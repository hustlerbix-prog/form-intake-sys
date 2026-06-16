import { NextResponse, type NextRequest } from "next/server";
import { getPdfBytes } from "@/lib/server/store";

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");
  if (!profileId) return NextResponse.json({ error: "Missing profile_id" }, { status: 400 });

  const pdf = getPdfBytes({ profile_id: profileId });
  if (!pdf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filename = `robo_intake_${profileId.split("-")[0]}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
}
