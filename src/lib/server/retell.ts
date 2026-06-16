import Retell from "retell-sdk";
import type { AgentCreateParams, AgentUpdateParams } from "retell-sdk/resources/agent";
import type { CallCreateWebCallParams, CallResponse } from "retell-sdk/resources/call";
import type { LlmCreateParams, LlmUpdateParams } from "retell-sdk/resources/llm";
import { getAgent, searchKb, updateAgent, type BuilderAgent } from "@/lib/server/builderStore";
import { loadAdminSettings } from "@/lib/server/adminSettings";

type RetellProvisionResult = {
  builder_agent: BuilderAgent;
  retell_agent_id: string;
  retell_llm_id: string;
  retell_model: string;
  retell_voice_id: string;
  synced_at: string;
};

type RetellWebCallResult = RetellProvisionResult & {
  call_id: string;
  access_token: string;
  call_status: string;
};

const RETELL_VOICE_ALIASES: Record<string, string> = {
  "default-voice": "retell-Cimo",
  "professional-receptionist": "retell-Cimo",
  "sales-outreach": "retell-Cimo",
  "ivr-router": "retell-Cimo",
};

const DEFAULT_RETELL_MODEL: NonNullable<LlmCreateParams["model"]> = "gpt-4.1-mini";

function getRetellClient(): Retell {
  const apiKey = process.env.RETELL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RETELL_API_KEY is missing.");
  }
  return new Retell({ apiKey });
}

function mapLanguage(language: BuilderAgent["config"]["language"]): NonNullable<AgentCreateParams["language"]> {
  if (language === "es") return "es-ES";
  if (language === "bilingual") return "multi";
  return "en-US";
}

function normalizeRetellModel(model: string): NonNullable<LlmCreateParams["model"]> {
  const value = model.trim().toLowerCase();
  if (!value || value === "auto") return DEFAULT_RETELL_MODEL;

  const normalized = value.includes("/") ? value.split("/").pop() ?? value : value;
  const mapped: Record<string, NonNullable<LlmCreateParams["model"]>> = {
    "gpt-4.1": "gpt-4.1",
    "gpt-4.1-mini": "gpt-4.1-mini",
    "gpt-4.1-nano": "gpt-4.1-nano",
    "gpt-4o": "gpt-4.1",
    "gpt-4o-mini": "gpt-4.1-mini",
    "gpt-5": "gpt-5",
    "gpt-5-mini": "gpt-5-mini",
    "gpt-5-nano": "gpt-5-nano",
    "claude-3-5-haiku": "claude-4.5-haiku",
    "claude-3.5-haiku": "claude-4.5-haiku",
    "claude-3-5-sonnet": "claude-4.5-sonnet",
    "claude-3.5-sonnet": "claude-4.5-sonnet",
    "claude-4.5-sonnet": "claude-4.5-sonnet",
    "claude-4.5-haiku": "claude-4.5-haiku",
    "claude-4.6-sonnet": "claude-4.6-sonnet",
    "gemini-2.0-flash": "gemini-3.0-flash",
    "gemini-2.0-flash-lite": "gemini-2.5-flash-lite",
    "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
    "gemini-3.0-flash": "gemini-3.0-flash",
    "gemini-3.1-flash-lite": "gemini-3.1-flash-lite",
  };

  return mapped[normalized] ?? DEFAULT_RETELL_MODEL;
}

function normalizeRetellVoiceId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return process.env.RETELL_DEFAULT_VOICE?.trim() || "retell-Cimo";
  if (/^(retell|11labs|openai|cartesia|deepgram)-/i.test(trimmed)) return trimmed;
  return RETELL_VOICE_ALIASES[trimmed] ?? process.env.RETELL_DEFAULT_VOICE?.trim() ?? "retell-Cimo";
}

function buildKnowledgeSummary(agent: BuilderAgent): string {
  if (!agent.config.rag_active) return "";
  const kbChunks = searchKb(agent.id, `${agent.config.name} ${agent.config.system_prompt}`, 8);
  if (!kbChunks.length) return "";

  const snippets: string[] = [];
  let totalChars = 0;
  for (const chunk of kbChunks) {
    const next = `[${chunk.source}]\n${chunk.content.trim()}`;
    totalChars += next.length;
    if (totalChars > 6000) break;
    snippets.push(next);
  }
  return snippets.join("\n\n");
}

function buildFunctionNotes(agent: BuilderAgent): string {
  const functions = agent.flow_graph.nodes
    .filter((node) => node.type === "tool_call")
    .map((node) => {
      const description = typeof node.properties.description === "string" ? node.properties.description.trim() : "";
      const trigger = typeof node.properties.trigger === "string" ? node.properties.trigger.trim() : "";
      const enabled = node.properties.enabled !== false;
      if (!enabled) return null;
      return `- ${node.label}${trigger ? ` [trigger: ${trigger}]` : ""}${description ? `: ${description}` : ""}`;
    })
    .filter((item): item is string => Boolean(item));
  return functions.join("\n");
}

async function resolvePreferredRetellModel(agent: BuilderAgent): Promise<NonNullable<LlmCreateParams["model"]>> {
  const { stored } = await loadAdminSettings();
  const adminFallback = normalizeRetellModel(stored.ai.model);
  const preferred = normalizeRetellModel(agent.config.voice.retell_model || agent.config.model || stored.ai.model);
  return preferred || adminFallback || DEFAULT_RETELL_MODEL;
}

async function buildLlmPayload(agent: BuilderAgent): Promise<LlmCreateParams> {
  const functionNotes = buildFunctionNotes(agent);
  const kbSummary = buildKnowledgeSummary(agent);
  const model = await resolvePreferredRetellModel(agent);
  const generalPrompt = [
    agent.config.system_prompt.trim(),
    `Business language: ${agent.config.language}.`,
    `Conversation tone: ${agent.config.tone}.`,
    `Fallback behavior: ${agent.config.fallback}.`,
    functionNotes ? `Available functions:\n${functionNotes}` : "",
    kbSummary ? `Business knowledge:\n${kbSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const tools: NonNullable<LlmCreateParams["general_tools"]> = [
    {
      type: "end_call",
      name: "end_call",
      description: "End the call when the customer confirms the conversation is complete.",
    },
  ];

  if (agent.config.voice.transfer_number.trim()) {
    tools.push({
      type: "transfer_call",
      name: "transfer_to_human",
      description: "Transfer the caller to a human teammate when they request escalation or the prompt requires it.",
      transfer_destination: {
        type: "predefined",
        number: agent.config.voice.transfer_number.trim(),
      },
      transfer_option: {
        type: "cold_transfer",
      },
      speak_during_execution: true,
      execution_message_description: "Please hold while I connect you to a teammate.",
      execution_message_type: "static_text",
    });
  }

  return {
    model,
    model_temperature: agent.config.temperature,
    model_high_priority: true,
    tool_call_strict_mode: true,
    general_prompt: generalPrompt,
    general_tools: tools,
    begin_message: "",
    start_speaker: "user",
    begin_after_user_silence_ms: 1200,
  };
}

function buildAgentPayload(agent: BuilderAgent, llmId: string): AgentCreateParams {
  return {
    agent_name: agent.config.name,
    voice_id: normalizeRetellVoiceId(agent.config.voice.retell_voice),
    response_engine: {
      type: "retell-llm",
      llm_id: llmId,
    },
    language: mapLanguage(agent.config.language),
    webhook_url: `${(process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/agents/${agent.id}/voice/provision`,
    data_storage_setting: "everything",
    begin_message_delay_ms: 0,
    enable_backchannel: true,
    interruption_sensitivity: 0.85,
    responsiveness: 0.9,
    allow_user_dtmf: agent.config.voice.dtmf_capture,
    end_call_after_silence_ms: 600000,
    max_call_duration_ms: 1800000,
    denoising_mode: "noise-cancellation",
  };
}

export async function syncRetellAgent(agentId: string): Promise<RetellProvisionResult> {
  const agent = getAgent(agentId);
  if (!agent) throw new Error("Builder agent not found.");
  if (agent.type !== "voice") throw new Error("Only voice agents can sync with Retell.");

  const client = getRetellClient();
  const llmPayload = await buildLlmPayload(agent);

  let llmId = agent.config.voice.retell_llm_id.trim();
  const llmResponse = llmId
    ? await client.llm.update(llmId, llmPayload as LlmUpdateParams).catch(async () => {
        llmId = "";
        return client.llm.create(llmPayload);
      })
    : await client.llm.create(llmPayload);
  llmId = llmResponse.llm_id;

  const agentPayload = buildAgentPayload(agent, llmId);
  let retellAgentId = agent.config.voice.retell_agent_id.trim();
  const remoteAgent = retellAgentId
    ? await client.agent.update(retellAgentId, agentPayload as AgentUpdateParams).catch(async () => {
        retellAgentId = "";
        return client.agent.create(agentPayload);
      })
    : await client.agent.create(agentPayload);
  retellAgentId = remoteAgent.agent_id;

  const syncedAt = new Date().toISOString();
  const updated =
    updateAgent({
      agent_id: agent.id,
      patch: {
        config: {
          voice: {
            ...agent.config.voice,
            retell_agent_id: retellAgentId,
            retell_llm_id: llmId,
            retell_last_synced_at: syncedAt,
          },
        },
      },
    }) ?? getAgent(agent.id);

  if (!updated) throw new Error("Failed to persist Retell sync state.");

  return {
    builder_agent: updated,
    retell_agent_id: retellAgentId,
    retell_llm_id: llmId,
    retell_model: llmPayload.model ?? DEFAULT_RETELL_MODEL,
    retell_voice_id: agentPayload.voice_id,
    synced_at: syncedAt,
  };
}

export async function createRetellWebCall(input: {
  agentId: string;
  metadata?: CallCreateWebCallParams["metadata"];
  retell_llm_dynamic_variables?: CallCreateWebCallParams["retell_llm_dynamic_variables"];
}): Promise<RetellWebCallResult> {
  const provisioned = await syncRetellAgent(input.agentId);
  const client = getRetellClient();
  const webCall = await client.call.createWebCall({
    agent_id: provisioned.retell_agent_id,
    metadata: input.metadata,
    retell_llm_dynamic_variables: input.retell_llm_dynamic_variables,
  });

  return {
    ...provisioned,
    call_id: webCall.call_id,
    access_token: webCall.access_token,
    call_status: webCall.call_status,
  };
}

export async function retrieveRetellCall(callId: string): Promise<CallResponse> {
  const client = getRetellClient();
  return client.call.retrieve(callId);
}
