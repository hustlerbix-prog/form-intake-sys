import { NextRequest, NextResponse } from "next/server";
import { braintreeConfig } from "@/lib/payment/keys";
import { activateOrder } from "@/lib/payment/order-actions";
import { BraintreeSaleSchema } from "@/lib/payment/schemas";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BraintreeSaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { orderId, nonce, amount } = parsed.data;

  let braintree: typeof import("braintree");
  try {
    braintree = await import("braintree");
  } catch {
    return NextResponse.json(
      { error: "braintree SDK not installed. Run: npm install braintree" },
      { status: 500 }
    );
  }

  try {
    const cfg = braintreeConfig();
    const gateway = new braintree.BraintreeGateway({
      environment: cfg.isTest
        ? braintree.Environment.Sandbox
        : braintree.Environment.Production,
      merchantId: cfg.merchantId,
      publicKey: cfg.publicKey,
      privateKey: cfg.privateKey,
    });

    const result = await gateway.transaction.sale({
      amount: String(amount),
      paymentMethodNonce: nonce,
      options: { submitForSettlement: true },
    });

    if (result.success) {
      await activateOrder(orderId, "paypal", result.transaction.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: result.message }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Braintree error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
