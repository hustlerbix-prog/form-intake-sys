import { NextResponse, type NextRequest } from "next/server";
import { ProfileSubmitSchema } from "@/lib/validations";
import { submitProfile } from "@/lib/server/store";

// Vercel: allow up to 300s for the full pipeline (scrape + AI analyze + PDF)
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = ProfileSubmitSchema.parse(await req.json());
  const submission = submitProfile({
    profile_id: body.profile_id,
    contact: body.contact,
    language: body.language,
  });

  if (!submission) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, profile_id: body.profile_id });
}
