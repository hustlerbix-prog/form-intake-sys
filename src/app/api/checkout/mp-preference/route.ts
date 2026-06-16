import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mpToken } from "@/lib/payment/keys";
import { MpPreferenceSchema } from "@/lib/payment/schemas";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = MpPreferenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { orderId, agentId, amount, productName, payerEmail } = parsed.data;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let MercadoPagoConfig: typeof import("mercadopago").MercadoPagoConfig;
  let Preference: typeof import("mercadopago").Preference;
  try {
    const mp = await import("mercadopago");
    MercadoPagoConfig = mp.MercadoPagoConfig;
    Preference = mp.Preference;
  } catch {
    return NextResponse.json(
      { error: "mercadopago SDK not installed. Run: npm install mercadopago" },
      { status: 500 }
    );
  }

  try {
    const mp = new MercadoPagoConfig({ accessToken: mpToken() });
    const preference = new Preference(mp);

    const result = await preference.create({
      body: {
        items: [
          {
            id: orderId,
            title: productName,
            quantity: 1,
            currency_id: "USD",
            unit_price: amount,
          },
        ],
        payer: { email: payerEmail },
        external_reference: orderId,
        back_urls: {
          success: `${appUrl}/checkout/success?order_id=${orderId}`,
          failure: `${appUrl}/checkout/failed`,
          pending: `${appUrl}/checkout/pending`,
        },
        auto_return: "approved",
        notification_url: `${appUrl}/api/webhooks/mercadopago`,
        metadata: { agentId },
      },
    });

    await supabaseAdmin
      .from("orders")
      .update({ processor: "mercadopago", processor_ref: result.id, status: "pending" })
      .eq("id", orderId);

    return NextResponse.json({
      url:
        process.env.NODE_ENV === "production"
          ? result.init_point
          : result.sandbox_init_point,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "MercadoPago error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
