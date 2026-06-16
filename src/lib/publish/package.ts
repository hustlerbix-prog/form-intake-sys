import { supabaseAdmin } from "@/lib/supabase/admin";

interface Snapshot {
  id: string;
  version: number;
  scoped_api_key: string;
}

// Generate a zip integration package and upload to Supabase Storage.
// Requires: npm install jszip
export async function generateIntegrationPackage(
  agentId: string,
  snapshot: Snapshot
): Promise<string> {
  // Dynamic import so the build doesn't fail if jszip is not yet installed
  let JSZip: typeof import("jszip");
  try {
    JSZip = (await import("jszip")) as unknown as typeof import("jszip");
  } catch {
    throw new Error("jszip is not installed. Run: npm install jszip");
  }

  const zip = new (JSZip as unknown as { new(): InstanceType<typeof import("jszip")> })();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.roboai.agency";

  zip.file(
    "embed.html",
    `<script>\n  window.ROBOAI_AGENT_ID = "${agentId}";\n  window.ROBOAI_ENDPOINT = "${appUrl}/api/chat";\n</script>\n<script src="${appUrl}/widget/chat.js" async></script>`
  );

  zip.file(
    ".env.example",
    [
      `ROBOAI_AGENT_ID=${agentId}`,
      "ROBOAI_API_KEY=your-scoped-api-key",
      `ROBOAI_WEBHOOK_URL=https://your-domain.com/webhooks/roboai`,
    ].join("\n")
  );

  zip.file(
    "api-config.json",
    JSON.stringify(
      {
        agent_id: agentId,
        endpoint: `${appUrl}/api/chat`,
        webhook_url: `${appUrl}/api/agents/${agentId}/webhooks`,
        scoped_api_key: snapshot.scoped_api_key,
        version: snapshot.version,
      },
      null,
      2
    )
  );

  zip.file("README.md", buildReadme(agentId, appUrl));
  zip.file("webhook-guide.md", buildWebhookGuide(appUrl));

  const buffer = await (zip as unknown as { generateAsync: (opts: Record<string, unknown>) => Promise<Buffer> }).generateAsync({
    type: "nodebuffer",
  });

  const path = `integrations/${agentId}/package-v${snapshot.version}.zip`;

  const db = supabaseAdmin;
  await db.storage.from("integration-packages").upload(path, buffer, {
    contentType: "application/zip",
    upsert: true,
  } as unknown as Parameters<ReturnType<typeof db.storage.from>["upload"]>[2]);

  const { data } = db.storage.from("integration-packages").getPublicUrl(path);
  return data.publicUrl;
}

function buildReadme(agentId: string, appUrl: string): string {
  return `# ROBO AI Agent Integration\n\nAgent ID: \`${agentId}\`\nEndpoint: \`${appUrl}/api/chat\`\n\n## Quick Start\n\n1. Copy \`embed.html\` script tags into your website.\n2. Set environment variables from \`.env.example\`.\n3. Configure your webhook URL to receive agent events.\n\nSee \`webhook-guide.md\` for event schema.\n`;
}

function buildWebhookGuide(appUrl: string): string {
  return `# Webhook Guide\n\n## Endpoint\n\nYour server must expose a POST endpoint and register it at:\n\`${appUrl}/api/agents/{agentId}/webhooks\`\n\n## Events\n\n| Event | Payload |\n|-------|---------|\n| \`message.received\` | \`{ agentId, sessionId, message, timestamp }\` |\n| \`session.started\` | \`{ agentId, sessionId, timestamp }\` |\n| \`session.ended\` | \`{ agentId, sessionId, duration_ms, timestamp }\` |\n`;
}
