import { randomUUID, createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type AgentType = "chatbot" | "voice" | "agent";
export type AgentStatus = "draft" | "testing" | "live" | "archived";
export type AgentTone = "professional" | "friendly" | "formal" | "casual" | "empathetic";
export type AgentLanguage = "en" | "es" | "bilingual";
export type FallbackBehaviour = "escalate" | "apologise" | "redirect";
export type ExportFormat = "mcp" | "api" | "widget" | "rawcode";
export type VoiceServiceSku = "none" | "vs-01" | "vs-02" | "vs-03";
export type VoiceCallMode = "none" | "inbound" | "outbound" | "ivr";
export type BookingProvider = "none" | "cal.com" | "google_calendar";
export type CrmProvider = "none" | "hubspot" | "salesforce" | "csv";
export type KnowledgeSyncTarget = "none" | "retell+pgvector" | "pgvector";

export type VoiceConfig = {
  service_sku: VoiceServiceSku;
  call_mode: VoiceCallMode;
  voice_provider: "retell";
  telephony_provider: "twilio";
  twilio_phone_number: string;
  retell_model: string;
  retell_voice: string;
  retell_agent_id: string;
  retell_llm_id: string;
  retell_last_synced_at: string;
  branded_caller_id: boolean;
  voicemail_detection: boolean;
  dtmf_capture: boolean;
  booking_enabled: boolean;
  booking_provider: BookingProvider;
  booking_url: string;
  transfer_number: string;
  crm_provider: CrmProvider;
  notion_sync: boolean;
  knowledge_sync_target: KnowledgeSyncTarget;
};

export type IntegrationConfig = {
  modal_enabled: boolean;
  stripe_provisioning: boolean;
  resend_digest: boolean;
  supabase_logging: boolean;
};

export type AgentConfig = {
  name: string;
  language: AgentLanguage;
  tone: AgentTone;
  fallback: FallbackBehaviour;
  conversation_starter: "assistant" | "visitor";
  system_prompt: string;
  rag_active: boolean;
  lead_capture: boolean;
  human_escalation: boolean;
  conversation_memory: boolean;
  bilingual_detect: boolean;
  model: string;
  max_tokens: number;
  temperature: number;
  voice: VoiceConfig;
  integrations: IntegrationConfig;
};

export type FlowNodeType =
  | "start"
  | "message"
  | "listen"
  | "intent_router"
  | "rag_lookup"
  | "condition"
  | "tool_call"
  | "escalate"
  | "end";

export type FlowNode = {
  id: string;
  type: FlowNodeType;
  label: string;
  order: number;
  properties: Record<string, unknown>;
};

export type FlowGraph = {
  nodes: FlowNode[];
  edges: Array<{ from: string; to: string; label?: string }>;
};

export type BuilderAgent = {
  id: string;
  profile_id: string;
  created_at: string;
  updated_at: string;
  status: AgentStatus;
  type: AgentType;
  template_id: string;
  config: AgentConfig;
  flow_graph: FlowGraph;
  config_hash: string | null;
  published_at: string | null;
  /**
   * Immutable snapshot captured at publish time.
   * Runtime "live" mode and exports must use this snapshot, never the draft.
   */
  published_snapshot: { config: AgentConfig; flow_graph: FlowGraph } | null;
};

export type KbSourceType = "intake" | "scrape" | "report" | "upload" | "url" | "text";
export type KbSourceStatus = "queued" | "processing" | "indexed" | "failed" | "error";
export type KbSourceFailureType = "extraction_empty" | "unsupported_type" | "too_large" | "unknown";

export type KbSource = {
  id: string;
  agent_id: string;
  name: string;
  type: KbSourceType;
  status: KbSourceStatus;
  failure_type: KbSourceFailureType | null;
  chunk_count: number;
  size_bytes: number;
  source_url: string | null;
  error_message: string | null;
  indexed_at: string | null;
  created_at: string;
};

export type KbChunk = {
  id: string;
  source_id: string;
  agent_id: string;
  content: string;
  token_count: number;
  chunk_index: number;
  created_at: string;
};

export type ExportArtefact = {
  id: string;
  agent_id: string;
  format: ExportFormat;
  version: number;
  config_hash: string;
  artefact_data: Record<string, unknown>;
  created_at: string;
};

export type VoiceTestResult = {
  id: string;
  agent_id: string;
  created_at: string;
  mode: "audio" | "llm";
  prompt: string;
  call_id: string | null;
  transcript: Array<{ speaker: "caller" | "assistant"; text: string }>;
  summary: string | null;
  recording_url: string | null;
  rag_chunks: Array<{ content: string; source: string }>;
  metadata: {
    latency_ms: number;
    provider: string;
    model: string;
    llm_provider?: string;
    llm_model?: string;
    backup_model?: string | null;
    backup_used?: boolean;
  };
};

type Store = {
  agents: Map<string, BuilderAgent>;
  kbSources: Map<string, KbSource>;
  kbChunks: Map<string, KbChunk>;
  exports: Map<string, ExportArtefact[]>;
  voiceTests: Map<string, VoiceTestResult[]>;
};

type PersistedStore = {
  v: 2;
  agents: Array<[string, BuilderAgent]>;
  kbSources: Array<[string, KbSource]>;
  kbChunks: Array<[string, KbChunk]>;
  exports: Array<[string, ExportArtefact[]]>;
  voiceTests: Array<[string, VoiceTestResult[]]>;
};

function storeFilePath(): string {
  return path.join(process.cwd(), ".data", "builder_store.json");
}

function persistStore(store: Store): void {
  try {
    const outDir = path.join(process.cwd(), ".data");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const payload: PersistedStore = {
      v: 2,
      agents: Array.from(store.agents.entries()),
      kbSources: Array.from(store.kbSources.entries()),
      kbChunks: Array.from(store.kbChunks.entries()),
      exports: Array.from(store.exports.entries()),
      voiceTests: Array.from(store.voiceTests.entries()),
    };
    writeFileSync(storeFilePath(), JSON.stringify(payload), "utf-8");
  } catch {
    return;
  }
}

function schedulePersist(store: Store): void {
  if (process.env.NODE_ENV === "production") return;
  const g = globalThis as unknown as { __roboBuilderStorePersistTimer?: NodeJS.Timeout };
  if (g.__roboBuilderStorePersistTimer) return;
  g.__roboBuilderStorePersistTimer = setTimeout(() => {
    g.__roboBuilderStorePersistTimer = undefined;
    persistStore(store);
  }, 200);
}

function getStore(): Store {
  const g = globalThis as unknown as { __roboBuilderStore?: Store; __roboBuilderStoreLoaded?: boolean };
  if (!g.__roboBuilderStore) {
    g.__roboBuilderStore = {
      agents: new Map(),
      kbSources: new Map(),
      kbChunks: new Map(),
      exports: new Map(),
      voiceTests: new Map(),
    };
  }
  if (!g.__roboBuilderStoreLoaded && process.env.NODE_ENV !== "production") {
    g.__roboBuilderStoreLoaded = true;
    try {
      const fp = storeFilePath();
      if (existsSync(fp)) {
        const raw = readFileSync(fp, "utf-8");
        const parsed = JSON.parse(raw) as PersistedStore;
        if (parsed && ((parsed.v as number) === 1 || parsed.v === 2)) {
          g.__roboBuilderStore.agents = new Map(parsed.agents ?? []);
          g.__roboBuilderStore.kbSources = new Map(parsed.kbSources ?? []);
          g.__roboBuilderStore.kbChunks = new Map(parsed.kbChunks ?? []);
          g.__roboBuilderStore.exports = new Map(parsed.exports ?? []);
          g.__roboBuilderStore.voiceTests = new Map(("voiceTests" in parsed ? parsed.voiceTests : []) ?? []);
        }
      }
    } catch {
      void 0;
    }
  }
  return g.__roboBuilderStore;
}

export const TEMPLATE_DEFAULTS: Record<
  string,
  { type: AgentType; product_id: string; config: Partial<AgentConfig> }
> = {
  "TPL-01": {
    type: "chatbot",
    product_id: "CB-01",
    config: { tone: "friendly", language: "bilingual", rag_active: true, lead_capture: true, human_escalation: true },
  },
  "TPL-02": {
    type: "voice",
    product_id: "AVA-01",
    config: {
      tone: "professional",
      language: "bilingual",
      rag_active: true,
      lead_capture: false,
      human_escalation: true,
      model: "claude-3-5-sonnet",
      voice: {
        service_sku: "vs-01",
        call_mode: "inbound",
        voice_provider: "retell",
        telephony_provider: "twilio",
        twilio_phone_number: process.env.TWILIO_PHONE_NUMBER ?? "",
        retell_model: "claude-3-5-sonnet",
        retell_voice: "professional-receptionist",
        retell_agent_id: "",
        retell_llm_id: "",
        retell_last_synced_at: "",
        branded_caller_id: false,
        voicemail_detection: true,
        dtmf_capture: false,
        booking_enabled: true,
        booking_provider: "cal.com",
        booking_url: process.env.CALENDAR_BOOKING_URL ?? process.env.NEXT_PUBLIC_CALENDAR_BOOKING_URL ?? "",
        transfer_number: "",
        crm_provider: "none",
        notion_sync: false,
        knowledge_sync_target: "retell+pgvector",
      },
      integrations: {
        modal_enabled: true,
        stripe_provisioning: true,
        resend_digest: true,
        supabase_logging: true,
      },
    },
  },
  "TPL-03": {
    type: "agent",
    product_id: "CA-01",
    config: { tone: "professional", language: "en", rag_active: true, lead_capture: false, human_escalation: false },
  },
  "TPL-04": {
    type: "chatbot",
    product_id: "CB-01",
    config: { tone: "friendly", language: "bilingual", rag_active: false, lead_capture: true, human_escalation: true },
  },
  "TPL-05": {
    type: "voice",
    product_id: "AVA-01",
    config: {
      tone: "professional",
      language: "bilingual",
      rag_active: true,
      lead_capture: true,
      human_escalation: false,
      model: "claude-3-5-haiku",
      voice: {
        service_sku: "vs-02",
        call_mode: "outbound",
        voice_provider: "retell",
        telephony_provider: "twilio",
        twilio_phone_number: process.env.TWILIO_PHONE_NUMBER ?? "",
        retell_model: "claude-3-5-haiku",
        retell_voice: "sales-outreach",
        retell_agent_id: "",
        retell_llm_id: "",
        retell_last_synced_at: "",
        branded_caller_id: true,
        voicemail_detection: true,
        dtmf_capture: false,
        booking_enabled: true,
        booking_provider: "cal.com",
        booking_url: process.env.CALENDAR_BOOKING_URL ?? process.env.NEXT_PUBLIC_CALENDAR_BOOKING_URL ?? "",
        transfer_number: "",
        crm_provider: "hubspot",
        notion_sync: false,
        knowledge_sync_target: "retell+pgvector",
      },
      integrations: {
        modal_enabled: true,
        stripe_provisioning: true,
        resend_digest: false,
        supabase_logging: true,
      },
    },
  },
  "TPL-07": {
    type: "voice",
    product_id: "AVA-01",
    config: {
      tone: "professional",
      language: "bilingual",
      rag_active: true,
      lead_capture: false,
      human_escalation: true,
      model: "claude-3-5-haiku",
      voice: {
        service_sku: "vs-03",
        call_mode: "ivr",
        voice_provider: "retell",
        telephony_provider: "twilio",
        twilio_phone_number: process.env.TWILIO_PHONE_NUMBER ?? "",
        retell_model: "claude-3-5-haiku",
        retell_voice: "ivr-router",
        retell_agent_id: "",
        retell_llm_id: "",
        retell_last_synced_at: "",
        branded_caller_id: false,
        voicemail_detection: true,
        dtmf_capture: true,
        booking_enabled: false,
        booking_provider: "none",
        booking_url: "",
        transfer_number: "",
        crm_provider: "none",
        notion_sync: false,
        knowledge_sync_target: "retell+pgvector",
      },
      integrations: {
        modal_enabled: true,
        stripe_provisioning: true,
        resend_digest: false,
        supabase_logging: true,
      },
    },
  },
  "TPL-06": {
    type: "agent",
    product_id: "Blank",
    config: { tone: "professional", language: "en", rag_active: true, lead_capture: false, human_escalation: false },
  },
};

const DEFAULT_FLOW: FlowNode[] = [
  { id: "node-1", type: "start", label: "Start", order: 1, properties: {} },
  { id: "node-2", type: "message", label: "Greet", order: 2, properties: { text: "Hi! How can I help you today?" } },
  { id: "node-3", type: "intent_router", label: "Intent Router", order: 3, properties: { intents: ["faq", "booking", "escalate"] } },
  { id: "node-4", type: "rag_lookup", label: "RAG Lookup", order: 4, properties: { top_k: 3, threshold: 0.75 } },
  { id: "node-5", type: "message", label: "Respond", order: 5, properties: { text: "Based on our knowledge base: {{rag_result}}" } },
  { id: "node-6", type: "escalate", label: "Escalate", order: 6, properties: { channel: "email" } },
  { id: "node-7", type: "end", label: "End", order: 7, properties: {} },
];

function baseConfig(input: { name: string }): AgentConfig {
  return {
    name: input.name,
    language: "en",
    tone: "professional",
    fallback: "escalate",
    conversation_starter: "assistant",
    system_prompt: "You are a helpful AI assistant for this business. Be accurate, concise, and operational.",
    rag_active: true,
    lead_capture: true,
    human_escalation: true,
    conversation_memory: false,
    bilingual_detect: false,
    model: "auto",
    max_tokens: 1024,
    temperature: 0.3,
    voice: {
      service_sku: "none",
      call_mode: "none",
      voice_provider: "retell",
      telephony_provider: "twilio",
      twilio_phone_number: process.env.TWILIO_PHONE_NUMBER ?? "",
      retell_model: "claude-3-5-sonnet",
      retell_voice: "default-voice",
      retell_agent_id: "",
      retell_llm_id: "",
      retell_last_synced_at: "",
      branded_caller_id: false,
      voicemail_detection: false,
      dtmf_capture: false,
      booking_enabled: false,
      booking_provider: "none",
      booking_url: process.env.CALENDAR_BOOKING_URL ?? process.env.NEXT_PUBLIC_CALENDAR_BOOKING_URL ?? "",
      transfer_number: "",
      crm_provider: "none",
      notion_sync: false,
      knowledge_sync_target: "pgvector",
    },
    integrations: {
      modal_enabled: false,
      stripe_provisioning: false,
      resend_digest: false,
      supabase_logging: true,
    },
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeAgentConfig(config: Partial<AgentConfig>): AgentConfig {
  const defaults = baseConfig({ name: typeof config.name === "string" && config.name ? config.name : "New Agent" });
  return {
    ...defaults,
    ...config,
    voice: {
      ...defaults.voice,
      ...(config.voice ?? {}),
    },
    integrations: {
      ...defaults.integrations,
      ...(config.integrations ?? {}),
    },
  };
}

export function createDraftAgent(input: { profile_id: string; template_id?: string }): BuilderAgent {
  const store = getStore();
  const now = new Date().toISOString();
  const agentId = randomUUID();
  const templateId = input.template_id ?? "TPL-01";
  const defaults = TEMPLATE_DEFAULTS[templateId] ?? TEMPLATE_DEFAULTS["TPL-01"];
  const cfg: AgentConfig = normalizeAgentConfig({ ...defaults.config, name: "New Agent" });
  const agent: BuilderAgent = {
    id: agentId,
    profile_id: input.profile_id,
    created_at: now,
    updated_at: now,
    status: "draft",
    type: defaults.type,
    template_id: templateId,
    config: cfg,
    flow_graph: { nodes: DEFAULT_FLOW.map((n) => ({ ...n })), edges: [] },
    config_hash: null,
    published_at: null,
    published_snapshot: null,
  };
  store.agents.set(agentId, agent);
  schedulePersist(store);
  return agent;
}

export function getAgent(agentId: string): BuilderAgent | undefined {
  const agent = getStore().agents.get(agentId);
  if (!agent) return;
  agent.config = normalizeAgentConfig(agent.config);
  return agent;
}

export function updateAgent(input: {
  agent_id: string;
  patch: Partial<Pick<BuilderAgent, "template_id" | "type" | "flow_graph">> & { config?: Partial<AgentConfig> };
}): BuilderAgent | undefined {
  const store = getStore();
  const agent = store.agents.get(input.agent_id);
  if (!agent) return;
  agent.updated_at = new Date().toISOString();
  if (input.patch.template_id) {
    agent.template_id = input.patch.template_id;
    const defaults = TEMPLATE_DEFAULTS[input.patch.template_id];
    if (defaults) {
      agent.type = defaults.type;
      agent.config = normalizeAgentConfig({ ...agent.config, ...defaults.config });
    }
  }
  if (input.patch.type) agent.type = input.patch.type;
  if (input.patch.flow_graph) agent.flow_graph = input.patch.flow_graph;
  if (input.patch.config) {
    const voice = input.patch.config.voice
      ? {
          ...agent.config.voice,
          ...input.patch.config.voice,
        }
      : agent.config.voice;
    const integrations = input.patch.config.integrations
      ? {
          ...agent.config.integrations,
          ...input.patch.config.integrations,
        }
      : agent.config.integrations;
    agent.config = normalizeAgentConfig({ ...agent.config, ...input.patch.config, voice, integrations });
  }
  store.agents.set(agent.id, agent);
  schedulePersist(store);
  return agent;
}

export function publishAgent(agentId: string): { config_hash: string } | undefined {
  const store = getStore();
  const agent = store.agents.get(agentId);
  if (!agent) return;
  const hash = createHash("sha256")
    .update(JSON.stringify({ config: agent.config, flow_graph: agent.flow_graph }))
    .digest("hex")
    .slice(0, 12);
  agent.config_hash = hash;
  agent.published_at = new Date().toISOString();
  agent.status = "testing";
  agent.published_snapshot = {
    config: cloneJson(agent.config),
    flow_graph: cloneJson(agent.flow_graph),
  };
  agent.updated_at = new Date().toISOString();
  store.agents.set(agent.id, agent);
  schedulePersist(store);
  return { config_hash: hash };
}

const CHUNK_CHARS = 2048;
const OVERLAP_CHARS = 200;
const MAX_CHUNKS = 600;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_CHARS) return clean.length > 50 ? [clean] : [];
  while (start < clean.length) {
    const end = start + CHUNK_CHARS;
    let chunk = clean.slice(start, end);
    if (end < clean.length) {
      const lastPeriod = chunk.lastIndexOf(". ");
      if (lastPeriod > CHUNK_CHARS * 0.6) chunk = chunk.slice(0, lastPeriod + 1);
    }
    if (chunk.trim().length > 50) chunks.push(chunk.trim());
    if (chunks.length >= MAX_CHUNKS) break;
    const step = Math.max(1, chunk.length - OVERLAP_CHARS);
    start += step;
  }
  return chunks;
}

export function addKbSourceText(input: {
  agent_id: string;
  name: string;
  type: KbSourceType;
  text: string;
  source_url?: string | null;
}): KbSource | undefined {
  const store = getStore();
  if (!store.agents.has(input.agent_id)) return;
  const now = new Date().toISOString();
  const sourceId = randomUUID();
  const src: KbSource = {
    id: sourceId,
    agent_id: input.agent_id,
    name: input.name,
    type: input.type,
    status: "processing",
    failure_type: null,
    chunk_count: 0,
    size_bytes: Buffer.byteLength(input.text, "utf-8"),
    source_url: input.source_url ?? null,
    error_message: null,
    indexed_at: null,
    created_at: now,
  };
  store.kbSources.set(sourceId, src);
  try {
    const trimmed = input.text.trim();
    if (trimmed.length < 50) {
      src.status = "failed";
      src.failure_type = "extraction_empty";
      src.error_message = "No usable text could be extracted (empty or too short).";
      store.kbSources.set(sourceId, src);
      schedulePersist(store);
      return src;
    }
    const chunks = chunkText(input.text);
    chunks.forEach((content, i) => {
      const id = randomUUID();
      store.kbChunks.set(id, {
        id,
        source_id: sourceId,
        agent_id: input.agent_id,
        content,
        token_count: Math.round(content.length / 4),
        chunk_index: i,
        created_at: now,
      });
    });
    src.chunk_count = chunks.length;
    src.status = "indexed";
    src.indexed_at = new Date().toISOString();
    store.kbSources.set(sourceId, src);
    schedulePersist(store);
  } catch (err) {
    src.status = "error";
    src.failure_type = "unknown";
    src.error_message = err instanceof Error ? err.message : String(err);
    store.kbSources.set(sourceId, src);
    schedulePersist(store);
  }
  return src;
}

export function listKbSources(agentId: string): KbSource[] {
  const store = getStore();
  return Array.from(store.kbSources.values())
    .filter((s) => s.agent_id === agentId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getPublishedSnapshot(agentId: string): BuilderAgent["published_snapshot"] | null {
  return getStore().agents.get(agentId)?.published_snapshot ?? null;
}

export function searchKb(agentId: string, query: string, max: number): Array<{ content: string; source: string }> {
  const store = getStore();
  const q = query.toLowerCase().split(/\s+/).filter(Boolean);
  const sourcesById = new Map(Array.from(store.kbSources.values()).map((s) => [s.id, s]));
  const candidates = Array.from(store.kbChunks.values())
    .filter((c) => c.agent_id === agentId)
    .map((c) => {
      const text = c.content.toLowerCase();
      const score = q.reduce((acc, term) => acc + (text.includes(term) ? 1 : 0), 0);
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
  return candidates.map(({ c }) => ({ content: c.content, source: sourcesById.get(c.source_id)?.name ?? "KB" }));
}

export function addExport(input: { agent_id: string; format: ExportFormat; config_hash: string; artefact_data: Record<string, unknown> }): ExportArtefact {
  const store = getStore();
  const list = store.exports.get(input.agent_id) ?? [];
  const version = list.filter((e) => e.format === input.format).reduce((m, e) => Math.max(m, e.version), 0) + 1;
  const out: ExportArtefact = {
    id: randomUUID(),
    agent_id: input.agent_id,
    format: input.format,
    version,
    config_hash: input.config_hash,
    artefact_data: input.artefact_data,
    created_at: new Date().toISOString(),
  };
  const next = [out, ...list].filter((e) => !(e.format === input.format && e.version <= version - 5));
  store.exports.set(input.agent_id, next);
  schedulePersist(store);
  return out;
}

export function listExports(agentId: string): ExportArtefact[] {
  return getStore().exports.get(agentId) ?? [];
}

export function addVoiceTestResult(input: Omit<VoiceTestResult, "id" | "created_at">): VoiceTestResult | undefined {
  const store = getStore();
  if (!store.agents.has(input.agent_id)) return;
  const list = store.voiceTests.get(input.agent_id) ?? [];
  const out: VoiceTestResult = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    ...input,
  };
  const next = [out, ...list].slice(0, 20);
  store.voiceTests.set(input.agent_id, next);
  schedulePersist(store);
  return out;
}

export function listVoiceTestResults(agentId: string): VoiceTestResult[] {
  return getStore().voiceTests.get(agentId) ?? [];
}
