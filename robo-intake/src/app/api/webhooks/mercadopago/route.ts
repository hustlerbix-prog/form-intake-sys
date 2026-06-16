import { NextRequest, NextResponse } from "next/server";
import { mpToken } from "@/lib/payment/keys";
import { activateOrder, failOrder } from "@/lib/payment/order-actions";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // MP sends type: 'payment' for payment notifications
  if (body.type !== "payment" || !body.data) {
    return NextResponse.json({ received: true });
  }

  let MercadoPagoConfig: typeof import("mercadopago").MercadoPagoConfig;
  let Payment: typeof import("mercadopago").Payment;
  try {
    const mp = await import("mercadopago");
    MercadoPagoConfig = mp.MercadoPagoConfig;
    Payment = mp.Payment;
  } catch {
    return NextResponse.json({ error: "mercadopago SDK not installed" }, { status: 500 });
  }

  try {
    const mp = new MercadoPagoConfig({ accessToken: mpToken() });
    const paymentClient = new Payment(mp);
    const paymentData = await paymentClient.get({
      id: String((body.data as Record<string, unknown>).id),
    });

    const orderId = paymentData.external_reference;
    if (!orderId) {
      return NextResponse.json({ received: true });
    }

    switch (paymentData.status) {
      case "approved":
        await activateOrder(orderId, "mercadopago", String(paymentData.id));
        break;
      case "rejected":
        await failOrder(orderId);
        break;
      // 'pending', 'in_process' — await next event
    }
  } catch (err) {
    console.error("[webhook/mercadopago] error:", err);
  }

  return NextResponse.json({ received: true });
}
