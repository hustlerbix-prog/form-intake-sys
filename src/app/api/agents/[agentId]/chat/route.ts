import { NextResponse, type NextRequest } from "next/server";
import { getAgent, getPublishedSnapshot, searchKb } from "@/lib/server/builderStore";
import { callConfiguredLlm } from "@/lib/server/llmClient";
import { z } from "zod";

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .min(1),
  mode: z.enum(["preview", "live"]).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { agentId: string } }) {
  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const agent = getAgent(params.agentId);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });

  const mode = parsed.data.mode ?? "preview";
  const snapshot = mode === "live" ? getPublishedSnapshot(params.agentId) : null;
  if (mode === "live" && !snapshot) return NextResponse.json({ error: "publish first" }, { status: 409 });

  const cfg = snapshot?.config ?? agent.config;

  const userMessage = parsed.data.messages.at(-1)?.role === "user" ? parsed.data.messages.at(-1)?.content ?? "" : "";
  const ragChunks = cfg.rag_active && userMessage ? searchKb(params.agentId, userMessage, 3) : [];

  const systemPrompt = [
    cfg.system_prompt,
    cfg.tone ? `\n\nTone: ${cfg.tone}` : "",
    cfg.language ? `\nLanguage: ${cfg.language}` : "",
    ragChunks.length > 0 ? `\n\nKNOWLEDGE BASE CONTEXT:\n${ragChunks.map((c) => c.content).join("\n\n")}` : "",
  ].join("");

  const t0 = Date.now();
  const res = await callConfiguredLlm({
    responseFormat: "text",
    messages: [
      { role: "system", content: systemPrompt },
      ...parsed.data.messages.slice(-10).map((m) => ({ role: m.role, content: m.content } as const)),
    ],
  });

  const latency = Date.now() - t0;
  if (!res.ok) {
    return NextResponse.json({
      content: cfg.language === "es" ? "No puedo responder en este momento." : "I can’t answer right now.",
      rag_chunks: ragChunks,
      latency_ms: latency,
      provider: res.provider,
      model: res.model,
    });
  }

  return NextResponse.json({
    content: res.text,
    rag_chunks: ragChunks,
    latency_ms: latency,
    provider: res.provider,
    model: res.model,
  });
}
