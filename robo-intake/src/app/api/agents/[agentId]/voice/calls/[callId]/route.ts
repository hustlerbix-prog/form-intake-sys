import { NextResponse, type NextRequest } from "next/server";
import { getAgent } from "@/lib/server/builderStore";
import { retrieveRetellCall } from "@/lib/server/retell";

export async function GET(_req: NextRequest, { params }: { params: { agentId: string; callId: string } }) {
  const agent = getAgent(params.agentId);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (agent.type !== "voice") return NextResponse.json({ error: "voice only" }, { status: 400 });

  try {
    const call = await retrieveRetellCall(params.callId);
    return NextResponse.json(call);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load call details." },
      { status: 500 }
    );
  }
}
