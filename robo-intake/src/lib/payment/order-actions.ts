import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Processor } from "./processor-router";

export async function activateOrder(
  orderId: string,
  processor: Processor,
  processorRef: string
): Promise<void> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .update({
      status: "paid",
      processor,
      processor_ref: processorRef,
      paid_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select("account_id, agent_id, amount_usd, billing_model")
    .single();

  if (error || !order) {
    console.error("[payment] activateOrder failed:", error?.message);
    return;
  }

  await supabaseAdmin.from("audit_log").insert({
    actor_id: order.account_id,
    entity_type: "order",
    entity_id: orderId,
    action: "payment_confirmed",
    meta: { processor, processor_ref: processorRef },
    created_at: new Date().toISOString(),
  });

  // Fire receipt email in background — import lazily to avoid loading Resend at cold start
  try {
    const { sendReceiptEmail } = await import("@/lib/email/receipt");
    await sendReceiptEmail({ orderId, accountId: order.account_id, amountUsd: order.amount_usd });
  } catch (err) {
    console.error("[payment] receipt email failed:", err);
  }
}

export async function failOrder(orderId: string): Promise<void> {
  await supabaseAdmin
    .from("orders")
    .update({ status: "failed" })
    .eq("id", orderId);
}
