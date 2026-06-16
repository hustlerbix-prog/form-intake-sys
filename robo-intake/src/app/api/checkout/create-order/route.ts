import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CreateOrderSchema } from "@/lib/payment/schemas";
import { selectProcessor } from "@/lib/payment/processor-router";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const {
    agentId,
    productId,
    billingModel,
    planDetails,
    amountUsd,
    currency,
    billingCountry,
  } = parsed.data;

  const { primary: processor } = billingCountry
    ? await selectProcessor(billingCountry)
    : { primary: "stripe" as const };

  try {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        agent_id: agentId,
        product_id: productId,
        billing_model: billingModel,
        plan_details: planDetails ?? {},
        amount_usd: amountUsd,
        currency,
        processor,
        status: "draft",
      })
      .select("id, status, processor, amount_usd, billing_model")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ order });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
