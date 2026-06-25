import { describe, expect, it } from "vitest";
import { generateIntakePdf } from "./generator";

describe("generateIntakePdf", () => {
  it("creates a non-empty PDF", async () => {
    const bytes = await generateIntakePdf({
      submission: {
        profile_id: "00000000-0000-0000-0000-000000000000",
        created_at: new Date().toISOString(),
        language: "en",
        source_product_id: null,
        answers_raw: {},
        questionnaire: [
          {
            layer: "CONTEXT",
            question_id: "Q-01",
            field: "industry",
            question: "What industry does your business operate in?",
            answer: "Logistics & Supply Chain",
          },
        ],
        website_scrape: {
          profile_id: "00000000-0000-0000-0000-000000000000",
          website_url: "https://example.com",
          scraped_at: new Date().toISOString(),
          scrape_status: "success",
          final_url: "https://example.com",
          status_code: 200,
          page_title: "Example",
          meta_description: "Example",
          detected_language: "en",
          confidence_score: 0.5,
          tech_stack_detected: ["Cloudflare"],
          tech_profile: {
            cms: "unknown",
            js_framework: "unknown",
            hosting: "cloudflare",
            analytics: [],
            crm_signals: [],
            payment_processors: [],
            chat_tools: [],
            booking_tools: [],
            ecommerce_signals: [],
            latam_tools: [],
            integration_complexity: 3,
            integration_notes: "",
            whatsapp_present: false,
          },
          social_links: {},
          content_excerpt: "Example excerpt",
          content_summary: "Example summary",
          content_corpus: null,
          ai_summary: "AI summary",
          ai_services_detected: ["Service A"],
          ai_industry: "other",
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
          error_message: null,
        },
        full_report: null,
        business: {
          industry: "logistics",
          team_size: "2-5",
          revenue_range: "10-50k",
          website_url: "https://example.com",
        },
        operations: {
          core_ops: "Dispatch, routing, invoicing",
        },
        pain_points: {
          top_time_cost: "Scheduling",
          bottleneck: "Inbound requests",
          data_situation: "Spreadsheets",
          decision_speed: "1–2 days",
          risk_areas: ["compliance"],
          prior_ai_experience: false,
        },
        goals: {
          success_definition: "Faster response times",
          urgency_flag: "Next month",
        },
        tools: { existing_tools: ["excel"] },
        budget: { budget_comfort: "500-2k" },
        contact: { email: "test@example.com", first_name: "Test", consent_marketing: false },
      },
      calendarUrl: "https://cal.com/demo",
    });

    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("sanitizes unicode report text that standard PDF fonts cannot encode", async () => {
    const bytes = await generateIntakePdf({
      submission: {
        profile_id: "00000000-0000-0000-0000-000000000001",
        created_at: new Date().toISOString(),
        language: "en",
        source_product_id: null,
        answers_raw: { website_url: "https://example.com" },
        questionnaire: [
          {
            layer: "CONTEXT",
            question_id: "Q-12",
            field: "website_url",
            question: "What is your website URL?",
            answer: "https://example.com",
          },
        ],
        website_scrape: null,
        full_report: {
          catalogue_version: "v1.0",
          diagnosis: {
            business_summary: "Summary generated without AI -> now rerun with configured model.",
            operational_gaps: [
              {
                gap_id: "low_visibility",
                description: "Lead enters by web/chat -> CRM -> assignment -> follow-up.",
                severity_score: 6,
                evidence_source: "both",
              },
            ],
            pain_priority_rank: ["low_visibility"],
            automation_readiness_score: 40,
            readiness_dimension_breakdown: {
              data_availability: 8,
              tool_maturity: 8,
              budget_comfort: 8,
              decision_authority: 8,
              urgency: 8,
            },
            recommended_products: [
              {
                product_id: "CB-01",
                product_name: "AI Chatbot",
                tier: "primary",
                monthly_price_usd: 499,
                one_time_price_usd: null,
                rationale: "Mini demo - AI Chatbot with FAQ automation.",
                value_driver: "lead_capture",
                priority_rank: 1,
              },
            ],
            implementation_roadmap: [
              {
                phase: 1,
                title: "Phase 1 - Foundations",
                duration_weeks: 2,
                products: ["CB-01"],
                description: "Deploy chatbot -> capture leads.",
                cumulative_monthly_value_usd: 500,
              },
              {
                phase: 2,
                title: "Phase 2 - Optimisation",
                duration_weeks: 2,
                products: ["AO-02"],
                description: "Add dashboard -> weekly KPI reporting.",
                cumulative_monthly_value_usd: 800,
              },
            ],
            estimated_monthly_value_usd: 800,
            value_reasoning: "Savings come from fewer manual follow-ups -> faster response times.",
            confidence_score: 0.7,
            data_source: "intake_only",
            reasoning_trace: "form + website",
            human_escalation_flag: false,
            language: "en",
            llm_provider: "disabled",
            llm_model: "disabled",
            generated_at: new Date().toISOString(),
          },
          before_after: {
            before: "Before - manual-heavy process.",
            after: "After - automated intake and routing.",
            revenue_support: "1) Lead via web/chat -> 2) CRM -> 3) email/SMS.",
          },
          roi: {
            monthly_value_usd: 800,
            monthly_cost_usd: 499,
            one_time_cost_usd: 0,
            net_monthly_value_usd: 301,
            payback_months: 2,
            roi_12mo_percent: 72,
            assumptions: ["Conservative estimate..."],
          },
          demos: {
            chatbot: { title: "Mini demo - AI Chatbot", script: ["Visitor -> bot", "Bot -> booking"] },
            voice_assistant: { title: "Mini demo - AI Voice Assistant", script: ["Caller -> agent"] },
            automations: { title: "Mini demo - AI Automations", script: ["Lead -> CRM -> Slack"] },
          },
        },
        business: {
          industry: null,
          team_size: null,
          revenue_range: null,
          website_url: "https://example.com",
        },
        operations: { core_ops: null },
        pain_points: {
          top_time_cost: null,
          bottleneck: null,
          data_situation: null,
          decision_speed: null,
          risk_areas: [],
          prior_ai_experience: null,
        },
        goals: { success_definition: null, urgency_flag: null },
        tools: { existing_tools: [] },
        budget: { budget_comfort: null },
        contact: null,
      },
    });

    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
