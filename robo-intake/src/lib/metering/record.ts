import { supabaseAdmin } from "@/lib/supabase/admin";

export interface UsageEvent {
  accountId: string;
  agentId: string;
  orderId: string;
  eventType: "token_in" | "token_out" | "minute" | "tool_call";
  quantity: number;
  unitCostUsd: number;
}

export async function recordUsage(event: UsageEvent): Promise<void> {
  const total = event.quantity * event.unitCostUsd;

  const { error } = await supabaseAdmin.from("usage_ledger").insert({
    account_id: event.accountId,
    agent_id: event.agentId,
    order_id: event.orderId,
    event_type: event.eventType,
    quantity: event.quantity,
    unit_cost_usd: event.unitCostUsd,
    total_cost_usd: total,
  });

  if (error) {
    console.error("[metering] recordUsage failed:", error.message);
  }
}

export async function getRemainingBalance(
  accountId: string,
  prepaidAmount: number
): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("usage_ledger")
    .select("total_cost_usd")
    .eq("account_id", accountId)
    .gte("created_at", currentBillingPeriodStart());

  if (error) {
    console.error("[metering] getRemainingBalance failed:", error.message);
    return prepaidAmount;
  }

  const spent = (data ?? []).reduce(
    (sum: number, r: { total_cost_usd: number }) => sum + Number(r.total_cost_usd),
    0
  );
  return prepaidAmount - spent;
}

function currentBillingPeriodStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
