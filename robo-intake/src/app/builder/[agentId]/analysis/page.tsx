import { redirect } from "next/navigation";
import { getAgent } from "@/lib/server/builderStore";

export default function BuilderAnalysisRedirectPage({
  params,
}: {
  params: { agentId: string };
}) {
  const agent = getAgent(params.agentId);

  if (!agent?.profile_id) {
    redirect(`/builder/${params.agentId}/step1`);
  }

  redirect(`/analyse?profile_id=${encodeURIComponent(agent.profile_id)}&view=report`);
}
