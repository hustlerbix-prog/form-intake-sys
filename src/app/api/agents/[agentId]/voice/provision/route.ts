import { NextResponse, type NextRequest } from "next/server";
import { getAgent } from "@/lib/server/builderStore";
import { buildVoiceDeploymentPlan } from "@/lib/server/voiceIntegrations";
import { syncRetellAgent } from "@/lib/server/retell";

export async function POST(req: NextRequest, { params }: { params: { agentId: string } }) {
  const agent = getAgent(params.agentId);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (agent.type !== "voice") return NextResponse.json({ error: "voice only" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as { event?: string } | null;
  if (body?.event) {
    return NextResponse.json({ ok: true });
  }

  try {
    const provisioned = await syncRetellAgent(params.agentId);
    return NextResponse.json({
      mode: "retell_sync",
      deployment_plan: buildVoiceDeploymentPlan(provisioned.builder_agent),
      retell: {
        agent_id: provisioned.retell_agent_id,
        llm_id: provisioned.retell_llm_id,
        model: provisioned.retell_model,
        voice_id: provisioned.retell_voice_id,
        synced_at: provisioned.synced_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Provisioning failed." },
      { status: 500 }
    );
  }
}
