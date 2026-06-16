import { NextResponse, type NextRequest } from "next/server";
import { addExport, getAgent, getPublishedSnapshot, type ExportFormat } from "@/lib/server/builderStore";
import { buildVoiceDeploymentPlan, getVoiceProviderReadiness } from "@/lib/server/voiceIntegrations";
import { randomUUID } from "crypto";

function buildMcpArtefact(profileId: string, agentId: string) {
  const base = (process.env.NEXT_PUBLIC_MCP_BASE ?? "https://mcp.roboai.agency").replace(/\/$/, "");
  const endpoint = `${base}/${profileId}/sse`;
  const claudeConfig = {
    mcpServers: {
      roboai: { command: "npx", args: ["-y", "@roboai/mcp-client", endpoint] },
    },
  };
  return {
    endpoint,
    claude_desktop_config: JSON.stringify(claudeConfig, null, 2),
    instructions: [
      "1. Open Claude Desktop → Settings → Developer",
      "2. Paste the config block into claude_desktop_config.json",
      "3. Restart Claude Desktop",
      `4. The agent '${agentId}' will appear as a connected MCP tool`,
    ],
  };
}

function buildApiArtefact(agentId: string, apiKey: string) {
  const base = (process.env.NEXT_PUBLIC_API_BASE ?? "https://api.roboai.agency/v1").replace(/\/$/, "");
  const url = `${base}/agents/${agentId}`;
  return {
    base_url: url,
    api_key: apiKey,
    curl_example: `curl -X POST ${url}/chat \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"messages":[{"role":"user","content":"Hello"}]}'`,
    docs_url: `${base}/docs`,
    rate_limits: { requests_per_minute: 60, tokens_per_day: 500000 },
  };
}

function buildWidgetArtefact(agentId: string, options: { primaryColor: string; position: "bottom-right" | "bottom-left"; greeting: string }) {
  const cdnUrl = process.env.NEXT_PUBLIC_WIDGET_CDN ?? "https://roboai.agency/widget.js";
  const attrs = [
    `data-agent="${agentId}"`,
    `data-color="${options.primaryColor}"`,
    `data-position="${options.position}"`,
    `data-greeting="${options.greeting}"`,
  ].join(" ");
  return {
    embed_snippet: `<script src="${cdnUrl}" ${attrs} async></script>`,
    customisation: options,
  };
}

export async function POST(req: NextRequest, { params }: { params: { agentId: string; format: ExportFormat } }) {
  const agent = getAgent(params.agentId);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!agent.config_hash) return NextResponse.json({ error: "publish first" }, { status: 409 });
  const snapshot = getPublishedSnapshot(params.agentId);
  if (!snapshot) return NextResponse.json({ error: "publish first" }, { status: 409 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  let artefactData: Record<string, unknown>;
  if (params.format === "mcp") {
    artefactData = buildMcpArtefact(agent.profile_id, params.agentId);
  } else if (params.format === "api") {
    const apiKey = `rba_${randomUUID().replace(/-/g, "")}`;
    artefactData = buildApiArtefact(params.agentId, apiKey);
    if (agent.type === "voice") {
      artefactData.voice = {
        test_call_endpoint: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/agents/${params.agentId}/voice/test-call`,
        provider_readiness: getVoiceProviderReadiness(agent),
        deployment_plan: buildVoiceDeploymentPlan(agent),
      };
    }
  } else if (params.format === "widget") {
    artefactData = buildWidgetArtefact(params.agentId, {
      primaryColor: typeof body.primaryColor === "string" ? body.primaryColor : "#0EA5A0",
      position: body.position === "bottom-left" ? "bottom-left" : "bottom-right",
      greeting: typeof body.greeting === "string" ? body.greeting : "Hi! How can I help?",
    });
  } else if (params.format === "rawcode") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    artefactData = {
      instructions: [
        "Download the JSON and use it to bootstrap a Node.js runtime or your preferred framework.",
        "This MVP export does not generate a ZIP yet (Phase 2).",
      ],
      agent_config: snapshot.config,
      agent_flow_graph: snapshot.flow_graph,
      test_endpoint: `${appUrl}/api/agents/${params.agentId}/chat`,
    };
    if (agent.type === "voice") {
      artefactData.voice_deployment_plan = buildVoiceDeploymentPlan(agent);
      artefactData.voice_test_endpoint = `${appUrl}/api/agents/${params.agentId}/voice/test-call`;
    }
  } else {
    return NextResponse.json({ error: "invalid format" }, { status: 400 });
  }

  const exportRow = addExport({
    agent_id: params.agentId,
    format: params.format,
    config_hash: agent.config_hash,
    artefact_data: artefactData,
  });

  return NextResponse.json({ version: exportRow.version, artefact: exportRow.artefact_data });
}
