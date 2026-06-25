"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ProviderPoolEntry = {
  provider: "anthropic" | "openrouter" | "openai" | "gemini" | "deepseek" | "moonshot";
  model: string;
  baseUrl: string | null;
  apiKey: string | null;
};

type AiSettings = {
  enabled: boolean;
  provider: "anthropic" | "openrouter" | "openai" | "gemini" | "deepseek" | "moonshot";
  model: string;
  baseUrl: string | null;
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
  apiKey: string | null;
  poolStrategy: "off" | "cascade" | "race";
  providerPool: ProviderPoolEntry[];
};

type ScraperSettings = {
  provider: "playwright" | "scrapegraph";
  sgaiApiKey: string | null;
  sgaiTimeoutMs: number;
};

const FREE_MODEL_PRESETS: { label: string; entry: ProviderPoolEntry }[] = [
  { label: "Gemma 4 31B", entry: { provider: "openrouter", model: "google/gemma-4-31b-it:free", baseUrl: "https://openrouter.ai/api/v1", apiKey: null } },
  { label: "Nemotron 120B", entry: { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free", baseUrl: "https://openrouter.ai/api/v1", apiKey: null } },
  { label: "Qwen3 80B", entry: { provider: "openrouter", model: "qwen/qwen3-next-80b-a3b-instruct:free", baseUrl: "https://openrouter.ai/api/v1", apiKey: null } },
  { label: "Nex-N2 Pro", entry: { provider: "openrouter", model: "nex-agi/nex-n2-pro:free", baseUrl: "https://openrouter.ai/api/v1", apiKey: null } },
  { label: "Gemini 2.0 Flash", entry: { provider: "gemini", model: "gemini-2.0-flash", baseUrl: null, apiKey: null } },
  { label: "DeepSeek Chat", entry: { provider: "deepseek", model: "deepseek-chat", baseUrl: null, apiKey: null } },
];

type SettingsResponse = { persisted: boolean; ai: AiSettings; scraper: ScraperSettings };

const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (latest, best)" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fast, cheap)" },
    { value: "claude-opus-4-8", label: "Claude Opus 4.8 (most capable)" },
  ],
  openrouter: [
    { value: "google/gemma-4-31b-it:free", label: "Gemma 4 31B (free) — recommended" },
    { value: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super 120B (free) — most capable" },
    { value: "nex-agi/nex-n2-pro:free", label: "Nex-N2-Pro 397B MoE (free)" },
    { value: "qwen/qwen3-next-80b-a3b-instruct:free", label: "Qwen3 80B (free)" },
    { value: "openai/gpt-4o-mini", label: "GPT-4o Mini (paid)" },
    { value: "openai/gpt-4o", label: "GPT-4o (paid)" },
    { value: "anthropic/claude-3-5-haiku", label: "Claude 3.5 Haiku via OpenRouter (paid)" },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4o", label: "GPT-4o" },
  ],
  gemini: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash — free 15 RPM (recommended)" },
    { value: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash Preview — free 10 RPM" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash — free 15 RPM" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro — free 2 RPM (slow for 4 passes)" },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek Chat" },
    { value: "deepseek-reasoner", label: "DeepSeek Reasoner" },
  ],
  moonshot: [
    { value: "kimi-k2-0711-preview", label: "Kimi k2 (latest, requires temp=1)" },
    { value: "moonshot-v1-8k", label: "Moonshot v1 (8k)" },
    { value: "moonshot-v1-32k", label: "Moonshot v1 (32k)" },
    { value: "moonshot-v1-128k", label: "Moonshot v1 (128k)" },
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
  const [scraper, setScraper] = useState<ScraperSettings | null>(null);

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
    setScraper(data.scraper ?? { provider: "playwright", sgaiApiKey: null, sgaiTimeoutMs: 30000 });
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
        body: JSON.stringify({ ai, scraper }),
      });
      if (!res.ok) {
        setError((await res.text()) || "Failed to save settings");
        setSaving(false);
        return;
      }
      const data = (await res.json()) as SettingsResponse;
      setPersisted(data.persisted);
      setAi(data.ai);
      setScraper(data.scraper ?? { provider: "playwright", sgaiApiKey: null, sgaiTimeoutMs: 30000 });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }, [ai, scraper, headers, token]);

  const isAnthropic = ai?.provider === "anthropic";
  const baseUrlPlaceholder = (() => {
    if (!ai) return "";
    if (ai.provider === "openrouter") return "https://openrouter.ai/api/v1";
    if (ai.provider === "openai") return "https://api.openai.com/v1";
    if (ai.provider === "gemini") return "https://generativelanguage.googleapis.com/v1beta/openai";
    if (ai.provider === "deepseek") return "https://api.deepseek.com/v1";
    if (ai.provider === "moonshot") return "https://api.moonshot.cn/v1";
    return "";
  })();

  const apiKeyLabel = (() => {
    if (!ai) return "API key";
    if (ai.provider === "anthropic") return "Anthropic API key (optional — uses env var if empty)";
    if (ai.provider === "openrouter") return "OpenRouter API key";
    if (ai.provider === "openai") return "OpenAI API key";
    if (ai.provider === "gemini") return "Gemini API key";
    if (ai.provider === "deepseek") return "DeepSeek API key";
    if (ai.provider === "moonshot") return "Moonshot (Kimi) API key";
    return "API key";
  })();

  const apiKeyPlaceholder = (() => {
    if (!ai) return "";
    if (ai.provider === "anthropic") return "sk-ant-… (or leave blank to use ANTHROPIC_API_KEY env var)";
    if (ai.provider === "openrouter") return "sk-or-…";
    if (ai.provider === "openai") return "sk-…";
    if (ai.provider === "gemini") return "AIza…";
    if (ai.provider === "deepseek") return "sk-…";
    if (ai.provider === "moonshot") return "sk-…";
    return "";
  })();

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

        {/* Web Scraper settings */}
        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <h2 className="text-lg font-bold text-white mb-1">Web Scraper</h2>
          <p className="text-xs text-slate-400 mb-5">
            Controls how prospect websites are fetched. ScrapeGraph AI handles JS-rendered pages and anti-bot protection automatically.
          </p>

          {loading || !scraper ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : (
            <div className="space-y-5">
              {/* Provider selector */}
              <div className="flex gap-2">
                {(["playwright", "scrapegraph"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setScraper({ ...scraper, provider: p })}
                    className={
                      "px-4 py-2 rounded-lg border text-sm font-semibold transition " +
                      (scraper.provider === p
                        ? "bg-teal border-teal text-navy"
                        : "border-slate-600 text-slate-300 hover:border-slate-400")
                    }
                  >
                    {p === "playwright" ? "Playwright (built-in)" : "ScrapeGraph AI"}
                  </button>
                ))}
              </div>

              {scraper.provider === "playwright" && (
                <p className="text-xs text-slate-400">
                  Uses static fetch + Playwright headless + Zyte fallback. Requires Playwright installed locally or on your server. Good for most sites; may fail on heavy JS or bot-protected pages.
                </p>
              )}

              {scraper.provider === "scrapegraph" && (
                <>
                  <p className="text-xs text-slate-400">
                    ScrapeGraph AI cloud API — handles JS rendering, anti-bot bypass, and proxy rotation automatically. Get your API key at{" "}
                    <span className="text-teal font-mono">dashboard.scrapegraphai.com</span>.
                    Alternatively set <code className="font-mono text-teal">SGAI_API_KEY</code> as an env var.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="ScrapeGraph API key">
                      <input
                        value={scraper.sgaiApiKey ?? ""}
                        onChange={(e) => setScraper({ ...scraper, sgaiApiKey: e.target.value || null })}
                        className="h-11 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 text-sm text-slate-50 placeholder:text-slate-300"
                        placeholder="SGAI-…"
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {scraper.sgaiApiKey?.includes("•") && (
                        <p className="mt-1 text-xs text-slate-300">Currently: {scraper.sgaiApiKey}</p>
                      )}
                    </Field>
                    <Field label="Per-page timeout (ms)">
                      <input
                        value={String(scraper.sgaiTimeoutMs)}
                        onChange={(e) => setScraper({ ...scraper, sgaiTimeoutMs: Number(e.target.value || 30000) })}
                        className="h-11 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 text-sm text-slate-50 placeholder:text-slate-300"
                        inputMode="numeric"
                        placeholder="30000"
                      />
                      <p className="mt-1 text-xs text-slate-300">30000 ms recommended. ScrapeGraph renders JS before returning.</p>
                    </Field>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

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
                        baseUrl:
                          e.target.value === "anthropic"
                            ? null
                            : ((
                                p: string
                              ) => {
                                if (p === "openrouter") return "https://openrouter.ai/api/v1";
                                if (p === "openai") return "https://api.openai.com/v1";
                                if (p === "gemini") return "https://generativelanguage.googleapis.com/v1beta/openai";
                                if (p === "deepseek") return "https://api.deepseek.com/v1";
                                if (p === "moonshot") return "https://api.moonshot.cn/v1";
                                return null;
                              })(e.target.value),
                      })
                    }
                    className="h-11 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 text-sm text-slate-50"
                  >
                    <option value="anthropic">Anthropic (direct)</option>
                    <option value="openrouter">OpenRouter (proxy)</option>
                    <option value="openai">OpenAI (ChatGPT)</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="moonshot">Kimi (Moonshot)</option>
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
                    placeholder={baseUrlPlaceholder}
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
                  <p className="mt-1 text-xs text-slate-300">60000 for fast models (Anthropic/GPT). Use 120000 for slow models (Kimi k2, DeepSeek). Analyzer runs 4 sequential passes.</p>
                </Field>
              </div>

              {/* Provider Pool */}
              <div className="rounded-lg border border-slate-600 bg-slate-900/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Provider Pool</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      When a model is rate-limited or down, the pool automatically tries others.
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {(["off", "cascade", "race"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => ai && setAi({ ...ai, poolStrategy: s })}
                        className={
                          "px-3 py-1 rounded text-xs font-semibold transition border " +
                          (ai?.poolStrategy === s
                            ? "bg-teal border-teal text-navy"
                            : "border-slate-600 text-slate-300 hover:border-slate-400")
                        }
                      >
                        {s === "off" ? "Off" : s === "cascade" ? "Cascade" : "Race"}
                      </button>
                    ))}
                  </div>
                </div>

                {ai?.poolStrategy !== "off" && (
                  <>
                    <p className="text-xs text-slate-400">
                      {ai?.poolStrategy === "cascade"
                        ? "Cascade: tries each model in order until one responds. Saves API quota."
                        : "Race: fires all models in parallel, returns the fastest valid response. Best reliability."}
                    </p>

                    {/* Quick-add presets */}
                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-1.5">Quick-add free models:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {FREE_MODEL_PRESETS.map((preset) => {
                          const inPool = (ai?.providerPool ?? []).some((e) => e.model === preset.entry.model);
                          return (
                            <button
                              key={preset.entry.model}
                              type="button"
                              onClick={() => {
                                if (!ai) return;
                                if (inPool) {
                                  setAi({ ...ai, providerPool: ai.providerPool.filter((e) => e.model !== preset.entry.model) });
                                } else {
                                  setAi({ ...ai, providerPool: [...(ai.providerPool ?? []), preset.entry] });
                                }
                              }}
                              className={
                                "text-xs px-2.5 py-1 rounded border transition " +
                                (inPool
                                  ? "border-teal bg-teal/15 text-teal"
                                  : "border-slate-500 bg-slate-800 text-slate-300 hover:border-slate-300")
                              }
                            >
                              {inPool ? "✓ " : "+ "}{preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Current pool */}
                    {(ai?.providerPool ?? []).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-300 mb-1.5">
                          Pool ({ai?.poolStrategy === "cascade" ? "tried in order" : "all fired in parallel"}):
                        </p>
                        <div className="flex flex-col gap-1">
                          {(ai?.providerPool ?? []).map((entry, i) => (
                            <div key={i} className="flex items-center gap-2 rounded bg-slate-800 px-3 py-1.5">
                              <span className="text-xs text-slate-400 w-4 shrink-0">{i + 1}.</span>
                              <span className="text-xs font-mono text-slate-200 flex-1 truncate">{entry.model}</span>
                              <span className="text-xs text-slate-500 shrink-0">{entry.provider}</span>
                              <button
                                type="button"
                                onClick={() => ai && setAi({ ...ai, providerPool: ai.providerPool.filter((_, j) => j !== i) })}
                                className="text-slate-500 hover:text-red-400 text-xs ml-1 transition"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-1.5">
                          OpenRouter pool entries share your OpenRouter API key. Gemini/DeepSeek entries use their own env var or you can set a key below.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* API key */}
              <Field label={apiKeyLabel}>
                <input
                  value={ai.apiKey ?? ""}
                  onChange={(e) => setAi({ ...ai, apiKey: e.target.value || null })}
                  className="h-11 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 text-sm text-slate-50 placeholder:text-slate-300"
                  placeholder={apiKeyPlaceholder}
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
