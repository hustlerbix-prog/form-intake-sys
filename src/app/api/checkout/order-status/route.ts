import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 });
  }

  const client = getSupabaseAdmin();
  if (!client) {
    // Supabase not configured — treat as unpaid so checkout shows
    return NextResponse.json({ paid: false, orderId: null });
  }

  const { data } = await client
    .from("orders")
    .select("id, status, billing_model, amount_usd, bypass")
    .eq("agent_id", agentId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) {
    return NextResponse.json({ paid: false, orderId: null });
  }

  return NextResponse.json({
    paid: true,
    orderId: data.id,
    billingModel: data.billing_model,
    amountUsd: data.amount_usd,
    bypass: data.bypass,
  });
}
