import { NextResponse, type NextRequest } from "next/server";
import { getSubmissionJson } from "@/lib/server/store";
import { addKbSourceText, createDraftAgent } from "@/lib/server/builderStore";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { profile_id?: string; dev?: boolean };
  const profileId = body.profile_id ?? (body.dev ? `dev_${randomUUID()}` : null);
  if (!profileId) return NextResponse.json({ error: "Missing profile_id" }, { status: 400 });

  const agent = createDraftAgent({ profile_id: profileId });
  const submission = getSubmissionJson({ profile_id: profileId });
  if (submission) {
    addKbSourceText({
      agent_id: agent.id,
      name: "BA-001 Intake + Submission JSON",
      type: "intake",
      text: JSON.stringify(submission, null, 2),
    });
    if (submission.website_scrape) {
      addKbSourceText({
        agent_id: agent.id,
        name: "BA-002 Website Scrape",
        type: "scrape",
        text: JSON.stringify(submission.website_scrape, null, 2),
      });
    }
    if (submission.full_report) {
      addKbSourceText({
        agent_id: agent.id,
        name: "BA-004 Diagnosis Report",
        type: "report",
        text: JSON.stringify(submission.full_report, null, 2),
      });
    }
  }

  return NextResponse.json({ agent_id: agent.id });
}
