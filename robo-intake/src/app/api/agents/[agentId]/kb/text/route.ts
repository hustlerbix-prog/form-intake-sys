import { NextResponse, type NextRequest } from "next/server";
import { addKbSourceText } from "@/lib/server/builderStore";
import { z } from "zod";

const BodySchema = z.object({
  name: z.string().min(1).max(120),
  text: z.string().min(1).max(200000),
});

export async function POST(req: NextRequest, { params }: { params: { agentId: string } }) {
  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const src = addKbSourceText({
    agent_id: params.agentId,
    name: parsed.data.name,
    type: "text",
    text: parsed.data.text,
  });
  if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (src.status === "failed") {
    return NextResponse.json(
      { error: { code: `kb/${src.failure_type ?? "failed"}`, message: src.error_message ?? "Ingestion failed" }, source: src },
      { status: 422 }
    );
  }
  if (src.status === "error") {
    return NextResponse.json({ error: { code: "kb/error", message: src.error_message ?? "Ingestion failed" }, source: src }, { status: 500 });
  }

  return NextResponse.json({ source: src }, { status: 201 });
}
