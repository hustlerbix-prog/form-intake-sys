import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAgent } from "@/lib/server/builderStore";
import { simulateVoiceConversation } from "@/lib/server/voiceIntegrations";

const BodySchema = z.object({
  prompt: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest, { params }: { params: { agentId: string } }) {
  const agent = getAgent(params.agentId);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (agent.type !== "voice") return NextResponse.json({ error: "voice only" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const startedAt = Date.now();
  const out = await simulateVoiceConversation({ agent, prompt: parsed.data.prompt });
  return NextResponse.json({
    ...out,
    latency_ms: Date.now() - startedAt,
  });
}
