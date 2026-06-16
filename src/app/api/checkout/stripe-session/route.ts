import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripeKey } from "@/lib/payment/keys";
import { StripeSessionSchema } from "@/lib/payment/schemas";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = StripeSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { orderId, agentId, priceAmountCents, productName, successUrl, cancelUrl } = parsed.data;

  let Stripe: typeof import("stripe").default;
  try {
    Stripe = (await import("stripe")).default;
  } catch {
    return NextResponse.json({ error: "Stripe SDK not installed. Run: npm install stripe" }, { status: 500 });
  }

  try {
    const stripe = new Stripe(stripeKey(), { apiVersion: "2026-05-27.dahlia" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: productName },
            unit_amount: priceAmountCents,
          },
          quantity: 1,
        },
      ],
      metadata: { orderId, agentId },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    await supabaseAdmin
      .from("orders")
      .update({ processor: "stripe", processor_ref: session.id, status: "pending" })
      .eq("id", orderId);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
