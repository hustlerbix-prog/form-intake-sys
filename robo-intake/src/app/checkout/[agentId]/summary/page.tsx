"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function SummaryPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const model = searchParams.get("model") ?? "one_shot";
  const productId = searchParams.get("product") ?? "CB-01";
  const amountStr = searchParams.get("amount") ?? "0";
  const planDetailsStr = searchParams.get("planDetails") ?? "{}";
  const promoCode = searchParams.get("promo") ?? "";
  const returnUrl = searchParams.get("returnUrl") ?? "";

  const amount = parseFloat(amountStr);
  let planDetails: Record<string, unknown> = {};
  try {
    planDetails = JSON.parse(planDetailsStr);
  } catch {
    void 0;
  }

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingCountry, setBillingCountry] = useState("US");
  const billingCountryLabel =
    COUNTRIES.find((country) => country.code === billingCountry)?.name ?? billingCountry;

  const handleProceed = async () => {
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          productId,
          billingModel: model,
          planDetails,
          amountUsd: amount,
          billingCountry,
        }),
      });

      const data = (await res.json()) as { order?: { id: string }; error?: string };
      if (!res.ok || !data.order) {
        setError(data.error ?? "Failed to create order");
        setCreating(false);
        return;
      }

      const paymentParams = new URLSearchParams({
        orderId: data.order.id,
        amount: String(amount),
        product: productId,
        model,
        country: billingCountry,
        ...(returnUrl ? { returnUrl } : {}),
      });
      router.push(`/checkout/${agentId}/payment?${paymentParams}`);
    } catch {
      setError("Network error. Please try again.");
      setCreating(false);
    }
  };

  const tax = amount * 0; // Tax calculation TBD per billing country
  const total = amount + tax;

  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <CheckoutBreadcrumb step={3} />
      <h1 className="text-2xl font-bold text-[#0D1B2A] mb-2">Order Summary</h1>
      <p className="text-slate-500 text-sm mb-8">Review your order before payment.</p>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 mb-6">
        <SummaryRow label="Product" value={productId} />
        <SummaryRow label="Billing model" value={MODEL_LABELS[model] ?? model} />
        {!!planDetails.poolPackageId && (
          <SummaryRow label="Pool tier" value={String(planDetails.poolPackageId)} />
        )}
        {!!planDetails.billingCycle && (
          <SummaryRow label="Billing cycle" value={String(planDetails.billingCycle)} />
        )}
        {!!planDetails.prepaidAmount && (
          <SummaryRow label="Prepaid credit" value={`$${Number(planDetails.prepaidAmount).toFixed(2)} USD`} />
        )}
        {!!planDetails.spendingCap && (
          <SummaryRow label="Monthly spending cap" value={`$${Number(planDetails.spendingCap).toFixed(2)} USD`} />
        )}
        {!!planDetails.overagePolicy && (
          <SummaryRow
            label="Overage policy"
            value={String(planDetails.overagePolicy) === "hard_cap" ? "Pause agent" : "Auto top-up"}
          />
        )}
        <SummaryRow label="Billing country" value={billingCountryLabel} />
        {promoCode && <SummaryRow label="Promo code" value={promoCode} />}
        <SummaryRow label="Subtotal" value={`$${amount.toFixed(2)} USD`} />
        {model === "usage_payg" && (
          <SummaryRow label="Checkout due today" value="$0.00 USD" />
        )}
        {tax > 0 && <SummaryRow label="Tax" value={`$${tax.toFixed(2)} USD`} />}
        <div className="px-6 py-4 flex justify-between font-bold text-[#0D1B2A]">
          <span>Total</span>
          <span>${total.toFixed(2)} USD</span>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Billing country
        </label>
        <div className="relative w-64">
          <select
            value={billingCountry}
            onChange={(e) => setBillingCountry(e.target.value)}
            className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-[#0EA5A0] focus:ring-2 focus:ring-[#0EA5A0]/20"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
            ▾
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Determines your payment processor and applicable taxes.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-semibold hover:bg-slate-50 transition"
        >
          ← Edit
        </button>
        <button
          type="button"
          onClick={() => void handleProceed()}
          disabled={creating}
          className="flex-1 bg-[#0D1B2A] text-white py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {creating ? "Creating order…" : "Proceed to Payment →"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 py-3 flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800 font-medium capitalize">{value}</span>
    </div>
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

const MODEL_LABELS: Record<string, string> = {
  usage_prepaid: "Usage-Based · Prepaid",
  usage_postpaid: "Usage-Based · Postpaid",
  usage_payg: "Pay-as-You-Go",
  one_shot: "One-Shot Payment",
  pool: "Subscription Pool",
};

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
  { code: "BR", name: "Brazil" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "PE", name: "Peru" },
  { code: "VE", name: "Venezuela" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "OTHER", name: "Other" },
];
