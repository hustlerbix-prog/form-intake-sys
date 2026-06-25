import { NextResponse, type NextRequest } from "next/server";
import { getSubmissionJson } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");
  if (!profileId) return NextResponse.json({ error: "Missing profile_id" }, { status: 400 });

  const submission = getSubmissionJson({ profile_id: profileId });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Strip raw HTML from scrape (internal pipeline artifact, not useful for agents)
  const scrape = submission.website_scrape;
  const scrapeClean = scrape
    ? (Object.fromEntries(Object.entries(scrape).filter(([k]) => k !== "raw_html_snapshot")) as Omit<typeof scrape, "raw_html_snapshot">)
    : null;

  // Build agent knowledge base — all useful data in one clean structure
  const knowledgeBase = scrapeClean
    ? {
        _description: "Website intelligence + business profile — ready for chatbot, voice, or AI agent ingestion",
        business: {
          url: scrapeClean.website_url,
          final_url: scrapeClean.final_url,
          name: scrapeClean.page_title,
          industry: scrapeClean.ai_industry ?? submission.business.industry,
          team_size: submission.business.team_size,
          revenue_range: submission.business.revenue_range,
          description: scrapeClean.ai_summary ?? scrapeClean.content_summary,
          detected_language: scrapeClean.detected_language ?? submission.language,
          tone_of_voice: scrapeClean.tone_of_voice,
          target_audience: scrapeClean.target_audience ?? [],
          brand_story: scrapeClean.brand_story,
          geo_coverage: scrapeClean.geo_coverage,
        },
        services: scrapeClean.services ?? [],
        pricing: scrapeClean.pricing_signals,
        contact: scrapeClean.contact_info,
        social_links: scrapeClean.social_links,
        social_proof: scrapeClean.social_proof,
        tech_stack: scrapeClean.tech_stack_detected,
        tech_profile: scrapeClean.tech_profile,
        operational_tools: scrapeClean.operational_tools ?? [],
        pain_points: {
          top_time_cost: submission.pain_points.top_time_cost,
          bottleneck: submission.pain_points.bottleneck,
          data_situation: submission.pain_points.data_situation,
          prior_ai_experience: submission.pain_points.prior_ai_experience,
          risk_areas: submission.pain_points.risk_areas,
        },
        existing_tools: submission.tools.existing_tools,
        budget: submission.budget.budget_comfort,
        goals: submission.goals,
        full_text_corpus: scrapeClean.content_corpus ?? scrapeClean.content_excerpt,
        ai_analysis: submission.full_report
          ? {
              business_summary: submission.full_report.diagnosis.business_summary,
              operational_gaps: submission.full_report.diagnosis.operational_gaps,
              readiness_score: submission.full_report.diagnosis.automation_readiness_score,
              recommended_products: submission.full_report.diagnosis.recommended_products,
              estimated_monthly_value_usd: submission.full_report.diagnosis.estimated_monthly_value_usd,
              value_reasoning: submission.full_report.diagnosis.value_reasoning,
              implementation_roadmap: submission.full_report.diagnosis.implementation_roadmap,
            }
          : null,
      }
    : null;

  const output = {
    ...submission,
    website_scrape: scrapeClean,
    knowledge_base: knowledgeBase,
  };

  const filename = `robo_intake_${profileId.split("-")[0]}.json`;
  return new NextResponse(JSON.stringify(output, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
