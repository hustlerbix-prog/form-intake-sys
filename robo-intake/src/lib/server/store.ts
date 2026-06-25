import { randomUUID } from "crypto";
import { generateIntakePdf } from "../pdf/generator";
import { QUESTION_BANK } from "../questions";
import { appendJsonlLog } from "./logging";
import { generateFullReport, type FullReport } from "./masterAnalyzer";
import { scrapeWebsite, type ScrapeResult } from "./scraper";

export type Language = "en" | "es";

export type PipelineStatus = {
  submitted: boolean;
  scraped: boolean;
  analyzed: boolean;
  pdf_ready: boolean;
  analysis_running: boolean;
};

export type CanonicalSubmissionJson = {
  profile_id: string;
  created_at: string;
  language: Language;
  source_product_id: string | null;
  answers_raw: Record<string, unknown>;
  questionnaire: Array<{
    layer: string;
    question_id: string;
    field: string;
    question: string;
    answer: string | string[] | null;
  }>;
  website_scrape: ScrapeResult | null;
  full_report: FullReport | null;
  business: {
    industry: string | null;
    team_size: string | null;
    revenue_range: string | null;
    website_url: string | null;
  };
  operations: {
    core_ops: string | null;
  };
  pain_points: {
    top_time_cost: string | null;
    bottleneck: string | null;
    data_situation: string | null;
    decision_speed: string | null;
    risk_areas: string[];
    prior_ai_experience: boolean | null;
  };
  goals: {
    success_definition: string | null;
    urgency_flag: string | null;
  };
  tools: { existing_tools: string[] };
  budget: { budget_comfort: string | null };
  contact: { email: string; first_name: string; consent_marketing: boolean } | null;
};

type Profile = {
  profile_id: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  language: Language;
  source_product_id: string | null;
  session_status: "in_progress" | "submitted" | "expired";
  answers: Record<string, unknown>;
  questions_shown: string[];
  submission?: CanonicalSubmissionJson;
  pdf?: Uint8Array;
  pipeline: PipelineStatus;
  website_scrape: ScrapeResult | null;
  website_scrape_in_flight?: Promise<void>;
  website_scrape_url?: string | null;
  analysis_in_flight?: Promise<void>;
};

type Store = {
  profiles: Map<string, Profile>;
};

function getStore(): Store {
  const g = globalThis as unknown as { __roboStore?: Store };
  if (!g.__roboStore) {
    g.__roboStore = { profiles: new Map() };
  }
  return g.__roboStore;
}

export function createOrResumeSession(input: {
  language: Language;
  source_product_id?: string;
  profile_id?: string;
}): { profile_id: string; expires_at: string } {
  const store = getStore();
  const now = Date.now();
  const expiresAt = new Date(now + 72 * 60 * 60 * 1000).toISOString();
  const profileId = input.profile_id;

  if (profileId) {
    const existing = store.profiles.get(profileId);
    if (existing && new Date(existing.expires_at).getTime() > now && existing.session_status !== "expired") {
      existing.updated_at = new Date().toISOString();
      return { profile_id: existing.profile_id, expires_at: existing.expires_at };
    }
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  store.profiles.set(id, {
    profile_id: id,
    created_at: createdAt,
    updated_at: createdAt,
    expires_at: expiresAt,
    language: input.language,
    source_product_id: input.source_product_id ?? null,
    session_status: "in_progress",
    answers: {},
    questions_shown: [],
    pipeline: { submitted: false, scraped: false, analyzed: false, pdf_ready: false, analysis_running: false },
    website_scrape: null,
    website_scrape_url: null,
  });

  return { profile_id: id, expires_at: expiresAt };
}

export function saveAnswer(input: {
  profile_id: string;
  field: string;
  value: unknown;
  question_id?: string;
}): void {
  const store = getStore();
  const profile = store.profiles.get(input.profile_id);
  if (!profile) return;
  profile.updated_at = new Date().toISOString();
  profile.answers[input.field] = input.value;
  if (input.question_id && !profile.questions_shown.includes(input.question_id)) {
    profile.questions_shown.push(input.question_id);
  }

  if (input.field === "website_url") {
    const url = typeof input.value === "string" ? input.value.trim() : "";
    if (url) {
      void startWebsiteScrape(profile.profile_id, url);
    }
  }
}

export function getProfile(input: { profile_id: string }): Profile | undefined {
  return getStore().profiles.get(input.profile_id);
}

export function submitProfile(input: {
  profile_id: string;
  contact?: { email: string; first_name: string; consent_marketing: boolean };
  language: Language;
}): CanonicalSubmissionJson | undefined {
  const store = getStore();
  const profile = store.profiles.get(input.profile_id);
  if (!profile) return;

  if (profile.session_status === "submitted" && profile.submission) {
    if (input.contact) {
      profile.submission.contact = {
        email: input.contact.email,
        first_name: input.contact.first_name,
        consent_marketing: input.contact.consent_marketing,
      };
      profile.updated_at = new Date().toISOString();
    }
    return profile.submission;
  }

  const submission: CanonicalSubmissionJson = {
    profile_id: profile.profile_id,
    created_at: profile.created_at,
    language: input.language,
    source_product_id: profile.source_product_id,
    answers_raw: { ...profile.answers },
    questionnaire: buildQuestionnaire({ answers: profile.answers, language: input.language }),
    website_scrape: profile.website_scrape,
    full_report: null,
    business: {
      industry: (profile.answers.industry as string | null) ?? null,
      team_size: (profile.answers.team_size as string | null) ?? null,
      revenue_range: (profile.answers.revenue_range as string | null) ?? null,
      website_url: (profile.answers.website_url as string | null) ?? null,
    },
    operations: {
      core_ops: (profile.answers.core_ops as string | null) ?? null,
    },
    pain_points: {
      top_time_cost: (profile.answers.top_time_cost as string | null) ?? null,
      bottleneck: (profile.answers.bottleneck as string | null) ?? null,
      data_situation: (profile.answers.data_situation as string | null) ?? null,
      decision_speed: (profile.answers.decision_speed as string | null) ?? null,
      risk_areas: Array.isArray(profile.answers.risk_areas)
        ? (profile.answers.risk_areas as string[])
        : profile.answers.risk_areas
          ? [String(profile.answers.risk_areas)]
          : [],
      prior_ai_experience:
        profile.answers.prior_ai_experience === undefined
          ? null
          : profile.answers.prior_ai_experience === true || profile.answers.prior_ai_experience === "yes"
            ? true
            : false,
    },
    goals: {
      success_definition: (profile.answers.success_definition as string | null) ?? null,
      urgency_flag: (profile.answers.urgency_flag as string | null) ?? null,
    },
    tools: {
      existing_tools: Array.isArray(profile.answers.existing_tools)
        ? (profile.answers.existing_tools as string[])
        : profile.answers.existing_tools
          ? [String(profile.answers.existing_tools)]
          : [],
    },
    budget: {
      budget_comfort: (profile.answers.budget_comfort as string | null) ?? null,
    },
    contact: input.contact
      ? {
          email: input.contact.email,
          first_name: input.contact.first_name,
          consent_marketing: input.contact.consent_marketing,
        }
      : null,
  };

  profile.updated_at = new Date().toISOString();
  profile.session_status = "submitted";
  profile.submission = submission;
  profile.pipeline = { submitted: true, scraped: false, analyzed: false, pdf_ready: false, analysis_running: false };

  startPipeline(profile.profile_id).catch(() => {});

  return submission;
}

function buildQuestionnaire(input: { answers: Record<string, unknown>; language: Language }): CanonicalSubmissionJson["questionnaire"] {
  return QUESTION_BANK.map((q) => {
    const value = input.answers[q.field];
    const questionText = input.language === "en" ? q.en : q.es;

    if (q.inputType === "chip-single" && q.options) {
      const found = q.options.find((o) => o.value === value);
      return {
        layer: input.language === "en" ? q.layerEn : q.layerEs,
        question_id: q.id,
        field: q.field,
        question: questionText,
        answer: found ? (input.language === "en" ? found.labelEn : found.labelEs) : value ? String(value) : null,
      };
    }

    if (q.inputType === "chip-multi" && q.options) {
      const arr = Array.isArray(value) ? (value as unknown[]).map(String) : value ? [String(value)] : [];
      const mapped = arr
        .map((v) => {
          const found = q.options?.find((o) => o.value === v);
          return found ? (input.language === "en" ? found.labelEn : found.labelEs) : v;
        })
        .filter(Boolean);
      return {
        layer: input.language === "en" ? q.layerEn : q.layerEs,
        question_id: q.id,
        field: q.field,
        question: questionText,
        answer: mapped.length ? mapped : null,
      };
    }

    return {
      layer: input.language === "en" ? q.layerEn : q.layerEs,
      question_id: q.id,
      field: q.field,
      question: questionText,
      answer: value ? String(value) : null,
    };
  });
}

async function startPipeline(profileId: string): Promise<void> {
  const store = getStore();
  const profile = store.profiles.get(profileId);
  if (!profile || !profile.submission) return;

  const websiteUrl = typeof profile.answers.website_url === "string" ? String(profile.answers.website_url) : "";
  if (websiteUrl) {
    await startWebsiteScrape(profile.profile_id, websiteUrl);
    await profile.website_scrape_in_flight?.catch(() => {});
  }
  profile.pipeline.scraped = true;

  profile.submission.website_scrape = profile.website_scrape;
  await runAnalysis(profileId);
}

async function runAnalysis(profileId: string): Promise<void> {
  const store = getStore();
  const profile = store.profiles.get(profileId);
  if (!profile || !profile.submission) return;
  if (profile.analysis_in_flight) {
    await profile.analysis_in_flight;
    return;
  }

  profile.analysis_in_flight = (async () => {
    profile.pipeline.analysis_running = true;
    profile.pipeline.analyzed = false;
    profile.pipeline.pdf_ready = false;

    await appendJsonlLog({ file: "analysis.log", event: "analysis_start", fields: { profile_id: profileId } });
    try {
      const report = await generateFullReport(profile.submission!);
      profile.submission!.full_report = report;
      profile.pipeline.analyzed = true;
      await appendJsonlLog({
        file: "analysis.log",
        event: "analysis_done",
        fields: {
          profile_id: profileId,
          data_source: report.diagnosis.data_source,
          llm_provider: report.diagnosis.llm_provider,
          llm_model: report.diagnosis.llm_model,
          confidence_score: report.diagnosis.confidence_score,
          readiness_score: report.diagnosis.automation_readiness_score,
          estimated_monthly_value_usd: report.diagnosis.estimated_monthly_value_usd,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await appendJsonlLog({
        file: "analysis.log",
        event: "analysis_failed",
        fields: { profile_id: profileId, error: message.slice(0, 200) },
      });
      profile.pipeline.analyzed = true;
    }

    const pdfBytes = await generateIntakePdf({
      submission: profile.submission!,
      calendarUrl: process.env.CALENDAR_BOOKING_URL,
    });
    profile.pdf = pdfBytes;
    profile.pipeline.pdf_ready = true;
    profile.pipeline.analysis_running = false;
    profile.analysis_in_flight = undefined;
  })();

  try {
    await profile.analysis_in_flight;
  } finally {
    profile.pipeline.analysis_running = false;
    profile.analysis_in_flight = undefined;
  }
}

export async function redoAnalysis(input: { profile_id: string }): Promise<boolean> {
  const profile = getStore().profiles.get(input.profile_id);
  if (!profile || !profile.submission || profile.session_status !== "submitted") return false;

  const websiteUrl = typeof profile.answers.website_url === "string" ? String(profile.answers.website_url) : "";
  const shouldRescrape =
    Boolean(websiteUrl) &&
    (!profile.website_scrape ||
      profile.website_scrape.scrape_status === "failed" ||
      profile.website_scrape.scrape_status === "blocked" ||
      profile.website_scrape.scrape_status === "timeout");

  if (websiteUrl && shouldRescrape) {
    await startWebsiteScrape(profile.profile_id, websiteUrl, { force: true });
    await profile.website_scrape_in_flight?.catch(() => {});
  } else if (!profile.pipeline.scraped && websiteUrl) {
    await startWebsiteScrape(profile.profile_id, websiteUrl);
    await profile.website_scrape_in_flight?.catch(() => {});
  }

  if (!profile.pipeline.scraped || shouldRescrape) {
    profile.pipeline.scraped = true;
    profile.submission.website_scrape = profile.website_scrape;
  }

  await appendJsonlLog({ file: "analysis.log", event: "analysis_redo_requested", fields: { profile_id: input.profile_id } });
  await runAnalysis(input.profile_id);
  return true;
}

export function getPipelineStatus(input: { profile_id: string }): PipelineStatus | undefined {
  return getStore().profiles.get(input.profile_id)?.pipeline;
}

export function getSubmissionJson(input: { profile_id: string }): CanonicalSubmissionJson | undefined {
  return getStore().profiles.get(input.profile_id)?.submission;
}

export function getPdfBytes(input: { profile_id: string }): Uint8Array | undefined {
  return getStore().profiles.get(input.profile_id)?.pdf;
}

export function eraseProfile(input: { profile_id: string }): boolean {
  const store = getStore();
  return store.profiles.delete(input.profile_id);
}

async function startWebsiteScrape(profileId: string, websiteUrl: string, options?: { force?: boolean }): Promise<void> {
  const store = getStore();
  const profile = store.profiles.get(profileId);
  if (!profile) return;

  const existingUrl = profile.website_scrape_url ?? null;
  if (profile.website_scrape_in_flight) return;
  if (!options?.force && existingUrl === websiteUrl && profile.website_scrape) return;

  profile.website_scrape_url = websiteUrl;
  profile.website_scrape_in_flight = (async () => {
    await appendJsonlLog({ file: "scraper.log", event: "scrape_job_start", fields: { profile_id: profileId, website_url: websiteUrl } });
    try {
      const result = await scrapeWebsite({ profile_id: profileId, website_url: websiteUrl });
      profile.website_scrape = result;
      await appendJsonlLog({ file: "scraper.log", event: "scrape_job_success", fields: { profile_id: profileId, website_url: websiteUrl, scrape_status: result.scrape_status } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      profile.website_scrape = {
        profile_id: profileId,
        website_url: websiteUrl,
        scraped_at: new Date().toISOString(),
        scrape_status: "failed",
        final_url: null,
        status_code: null,
        page_title: null,
        meta_description: null,
        detected_language: null,
        confidence_score: 0,
        tech_stack_detected: [],
        tech_profile: {
          cms: "unknown",
          js_framework: "unknown",
          hosting: "unknown",
          analytics: [],
          crm_signals: [],
          payment_processors: [],
          chat_tools: [],
          booking_tools: [],
          ecommerce_signals: [],
          latam_tools: [],
          integration_complexity: 5,
          integration_notes: "",
          whatsapp_present: false,
        },
        social_links: {},
        content_excerpt: null,
        content_summary: null,
        content_corpus: null,
        ai_summary: null,
        ai_services_detected: [],
        ai_industry: null,
        services: null,
        target_audience: null,
        tone_of_voice: null,
        pricing_signals: null,
        operational_tools: null,
        contact_info: null,
        brand_story: null,
        geo_coverage: null,
        social_proof: null,
        raw_html_snapshot: null,
        error_message: message.slice(0, 500),
      };
      await appendJsonlLog({ file: "scraper.log", event: "scrape_job_failed", fields: { profile_id: profileId, website_url: websiteUrl, error: message.slice(0, 200) } });
    } finally {
      profile.website_scrape_in_flight = undefined;
      if (profile.submission) profile.submission.website_scrape = profile.website_scrape;
    }
  })();

  await profile.website_scrape_in_flight;
}
