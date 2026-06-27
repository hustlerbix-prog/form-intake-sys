import { z } from "zod";

export const AllowedTemplateIdSchema = z.string().min(1).max(40);

export const AgentTypeSchema = z.enum(["chatbot", "voice", "agent"]);

export const AgentConfigSchema = z.object({
  name: z.string().min(1).max(80),
  language: z.enum(["en", "es", "bilingual"]),
  tone: z.enum(["professional", "friendly", "formal", "casual", "empathetic"]),
  fallback: z.enum(["escalate", "apologise", "redirect"]),
  conversation_starter: z.enum(["assistant", "visitor"]),
  system_prompt: z.string().min(1).max(4000),
  rag_active: z.boolean(),
  lead_capture: z.boolean(),
  human_escalation: z.boolean(),
  conversation_memory: z.boolean(),
  bilingual_detect: z.boolean(),
  model: z.string().min(1).max(100),
  max_tokens: z.number().int().min(128).max(8192),
  temperature: z.number().min(0).max(1),
  voice: z.object({
    service_sku: z.enum(["none", "vs-01", "vs-02", "vs-03"]),
    call_mode: z.enum(["none", "inbound", "outbound", "ivr"]),
    voice_provider: z.literal("retell"),
    telephony_provider: z.literal("twilio"),
    twilio_phone_number: z.string().max(80),
    retell_model: z.string().min(1).max(100),
    retell_voice: z.string().min(1).max(100),
    retell_agent_id: z.string().max(120),
    retell_llm_id: z.string().max(120),
    retell_last_synced_at: z.string().max(80),
    branded_caller_id: z.boolean(),
    voicemail_detection: z.boolean(),
    dtmf_capture: z.boolean(),
    booking_enabled: z.boolean(),
    booking_provider: z.enum(["none", "cal.com", "google_calendar"]),
    booking_url: z.string().max(300),
    transfer_number: z.string().max(80),
    crm_provider: z.enum(["none", "hubspot", "salesforce", "csv"]),
    notion_sync: z.boolean(),
    knowledge_sync_target: z.enum(["none", "retell+pgvector", "pgvector"]),
  }),
  integrations: z.object({
    modal_enabled: z.boolean(),
    stripe_provisioning: z.boolean(),
    resend_digest: z.boolean(),
    supabase_logging: z.boolean(),
  }),
});

export const FlowNodeTypeSchema = z.enum([
  "start",
  "message",
  "listen",
  "intent_router",
  "rag_lookup",
  "condition",
  "tool_call",
  "escalate",
  "end",
]);

export const FlowNodeSchema = z.object({
  id: z.string().min(1).max(200),
  type: FlowNodeTypeSchema,
  label: z.string().min(1).max(120),
  order: z.number().int().min(1).max(9999),
  properties: z.record(z.string(), z.unknown()),
});

export const FlowEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().optional(),
});

export const FlowGraphSchema = z.object({
  nodes: z.array(FlowNodeSchema).max(500),
  edges: z.array(FlowEdgeSchema).max(1000),
});

export const AgentPatchSchema = z.object({
  template_id: AllowedTemplateIdSchema.optional(),
  type: AgentTypeSchema.optional(),
  flow_graph: FlowGraphSchema.optional(),
  config: AgentConfigSchema.partial().optional(),
});

export type PublishFailure = {
  code: string;
  module: "kb" | "config" | "flow";
  message: string;
};

export function validatePublish(input: {
  rag_active: boolean;
  hasIndexedKbSource: boolean;
  flow_graph: z.infer<typeof FlowGraphSchema>;
  config: z.infer<typeof AgentConfigSchema>;
}): PublishFailure[] {
  const failures: PublishFailure[] = [];

  if (!input.config.name.trim()) {
    failures.push({ code: "config/name_required", module: "config", message: "Agent name is required." });
  }

  const nodes = input.flow_graph.nodes ?? [];
  const startCount = nodes.filter((n) => n.type === "start").length;
  const endCount = nodes.filter((n) => n.type === "end" || n.type === "escalate").length;
  if (startCount !== 1) {
    failures.push({ code: "flow/start_count", module: "flow", message: "Flow must contain exactly one start node." });
  }
  if (endCount < 1) {
    failures.push({ code: "flow/end_missing", module: "flow", message: "Flow must contain at least one end or escalate node." });
  }

  if (input.rag_active && !input.hasIndexedKbSource) {
    failures.push({ code: "kb/required", module: "kb", message: "RAG is enabled but no indexed knowledge base sources exist." });
  }

  return failures;
}

export const ALLOWED_INTERPOLATION_VARS = ["bot_name", "business_name", "user_name", "slogan"] as const;
const ALLOWED_VARS = new Set<string>(ALLOWED_INTERPOLATION_VARS);

export function assertAllowedInterpolation(input: { text: string; field: string }): void {
  const unknown = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let match: RegExpExecArray | null = null;
  while ((match = re.exec(input.text)) !== null) {
    const key = match[1] ?? "";
    if (key && !ALLOWED_VARS.has(key)) unknown.add(key);
  }
  if (unknown.size) {
    throw new Error(`Unknown template variables in ${input.field}: ${Array.from(unknown).join(", ")}`);
  }
}
