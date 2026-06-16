import { supabaseAdmin } from "@/lib/supabase/admin";
import { isBypassEnabled } from "@/lib/server/paymentSettings";

export { isBypassEnabled };

export async function processBypassOrder(
  orderId: string,
  actorId: string
): Promise<void> {
  const db = supabaseAdmin;

  await db
    .from("orders")
    .update({
      status: "paid",
      processor: "bypass",
      processor_ref: `bypass-${Date.now()}`,
      bypass: true,
      paid_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  await db.from("audit_log").insert({
    actor_id: actorId,
    entity_type: "order",
    entity_id: orderId,
    action: "bypass_payment",
    meta: { note: "Payment bypassed — test/demo mode" },
    created_at: new Date().toISOString(),
  });
}
