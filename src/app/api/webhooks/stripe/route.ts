import { NextRequest, NextResponse } from "next/server";
import { stripeKey, stripeWebhookSecret } from "@/lib/payment/keys";
import { activateOrder, failOrder } from "@/lib/payment/order-actions";

// Stripe requires raw body for signature verification
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let Stripe: typeof import("stripe").default;
  try {
    Stripe = (await import("stripe")).default;
  } catch {
    return NextResponse.json({ error: "Stripe SDK not installed" }, { status: 500 });
  }

  let event: import("stripe").Stripe.Event;
  try {
    const stripe = new Stripe(stripeKey(), { apiVersion: "2026-05-27.dahlia" });
    event = stripe.webhooks.constructEvent(body, sig, stripeWebhookSecret());
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook signature verification failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as import("stripe").Stripe.PaymentIntent;
        if (pi.metadata?.orderId) {
          await activateOrder(pi.metadata.orderId, "stripe", pi.id);
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as import("stripe").Stripe.PaymentIntent;
        if (pi.metadata?.orderId) {
          await failOrder(pi.metadata.orderId);
        }
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as import("stripe").Stripe.Invoice;
        const orderId = (inv as unknown as { subscription_details?: { metadata?: { orderId?: string } } })
          .subscription_details?.metadata?.orderId;
        if (orderId) await activateOrder(orderId, "stripe", inv.id);
        break;
      }
      case "customer.subscription.deleted": {
        // Agent suspension — implement per agent lifecycle spec
        console.log("[webhook/stripe] subscription deleted:", event.data.object);
        break;
      }
    }
  } catch (err) {
    console.error("[webhook/stripe] handler error:", err);
    // Return 200 to prevent Stripe from retrying a handler-side error
  }

  return NextResponse.json({ received: true });
}
