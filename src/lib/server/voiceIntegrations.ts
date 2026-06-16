import type { BuilderAgent } from "@/lib/server/builderStore";
import { searchKb } from "@/lib/server/builderStore";
import { loadAdminSettings } from "@/lib/server/adminSettings";
import { callConfiguredLlm } from "@/lib/server/llmClient";

type ProviderStatus = "connected" | "missing_env" | "optional" | "disabled";

export type ProviderReadiness = {
  provider: string;
  status: ProviderStatus;
  summary: string;
  env_keys: string[];
};

function hasEnv(...keys: string[]): boolean {
  return keys.every((key) => Boolean(process.env[key]));
}

function voiceServiceName(serviceSku: BuilderAgent["config"]["voice"]["service_sku"]): string {
  if (serviceSku === "vs-01") return "VS-01 AI Voice Secretary";
  if (serviceSku === "vs-02") return "VS-02 AI Leads Hunter";
  if (serviceSku === "vs-03") return "VS-03 AI IVR & Call Forwarding";
  return "Voice Assistant";
}

function configuredTwilioNumber(agent: BuilderAgent): string {
  return agent.config.voice.twilio_phone_number.trim() || process.env.TWILIO_PHONE_NUMBER || "";
}

function modalFunctionsForAgent(agent: BuilderAgent): string[] {
  const base = ["post_call_processor", "knowledge_base_sync"];
  if (agent.config.voice.service_sku === "vs-01") return [...base, "booking_confirmer", "escalation_router", "weekly_digest", "ivr_router"];
  if (agent.config.voice.service_sku === "vs-02") return [...base, "outbound_campaign", "lead_scorer", "escalation_router"];
  if (agent.config.voice.service_sku === "vs-03") return [...base, "ivr_router", "escalation_router"];
  return base;
}

export function getVoiceProviderReadiness(agent: BuilderAgent): ProviderReadiness[] {
  const calReady = Boolean(process.env.CALENDAR_BOOKING_URL || process.env.NEXT_PUBLIC_CALENDAR_BOOKING_URL);
  const hubspotReady = hasEnv("HUBSPOT_ACCESS_TOKEN");
  const salesforceReady = hasEnv("SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_SECRET");
  return [
    {
      provider: "Retell AI",
      status: hasEnv("RETELL_API_KEY") ? "connected" : "missing_env",
      summary: "Voice agent runtime, KB ingestion target, webhooks, and call analytics.",
      env_keys: ["RETELL_API_KEY"],
    },
    {
      provider: "Twilio",
      status: hasEnv("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN") && Boolean(configuredTwilioNumber(agent)) ? "connected" : "missing_env",
      summary: "Telephony, configurable caller number, SMS follow-up, and warm-transfer routing.",
      env_keys: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER or voice.twilio_phone_number"],
    },
    {
      provider: "Cal.com / Calendar",
      status: agent.config.voice.booking_enabled ? (calReady ? "connected" : "missing_env") : "optional",
      summary: "Booking link or calendar provider used by booking flows.",
      env_keys: ["CALENDAR_BOOKING_URL"],
    },
    {
      provider: "Modal",
      status: agent.config.integrations.modal_enabled ? (hasEnv("MODAL_DEPLOY_URL") ? "connected" : "missing_env") : "disabled",
      summary: `Serverless orchestration for ${modalFunctionsForAgent(agent).join(", ")}.`,
      env_keys: ["MODAL_DEPLOY_URL"],
    },
    {
      provider: "Stripe",
      status: agent.config.integrations.stripe_provisioning ? (hasEnv("STRIPE_SECRET_KEY") ? "connected" : "missing_env") : "optional",
      summary: "Self-serve provisioning trigger after payment success.",
      env_keys: ["STRIPE_SECRET_KEY"],
    },
    {
      provider: "Resend",
      status: agent.config.integrations.resend_digest ? (hasEnv("RESEND_API_KEY") ? "connected" : "missing_env") : "optional",
      summary: "Weekly digests, onboarding, and escalation emails.",
      env_keys: ["RESEND_API_KEY"],
    },
    {
      provider: "Supabase",
      status: agent.config.integrations.supabase_logging ? (hasEnv("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY") ? "connected" : "missing_env") : "optional",
      summary: "Shared call logs, transcripts, provisioning, and analytics storage.",
      env_keys: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    },
    {
      provider: "Notion",
      status: agent.config.voice.notion_sync ? (hasEnv("NOTION_API_KEY", "NOTION_DATABASE_ID") ? "connected" : "missing_env") : "optional",
      summary: "Optional KB/doc sync source for onboarding playbooks or FAQs.",
      env_keys: ["NOTION_API_KEY", "NOTION_DATABASE_ID"],
    },
    {
      provider: "CRM",
      status:
        agent.config.voice.crm_provider === "hubspot"
          ? hubspotReady
            ? "connected"
            : "missing_env"
          : agent.config.voice.crm_provider === "salesforce"
            ? salesforceReady
              ? "connected"
              : "missing_env"
            : "optional",
      summary: "Lead sync and scoring write-back for VS-02 campaigns.",
      env_keys:
        agent.config.voice.crm_provider === "hubspot"
          ? ["HUBSPOT_ACCESS_TOKEN"]
          : agent.config.voice.crm_provider === "salesforce"
            ? ["SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_SECRET"]
            : [],
    },
  ];
}

export function buildVoiceDeploymentPlan(agent: BuilderAgent) {
  const voice = agent.config.voice;
  const baseUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const readiness = getVoiceProviderReadiness(agent);
  const missingProviders = readiness.filter((item) => item.status === "missing_env").map((item) => item.provider);
  return {
    product: {
      service_sku: voice.service_sku,
      service_name: voiceServiceName(voice.service_sku),
      agent_type: agent.type,
      call_mode: voice.call_mode,
      language: agent.config.language,
      tone: agent.config.tone,
      knowledge_sync_target: voice.knowledge_sync_target,
    },
    provider_readiness: readiness,
    retell: {
      provider: "retell",
      agent_name: agent.config.name,
      llm_model: voice.retell_model || agent.config.model,
      voice_model: voice.retell_voice,
      kb_enabled: agent.config.rag_active,
      inbound_webhook_url: `${baseUrl}/api/agents/${agent.id}/voice/provision`,
      post_call_webhook_url: `${baseUrl}/api/agents/${agent.id}/voice/provision`,
      tools:
        voice.service_sku === "vs-01"
          ? ["knowledge_base", "booking_confirmer", "warm_transfer"]
          : voice.service_sku === "vs-02"
            ? ["batch_call", "lead_scorer", "booking_confirmer", "warm_transfer"]
            : ["ivr_router", "dtmf_capture", "warm_transfer"],
    },
    twilio: {
      provider: "twilio",
      phone_number: configuredTwilioNumber(agent),
      requires_subaccount: true,
      sms_enabled: voice.booking_enabled || voice.service_sku === "vs-02",
      whatsapp_enabled: false,
      transfer_number: voice.transfer_number,
      branded_caller_id: voice.branded_caller_id,
    },
    modal: {
      enabled: agent.config.integrations.modal_enabled,
      functions: modalFunctionsForAgent(agent),
    },
    calendar: {
      provider: voice.booking_provider,
      booking_url: voice.booking_url || process.env.CALENDAR_BOOKING_URL || process.env.NEXT_PUBLIC_CALENDAR_BOOKING_URL || "",
    },
    crm: {
      provider: voice.crm_provider,
      sync_enabled: voice.crm_provider !== "none",
    },
    notifications: {
      resend_digest: agent.config.integrations.resend_digest,
      sms_follow_up: voice.service_sku === "vs-01" || voice.service_sku === "vs-02",
    },
    provisioning: {
      ready: missingProviders.length === 0,
      missing_providers: missingProviders,
      next_step:
        missingProviders.length === 0
          ? "Provisioning-ready. Connect provider credentials in production and trigger provisioning."
          : `Missing credentials for: ${missingProviders.join(", ")}`,
    },
  };
}

export async function simulateVoiceConversation(input: { agent: BuilderAgent; prompt: string }) {
  const ragChunks = input.agent.config.rag_active ? searchKb(input.agent.id, input.prompt, 5) : [];
  const { stored } = await loadAdminSettings();
  const adminFallbackModel = stored.ai.model.trim();
  const primaryVoiceModel = input.agent.config.voice.retell_model.trim() || input.agent.config.model.trim() || adminFallbackModel;
  const systemPrompt = [
    input.agent.config.system_prompt,
    `\nService SKU: ${input.agent.config.voice.service_sku}`,
    `\nCall mode: ${input.agent.config.voice.call_mode}`,
    `\nVoice runtime: Retell.`,
    `\nPreferred Retell LLM model: ${primaryVoiceModel}.`,
    `\nRespond as a spoken phone assistant. Keep answers concise and natural.`,
    ragChunks.length ? `\n\nKNOWLEDGE BASE CONTEXT:\n${ragChunks.map((item) => item.content).join("\n\n")}` : "",
  ].join("");

  const primaryAttempt = await callConfiguredLlm({
    responseFormat: "text",
    modelOverride: primaryVoiceModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: input.prompt },
    ],
  });
  const shouldUseAdminFallback =
    adminFallbackModel.length > 0 &&
    adminFallbackModel !== primaryVoiceModel &&
    (!primaryAttempt.ok || !primaryAttempt.text.trim());
  const fallbackAttempt = shouldUseAdminFallback
    ? await callConfiguredLlm({
        responseFormat: "text",
        modelOverride: adminFallbackModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input.prompt },
        ],
      })
    : null;
  const llm = fallbackAttempt?.ok ? fallbackAttempt : primaryAttempt;
  const backupUsed = Boolean(fallbackAttempt?.ok);

  const responseText = llm.ok
    ? llm.text
    : input.agent.config.language === "es"
      ? "No pude generar una respuesta de voz ahora mismo."
      : "I could not generate a voice response right now.";

  return {
    content: responseText,
    rag_chunks: ragChunks,
    provider: input.agent.config.voice.voice_provider,
    model: backupUsed ? adminFallbackModel : primaryVoiceModel,
    llm_provider: llm.provider,
    llm_model: llm.model,
    backup_model: adminFallbackModel !== primaryVoiceModel ? adminFallbackModel : null,
    backup_used: backupUsed,
    transcript: [
      { speaker: "caller", text: input.prompt },
      { speaker: "assistant", text: responseText },
    ],
    deployment_plan: buildVoiceDeploymentPlan(input.agent),
  };
}
