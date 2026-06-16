"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function PaymentPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderId = searchParams.get("orderId") ?? "";
  const amount = parseFloat(searchParams.get("amount") ?? "0");
  const productId = searchParams.get("product") ?? "";
  const country = searchParams.get("country") ?? "US";
  const returnUrl = searchParams.get("returnUrl") ?? "";

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBypass, setIsBypass] = useState(false);
  const [processor, setProcessor] = useState<"stripe" | "mercadopago" | "paypal">("stripe");

  const LATAM = new Set(["AR", "BR", "CL", "CO", "MX", "PE", "VE"]);
  const defaultProcessor = LATAM.has(country.toUpperCase()) ? "mercadopago" : "stripe";

  useEffect(() => {
    // Check if bypass is available
    const token = localStorage.getItem("robo_admin_token") ?? "";
    if (token) {
      fetch("/api/admin/payment-settings", { headers: { "x-admin-token": token } })
        .then((r) => r.json())
        .then((d) => {
          if (d.payment?.bypassEnabled) setIsBypass(true);
        })
        .catch(() => void 0);
    }
    setProcessor(defaultProcessor as typeof processor);
  }, [defaultProcessor]);

  const handleStripeCheckout = async () => {
    setProcessing(true);
    setError(null);
    const appUrl = window.location.origin;

    const res = await fetch("/api/checkout/stripe-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        agentId,
        priceAmountCents: Math.round(amount * 100),
        productName: `ROBO AI — ${productId}`,
        successUrl: `${appUrl}/checkout/success${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`,
        cancelUrl: `${appUrl}/checkout/failed`,
      }),
    });

    const data = (await res.json()) as { url?: string; error?: string };
    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error ?? "Stripe checkout failed");
      setProcessing(false);
    }
  };

  const handleMpCheckout = async () => {
    setProcessing(true);
    setError(null);

    const res = await fetch("/api/checkout/mp-preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        agentId,
        amount,
        productName: `ROBO AI — ${productId}`,
        payerEmail: "client@example.com",
        billingCountry: country,
      }),
    });

    const data = (await res.json()) as { url?: string; error?: string };
    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error ?? "MercadoPago checkout failed");
      setProcessing(false);
    }
  };

  const handleBypass = async () => {
    setProcessing(true);
    setError(null);
    const token = localStorage.getItem("robo_admin_token") ?? "";

    const res = await fetch("/api/checkout/bypass", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ orderId, actorId: "admin" }),
    });

    const data = (await res.json()) as { success?: boolean; error?: string };
    if (data.success) {
      // If coming from the builder, go straight back there; otherwise show success page
      router.push(returnUrl || `/checkout/success?order_id=${orderId}`);
    } else {
      setError(data.error ?? "Bypass failed");
      setProcessing(false);
    }
  };

  const handlePrimary = () => {
    if (processor === "stripe") void handleStripeCheckout();
    else if (processor === "mercadopago") void handleMpCheckout();
  };

  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <CheckoutBreadcrumb step={4} />
      <h1 className="text-2xl font-bold text-[#0D1B2A] mb-2">Payment</h1>
      <p className="text-slate-500 text-sm mb-8">
        Total: <strong>${amount.toFixed(2)} USD</strong>
      </p>

      {isBypass && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-xl px-4 py-3 mb-6 flex items-center gap-2 text-sm">
          <span>⚡</span>
          <span>
            <strong>Test Mode — Payment Bypass Available.</strong> No real transaction will occur.
          </span>
        </div>
      )}

      {/* Processor selector */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-700 mb-2">Payment method</p>
        <div className="flex gap-3">
          {(["stripe", "mercadopago", "paypal"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProcessor(p as "stripe" | "mercadopago" | "paypal")}
              className={`px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                processor === p
                  ? "bg-[#0D1B2A] text-white border-[#0D1B2A]"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {PROCESSOR_LABELS[p]}
            </button>
          ))}
        </div>
        {LATAM.has(country.toUpperCase()) && processor !== "mercadopago" && (
          <p className="mt-2 text-xs text-amber-600">
            MercadoPago is recommended for your region ({country}).
          </p>
        )}
      </div>

      {/* Payment action */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <p className="text-sm text-slate-500 mb-4">
          {PROCESSOR_DESCRIPTIONS[processor]}
        </p>
        <button
          type="button"
          onClick={handlePrimary}
          disabled={processing}
          className="w-full bg-[#0EA5A0] text-white py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {processing ? "Redirecting…" : `Pay $${amount.toFixed(2)} with ${PROCESSOR_LABELS[processor]}`}
        </button>
      </div>

      {isBypass && (
        <button
          type="button"
          onClick={() => void handleBypass()}
          disabled={processing}
          className="w-full border-2 border-yellow-400 text-yellow-700 py-3 rounded-xl font-semibold hover:bg-yellow-50 transition disabled:opacity-50"
        >
          ⚡ Complete Payment (Test Mode — No Charge)
        </button>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-3 underline text-red-600 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      <p className="mt-6 text-xs text-slate-400 text-center">
        Secured by {PROCESSOR_LABELS[processor]} · Card data never touches ROBO AI servers
      </p>
    </main>
  );
}

function CheckoutBreadcrumb({ step }: { step: number }) {
  const steps = ["Billing Model", "Plan", "Summary", "Payment"];
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => (
        <span key={label} className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold px-2 py-1 rounded ${
              i + 1 === step
                ? "bg-[#0D1B2A] text-white"
                : i + 1 < step
                ? "bg-[#0EA5A0] text-white"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {i + 1}. {label}
          </span>
          {i < steps.length - 1 && <span className="text-slate-300 text-xs">›</span>}
        </span>
      ))}
    </div>
  );
}

const PROCESSOR_LABELS: Record<string, string> = {
  stripe: "Stripe",
  mercadopago: "MercadoPago",
  paypal: "PayPal",
};

const PROCESSOR_DESCRIPTIONS: Record<string, string> = {
  stripe: "You will be redirected to Stripe's secure hosted checkout page to complete payment.",
  mercadopago:
    "You will be redirected to MercadoPago's secure checkout. Supports cards, OXXO (MX), and Pix (BR).",
  paypal: "You will be redirected to PayPal's secure checkout to complete payment.",
};
