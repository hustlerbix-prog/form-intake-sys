import { NextRequest, NextResponse } from "next/server";
import { canPublish } from "@/lib/publish/gate";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateIntegrationPackage } from "@/lib/publish/package";
import { PublishAgentSchema } from "@/lib/payment/schemas";
import { randomBytes } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const { agentId } = params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PublishAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { actorId } = parsed.data;

  if (!(await canPublish(agentId))) {
    return NextResponse.json({ error: "Payment required before publishing" }, { status: 402 });
  }

  try {
    // Create immutable config snapshot
    const snapshot = {
      id: randomBytes(16).toString("hex"),
      version: Date.now(),
      scoped_api_key: `robo_${randomBytes(24).toString("hex")}`,
      agent_id: agentId,
      created_at: new Date().toISOString(),
    };

    await supabaseAdmin.from("bot_config_snapshots").insert(snapshot);

    // Mark agent as published
    await supabaseAdmin
      .from("agents")
      .update({ status: "published", published_snapshot_id: snapshot.id })
      .eq("id", agentId);

    // Generate integration package (zip)
    let downloadUrl: string | null = null;
    try {
      downloadUrl = await generateIntegrationPackage(agentId, snapshot);
    } catch (err) {
      console.warn("[publish] package generation failed:", err);
    }

    // Audit log
    await supabaseAdmin.from("audit_log").insert({
      actor_id: actorId,
      entity_type: "agent",
      entity_id: agentId,
      action: "publish",
      meta: { snapshot_id: snapshot.id },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, downloadUrl, snapshotId: snapshot.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Publish failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
