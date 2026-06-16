"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ALLOWED_INTERPOLATION_VARS } from "@/lib/builder/builderSchemas";

type AgentConfig = {
  name: string;
  language: "en" | "es" | "bilingual";
  tone: "professional" | "friendly" | "formal" | "casual" | "empathetic";
  fallback: "escalate" | "apologise" | "redirect";
  system_prompt: string;
  rag_active: boolean;
  lead_capture: boolean;
  human_escalation: boolean;
  conversation_memory: boolean;
  bilingual_detect: boolean;
  model: string;
  max_tokens: number;
  temperature: number;
  voice: {
    service_sku: "none" | "vs-01" | "vs-02" | "vs-03";
    call_mode: "none" | "inbound" | "outbound" | "ivr";
    twilio_phone_number: string;
    retell_model: string;
    retell_voice: string;
    branded_caller_id: boolean;
    voicemail_detection: boolean;
    dtmf_capture: boolean;
    booking_enabled: boolean;
    booking_provider: "none" | "cal.com" | "google_calendar";
    booking_url: string;
    transfer_number: string;
    crm_provider: "none" | "hubspot" | "salesforce" | "csv";
    notion_sync: boolean;
    knowledge_sync_target: "none" | "retell+pgvector" | "pgvector";
  };
  integrations: {
    modal_enabled: boolean;
    stripe_provisioning: boolean;
    resend_digest: boolean;
    supabase_logging: boolean;
  };
};

type Agent = { id: string; type: "chatbot" | "voice" | "agent"; config: AgentConfig };

export default function BuilderStep4() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch(`/api/agents/${agentId}`);
      const a = (await res.json()) as Agent;
      if (!mounted) return;
      if (res.ok) setAgent(a);
    })().catch(() => {});
    return () => {
      mounted = false;
    };
  }, [agentId]);

  const patch = async (config: Partial<AgentConfig>) => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });
    const data = (await res.json()) as Agent | { error?: string };
    if (res.ok) {
      setAgent(data as Agent);
    } else {
      setError(("error" in data && data.error) || "Failed to save configuration");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-navy px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <div className="text-white font-syne text-3xl font-bold mb-1">AI Builder</div>
            <div className="text-slateText">Step 4 — Configure</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/builder/${agentId}/step3`)}
              className="h-11 px-5 rounded-lg border border-navy-500 text-white font-bold hover:border-teal/40 hover:text-teal transition"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => router.push(`/builder/${agentId}/step5`)}
              className="h-11 px-5 rounded-lg bg-teal text-navy font-bold hover:brightness-110 transition"
            >
              Continue
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-5 space-y-5">
          <div className="rounded-lg border border-navy-600 bg-navy-800/60 p-4">
            <div className="text-white font-semibold mb-2">Allowed variables</div>
            <div className="text-slateText text-sm leading-6">
              Use these variables in prompts and flow text:
              {" "}
              {ALLOWED_INTERPOLATION_VARS.map((v) => `{{${v}}}`).join(", ")}
            </div>
            <div className="text-slateText text-xs mt-2">
              Unknown variables are blocked when saving, per the CB100 validation rules.
            </div>
          </div>

          {error ? <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

          <div>
            <div className="text-white font-semibold mb-2">Agent name</div>
            <input
              value={agent?.config.name ?? ""}
              disabled={busy}
              onChange={(e) => setAgent((a) => (a ? { ...a, config: { ...a.config, name: e.target.value } } : a))}
              onBlur={async () => {
                if (!agent) return;
                await patch({ name: agent.config.name });
              }}
              className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-white font-semibold mb-2">Language</div>
              <select
                value={agent?.config.language ?? "en"}
                disabled={busy}
                onChange={(e) => void patch({ language: e.target.value as AgentConfig["language"] })}
                className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="bilingual">Bilingual</option>
              </select>
            </div>
            <div>
              <div className="text-white font-semibold mb-2">Tone</div>
              <select
                value={agent?.config.tone ?? "professional"}
                disabled={busy}
                onChange={(e) => void patch({ tone: e.target.value as AgentConfig["tone"] })}
                className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
                <option value="empathetic">Empathetic</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <div className="text-white font-semibold mb-2">Fallback</div>
              <select
                value={agent?.config.fallback ?? "escalate"}
                disabled={busy}
                onChange={(e) => void patch({ fallback: e.target.value as AgentConfig["fallback"] })}
                className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
              >
                <option value="escalate">Escalate</option>
                <option value="apologise">Apologise</option>
                <option value="redirect">Redirect</option>
              </select>
            </div>
            <div>
              <div className="text-white font-semibold mb-2">Model</div>
              <input
                value={agent?.config.model ?? "auto"}
                disabled={busy}
                onChange={(e) => setAgent((a) => (a ? { ...a, config: { ...a.config, model: e.target.value } } : a))}
                onBlur={async () => {
                  if (!agent) return;
                  await patch({ model: agent.config.model });
                }}
                className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
              />
            </div>
            <div>
              <div className="text-white font-semibold mb-2">Max tokens</div>
              <input
                type="number"
                value={agent?.config.max_tokens ?? 1024}
                disabled={busy}
                onChange={(e) =>
                  setAgent((a) => (a ? { ...a, config: { ...a.config, max_tokens: Number(e.target.value || 1024) } } : a))
                }
                onBlur={async () => {
                  if (!agent) return;
                  await patch({ max_tokens: agent.config.max_tokens });
                }}
                className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
              />
            </div>
          </div>

          <div>
            <div className="text-white font-semibold mb-2">System prompt</div>
            <textarea
              value={agent?.config.system_prompt ?? ""}
              disabled={busy}
              onChange={(e) => setAgent((a) => (a ? { ...a, config: { ...a.config, system_prompt: e.target.value } } : a))}
              onBlur={async () => {
                if (!agent) return;
                await patch({ system_prompt: agent.config.system_prompt });
              }}
              className="w-full min-h-[160px] rounded-lg bg-navy-800 border border-navy-600 px-3 py-2 text-white"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={agent?.config.rag_active ?? false}
                disabled={busy}
                onChange={(e) => void patch({ rag_active: e.target.checked })}
              />
              RAG active
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={agent?.config.lead_capture ?? false}
                disabled={busy}
                onChange={(e) => void patch({ lead_capture: e.target.checked })}
              />
              Lead capture
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={agent?.config.human_escalation ?? false}
                disabled={busy}
                onChange={(e) => void patch({ human_escalation: e.target.checked })}
              />
              Human escalation
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={agent?.config.conversation_memory ?? false}
                disabled={busy}
                onChange={(e) => void patch({ conversation_memory: e.target.checked })}
              />
              Conversation memory
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={agent?.config.bilingual_detect ?? false}
                disabled={busy}
                onChange={(e) => void patch({ bilingual_detect: e.target.checked })}
              />
              Auto language detect
            </label>
          </div>

          <div>
            <div className="text-white font-semibold mb-2">Temperature</div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={agent?.config.temperature ?? 0.3}
              disabled={busy}
              onChange={(e) =>
                setAgent((a) => (a ? { ...a, config: { ...a.config, temperature: Number(e.target.value) } } : a))
              }
              onMouseUp={async () => {
                if (!agent) return;
                await patch({ temperature: agent.config.temperature });
              }}
              className="w-full"
            />
            <div className="text-slateText text-xs mt-1">{(agent?.config.temperature ?? 0.3).toFixed(2)}</div>
          </div>

          {agent?.type === "voice" ? (
            <div className="rounded-lg border border-teal/30 bg-teal/5 p-4 space-y-4">
              <div className="text-white font-semibold">AVA Voice Configuration</div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-white font-semibold mb-2">Service</div>
                  <select
                    value={agent.config.voice.service_sku}
                    disabled={busy}
                    onChange={(e) =>
                      void patch({
                        voice: {
                          ...agent.config.voice,
                          service_sku: e.target.value as AgentConfig["voice"]["service_sku"],
                        },
                      })
                    }
                    className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                  >
                    <option value="vs-01">VS-01 Voice Secretary</option>
                    <option value="vs-02">VS-02 Leads Hunter</option>
                    <option value="vs-03">VS-03 IVR Routing</option>
                  </select>
                </div>
                <div>
                  <div className="text-white font-semibold mb-2">Call mode</div>
                  <select
                    value={agent.config.voice.call_mode}
                    disabled={busy}
                    onChange={(e) =>
                      void patch({
                        voice: {
                          ...agent.config.voice,
                          call_mode: e.target.value as AgentConfig["voice"]["call_mode"],
                        },
                      })
                    }
                    className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                  >
                    <option value="inbound">Inbound</option>
                    <option value="outbound">Outbound</option>
                    <option value="ivr">IVR</option>
                  </select>
                </div>
                <div>
                  <div className="text-white font-semibold mb-2">Knowledge sync</div>
                  <select
                    value={agent.config.voice.knowledge_sync_target}
                    disabled={busy}
                    onChange={(e) =>
                      void patch({
                        voice: {
                          ...agent.config.voice,
                          knowledge_sync_target: e.target.value as AgentConfig["voice"]["knowledge_sync_target"],
                        },
                      })
                    }
                    className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                  >
                    <option value="retell+pgvector">Retell + pgvector</option>
                    <option value="pgvector">pgvector only</option>
                    <option value="none">Disabled</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-white font-semibold mb-2">Retell model</div>
                  <input
                    value={agent.config.voice.retell_model}
                    disabled={busy}
                    onChange={(e) =>
                      setAgent((a) =>
                        a ? { ...a, config: { ...a.config, voice: { ...a.config.voice, retell_model: e.target.value } } } : a
                      )
                    }
                    onBlur={async () => {
                      if (!agent) return;
                      await patch({ voice: agent.config.voice });
                    }}
                    className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                  />
                </div>
                <div>
                  <div className="text-white font-semibold mb-2">Retell voice</div>
                  <input
                    value={agent.config.voice.retell_voice}
                    disabled={busy}
                    onChange={(e) =>
                      setAgent((a) =>
                        a ? { ...a, config: { ...a.config, voice: { ...a.config.voice, retell_voice: e.target.value } } } : a
                      )
                    }
                    onBlur={async () => {
                      if (!agent) return;
                      await patch({ voice: agent.config.voice });
                    }}
                    className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <div className="text-white font-semibold mb-2">Booking provider</div>
                  <select
                    value={agent.config.voice.booking_provider}
                    disabled={busy}
                    onChange={(e) =>
                      void patch({
                        voice: {
                          ...agent.config.voice,
                          booking_provider: e.target.value as AgentConfig["voice"]["booking_provider"],
                        },
                      })
                    }
                    className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                  >
                    <option value="none">None</option>
                    <option value="cal.com">Cal.com</option>
                    <option value="google_calendar">Google Calendar</option>
                  </select>
                </div>
                <div>
                  <div className="text-white font-semibold mb-2">CRM</div>
                  <select
                    value={agent.config.voice.crm_provider}
                    disabled={busy}
                    onChange={(e) =>
                      void patch({
                        voice: {
                          ...agent.config.voice,
                          crm_provider: e.target.value as AgentConfig["voice"]["crm_provider"],
                        },
                      })
                    }
                    className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                  >
                    <option value="none">None</option>
                    <option value="hubspot">HubSpot</option>
                    <option value="salesforce">Salesforce</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>
                <div>
                  <div className="text-white font-semibold mb-2">Twilio number</div>
                  <input
                    value={agent.config.voice.twilio_phone_number}
                    disabled={busy}
                    onChange={(e) =>
                      setAgent((a) =>
                        a ? { ...a, config: { ...a.config, voice: { ...a.config.voice, twilio_phone_number: e.target.value } } } : a
                      )
                    }
                    onBlur={async () => {
                      if (!agent) return;
                      await patch({ voice: agent.config.voice });
                    }}
                    placeholder="+1... or leave blank for env default"
                    className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                  />
                </div>
                <div>
                  <div className="text-white font-semibold mb-2">Transfer number</div>
                  <input
                    value={agent.config.voice.transfer_number}
                    disabled={busy}
                    onChange={(e) =>
                      setAgent((a) =>
                        a ? { ...a, config: { ...a.config, voice: { ...a.config.voice, transfer_number: e.target.value } } } : a
                      )
                    }
                    onBlur={async () => {
                      if (!agent) return;
                      await patch({ voice: agent.config.voice });
                    }}
                    placeholder="+1..."
                    className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                  />
                </div>
              </div>
              <div className="text-slateText text-xs -mt-1">
                Twilio caller number defaults to `TWILIO_PHONE_NUMBER` from `.env`, but you can override it per voice agent here.
              </div>

              <div>
                <div className="text-white font-semibold mb-2">Booking URL</div>
                <input
                  value={agent.config.voice.booking_url}
                  disabled={busy}
                  onChange={(e) =>
                    setAgent((a) =>
                      a ? { ...a, config: { ...a.config, voice: { ...a.config.voice, booking_url: e.target.value } } } : a
                    )
                  }
                  onBlur={async () => {
                    if (!agent) return;
                    await patch({ voice: agent.config.voice });
                  }}
                  placeholder="https://cal.com/..."
                  className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={agent.config.voice.booking_enabled}
                    disabled={busy}
                    onChange={(e) => void patch({ voice: { ...agent.config.voice, booking_enabled: e.target.checked } })}
                  />
                  Booking enabled
                </label>
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={agent.config.voice.branded_caller_id}
                    disabled={busy}
                    onChange={(e) => void patch({ voice: { ...agent.config.voice, branded_caller_id: e.target.checked } })}
                  />
                  Branded caller ID
                </label>
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={agent.config.voice.voicemail_detection}
                    disabled={busy}
                    onChange={(e) => void patch({ voice: { ...agent.config.voice, voicemail_detection: e.target.checked } })}
                  />
                  Voicemail detection
                </label>
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={agent.config.voice.dtmf_capture}
                    disabled={busy}
                    onChange={(e) => void patch({ voice: { ...agent.config.voice, dtmf_capture: e.target.checked } })}
                  />
                  DTMF capture
                </label>
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={agent.config.voice.notion_sync}
                    disabled={busy}
                    onChange={(e) => void patch({ voice: { ...agent.config.voice, notion_sync: e.target.checked } })}
                  />
                  Notion sync
                </label>
              </div>

              <div className="rounded-lg border border-navy-600 bg-navy-800/60 p-4">
                <div className="text-white font-semibold mb-3">Shared integrations</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={agent.config.integrations.modal_enabled}
                      disabled={busy}
                      onChange={(e) =>
                        void patch({ integrations: { ...agent.config.integrations, modal_enabled: e.target.checked } })
                      }
                    />
                    Modal orchestration
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={agent.config.integrations.stripe_provisioning}
                      disabled={busy}
                      onChange={(e) =>
                        void patch({ integrations: { ...agent.config.integrations, stripe_provisioning: e.target.checked } })
                      }
                    />
                    Stripe provisioning
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={agent.config.integrations.resend_digest}
                      disabled={busy}
                      onChange={(e) =>
                        void patch({ integrations: { ...agent.config.integrations, resend_digest: e.target.checked } })
                      }
                    />
                    Resend digests
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={agent.config.integrations.supabase_logging}
                      disabled={busy}
                      onChange={(e) =>
                        void patch({ integrations: { ...agent.config.integrations, supabase_logging: e.target.checked } })
                      }
                    />
                    Supabase logging
                  </label>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
