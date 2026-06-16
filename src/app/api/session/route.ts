import { NextResponse, type NextRequest } from "next/server";
import { SessionCreateSchema } from "@/lib/validations";
import { createOrResumeSession } from "@/lib/server/store";

export async function POST(req: NextRequest) {
  const body = SessionCreateSchema.parse(await req.json());
  const created = createOrResumeSession({
    language: body.language,
    source_product_id: body.source_product_id,
    profile_id: body.profile_id,
  });
  return NextResponse.json(created);
}

