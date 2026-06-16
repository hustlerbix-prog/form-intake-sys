import { NextResponse, type NextRequest } from "next/server";
import { getAgent, updateAgent, type FlowGraph } from "@/lib/server/builderStore";
import { AgentPatchSchema, assertAllowedInterpolation } from "@/lib/builder/builderSchemas";

function validateInterpolationsInFlowGraph(flow: FlowGraph): void {
  const visit = (value: unknown, field: string) => {
    if (typeof value === "string") {
      assertAllowedInterpolation({ text: value, field });
      return;
    }
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => visit(v, `${field}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(value)) visit(v, `${field}.${k}`);
  };

  flow.nodes.forEach((n, i) => {
    // Only validate templated strings within node properties/labels.
    visit(n.label, `flow_graph.nodes[${i}].label`);
    visit(n.properties, `flow_graph.nodes[${i}].properties`);
  });
}

export async function GET(_req: NextRequest, { params }: { params: { agentId: string } }) {
  const agent = getAgent(params.agentId);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(agent);
}

export async function PATCH(req: NextRequest, { params }: { params: { agentId: string } }) {
  const body = (await req.json().catch(() => ({}))) as unknown;
  const parsed = AgentPatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  if (parsed.data.config?.system_prompt) {
    try {
      assertAllowedInterpolation({ text: parsed.data.config.system_prompt, field: "config.system_prompt" });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "invalid interpolation" },
        { status: 400 }
      );
    }
  }

  if (parsed.data.flow_graph) {
    try {
      validateInterpolationsInFlowGraph(parsed.data.flow_graph as unknown as FlowGraph);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "invalid interpolation" },
        { status: 400 }
      );
    }
  }

  const configPatch = parsed.data.config;
  const next = updateAgent({
    agent_id: params.agentId,
    patch: {
      template_id: parsed.data.template_id,
      type: parsed.data.type,
      flow_graph: parsed.data.flow_graph ? (parsed.data.flow_graph as unknown as FlowGraph) : undefined,
      config: configPatch,
    },
  });
  if (!next) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(next);
}
