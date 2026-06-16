import { NextResponse, type NextRequest } from "next/server";
import { RedoAnalysisSchema } from "@/lib/validations";
import { redoAnalysis } from "@/lib/server/store";

export async function POST(req: NextRequest) {
  const body = RedoAnalysisSchema.parse(await req.json());
  const ok = await redoAnalysis({ profile_id: body.profile_id });

  if (!ok) {
    return NextResponse.json({ error: "Profile not found or not submitted" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, profile_id: body.profile_id });
}
