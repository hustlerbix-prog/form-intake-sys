import { NextResponse, type NextRequest } from "next/server";
import { getAgent, listKbSources, publishAgent } from "@/lib/server/builderStore";
import { AgentConfigSchema, FlowGraphSchema, validatePublish } from "@/lib/builder/builderSchemas";

export async function POST(_req: NextRequest, { params }: { params: { agentId: string } }) {
  const agent = getAgent(params.agentId);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });

  const cfgParsed = AgentConfigSchema.safeParse(agent.config);
  const flowParsed = FlowGraphSchema.safeParse(agent.flow_graph);
  if (!cfgParsed.success || !flowParsed.success) {
    return NextResponse.json(
      {
        failures: [{ code: "config/invalid", module: "config", message: "Draft config is invalid. Fix validation errors before publishing." }],
      },
      { status: 422 }
    );
  }

  const kb = listKbSources(params.agentId);
  const hasIndexedKbSource = kb.some((s) => s.status === "indexed");
  const failures = validatePublish({
    rag_active: cfgParsed.data.rag_active,
    hasIndexedKbSource,
    flow_graph: flowParsed.data,
    config: cfgParsed.data,
  });
  if (failures.length) return NextResponse.json({ failures }, { status: 422 });

  const res = publishAgent(params.agentId);
  if (!res) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(res);
}
