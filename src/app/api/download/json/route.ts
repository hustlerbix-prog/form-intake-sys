import { NextResponse, type NextRequest } from "next/server";
import { getSubmissionJson } from "@/lib/server/store";

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");
  if (!profileId) return NextResponse.json({ error: "Missing profile_id" }, { status: 400 });

  const submission = getSubmissionJson({ profile_id: profileId });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filename = `robo_intake_${profileId.split("-")[0]}.json`;
  return new NextResponse(JSON.stringify(submission, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
}

