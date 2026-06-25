import { NextResponse, type NextRequest } from "next/server";
import { getSubmissionJson, getPipelineStatus } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");
  if (!profileId) return NextResponse.json({ error: "Missing profile_id" }, { status: 400 });

  const status = getPipelineStatus({ profile_id: profileId });
  if (!status?.scraped) return NextResponse.json({ error: "Scrape not yet complete" }, { status: 404 });

  const submission = getSubmissionJson({ profile_id: profileId });
  const scrape = submission?.website_scrape;
  if (!scrape) return NextResponse.json({ error: "No scrape data found" }, { status: 404 });

  // Build agent-ready payload — strip raw HTML (internal pipeline artifact)
  const scrapeClean = Object.fromEntries(
    Object.entries(scrape).filter(([k]) => k !== "raw_html_snapshot")
  ) as Omit<typeof scrape, "raw_html_snapshot">;

  const agentKnowledgeBase = {
    _description: "Website intelligence extracted by ROBO AI Agency — ready for agent ingestion",
    _profile_id: profileId,
    _exported_at: new Date().toISOString(),
    business: {
      url: scrapeClean.website_url,
      final_url: scrapeClean.final_url,
      name: scrapeClean.page_title,
      description: scrapeClean.ai_summary ?? scrapeClean.content_summary,
      industry: scrapeClean.ai_industry,
      detected_language: scrapeClean.detected_language,
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
    full_text_corpus: scrapeClean.content_corpus ?? scrapeClean.content_excerpt,
    scrape_meta: {
      scraped_at: scrapeClean.scraped_at,
      scrape_status: scrapeClean.scrape_status,
      confidence_score: scrapeClean.confidence_score,
    },
  };

  const output = {
    ...scrapeClean,
    agent_knowledge_base: agentKnowledgeBase,
  };

  const filename = `robo_scrape_${profileId.split("-")[0]}.json`;
  return new NextResponse(JSON.stringify(output, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
