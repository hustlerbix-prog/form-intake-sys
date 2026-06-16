import { NextResponse, type NextRequest } from "next/server";
import { getPipelineStatus, getSubmissionJson, getPdfBytes } from "@/lib/server/store";

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");
  if (!profileId) return NextResponse.json({ error: "Missing profile_id" }, { status: 400 });

  const status = getPipelineStatus({ profile_id: profileId });
  const submission = getSubmissionJson({ profile_id: profileId });
  const pdf = getPdfBytes({ profile_id: profileId });

  return NextResponse.json({
    submitted: Boolean(status?.submitted),
    scraped: Boolean(status?.scraped),
    analyzed: Boolean(status?.analyzed),
    analysis_running: Boolean(status?.analysis_running),
    pdf_ready: Boolean(status?.pdf_ready && pdf),
    pdf_url: status?.pdf_ready && pdf ? `/api/download/pdf?profile_id=${profileId}` : null,
    json_url: submission ? `/api/download/json?profile_id=${profileId}` : null,
    report: submission?.full_report
      ? {
          catalogue_version: submission.full_report.catalogue_version,
          business_summary: submission.full_report.diagnosis.business_summary,
          operational_gaps: submission.full_report.diagnosis.operational_gaps,
          readiness_score: submission.full_report.diagnosis.automation_readiness_score,
          recommended_products: submission.full_report.diagnosis.recommended_products,
          estimated_monthly_value_usd: submission.full_report.diagnosis.estimated_monthly_value_usd,
          data_source: submission.full_report.diagnosis.data_source,
          llm_provider: submission.full_report.diagnosis.llm_provider,
          llm_model: submission.full_report.diagnosis.llm_model,
          reasoning_trace: submission.full_report.diagnosis.reasoning_trace,
          roi: submission.full_report.roi,
          before_after: submission.full_report.before_after,
          demos: submission.full_report.demos,
        }
      : null,
  });
}
