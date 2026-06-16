"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type AiSettings = {
  enabled: boolean;
  provider: "anthropic" | "openrouter";
  model: string;
  baseUrl: string | null;
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
  apiKey: string | null;
};

type SettingsResponse = { persisted: boolean; ai: AiSettings };

const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (latest, best)" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fast, cheap)" },
    { value: "claude-opus-4-8", label: "Claude Opus 4.8 (most capable)" },
  ],
  openrouter: [
    { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "openai/gpt-4o", label: "GPT-4o" },
    { value: "anthropic/claude-3-5-haiku", label: "Claude 3.5 Haiku (via OpenRouter)" },
    { value: "google/gemini-flash-1.5", label: "Gemini Flash 1.5" },
    { value: "meta-llama/llama-3.1-8b-instruct:free", label: "Llama 3.1 8B (free tier)" },
    { value: "mistralai/mistral-7b-instruct:free", label: "Mistral 7B (free tier)" },
  ],
};

export default function AdminSettingsPage() {
  const [token, setToken] = useState<string>("");
  const [persisted, setPersisted] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiSettings | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("robo_admin_token");
      if (saved) setToken(saved);
    } catch { void 0; }
  }, []);

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h["x-admin-token"] = token;
    return h;
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/ai-settings", { headers });
    if (!res.ok) {
      setLoading(false);
      setError((await res.text()) || "Failed to load settings");
      return;
    }
    const data = (await res.json()) as SettingsResponse;
    setPersisted(data.persisted);
    setAi(data.ai);
    setLoading(false);
  }, [headers]);

  useEffect(() => { void load(); }, [load]);

  const onSave = useCallback(async () => {
    if (!ai) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      try { window.localStorage.setItem("robo_admin_token", token); } catch { void 0; }
      const res = await fetch("/api/admin/ai-settings", {
        method: "PUT",
        headers,
        body: JSON.stringify({ ai }),
      });
      if (!res.ok) {
        setError((await res.text()) || "Failed to save settings");
        setSaving(false);
        return;
      }
      const data = (await res.json()) as SettingsResponse;
      setPersisted(data.persisted);
      setAi(data.ai);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }, [ai, headers, token]);

  const isAnthropic = ai?.provider === "anthropic";

  return (
    <div className="px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white">AI Model Settings</h1>
        <p className="mt-2 text-slate-400 text-sm">
          Controls the LLM used for the Master Analyzer (business diagnosis + product matching).
        </p>

        {/* Admin token */}
        <div className="mt-6 flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-300 shrink-0">Admin token</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="h-10 w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm text-white"
            placeholder="ADMIN_TOKEN value"
            type="password"
            autoComplete="current-password"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="h-10 px-4 rounded-lg border border-slate-600 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Reload
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {saved && (
          <div className="mt-4 rounded-lg border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-teal">
            Settings saved successfully.
          </div>
        )}

        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-700">
            <div>
              <p className="font-semibold text-white">AI Analysis</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Disabling falls back to rule-based recommendations with no LLM calls.
              </p>
            </div>
            <label className="inline-flex items-center gap-3 cursor-pointer">
              <span className="text-sm font-semibold text-slate-300">{ai?.enabled ? "Enabled" : "Disabled"}</span>
              <button
                type="button"
                onClick={() => ai && setAi({ ...ai, enabled: !ai.enabled })}
                aria-label={ai?.enabled ? "Disable AI" : "Enable AI"}
                className={"relative w-12 h-7 rounded-full transition " + (ai?.enabled ? "bg-teal" : "bg-slate-600")}
              >
                <span className={"absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all " + (ai?.enabled ? "left-6" : "left-1")} />
              </button>
            </label>
          </div>

          {loading || !ai ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : (
            <div className="space-y-5">
              {/* Provider + Model */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Provider">
                  <select
                    value={ai.provider}
                    onChange={(e) =>
                      setAi({
                        ...ai,
                        provider: e.target.value as AiSettings["provider"],
                        model: PROVIDER_MODELS[e.target.value]?.[0]?.value ?? ai.model,
                        baseUrl: null,
                      })
                    }
                    className="h-11 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 text-sm text-slate-50"
                  >
                    <option value="anthropic">Anthropic (direct)</option>
                    <option value="openrouter">OpenRouter (proxy)</option>
                  </select>
                  {isAnthropic && (
                    <p className="mt-1 text-xs text-slate-400">
                      Uses <code className="font-mono text-teal">ANTHROPIC_API_KEY</code> env var if API key below is empty.
                    </p>
                  )}
                </Field>

                <Field label="Model">
                  <input
                    value={ai.model}
                    onChange={(e) => setAi({ ...ai, model: e.target.value })}
                    className="h-11 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 text-sm font-mono text-slate-50 placeholder:text-slate-300"
                    placeholder={isAnthropic ? "claude-haiku-4-5-20251001" : "openai/gpt-4o-mini"}
                    list="model-suggestions"
                    spellCheck={false}
                  />
                  <datalist id="model-suggestions">
                    {(PROVIDER_MODELS[ai.provider] ?? []).map((m) => (
                      <option key={m.value} value={m.value} label={m.label} />
                    ))}
                  </datalist>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(PROVIDER_MODELS[ai.provider] ?? []).map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setAi({ ...ai, model: m.value })}
                        className={
                          "text-xs px-2 py-0.5 rounded border transition " +
                          (ai.model === m.value
                            ? "border-teal bg-teal/15 text-teal"
                            : "border-slate-500 bg-slate-800/70 text-slate-200 hover:border-slate-300 hover:text-white")
                        }
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {/* Base URL — only relevant for OpenRouter */}
              {!isAnthropic && (
                <Field label="Base URL">
                  <input
                    value={ai.baseUrl ?? ""}
                    onChange={(e) => setAi({ ...ai, baseUrl: e.target.value.trim() || null })}
                    className="h-11 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 text-sm text-slate-50 placeholder:text-slate-300"
                    placeholder="https://openrouter.ai/api/v1"
                    spellCheck={false}
                  />
                </Field>
              )}

              {/* Tuning params */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Max output tokens">
                  <input
                    value={String(ai.maxOutputTokens)}
                    onChange={(e) => setAi({ ...ai, maxOutputTokens: Number(e.target.value || 0) })}
                    className="h-11 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 text-sm text-slate-50 placeholder:text-slate-300"
                    inputMode="numeric"
                    placeholder="4096"
                  />
                  <p className="mt-1 text-xs text-slate-300">Min 2048 - each analyzer pass needs up to 2K tokens.</p>
                </Field>
                <Field label="Temperature">
                  <input
                    value={String(ai.temperature)}
                    onChange={(e) => setAi({ ...ai, temperature: Number(e.target.value || 0) })}
                    className="h-11 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 text-sm text-slate-50 placeholder:text-slate-300"
                    inputMode="decimal"
                    placeholder="0.2"
                  />
                  <p className="mt-1 text-xs text-slate-300">0.2 recommended for structured JSON output.</p>
                </Field>
                <Field label="Per-call timeout (ms)">
                  <input
                    value={String(ai.timeoutMs)}
                    onChange={(e) => setAi({ ...ai, timeoutMs: Number(e.target.value || 0) })}
                    className="h-11 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 text-sm text-slate-50 placeholder:text-slate-300"
                    inputMode="numeric"
                    placeholder="60000"
                  />
                  <p className="mt-1 text-xs text-slate-300">60000 recommended. Analyzer runs 4 sequential passes.</p>
                </Field>
              </div>

              {/* API key */}
              <Field label={isAnthropic ? "Anthropic API key (optional — uses env var if empty)" : "OpenRouter API key"}>
                <input
                  value={ai.apiKey ?? ""}
                  onChange={(e) => setAi({ ...ai, apiKey: e.target.value || null })}
                  className="h-11 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 text-sm text-slate-50 placeholder:text-slate-300"
                  placeholder={isAnthropic ? "sk-ant-… (or leave blank to use ANTHROPIC_API_KEY env var)" : "sk-or-…"}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                />
                {ai.apiKey?.includes("•") && (
                  <p className="mt-1 text-xs text-slate-300">Currently: {ai.apiKey}</p>
                )}
              </Field>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-300">
                  Storage:{" "}
                  {persisted
                    ? "Encrypted file (.data/admin_settings.enc)"
                    : "In-memory only (set SETTINGS_ENCRYPTION_KEY to persist)"}
                </p>
                <button
                  type="button"
                  onClick={() => void onSave()}
                  disabled={saving}
                  className="h-11 px-6 rounded-lg bg-teal text-navy font-bold hover:brightness-110 transition disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save settings"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-slate-300 mb-2">{props.label}</div>
      {props.children}
    </label>
  );
}
