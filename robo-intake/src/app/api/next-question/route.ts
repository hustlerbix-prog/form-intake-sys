import { NextResponse, type NextRequest } from "next/server";
import { NextQuestionSchema } from "@/lib/validations";
import { selectNextQuestionAI } from "@/lib/server/questionEngine";

export async function POST(req: NextRequest) {
  const body = NextQuestionSchema.parse(await req.json());
  const result = await selectNextQuestionAI({
    answers_so_far: body.answers_so_far,
    questions_shown: body.questions_shown,
    language: body.language,
  });
  return NextResponse.json(result);
}

