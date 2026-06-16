import { NextRequest, NextResponse } from "next/server";
import { assertAdminAccess } from "@/lib/server/adminAuth";
import {
  getPaymentSettings,
  savePaymentSettings,
  PaymentSettingsSchema,
} from "@/lib/server/paymentSettings";

function processorStatus() {
  return {
    stripe: {
      secretKeyConfigured:
        !!(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_TEST),
      webhookConfigured:
        !!(process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET_TEST),
      publishableKeyConfigured:
        !!(
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST
        ),
    },
    mercadopago: {
      accessTokenConfigured:
        !!(process.env.MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN_TEST),
    },
    braintree: {
      configured:
        !!(process.env.BRAINTREE_MERCHANT_ID || process.env.BRAINTREE_MERCHANT_ID_TEST),
    },
    resend: {
      configured: !!process.env.RESEND_API_KEY,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    assertAdminAccess(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { payment } = await getPaymentSettings();
  return NextResponse.json({
    payment,
    envStatus: processorStatus(),
  });
}

export async function PUT(req: NextRequest) {
  try {
    assertAdminAccess(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PaymentSettingsSchema.partial().safeParse(
    (body as Record<string, unknown>)?.payment ?? body
  );
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { stored, persisted } = await savePaymentSettings(parsed.data);
  return NextResponse.json({
    payment: stored.payment,
    persisted,
    envStatus: processorStatus(),
  });
}
