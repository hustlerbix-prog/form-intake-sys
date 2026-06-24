import { z } from "zod";
import { callConfiguredLlm, type LlmMessage } from "./llmClient";
import type { CanonicalSubmissionJson, Language } from "./store";

export type Product = {
  id: string;
  name: string;
  description: string;
  monthly_price_usd: number | null;
  one_time_price_usd: number | null;
  best_fit: string[];
};

export const PRODUCT_CATALOGUE_VERSION = "v1.0";

export const PRODUCT_CATALOGUE: Product[] = [
  {
    id: "CB-01",
    name: "AI Chatbot",
    description: "Customer-facing conversational agent with knowledge base for lead capture, FAQ automation, and customer support.",
    monthly_price_usd: 499,
    one_time_price_usd: null,
    best_fit: ["lead_capture", "customer_support", "faq_automation", "retail", "hospitality", "healthcare"],
  },
  {
    id: "CA-01",
    name: "Company Analyzer",
    description: "Internal business intelligence agent fed by a knowledge base and RAG for ops analysis, reporting, and decision support.",
    monthly_price_usd: 499,
    one_time_price_usd: null,
    best_fit: ["internal_ops", "reporting", "decision_support", "manual_data_entry", "finance", "professional"],
  },
  {
    id: "AVA-01",
    name: "AI Voice Assistant",
    description: "Programmable voice agent with knowledge base for phone support, appointment booking, and order status.",
    monthly_price_usd: 899,
    one_time_price_usd: null,
    best_fit: ["phone_support", "appointment_booking", "order_status", "logistics", "healthcare", "hospitality"],
  },
  {
    id: "IS-01",
    name: "AI Onboarding Sprint",
    description: "5-day build and deploy of a core AI product — the fastest path to live.",
    monthly_price_usd: null,
    one_time_price_usd: 2500,
    best_fit: ["first_deployment", "all"],
  },
  {
    id: "IS-02",
    name: "Integration Sprint",
    description: "Connect an AI product to the existing stack: CRM, ERP, helpdesk.",
    monthly_price_usd: null,
    one_time_price_usd: 1800,
    best_fit: ["post_launch", "crm_integration", "erp_integration"],
  },
  {
    id: "IS-03",
    name: "Data Pipeline Build",
    description: "Structured data ingestion from manual or legacy sources into AI-consumable format.",
    monthly_price_usd: null,
    one_time_price_usd: 2200,
    best_fit: ["unstructured_data", "manual_data_entry", "legacy_systems", "reporting"],
  },
  {
    id: "IS-04",
    name: "Voice Channel Deploy",
    description: "AVA-01 configured for phone/IVR deployment.",
    monthly_price_usd: null,
    one_time_price_usd: 2800,
    best_fit: ["phone_heavy", "call_center", "logistics", "healthcare"],
  },
  {
    id: "IS-05",
    name: "Custom Agent Build",
    description: "Bespoke AI agent beyond the standard catalogue for unique use cases.",
    monthly_price_usd: null,
    one_time_price_usd: 3500,
    best_fit: ["unique_use_case", "custom"],
  },
  {
    id: "CS-01",
    name: "AI Readiness Audit",
    description: "2-hour structured assessment and written report. Best first step for clients with low clarity.",
    monthly_price_usd: null,
    one_time_price_usd: 750,
    best_fit: ["low_readiness", "unclear_starting_point", "no_ai_experience"],
  },
  {
    id: "CS-02",
    name: "Strategy Workshop",
    description: "Half-day AI roadmap session for leadership buy-in.",
    monthly_price_usd: null,
    one_time_price_usd: 1200,
    best_fit: ["committee_decision", "leadership_alignment", "roadmap_needed"],
  },
  {
    id: "CS-03",
    name: "Compliance Review",
    description: "CISA-led GRC review of AI deployment for regulated industries.",
    monthly_price_usd: null,
    one_time_price_usd: 1500,
    best_fit: ["finance", "healthcare", "legal", "regulated_industry"],
  },
  {
    id: "CS-04",
    name: "Change Management Coaching",
    description: "3-session team adoption programme to overcome resistance.",
    monthly_price_usd: null,
    one_time_price_usd: 900,
    best_fit: ["team_resistance", "adoption_barrier"],
  },
  {
    id: "MS-01",
    name: "Core Retainer",
    description: "Monthly managed support for 1 AI product.",
    monthly_price_usd: 399,
    one_time_price_usd: null,
    best_fit: ["post_deployment_maintenance", "small_budget"],
  },
  {
    id: "MS-02",
    name: "Growth Retainer",
    description: "Monthly support + optimisation + reporting for scale-up clients.",
    monthly_price_usd: 699,
    one_time_price_usd: null,
    best_fit: ["scale_up", "growth_phase", "medium_budget"],
  },
  {
    id: "MS-03",
    name: "Enterprise Retainer",
    description: "Full-stack managed service with SLA for high-complexity accounts.",
    monthly_price_usd: 1499,
    one_time_price_usd: null,
    best_fit: ["high_complexity", "enterprise", "large_budget"],
  },
  {
    id: "AO-01",
    name: "Bilingual Add-on",
    description: "EN/ES language layer on any product for LatAm and bilingual markets.",
    monthly_price_usd: 199,
    one_time_price_usd: null,
    best_fit: ["latam_market", "bilingual_ops", "spanish_language"],
  },
  {
    id: "AO-02",
    name: "Analytics Dashboard",
    description: "Usage and performance dashboard for any deployed AI product.",
    monthly_price_usd: 149,
    one_time_price_usd: null,
    best_fit: ["reporting_focused", "metrics_driven"],
  },
  {
    id: "AO-03",
    name: "Priority Support",
    description: "4-hour SLA response with dedicated channel for time-sensitive businesses.",
    monthly_price_usd: 249,
    one_time_price_usd: null,
    best_fit: ["high_urgency", "time_sensitive", "revenue_critical"],
  },
];

function getProduct(productId: string): Product | undefined {
  return PRODUCT_CATALOGUE.find((p) => p.id === productId);
}

function validateProductIds(ids: string[]): string[] {
  const valid = new Set(PRODUCT_CATALOGUE.map((p) => p.id));
  return ids.filter((id) => !valid.has(id));
}

export type OperationalGap = {
  gap_id: string;
  description: string;
  severity_score: number;
  evidence_source: "form" | "scrape" | "both" | "inferred";
};

export type ReadinessDimensions = {
  data_availability: number;
  tool_maturity: number;
  budget_comfort: number;
  decision_authority: number;
  urgency: number;
};

export type RecommendedProduct = {
  product_id: string;
  product_name: string;
  tier: "primary" | "upsell";
  monthly_price_usd: number | null;
  one_time_price_usd: number | null;
  rationale: string;
  value_driver: string;
  priority_rank: number;
};

export type RoadmapPhase = {
  phase: number;
  title: string;
  duration_weeks: number;
  products: string[];
  description: string;
  cumulative_monthly_value_usd: number;
};

export type DiagnosisOutput = {
  business_summary: string;
  operational_gaps: OperationalGap[];
  pain_priority_rank: string[];
  automation_readiness_score: number;
  readiness_dimension_breakdown: ReadinessDimensions;
  recommended_products: RecommendedProduct[];
  implementation_roadmap: RoadmapPhase[];
  estimated_monthly_value_usd: number;
  value_reasoning: string;
  confidence_score: number;
  data_source: "full" | "intake_only";
  reasoning_trace: string;
  human_escalation_flag: boolean;
  language: Language;
  llm_provider: string;
  llm_model: string;
  generated_at: string;
};

export type FullReport = {
  catalogue_version: string;
  diagnosis: DiagnosisOutput;
  before_after: { before: string; after: string; revenue_support: string };
  roi: {
    monthly_value_usd: number;
    monthly_cost_usd: number;
    one_time_cost_usd: number;
    net_monthly_value_usd: number;
    payback_months: number | null;
    roi_12mo_percent: number | null;
    assumptions: string[];
  };
  demos: {
    chatbot: { title: string; script: string[] };
    voice_assistant: { title: string; script: string[] };
    automations: { title: string; script: string[] };
  };
};

const OperationalGapSchema = z.object({
  gap_id: z.string().min(1),
  description: z.string().min(10),
  severity_score: z.number().int().min(1).max(10),
  evidence_source: z.enum(["form", "scrape", "both", "inferred"]),
});

const ReadinessDimensionsSchema = z.object({
  data_availability: z.number().int().min(0).max(20),
  tool_maturity: z.number().int().min(0).max(20),
  budget_comfort: z.number().int().min(0).max(20),
  decision_authority: z.number().int().min(0).max(20),
  urgency: z.number().int().min(0).max(20),
});

const RecommendedProductSchema = z.object({
  product_id: z.string().min(1),
  product_name: z.string().min(1),
  tier: z.enum(["primary", "upsell"]),
  monthly_price_usd: z.number().nullable(),
  one_time_price_usd: z.number().nullable(),
  rationale: z.string().min(10),
  value_driver: z.string().min(1),
  priority_rank: z.number().int().min(1),
});

const RoadmapPhaseSchema = z.object({
  phase: z.number().int().min(1),
  title: z.string().min(1),
  duration_weeks: z.number().int().min(1),
  products: z.array(z.string()).min(1),
  description: z.string().min(10),
  cumulative_monthly_value_usd: z.number().int().min(0),
});

const Pass1Schema = z.object({
  business_summary: z.string().min(50),
});

const Pass2Schema = z.object({
  operational_gaps: z.array(OperationalGapSchema).min(1).max(3),
  pain_priority_rank: z.array(z.string()).min(1),
});

const Pass3Schema = z.object({
  automation_readiness_score: z.number().int().min(0).max(100),
  readiness_dimension_breakdown: ReadinessDimensionsSchema,
  readiness_reasoning: z.string().min(10),
});

const Pass4Schema = z.object({
  recommended_products: z.array(RecommendedProductSchema).min(1),
  implementation_roadmap: z.array(RoadmapPhaseSchema).min(2).max(4),
  estimated_monthly_value_usd: z.number().int().min(0),
  value_reasoning: z.string().min(10),
});

function redactEmails(value: unknown): unknown {
  const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  if (typeof value === "string") return value.replace(EMAIL_REGEX, "[email redacted]");
  if (Array.isArray(value)) return value.map(redactEmails);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactEmails(v);
    return out;
  }
  return value;
}

function toSafeProfile(submission: CanonicalSubmissionJson) {
  const answered = submission.questionnaire.filter((q) => q.answer != null && String(q.answer).length > 0).length;
  const industryOtherDetailsRaw = submission.answers_raw.industry_other_details;
  const industryOtherDetails =
    typeof industryOtherDetailsRaw === "string" ? industryOtherDetailsRaw.trim().slice(0, 200) : null;
  const industry =
    submission.business.industry === "other" && industryOtherDetails ? industryOtherDetails : submission.business.industry;
  return {
    profile_id: submission.profile_id,
    language: submission.language,
    industry,
    industry_other_details: industryOtherDetails,
    team_size: submission.business.team_size,
    revenue_range: submission.business.revenue_range,
    top_time_cost: submission.pain_points.top_time_cost,
    existing_tools: submission.tools.existing_tools,
    bottleneck: submission.pain_points.bottleneck,
    budget_comfort: submission.budget.budget_comfort,
    success_definition: submission.goals.success_definition,
    data_situation: submission.pain_points.data_situation,
    urgency_flag: submission.goals.urgency_flag,
    prior_ai_experience: submission.pain_points.prior_ai_experience,
    website_url: submission.business.website_url,
    questions_answered: answered,
  };
}

function toSafeScrape(submission: CanonicalSubmissionJson): Record<string, unknown> | null {
  const s = submission.website_scrape;
  if (!s) return null;
  const safe: Record<string, unknown> = {
    website_url: s.website_url,
    scraped_at: s.scraped_at,
    scrape_status: s.scrape_status,
    final_url: s.final_url,
    status_code: s.status_code,
    page_title: s.page_title,
    meta_description: s.meta_description,
    detected_language: s.detected_language,
    confidence_score: s.confidence_score,
    tech_profile: s.tech_profile,
    tech_stack_detected: s.tech_stack_detected,
    social_links: s.social_links,
    content_excerpt: s.content_excerpt,
    content_summary: s.content_summary,
    ai_summary: s.ai_summary,
    ai_services_detected: s.ai_services_detected,
    ai_industry: s.ai_industry,
    services: s.services,
    target_audience: s.target_audience,
    tone_of_voice: s.tone_of_voice,
    pricing_signals: s.pricing_signals,
    operational_tools: s.operational_tools,
    contact_info: s.contact_info,
    brand_story: s.brand_story,
    geo_coverage: s.geo_coverage,
    social_proof: s.social_proof,
    error_message: s.error_message,
  };
  return redactEmails(safe) as Record<string, unknown>;
}

function languageInstruction(language: Language): string {
  return language === "es"
    ? "Respond ENTIRELY in Latin American Spanish (es-MX). All string fields must be in Spanish. Product IDs remain unchanged."
    : "Respond in English.";
}

async function callPassJson<T>(input: { language: Language; system: string; user: string; schema: z.ZodSchema<T> }): Promise<
  | { ok: true; data: T; llm_provider: string; llm_model: string }
  | { ok: false; error: string; llm_provider: string; llm_model: string; llm_error?: string }
> {
  const messages: LlmMessage[] = [
    { role: "system", content: input.system },
    { role: "user", content: input.user },
  ];
  const res = await callConfiguredLlm({ messages, responseFormat: "json" });
  if (!res.ok) {
    return {
      ok: false,
      error: "llm_unavailable",
      llm_provider: res.provider,
      llm_model: res.model,
      llm_error: res.error,
    };
  }
  try {
    const json = JSON.parse(res.text) as unknown;
    const parsed = input.schema.safeParse(json);
    if (!parsed.success) return { ok: false, error: "schema_parse_failed", llm_provider: res.provider, llm_model: res.model };
    return { ok: true, data: parsed.data, llm_provider: res.provider, llm_model: res.model };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "json_parse_failed", llm_provider: res.provider, llm_model: res.model };
  }
}

function computeConfidence(input: { questionsAnswered: number; dataSource: "full" | "intake_only"; readinessScore: number }): number {
  const base = Math.min(100, input.questionsAnswered * 8);
  const scrapePenalty = input.dataSource === "intake_only" ? 15 : 0;
  const readinessPenalty = input.readinessScore < 30 ? 10 : 0;
  return Math.max(0, base - scrapePenalty - readinessPenalty);
}

function computeRoi(input: { products: RecommendedProduct[]; estimatedMonthlyValueUsd: number; language: Language }) {
  const monthlyCost = input.products.reduce((sum, p) => sum + (p.monthly_price_usd ?? 0), 0);
  const oneTimeCost = input.products.reduce((sum, p) => sum + (p.one_time_price_usd ?? 0), 0);
  const netMonthly = input.estimatedMonthlyValueUsd - monthlyCost;
  const paybackMonths = netMonthly > 0 && oneTimeCost > 0 ? Math.round((oneTimeCost / netMonthly) * 10) / 10 : null;
  const roi12mo =
    monthlyCost > 0 || oneTimeCost > 0
      ? Math.round((((input.estimatedMonthlyValueUsd * 12 - monthlyCost * 12 - oneTimeCost) / Math.max(1, monthlyCost * 12 + oneTimeCost)) * 100) * 10) /
        10
      : null;
  const assumptions =
    input.language === "es"
      ? [
          "La estimación de valor mensual es conservadora y depende de adopción y volumen real.",
          "Los precios provienen del catálogo v1.0 y pueden variar según alcance.",
          "El ROI no incluye costes internos de cambio/entrenamiento.",
        ]
      : [
          "Monthly value estimate is conservative and depends on adoption and real volume.",
          "Pricing comes from catalogue v1.0 and may vary by scope.",
          "ROI does not include internal change/training costs.",
        ];
  return {
    monthly_value_usd: input.estimatedMonthlyValueUsd,
    monthly_cost_usd: monthlyCost,
    one_time_cost_usd: oneTimeCost,
    net_monthly_value_usd: netMonthly,
    payback_months: paybackMonths,
    roi_12mo_percent: roi12mo,
    assumptions,
  };
}

function buildDefaultDemos(language: Language) {
  if (language === "es") {
    return {
      chatbot: {
        title: "Mini demo — AI Chatbot (CB-01)",
        script: [
          "Cliente: Hola, ¿puedo cotizar y agendar una llamada?",
          "Chatbot: Claro. ¿Cuál es tu nombre y el servicio que te interesa?",
          "Cliente: Quiero automatizar soporte y capturar leads.",
          "Chatbot: Perfecto. Te hago 3 preguntas rápidas y te envío opciones + link de agenda.",
        ],
      },
      voice_assistant: {
        title: "Mini demo — AI Voice Assistant (AVA-01)",
        script: [
          "Llamada entrante: “Quiero agendar una cita para esta semana.”",
          "Asistente: “Claro. ¿Qué día prefieres y a qué hora?”",
          "Cliente: “Jueves 3pm.”",
          "Asistente: “Listo. Te confirmo jueves 3pm y te envío la confirmación por SMS/email.”",
        ],
      },
      automations: {
        title: "Mini demo — AI Automations",
        script: [
          "1) Lead entra por web/chat → 2) Se crea en CRM → 3) Se asigna al vendedor → 4) Se envía email/SMS → 5) Se notifica en Slack → 6) Reporte semanal automático",
        ],
      },
    };
  }
  return {
    chatbot: {
      title: "Mini demo — AI Chatbot (CB-01)",
      script: [
        "Visitor: Hi, can I get a quote and book a call?",
        "Chatbot: Sure. What’s your name and what are you looking to improve?",
        "Visitor: Support + lead capture.",
        "Chatbot: Great. I’ll ask 3 quick questions and send options + a booking link.",
      ],
    },
    voice_assistant: {
      title: "Mini demo — AI Voice Assistant (AVA-01)",
      script: [
        'Inbound call: "I want to book an appointment this week."',
        'Assistant: "Sure. Which day and time do you prefer?"',
        'Caller: "Thursday 3pm."',
        'Assistant: "Booked. I’ll send a confirmation by SMS/email."',
      ],
    },
    automations: {
      title: "Mini demo — AI Automations",
      script: ["1) Lead via web/chat → 2) Create in CRM → 3) Assign owner → 4) Auto email/SMS → 5) Slack alert → 6) Weekly KPI report"],
    },
  };
}

function buildBeforeAfter(input: { language: Language; gaps: OperationalGap[]; roadmap: RoadmapPhase[]; valueReasoning: string }) {
  const top = input.gaps[0];
  const phase1 = input.roadmap[0];
  if (input.language === "es") {
    return {
      before: top
        ? `Antes: proceso manual dominante asociado a "${top.gap_id}". Impacto: ${top.description}`
        : "Antes: procesos manuales y variabilidad operativa que limitan velocidad y consistencia.",
      after: phase1
        ? `Después (Fase 1): ${phase1.description} (productos: ${phase1.products.join(", ")}).`
        : "Después: flujos automatizados con captura de datos, menos trabajo repetitivo y mejor seguimiento.",
      revenue_support: `Soporte de valor: ${input.valueReasoning}`,
    };
  }
  return {
    before: top
      ? `Before: manual-heavy process around "${top.gap_id}". Impact: ${top.description}`
      : "Before: manual processes and operational variability that limit speed and consistency.",
    after: phase1 ? `After (Phase 1): ${phase1.description} (products: ${phase1.products.join(", ")}).` : "After: automated workflows, less repetitive work, and better tracking.",
    revenue_support: `Value support: ${input.valueReasoning}`,
  };
}

/* ── In-house rule-based analyzer (runs when LLM is unavailable or unset) ── */

const GAP_SIGNALS: Array<{
  pattern: RegExp;
  gap_id: string;
  en: string;
  es: string;
  severity: number;
}> = [
  { pattern: /manual|spreadsheet|excel|copy.?past|data.?entry|hoja.?c[áa]lculo|entrada.?manual/i, gap_id: "manual_data_entry", en: "Manual data entry and spreadsheet-driven workflows consuming significant team capacity that could be automated.", es: "Entrada manual de datos y flujos en hojas de cálculo consumen capacidad operativa que puede automatizarse.", severity: 8 },
  { pattern: /schedul|appointment|booking|calendar|cita|agend|reserv/i, gap_id: "scheduling_bottleneck", en: "Appointment scheduling handled manually, creating delays and missed follow-ups.", es: "Agendamiento de citas gestionado manualmente, generando retrasos y oportunidades perdidas.", severity: 7 },
  { pattern: /customer.?support|ticket|inquiry|complaint|soporte|consulta|queja|atenci[oó]n.?cliente/i, gap_id: "customer_support_load", en: "High volume of repetitive customer inquiries handled manually, preventing focus on higher-value work.", es: "Alto volumen de consultas repetitivas atendidas manualmente, impidiendo el enfoque en trabajo de mayor valor.", severity: 8 },
  { pattern: /follow.?up|lead|pipeline|prospecto|seguimiento/i, gap_id: "lead_follow_up", en: "Lead follow-up and sales pipeline lacking automation, resulting in missed conversions.", es: "Seguimiento de prospectos y pipeline sin automatización, resultando en conversiones perdidas.", severity: 7 },
  { pattern: /report|dashboard|analytic|kpi|inform|reporte|tablero/i, gap_id: "reporting_manual", en: "Business reporting produced manually, limiting visibility and decision speed.", es: "Reportes generados manualmente, limitando visibilidad y velocidad de decisión.", severity: 6 },
  { pattern: /invoice|billing|payment|factur|cobro/i, gap_id: "billing_workflow", en: "Invoicing and payment collection managed manually, creating cash-flow delays.", es: "Facturación y cobro gestionados manualmente, generando retrasos en el flujo de caja.", severity: 7 },
  { pattern: /inventory|stock|supply|inventario|existencias/i, gap_id: "inventory_management", en: "Inventory managed without automation, increasing risk of stockouts and overstock.", es: "Inventario sin automatización, aumentando el riesgo de quiebres de stock.", severity: 7 },
  { pattern: /onboard|training|hiring|capacitaci[oó]n|incorporaci[oó]n/i, gap_id: "onboarding_ops", en: "Employee onboarding executed manually, slowing time-to-productivity for new hires.", es: "Incorporación de empleados manual, reduciendo la velocidad de adaptación de nuevos ingresos.", severity: 6 },
];

function detectRuleBasedGaps(submission: CanonicalSubmissionJson): OperationalGap[] {
  const formText = [
    submission.pain_points.top_time_cost ?? "",
    submission.pain_points.bottleneck ?? "",
    submission.pain_points.data_situation ?? "",
  ].join(" ");
  const scrapeText = [
    submission.website_scrape?.ai_summary ?? "",
    submission.website_scrape?.content_summary ?? "",
  ].join(" ");
  const gaps: OperationalGap[] = [];
  for (const sig of GAP_SIGNALS) {
    const inForm = sig.pattern.test(formText);
    const inScrape = sig.pattern.test(scrapeText);
    if (!inForm && !inScrape) continue;
    gaps.push({
      gap_id: sig.gap_id,
      description: submission.language === "es" ? sig.es : sig.en,
      severity_score: sig.severity,
      evidence_source: inForm && inScrape ? "both" : inScrape ? "scrape" : "form",
    });
    if (gaps.length >= 3) break;
  }
  if (gaps.length === 0) {
    gaps.push(
      submission.pain_points.top_time_cost
        ? { gap_id: "operational_inefficiency", description: submission.language === "es" ? `Ineficiencia operativa en: ${submission.pain_points.top_time_cost.slice(0, 140)}` : `Operational inefficiency in: ${submission.pain_points.top_time_cost.slice(0, 140)}`, severity_score: 7, evidence_source: "form" }
        : { gap_id: "process_visibility", description: submission.language === "es" ? "Baja visibilidad de procesos y ausencia de métricas operativas consistentes." : "Low process visibility and absence of consistent operational metrics.", severity_score: 6, evidence_source: "inferred" }
    );
  }
  return gaps;
}

function buildRuleBasedSummary(submission: CanonicalSubmissionJson): string {
  const lang = submission.language;
  const ind = submission.business.industry ?? (lang === "es" ? "negocio" : "business");
  const team = submission.business.team_size;
  const rev = submission.business.revenue_range;
  const timeCost = submission.pain_points.top_time_cost;
  const bottleneck = submission.pain_points.bottleneck;
  const dataSit = submission.pain_points.data_situation;
  const tools = (submission.tools.existing_tools ?? []).slice(0, 3).join(", ");
  const aiExpRaw = submission.pain_points.prior_ai_experience;
  const success = submission.goals.success_definition;
  const scrape = submission.website_scrape;

  const aiNote = aiExpRaw === false || aiExpRaw === null
    ? (lang === "es" ? "Sin experiencia previa en IA, la organización está en etapa inicial de adopción." : "With no prior AI exposure, the organisation is at an early adoption stage.")
    : aiExpRaw === true
    ? (lang === "es" ? "Con experiencia previa en IA, el equipo está listo para despliegues productivos." : "Having explored AI tools, the team is ready for production-grade deployments.")
    : (lang === "es" ? "El equipo cuenta con experiencia operativa en tecnología." : "The team has operational technology experience.");

  const webNote = scrape?.scrape_status === "success" && scrape.content_summary
    ? (lang === "es" ? ` Su presencia web indica: ${scrape.content_summary.slice(0, 100)}.` : ` Web presence indicates: ${scrape.content_summary.slice(0, 100)}.`)
    : "";

  const parts = lang === "es"
    ? [
        `Negocio del sector ${ind}${team ? ` con ${team} empleados` : ""}${rev ? ` y facturación en el rango ${rev}` : ""}.`,
        timeCost ? `Principal consumidor de tiempo: ${timeCost.slice(0, 130)}.` : "",
        bottleneck ? `Cuello de botella identificado: ${bottleneck.slice(0, 130)}.` : "",
        tools ? `Herramientas en uso: ${tools}.` : "No se reportan herramientas digitales consolidadas.",
        dataSit ? `Situación de datos: ${dataSit.slice(0, 100)}.` : "",
        aiNote, webNote,
        success ? `Visión de éxito declarada: ${success.slice(0, 120)}.` : "",
      ]
    : [
        `${ind.charAt(0).toUpperCase() + ind.slice(1)} business${team ? ` with ${team}` : ""}${rev ? `, revenue in the ${rev} range` : ""}.`,
        timeCost ? `Primary time cost: ${timeCost.slice(0, 130)}.` : "",
        bottleneck ? `Core bottleneck: ${bottleneck.slice(0, 130)}.` : "",
        tools ? `Current toolset includes ${tools}.` : "No consolidated digital toolset reported.",
        dataSit ? `Data situation: ${dataSit.slice(0, 100)}.` : "",
        aiNote, webNote,
        success ? `Declared success definition: ${success.slice(0, 120)}.` : "",
      ];
  return parts.filter(Boolean).join(" ").slice(0, 1000);
}

function scoreRuleBasedProducts(
  submission: CanonicalSubmissionJson,
  gaps: OperationalGap[],
  readinessScore: number,
  budgetBand: string,
): RecommendedProduct[] {
  const lang = submission.language;
  const ind = (submission.business.industry ?? "").toLowerCase();
  const gapIds = new Set(gaps.map((g) => g.gap_id));
  const aiExpRaw = submission.pain_points.prior_ai_experience;
  const scores = new Map<string, { score: number; en: string; es: string; driver: string }>();

  function add(id: string, delta: number, en: string, es: string, driver: string) {
    const cur = scores.get(id);
    scores.set(id, cur ? { ...cur, score: cur.score + delta } : { score: delta, en, es, driver });
  }

  if (readinessScore < 40) {
    add("CS-01", 6, "AI Readiness Audit is the right first step — low readiness requires structured assessment before tooling.", "La Auditoría de Madurez IA es el primer paso correcto — la baja madurez requiere evaluación estructurada antes de implementar herramientas.", "risk_reduction");
    add("IS-01", 4, "AI Onboarding Sprint delivers the fastest path from audit to live deployment.", "El Sprint de Incorporación IA ofrece la ruta más rápida de auditoría a despliegue productivo.", "speed_to_value");
  }
  if (["retail", "hospitality", "education"].includes(ind)) add("CB-01", 5, "High-volume customer interactions in this industry make a customer-facing chatbot the highest-ROI first deployment.", "Las interacciones de alto volumen en este sector hacen del chatbot la primera implementación de mayor ROI.", "customer_engagement");
  if (["healthcare", "logistics", "hospitality"].includes(ind)) add("AVA-01", 4, "Phone and appointment management is operationally critical in this industry — voice AI handles it at scale.", "La gestión de llamadas y citas es crítica en este sector — la IA de voz lo maneja a escala.", "call_deflection");
  if (["finance", "professional", "manufacturing", "technology"].includes(ind)) add("CA-01", 5, "Internal analytics and decision support align directly with this industry's data-driven operational demands.", "El soporte de análisis interno se alinea con las demandas operativas basadas en datos de este sector.", "decision_speed");
  if (["healthcare", "finance"].includes(ind)) add("CS-03", 3, "Compliance Review is essential before deploying AI in regulated workflows.", "La Revisión de Cumplimiento es esencial antes de desplegar IA en flujos regulados.", "compliance");

  if (gapIds.has("customer_support_load")) add("CB-01", 4, "Directly resolves the customer support load gap through 24/7 automated deflection.", "Resuelve directamente la carga de soporte mediante deflección automatizada 24/7.", "support_deflection");
  if (gapIds.has("scheduling_bottleneck")) add("AVA-01", 4, "AI Voice Assistant eliminates the scheduling bottleneck through end-to-end appointment automation.", "El Asistente de Voz IA elimina el cuello de botella de agendamiento con automatización de citas.", "time_saved");
  if (gapIds.has("manual_data_entry")) { add("IS-03", 4, "Data Pipeline Build eliminates manual data entry through structured ingestion automation.", "El Pipeline de Datos elimina la entrada manual mediante automatización de ingesta estructurada.", "data_quality"); add("CA-01", 2, "Company Analyzer turns the cleaned data into actionable insights.", "El Analizador de Empresa convierte los datos limpios en información accionable.", "decision_speed"); }
  if (gapIds.has("reporting_manual")) add("CA-01", 3, "Company Analyzer replaces manual reporting with real-time AI-driven insights.", "El Analizador de Empresa reemplaza reportes manuales con información en tiempo real.", "visibility");
  if (gapIds.has("lead_follow_up")) add("CB-01", 3, "Chatbot automates lead capture and follow-up sequences, preventing revenue leakage.", "El chatbot automatiza captura y seguimiento de leads, previniendo fuga de ingresos.", "revenue_capture");
  if (gapIds.has("billing_workflow")) add("IS-02", 2, "Integration Sprint connects billing workflows to automated payment systems.", "El Sprint de Integración conecta flujos de facturación a sistemas de pago automatizados.", "cash_flow");

  if (budgetBand === "under_500") {
    add("MS-01", 3, "Core Retainer delivers ongoing AI support within a constrained budget.", "El Retainer Básico provee soporte IA continuo dentro de un presupuesto ajustado.", "cost_control");
    scores.delete("AVA-01"); scores.delete("IS-04"); scores.delete("IS-05"); scores.delete("MS-03");
  } else if (budgetBand === "500_2k") {
    add("IS-01", 3, "AI Onboarding Sprint is the right-sized first investment at this budget.", "El Sprint de Incorporación IA es la primera inversión adecuada para este presupuesto.", "speed_to_value");
    add("MS-02", 2, "Growth Retainer sustains optimisation momentum after initial deployment.", "El Retainer de Crecimiento sostiene la optimización tras el despliegue inicial.", "sustained_growth");
  } else if (budgetBand === "2k_5k") {
    add("IS-02", 3, "Integration Sprint connects AI products to the existing stack for maximum leverage.", "El Sprint de Integración conecta los productos IA al stack existente para máximo aprovechamiento.", "tech_alignment");
    add("MS-02", 3, "Growth Retainer provides the ongoing support needed at this scale.", "El Retainer de Crecimiento provee el soporte continuo necesario a esta escala.", "sustained_growth");
  } else if (budgetBand === "5k_plus") {
    add("MS-03", 4, "Enterprise Retainer delivers the SLA coverage appropriate for complex, high-value deployments.", "El Retainer Enterprise entrega la cobertura de SLA adecuada para despliegues complejos de alto valor.", "risk_management");
    add("IS-05", 3, "Custom Agent Build unlocks bespoke automation beyond the standard catalogue.", "El Agente Personalizado desbloquea automatización a medida más allá del catálogo estándar.", "competitive_edge");
  }

  if (aiExpRaw === false || aiExpRaw === null) add("CS-01", 2, "AI Readiness Audit recommended as first step for businesses new to AI.", "Auditoría de Madurez IA recomendada como primer paso para negocios nuevos en IA.", "risk_reduction");
  if (!scores.has("IS-01") && budgetBand !== "under_500") add("IS-01", 1, "AI Onboarding Sprint provides the fastest path from decision to live deployment.", "El Sprint de Incorporación IA provee la ruta más rápida de decisión a despliegue.", "speed_to_value");

  const result = Array.from(scores.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 5)
    .map(([id, ps], idx) => {
      const product = getProduct(id);
      if (!product) return null;
      return {
        product_id: id,
        product_name: product.name,
        tier: (idx < 2 ? "primary" : "upsell") as "primary" | "upsell",
        monthly_price_usd: product.monthly_price_usd,
        one_time_price_usd: product.one_time_price_usd,
        rationale: lang === "es" ? ps.es : ps.en,
        value_driver: ps.driver,
        priority_rank: idx + 1,
      } satisfies RecommendedProduct;
    })
    .filter((p): p is RecommendedProduct => Boolean(p));

  // Safety net: always return at least one product
  if (result.length === 0) {
    const fallback = getProduct("IS-01")!;
    result.push({ product_id: "IS-01", product_name: fallback.name, tier: "primary", monthly_price_usd: fallback.monthly_price_usd, one_time_price_usd: fallback.one_time_price_usd, rationale: lang === "es" ? "Primer despliegue recomendado para cualquier perfil de negocio." : "Recommended first deployment for any business profile.", value_driver: "speed_to_value", priority_rank: 1 });
  }
  return result;
}

function buildRuleBasedRoadmap(products: RecommendedProduct[], readinessScore: number, language: Language): RoadmapPhase[] {
  const primary = products.filter((p) => p.tier === "primary").map((p) => p.product_id);
  const upsells = products.filter((p) => p.tier === "upsell").map((p) => p.product_id);
  const phase1Products = readinessScore < 40 && primary.includes("CS-01") ? ["CS-01"] : primary.slice(0, 2).length > 0 ? primary.slice(0, 2) : [products[0]?.product_id ?? "IS-01"];
  const phase2Products = (readinessScore < 40 ? primary.filter((p) => p !== "CS-01") : upsells.slice(0, 2));
  const safePhase2 = phase2Products.length > 0 ? phase2Products : upsells.slice(0, 1).length > 0 ? upsells.slice(0, 1) : primary.slice(1).length > 0 ? primary.slice(1) : ["MS-01"];

  if (language === "es") {
    return [
      { phase: 1, title: readinessScore < 40 ? "Fase 1 — Evaluación y Planificación" : "Fase 1 — Despliegue Inicial", duration_weeks: readinessScore < 40 ? 2 : 3, products: phase1Products, description: readinessScore < 40 ? "Auditoría de madurez IA, definición de hoja de ruta y priorización de implementaciones." : `Despliegue de las herramientas IA prioritarias: ${phase1Products.join(", ")}. Configuración, integración básica y pruebas de aceptación.`, cumulative_monthly_value_usd: 0 },
      { phase: 2, title: "Fase 2 — Integración y Optimización", duration_weeks: 4, products: safePhase2, description: "Integración al stack tecnológico existente, optimización de flujos y medición de impacto operativo.", cumulative_monthly_value_usd: 0 },
    ];
  }
  return [
    { phase: 1, title: readinessScore < 40 ? "Phase 1 — Assessment & Planning" : "Phase 1 — Initial Deployment", duration_weeks: readinessScore < 40 ? 2 : 3, products: phase1Products, description: readinessScore < 40 ? "AI readiness audit, personalised roadmap definition, and implementation prioritisation." : `Deploy priority AI tools: ${phase1Products.join(", ")}. Configuration, basic integration, and acceptance testing.`, cumulative_monthly_value_usd: 0 },
    { phase: 2, title: "Phase 2 — Integration & Optimisation", duration_weeks: 4, products: safePhase2, description: "Integrate with existing tech stack, optimise workflows, and measure operational impact.", cumulative_monthly_value_usd: 0 },
  ];
}

function estimateRuleBasedValue(submission: CanonicalSubmissionJson, readinessScore: number): { value: number; reasoning: string } {
  const lang = submission.language;
  const team = (submission.business.team_size ?? "").toLowerCase();
  const ind = (submission.business.industry ?? "").toLowerCase();

  const base = team.includes("solo") || /^1\b/.test(team) ? 300 : team.includes("2-5") || team.includes("2 to 5") ? 600 : team.includes("6-20") ? 1400 : team.includes("21-50") ? 3000 : team.includes("50") ? 6000 : 500;
  const indMult = ["finance", "healthcare", "professional"].includes(ind) ? 1.5 : ["retail", "hospitality", "logistics"].includes(ind) ? 1.3 : 1.0;
  const readinessMult = readinessScore >= 60 ? 1.0 : readinessScore >= 40 ? 0.8 : 0.6;
  const value = Math.round((base * indMult * readinessMult) / 100) * 100;

  const reasoning = lang === "es"
    ? `Estimación conservadora: base $${base}/mes para ${team || "equipo pequeño"} × coeficiente de sector ${indMult}x (${ind || "general"}) × factor de madurez ${readinessMult}x (${readinessScore}/100). Supone ganancia de eficiencia del 15–25% en 2–3 procesos clave.`
    : `Conservative estimate: base $${base}/mo for ${team || "small team"} × industry coefficient ${indMult}x (${ind || "general"}) × readiness factor ${readinessMult}x (${readinessScore}/100). Assumes 15–25% efficiency gain across 2–3 core workflows.`;

  return { value, reasoning };
}

function generateRuleBasedReport(submission: CanonicalSubmissionJson): FullReport {
  const language = submission.language;
  const readiness = scoreReadiness(submission);
  const budgetBand = normalizeBudget(submission.budget.budget_comfort);
  const dataSource: "full" | "intake_only" = submission.website_scrape?.scrape_status === "success" ? "full" : "intake_only";
  const profile = toSafeProfile(submission);

  const gaps = detectRuleBasedGaps(submission);
  const products = scoreRuleBasedProducts(submission, gaps, readiness.total, budgetBand);
  const roadmap = buildRuleBasedRoadmap(products, readiness.total, language);
  const { value: estimatedValue, reasoning: valueReasoning } = estimateRuleBasedValue(submission, readiness.total);
  const confidence = Math.max(45, computeConfidence({ questionsAnswered: profile.questions_answered, dataSource, readinessScore: readiness.total }) - 10);

  const diagnosis: DiagnosisOutput = {
    business_summary: buildRuleBasedSummary(submission),
    operational_gaps: gaps,
    pain_priority_rank: gaps.map((g) => g.gap_id),
    automation_readiness_score: readiness.total,
    readiness_dimension_breakdown: readiness.dims,
    recommended_products: products,
    implementation_roadmap: roadmap,
    estimated_monthly_value_usd: estimatedValue,
    value_reasoning: valueReasoning,
    confidence_score: confidence,
    data_source: dataSource,
    reasoning_trace: "in-house-rule-based-v1",
    human_escalation_flag: readiness.total < 40 || confidence < 55,
    language,
    llm_provider: "in-house",
    llm_model: "rule-based-v1",
    generated_at: new Date().toISOString(),
  };

  const roi = computeRoi({ products, estimatedMonthlyValueUsd: estimatedValue, language });
  const beforeAfter = buildBeforeAfter({ language, gaps, roadmap, valueReasoning });
  const demos = buildDefaultDemos(language);
  return { catalogue_version: PRODUCT_CATALOGUE_VERSION, diagnosis, before_after: beforeAfter, roi, demos };
}

function fallbackReport(
  submission: CanonicalSubmissionJson,
  _meta?: { llm_provider?: string; llm_model?: string; reason?: string | null }
): FullReport {
  return generateRuleBasedReport(submission);
}

function _fallbackReport_unused(
  submission: CanonicalSubmissionJson,
  meta?: { llm_provider?: string; llm_model?: string; reason?: string | null }
): FullReport {
  const profile = toSafeProfile(submission);
  const dataSource: "full" | "intake_only" =
    submission.website_scrape && submission.website_scrape.scrape_status === "success" ? "full" : "intake_only";
  const readiness = scoreReadiness(submission);
  const confidence = computeConfidence({ questionsAnswered: profile.questions_answered, dataSource, readinessScore: readiness.total });
  const demos = buildDefaultDemos(submission.language);
  const llmProvider = meta?.llm_provider ?? "disabled";
  const llmModel = meta?.llm_model ?? "disabled";
  const reason = meta?.reason ? String(meta.reason).slice(0, 140) : null;
  const isConfigMissing = llmProvider === "disabled" || llmModel === "disabled";
  const productsBase = fallbackRecommendations(submission, readiness.total);
  const products = isConfigMissing
    ? productsBase
    : productsBase.map((p) => ({
        ...p,
        rationale:
          submission.language === "es"
            ? "Recomendación por defecto (IA no disponible temporalmente)."
            : "Default recommendation (AI temporarily unavailable).",
      }));
  const roi = computeRoi({ products, estimatedMonthlyValueUsd: 0, language: submission.language });
  const diagnosis: DiagnosisOutput = {
    business_summary:
      submission.language === "es"
        ? isConfigMissing
          ? "Resumen generado sin IA (modelo no configurado). Conecta un modelo en /admin/settings para un diagnóstico completo."
          : `Diagnóstico IA no disponible temporalmente. Motivo: ${reason ?? "error desconocido"}. Puedes rehacer el análisis.`
        : isConfigMissing
          ? "Summary generated without AI (model not configured). Connect a model in /admin/settings for a full diagnosis."
          : `AI diagnosis temporarily unavailable. Reason: ${reason ?? "unknown error"}. You can redo the analysis.`,
    operational_gaps: fallbackGaps(submission),
    pain_priority_rank: fallbackGaps(submission).map((g) => g.gap_id),
    automation_readiness_score: readiness.total,
    readiness_dimension_breakdown: readiness.dims,
    recommended_products: products,
    implementation_roadmap: [
      {
        phase: 1,
        title: submission.language === "es" ? "Fase 1 — Fundaciones" : "Phase 1 — Foundations",
        duration_weeks: 2,
        products: products.slice(0, 2).map((p) => p.product_id),
        description:
          submission.language === "es"
            ? "Definir alcance, conectar datos básicos y desplegar una primera automatización."
            : "Define scope, connect basic data, and deploy a first automation.",
        cumulative_monthly_value_usd: 0,
      },
      {
        phase: 2,
        title: submission.language === "es" ? "Fase 2 — Optimización" : "Phase 2 — Optimisation",
        duration_weeks: 3,
        products: products.slice(2).map((p) => p.product_id),
        description: submission.language === "es" ? "Ampliar cobertura y medir desempeño." : "Expand coverage and track performance.",
        cumulative_monthly_value_usd: 0,
      },
    ],
    estimated_monthly_value_usd: 0,
    value_reasoning:
      submission.language === "es"
        ? isConfigMissing
          ? "Valor estimado pendiente de IA. Conecta un modelo para generar cálculos basados en señales del negocio."
          : "Valor estimado pendiente de IA. Reintenta el análisis para generar cálculos basados en señales del negocio."
        : isConfigMissing
          ? "Estimated value pending AI. Connect a model to generate calculations from business signals."
          : "Estimated value pending AI. Rerun analysis to generate calculations from business signals.",
    confidence_score: confidence,
    data_source: dataSource,
    reasoning_trace: "fallback_mode",
    human_escalation_flag: readiness.total < 40 || confidence < 60,
    language: submission.language,
    llm_provider: llmProvider,
    llm_model: llmModel,
    generated_at: new Date().toISOString(),
  };
  const beforeAfter = buildBeforeAfter({ language: submission.language, gaps: diagnosis.operational_gaps, roadmap: diagnosis.implementation_roadmap, valueReasoning: diagnosis.value_reasoning });
  return {
    catalogue_version: PRODUCT_CATALOGUE_VERSION,
    diagnosis,
    before_after: beforeAfter,
    roi,
    demos,
  };
}

function normalizeBudget(budget: string | null): "under_500" | "500_2k" | "2k_5k" | "5k_plus" | "unknown" {
  const b = (budget ?? "").toLowerCase();
  if (b.includes("under") || b.includes("<500") || b.includes("0-500") || b.includes("500-")) return "under_500";
  if (b.includes("500") && (b.includes("2k") || b.includes("2000") || b.includes("2,000") || b.includes("500–") || b.includes("500-2"))) return "500_2k";
  if (b.includes("2k") || b.includes("2000") || b.includes("2,000")) return "2k_5k";
  if (b.includes("5k") || b.includes("5000")) return "5k_plus";
  return "unknown";
}

function scoreReadiness(submission: CanonicalSubmissionJson): { total: number; dims: ReadinessDimensions } {
  const tools = new Set((submission.tools.existing_tools ?? []).map((t) => t.toLowerCase()));
  const tech = new Set((submission.website_scrape?.tech_stack_detected ?? []).map((t) => t.toLowerCase()));
  const toolSignals = ["shopify", "hubspot", "salesforce", "slack", "zendesk", "stripe", "quickbooks", "google analytics"];
  const toolHits = toolSignals.filter((s) => tools.has(s) || tech.has(s));

  const dataText = (submission.pain_points.data_situation ?? "").toLowerCase();
  const dataAvailability = dataText.includes("csv") || dataText.includes("spreadsheet") || dataText.includes("report") ? 15 : dataText ? 10 : 5;

  const toolMaturity = toolHits.length >= 2 ? 15 : toolHits.length === 1 ? 10 : tools.size > 0 ? 8 : 3;

  const budgetBand = normalizeBudget(submission.budget.budget_comfort);
  const budgetComfort = budgetBand === "5k_plus" ? 20 : budgetBand === "2k_5k" ? 15 : budgetBand === "500_2k" ? 10 : budgetBand === "under_500" ? 5 : 8;

  const teamText = (submission.business.team_size ?? "").toLowerCase();
  const decisionAuthority = teamText.includes("1") || teamText.includes("2-5") ? 15 : teamText.includes("50") ? 5 : 10;

  const urgencyText = (submission.goals.urgency_flag ?? "").toLowerCase();
  const urgency = urgencyText.includes("30") || urgencyText.includes("month") || urgencyText.includes("asap") ? 15 : urgencyText ? 10 : 5;

  const dims: ReadinessDimensions = {
    data_availability: clampInt(dataAvailability, 0, 20),
    tool_maturity: clampInt(toolMaturity, 0, 20),
    budget_comfort: clampInt(budgetComfort, 0, 20),
    decision_authority: clampInt(decisionAuthority, 0, 20),
    urgency: clampInt(urgency, 0, 20),
  };
  const total = dims.data_availability + dims.tool_maturity + dims.budget_comfort + dims.decision_authority + dims.urgency;
  return { total: clampInt(total, 0, 100), dims };
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function fallbackGaps(submission: CanonicalSubmissionJson): OperationalGap[] {
  const gaps: OperationalGap[] = [];
  if (submission.pain_points.top_time_cost) {
    gaps.push({
      gap_id: "time_heavy_manual_work",
      description: submission.pain_points.top_time_cost,
      severity_score: 8,
      evidence_source: "form",
    });
  }
  if (submission.pain_points.bottleneck) {
    gaps.push({
      gap_id: "process_bottleneck",
      description: submission.pain_points.bottleneck,
      severity_score: 7,
      evidence_source: "form",
    });
  }
  if (gaps.length === 0) {
    gaps.push({
      gap_id: "low_operational_visibility",
      description:
        submission.language === "es"
          ? "Falta de visibilidad operativa y seguimiento consistente en procesos clave."
          : "Lack of operational visibility and consistent tracking across key processes.",
      severity_score: 6,
      evidence_source: "inferred",
    });
  }
  return gaps.slice(0, 3);
}

function fallbackRecommendations(submission: CanonicalSubmissionJson, readinessScore: number): RecommendedProduct[] {
  const budgetBand = normalizeBudget(submission.budget.budget_comfort);
  const picks: string[] =
    readinessScore < 40
      ? ["CS-01", "IS-01"]
      : budgetBand === "under_500"
        ? ["CB-01", "IS-01", "MS-01"]
        : budgetBand === "500_2k"
          ? ["AVA-01", "IS-01", "MS-02"]
          : budgetBand === "5k_plus"
            ? ["CB-01", "CA-01", "AVA-01", "MS-03"]
            : ["CA-01", "IS-02", "MS-02"];

  return picks
    .map((id, idx) => {
      const p = getProduct(id);
      if (!p) return null;
      return {
        product_id: p.id,
        product_name: p.name,
        tier: idx < 2 ? "primary" : "upsell",
        monthly_price_usd: p.monthly_price_usd,
        one_time_price_usd: p.one_time_price_usd,
        rationale:
          submission.language === "es"
            ? "Recomendación por defecto (IA no configurada)."
            : "Default recommendation (AI not configured).",
        value_driver: "time_saved",
        priority_rank: idx + 1,
      } satisfies RecommendedProduct;
    })
    .filter((v): v is RecommendedProduct => Boolean(v));
}

export async function generateFullReport(submission: CanonicalSubmissionJson): Promise<FullReport> {
  const safeProfile = toSafeProfile(submission);
  const safeScrape = toSafeScrape(submission);
  const SCRAPE_HAS_DATA = new Set<string>(["success", "partial", "low_confidence"]);
  const isFormOnly = !safeScrape || !submission.website_scrape || !SCRAPE_HAS_DATA.has(submission.website_scrape.scrape_status);
  const dataSource: "full" | "intake_only" = isFormOnly ? "intake_only" : "full";
  const language = submission.language;

  const totalRetries = 2;
  let lastError: string | null = null;
  let lastProvider: string = "disabled";
  let lastModel: string = "disabled";

  for (let attempt = 0; attempt <= totalRetries; attempt++) {
    const pass1 = await callPassJson({
      language,
      system: `You are the ROBO AI Agency Master Analyzer Agent — a senior AI automation consultant with deep operational experience. ${languageInstruction(language)}\n\nPASS 1 — BUSINESS CONTEXT SYNTHESIS\nReturn ONLY valid JSON matching this schema:\n{"business_summary":"string — 150-220 words, analytical tone"}`,
      user: `BUSINESS PROFILE (intake form):\n${JSON.stringify(safeProfile, null, 2)}\n\nWEBSITE DATA (from scraper):\n${safeScrape ? JSON.stringify(safeScrape, null, 2) : "NOT AVAILABLE — website was not scraped or scrape failed."}`,
      schema: Pass1Schema,
    });
    if (!pass1.ok) {
      lastProvider = pass1.llm_provider;
      lastModel = pass1.llm_model;
      lastError = `pass1:${pass1.error}${pass1.llm_error ? `:${pass1.llm_error}` : ""}`;
      continue;
    }
    lastProvider = pass1.llm_provider;
    lastModel = pass1.llm_model;
    await new Promise((r) => setTimeout(r, 2000));

    const pass2 = await callPassJson({
      language,
      system: `You are the ROBO AI Agency Master Analyzer Agent. ${languageInstruction(language)}\n\nPASS 2 — GAP & PAIN ANALYSIS\nIdentify the top 3 operational gaps. Rank by severity: revenue_impact × frequency × manual_effort_hours.\nReturn ONLY valid JSON:\n{"operational_gaps":[{"gap_id":"string","description":"string","severity_score":1,"evidence_source":"form|scrape|both|inferred"}],"pain_priority_rank":["gap_id_1","gap_id_2","gap_id_3"]}`,
      user: `BUSINESS CONTEXT SUMMARY (Pass 1):\n${pass1.data.business_summary}\n\nBUSINESS PROFILE:\n${JSON.stringify(safeProfile, null, 2)}\n\nWEBSITE DATA:\n${safeScrape ? JSON.stringify(safeScrape, null, 2) : "NOT AVAILABLE"}`,
      schema: Pass2Schema,
    });
    if (!pass2.ok) {
      lastProvider = pass2.llm_provider;
      lastModel = pass2.llm_model;
      lastError = `pass2:${pass2.error}${pass2.llm_error ? `:${pass2.llm_error}` : ""}`;
      continue;
    }
    lastProvider = pass2.llm_provider;
    lastModel = pass2.llm_model;
    await new Promise((r) => setTimeout(r, 2000));

    const pass3 = await callPassJson({
      language,
      system: `You are the ROBO AI Agency Master Analyzer Agent. ${languageInstruction(language)}\n\nPASS 3 — AUTOMATION READINESS SCORING\nScore 0–100 across five dimensions (0–20 each): data_availability, tool_maturity, budget_comfort, decision_authority, urgency.\nReturn ONLY valid JSON:\n{"automation_readiness_score":0,"readiness_dimension_breakdown":{"data_availability":0,"tool_maturity":0,"budget_comfort":0,"decision_authority":0,"urgency":0},"readiness_reasoning":"string — 2-3 sentences citing signals"}`,
      user: `BUSINESS CONTEXT:\n${pass1.data.business_summary}\n\nTOP GAPS:\n${JSON.stringify(pass2.data.operational_gaps, null, 2)}\n\nBUSINESS PROFILE:\n${JSON.stringify(safeProfile, null, 2)}\n\nWEBSITE DATA:\n${safeScrape ? JSON.stringify(safeScrape, null, 2) : "NOT AVAILABLE"}`,
      schema: Pass3Schema,
    });
    if (!pass3.ok) {
      lastProvider = pass3.llm_provider;
      lastModel = pass3.llm_model;
      lastError = `pass3:${pass3.error}${pass3.llm_error ? `:${pass3.llm_error}` : ""}`;
      continue;
    }
    lastProvider = pass3.llm_provider;
    lastModel = pass3.llm_model;
    await new Promise((r) => setTimeout(r, 2000));

    const catalogueLite = PRODUCT_CATALOGUE.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      monthly_price_usd: p.monthly_price_usd,
      one_time_price_usd: p.one_time_price_usd,
    }));

    const pass4 = await callPassJson({
      language,
      system: `You are the ROBO AI Agency Master Analyzer Agent. ${languageInstruction(language)}\n\nPASS 4 — PRODUCT MATCHING & ROADMAP\nOnly use product IDs from the provided catalogue. NEVER invent new IDs.\nProvide conservative MONTHLY VALUE estimation and show calculation in value_reasoning.\nReturn ONLY valid JSON:\n{"recommended_products":[{"product_id":"string","product_name":"string","tier":"primary|upsell","monthly_price_usd":0,"one_time_price_usd":0,"rationale":"string","value_driver":"string","priority_rank":1}],"implementation_roadmap":[{"phase":1,"title":"string","duration_weeks":1,"products":["product_id"],"description":"string","cumulative_monthly_value_usd":0}],"estimated_monthly_value_usd":0,"value_reasoning":"string"}`,
      user: `BUSINESS CONTEXT:\n${pass1.data.business_summary}\n\nTOP GAPS (ranked):\n${JSON.stringify(pass2.data.operational_gaps, null, 2)}\nPAIN PRIORITY RANK:\n${JSON.stringify(pass2.data.pain_priority_rank)}\n\nREADINESS SCORE: ${pass3.data.automation_readiness_score}/100\nREADINESS BREAKDOWN:\n${JSON.stringify(pass3.data.readiness_dimension_breakdown, null, 2)}\n\nBUSINESS PROFILE:\n${JSON.stringify(safeProfile, null, 2)}\n\nWEBSITE DATA:\n${safeScrape ? JSON.stringify(safeScrape, null, 2) : "NOT AVAILABLE"}\n\nPRODUCT CATALOGUE (only use IDs from this list):\n${JSON.stringify(catalogueLite, null, 2)}`,
      schema: Pass4Schema,
    });
    if (!pass4.ok) {
      lastProvider = pass4.llm_provider;
      lastModel = pass4.llm_model;
      lastError = `pass4:${pass4.error}${pass4.llm_error ? `:${pass4.llm_error}` : ""}`;
      continue;
    }
    lastProvider = pass4.llm_provider;
    lastModel = pass4.llm_model;

    const hallucinated = validateProductIds(pass4.data.recommended_products.map((p) => p.product_id));
    if (hallucinated.length > 0) {
      lastError = `hallucinated_products:${hallucinated.join(",")}`;
      continue;
    }

    const dimSum =
      pass3.data.readiness_dimension_breakdown.data_availability +
      pass3.data.readiness_dimension_breakdown.tool_maturity +
      pass3.data.readiness_dimension_breakdown.budget_comfort +
      pass3.data.readiness_dimension_breakdown.decision_authority +
      pass3.data.readiness_dimension_breakdown.urgency;
    if (Math.abs(dimSum - pass3.data.automation_readiness_score) > 5) {
      lastError = `readiness_sum_mismatch:${dimSum}:${pass3.data.automation_readiness_score}`;
      continue;
    }

    const questionsAnswered = safeProfile.questions_answered;
    const confidenceScore = computeConfidence({
      questionsAnswered,
      dataSource,
      readinessScore: pass3.data.automation_readiness_score,
    });
    const humanEscalation = pass3.data.automation_readiness_score < 40 || confidenceScore < 60;

    const reasoningTrace = [
      `Data source: ${dataSource}`,
      `Questions answered: ${questionsAnswered}`,
      `Readiness score: ${pass3.data.automation_readiness_score} (${JSON.stringify(pass3.data.readiness_dimension_breakdown)})`,
      `Readiness reasoning: ${pass3.data.readiness_reasoning}`,
      `Confidence calculation: base=${Math.min(100, questionsAnswered * 8)} scrape_penalty=${dataSource === "intake_only" ? 15 : 0} readiness_penalty=${pass3.data.automation_readiness_score < 30 ? 10 : 0} final=${confidenceScore}`,
      `Value estimation: ${pass4.data.value_reasoning}`,
      `Attempt: ${attempt + 1}/${totalRetries + 1}`,
    ].join("\n");

    const diagnosis: DiagnosisOutput = {
      business_summary: pass1.data.business_summary,
      operational_gaps: pass2.data.operational_gaps,
      pain_priority_rank: pass2.data.pain_priority_rank,
      automation_readiness_score: pass3.data.automation_readiness_score,
      readiness_dimension_breakdown: pass3.data.readiness_dimension_breakdown,
      recommended_products: pass4.data.recommended_products,
      implementation_roadmap: pass4.data.implementation_roadmap,
      estimated_monthly_value_usd: pass4.data.estimated_monthly_value_usd,
      value_reasoning: pass4.data.value_reasoning,
      confidence_score: confidenceScore,
      data_source: dataSource,
      reasoning_trace: reasoningTrace,
      human_escalation_flag: humanEscalation,
      language,
      llm_provider: pass4.llm_provider,
      llm_model: pass4.llm_model,
      generated_at: new Date().toISOString(),
    };

    const roi = computeRoi({
      products: diagnosis.recommended_products,
      estimatedMonthlyValueUsd: diagnosis.estimated_monthly_value_usd,
      language,
    });
    const beforeAfter = buildBeforeAfter({
      language,
      gaps: diagnosis.operational_gaps,
      roadmap: diagnosis.implementation_roadmap,
      valueReasoning: diagnosis.value_reasoning,
    });
    const demos = buildDefaultDemos(language);

    return {
      catalogue_version: PRODUCT_CATALOGUE_VERSION,
      diagnosis,
      before_after: beforeAfter,
      roi,
      demos,
    };
  }

  return generateRuleBasedReport(submission);
}
