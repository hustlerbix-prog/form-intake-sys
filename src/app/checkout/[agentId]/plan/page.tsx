"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PoolPackage, ProductPrice } from "@/lib/server/paymentSettings";

interface PlanSettings {
  poolPackages: PoolPackage[];
  productPricing: ProductPrice[];
  autoTopUpIncrement: number;
  annualDiscountPct: number;
}

export default function PlanPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const model = searchParams.get("model") ?? "one_shot";
  const productId = searchParams.get("product") ?? "CB-01";
  const returnUrl = searchParams.get("returnUrl") ?? "";

  const [settings, setSettings] = useState<PlanSettings | null>(null);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [prepaidAmount, setPrepaidAmount] = useState(50);
  const [spendingCap, setSpendingCap] = useState(200);
  const [overagePolicy, setOveragePolicy] = useState<"hard_cap" | "auto_top_up">("hard_cap");
  const [promoCode, setPromoCode] = useState("");

  useEffect(() => {
    fetch("/api/admin/payment-settings", {
      headers: { "x-admin-token": localStorage.getItem("robo_admin_token") ?? "" },
    })
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.payment as PlanSettings);
        if (d.payment?.poolPackages?.[0]) {
          setSelectedPoolId(d.payment.poolPackages[0].id);
        }
      })
      .catch(() => setSettings({ poolPackages: [], productPricing: [], autoTopUpIncrement: 25, annualDiscountPct: 16 }));
  }, []);

  const productPrice =
    settings?.productPricing.find((p) => p.productId === productId && p.active)?.oneShotPrice ?? 0;

  const handleContinue = () => {
    const planDetails: Record<string, unknown> = { overagePolicy };
    let amount = 0;

    if (model === "pool" && selectedPoolId) {
      const pkg = settings?.poolPackages.find((p) => p.id === selectedPoolId);
      amount =
        billingCycle === "annual" ? (pkg?.priceAnnual ?? 0) : (pkg?.priceMonthly ?? 0);
      planDetails.poolPackageId = selectedPoolId;
      planDetails.billingCycle = billingCycle;
    } else if (model === "one_shot") {
      amount = productPrice;
    } else if (model === "usage_prepaid") {
      amount = prepaidAmount;
      planDetails.prepaidAmount = prepaidAmount;
    } else if (model === "usage_postpaid") {
      planDetails.spendingCap = spendingCap;
    }

    const params = new URLSearchParams({
      model,
      product: productId,
      amount: String(amount),
      planDetails: JSON.stringify(planDetails),
      ...(promoCode ? { promo: promoCode } : {}),
      ...(returnUrl ? { returnUrl } : {}),
    });
    router.push(`/checkout/${agentId}/summary?${params}`);
  };

  if (!settings) {
    return (
      <main className="max-w-2xl mx-auto py-12 px-4 text-center text-slate-400">
        Loading plan options…
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <CheckoutBreadcrumb step={2} />
      <h1 className="text-2xl font-bold text-[#0D1B2A] mb-2">Configure Your Plan</h1>
      <p className="text-slate-500 text-sm mb-8">
        {MODEL_LABELS[model] ?? model}
      </p>

      {model === "pool" && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
            {(["monthly", "annual"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBillingCycle(c)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${
                  billingCycle === c
                    ? "bg-[#0D1B2A] text-white border-[#0D1B2A]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {c === "monthly" ? "Monthly" : `Annual (save ~${settings.annualDiscountPct.toFixed(0)}%)`}
              </button>
            ))}
          </div>
          {settings.poolPackages
            .filter((p) => p.active)
            .map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelectedPoolId(pkg.id)}
                className={`w-full border-2 rounded-xl p-5 text-left transition ${
                  selectedPoolId === pkg.id
                    ? "border-[#0EA5A0] bg-[#0EA5A0]/5"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-[#0D1B2A]">{pkg.name}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      {(pkg.tokensPm / 1_000_000).toFixed(1)}M tokens/mo ·{" "}
                      {pkg.minutesPm.toLocaleString()} minutes/mo
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#0D1B2A]">
                      ${billingCycle === "annual"
                        ? pkg.priceAnnual.toFixed(0)
                        : pkg.priceMonthly.toFixed(0)}
                    </div>
                    <div className="text-xs text-slate-400">
                      /{billingCycle === "annual" ? "year" : "month"}
                    </div>
                  </div>
                </div>
              </button>
            ))}
        </div>
      )}

      {model === "one_shot" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex justify-between">
            <span className="font-semibold text-[#0D1B2A]">{productId} — One-Shot</span>
            <span className="font-bold text-[#0D1B2A]">${productPrice.toFixed(2)}</span>
          </div>
          <p className="text-sm text-slate-400 mt-2">Single payment, no recurring charge.</p>
          <div className="mt-4">
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Promo code (optional)
            </label>
            <input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="h-10 w-full max-w-xs rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="AGENCY20"
            />
          </div>
        </div>
      )}

      {(model === "usage_prepaid") && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Prepaid credit amount (USD)</span>
            <div className="flex gap-3 mt-2">
              {[25, 50, 100, 250].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPrepaidAmount(v)}
                  className={`px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                    prepaidAmount === v
                      ? "bg-[#0D1B2A] text-white border-[#0D1B2A]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  ${v}
                </button>
              ))}
            </div>
          <p className="text-xs text-slate-500 mt-2">
            Customer prepays the selected balance now. If auto top-up is enabled later, the default reload amount is ${settings.autoTopUpIncrement.toFixed(0)}.
          </p>
          </label>
          <OveragePolicySelect value={overagePolicy} onChange={setOveragePolicy} />
        </div>
      )}

      {model === "usage_postpaid" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Monthly spending cap (USD)</span>
            <input
              type="number"
              min={50}
              value={spendingCap}
              onChange={(e) => setSpendingCap(Number(e.target.value))}
              className="mt-2 h-10 w-40 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </label>
          <p className="text-xs text-slate-500">
            Customer is billed at cycle end for actual usage, capped at ${spendingCap.toFixed(0)} this month.
          </p>
          <OveragePolicySelect value={overagePolicy} onChange={setOveragePolicy} />
        </div>
      )}

      {model === "usage_payg" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-slate-600 text-sm">
            No minimum commitment. You are charged per API call or voice minute in real time.
            No credit balance required.
          </p>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Customer checkout today: <span className="font-semibold">$0.00 upfront</span>
            <div className="text-xs text-slate-500 mt-1">
              Billing starts only when the agent begins consuming tokens, calls, or minutes.
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleContinue}
        className="mt-8 w-full bg-[#0D1B2A] text-white py-3 rounded-xl font-semibold
                   hover:opacity-90 transition"
      >
        Review Order →
      </button>
    </main>
  );
}

function OveragePolicySelect({
  value,
  onChange,
}: {
  value: "hard_cap" | "auto_top_up";
  onChange: (v: "hard_cap" | "auto_top_up") => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">When balance runs out</span>
      <div className="flex gap-3 mt-2">
        {[
          { id: "hard_cap", label: "Pause agent" },
          { id: "auto_top_up", label: "Auto top-up" },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id as "hard_cap" | "auto_top_up")}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold transition ${
              value === opt.id
                ? "bg-[#0D1B2A] text-white border-[#0D1B2A]"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </label>
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
  usage_prepaid: "Usage-Based · Prepaid — load credit in advance",
  usage_postpaid: "Usage-Based · Postpaid — invoiced at cycle end",
  usage_payg: "Pay-as-You-Go — no minimum commitment",
  one_shot: "One-Shot Payment — single charge at catalog price",
  pool: "Subscription Pool — shared token + minute bundle",
};
