"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BILLING_MODEL_OPTIONS, type BillingModelId } from "@/lib/payment/billing-models";

export default function BillingModelPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get("product") ?? "CB-01";
  const [selected, setSelected] = useState<BillingModelId | null>(null);

  const options = BILLING_MODEL_OPTIONS.filter((o) =>
    o.applicableTo.includes(productId)
  );

  const handleContinue = () => {
    if (!selected) return;
    router.push(`/checkout/${agentId}/plan?model=${selected}&product=${productId}`);
  };

  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <CheckoutBreadcrumb step={1} />
      <h1 className="text-2xl font-bold text-[#0D1B2A] mb-2">Choose a Billing Model</h1>
      <p className="text-slate-500 text-sm mb-8">Select how you want to pay for your AI agent.</p>

      <div className="grid gap-4">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setSelected(opt.id)}
            className={`border-2 rounded-xl p-5 text-left transition-all ${
              selected === opt.id
                ? "border-[#0EA5A0] bg-[#0EA5A0]/5 shadow-sm"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                  selected === opt.id
                    ? "border-[#0EA5A0] bg-[#0EA5A0]"
                    : "border-slate-300"
                }`}
              />
              <div>
                <div className="font-semibold text-[#0D1B2A]">{opt.label}</div>
                <div className="text-sm text-slate-500 mt-1">{opt.description}</div>
                <div className="text-xs mt-2 text-[#0EA5A0] font-medium">
                  Best for: {opt.bestFor}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!selected}
        onClick={handleContinue}
        className="mt-8 w-full bg-[#0D1B2A] text-white py-3 rounded-xl font-semibold
                   disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
      >
        Continue →
      </button>
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
          {i < steps.length - 1 && (
            <span className="text-slate-300 text-xs">›</span>
          )}
        </span>
      ))}
    </div>
  );
}
