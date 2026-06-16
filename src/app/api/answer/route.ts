import { NextResponse, type NextRequest } from "next/server";
import { AnswerSchema } from "@/lib/validations";
import { saveAnswer } from "@/lib/server/store";

export async function POST(req: NextRequest) {
  const body = AnswerSchema.parse(await req.json());
  saveAnswer({
    profile_id: body.profile_id,
    field: body.field,
    value: body.value,
    question_id: body.question_id,
  });
  return NextResponse.json({ ok: true });
}

