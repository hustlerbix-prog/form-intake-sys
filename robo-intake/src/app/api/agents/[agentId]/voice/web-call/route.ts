import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAgent } from "@/lib/server/builderStore";
import { createRetellWebCall } from "@/lib/server/retell";

const BodySchema = z
  .object({
    customer_name: z.string().max(120).optional(),
    scenario: z.string().max(2000).optional(),
  })
  .optional();

export async function POST(req: NextRequest, { params }: { params: { agentId: string } }) {
  const agent = getAgent(params.agentId);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (agent.type !== "voice") return NextResponse.json({ error: "voice only" }, { status: 400 });

  const parsed = BodySchema.safeParse((await req.json().catch(() => undefined)) as unknown);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const webCall = await createRetellWebCall({
      agentId: params.agentId,
      metadata: {
        builder_agent_id: agent.id,
        profile_id: agent.profile_id,
      },
      retell_llm_dynamic_variables: {
        business_name: agent.config.name,
        customer_name: parsed.data?.customer_name ?? "Customer",
        scenario: parsed.data?.scenario ?? "",
      },
    });

    return NextResponse.json({
      provider: "retell",
      call_id: webCall.call_id,
      access_token: webCall.access_token,
      call_status: webCall.call_status,
      retell_agent_id: webCall.retell_agent_id,
      retell_llm_id: webCall.retell_llm_id,
      model: webCall.retell_model,
      voice_id: webCall.retell_voice_id,
      synced_at: webCall.synced_at,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Retell web call." },
      { status: 500 }
    );
  }
}
