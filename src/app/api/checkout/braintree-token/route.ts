import { NextResponse } from "next/server";
import { braintreeConfig } from "@/lib/payment/keys";

export async function GET() {
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

    const { clientToken } = await gateway.clientToken.generate({});
    return NextResponse.json({ clientToken });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Braintree error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
