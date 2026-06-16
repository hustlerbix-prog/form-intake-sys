import { NextResponse, type NextRequest } from "next/server";
import { getAgent } from "@/lib/server/builderStore";
import { buildVoiceDeploymentPlan, getVoiceProviderReadiness } from "@/lib/server/voiceIntegrations";

export async function GET(_req: NextRequest, { params }: { params: { agentId: string } }) {
  const agent = getAgent(params.agentId);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    agent_id: agent.id,
    type: agent.type,
    provider_readiness: agent.type === "voice" ? getVoiceProviderReadiness(agent) : [],
    deployment_plan: agent.type === "voice" ? buildVoiceDeploymentPlan(agent) : null,
  });
}

