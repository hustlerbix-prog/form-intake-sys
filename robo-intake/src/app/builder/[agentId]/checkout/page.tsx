"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BILLING_MODEL_OPTIONS, type BillingModelId } from "@/lib/payment/billing-models";

type AgentInfo = {
  name: string;
  type: "chatbot" | "voice" | "agent";
  config?: { name?: string };
};

type OrderStatus = {
  paid: boolean;
  orderId?: string;
  billingModel?: string;
  amountUsd?: number;
  bypass?: boolean;
};

const PRODUCT_BY_TYPE: Record<string, string> = {
  chatbot: "CB-01",
  voice: "AVA-01",
  agent: "CA-01",
};

const TYPE_LABEL: Record<string, string> = {
  chatbot: "AI Chatbot",
  voice: "Voice Agent",
  agent: "AI Agent",
};

export default function BuilderCheckoutGate() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();

  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [bypassAvailable, setBypassAvailable] = useState(false);
  const [selectedModel, setSelectedModel] = useState<BillingModelId | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [bypassBusy, setBypassBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      // Load agent info
      const agentRes = await fetch(`/api/agents/${agentId}`);
      if (agentRes.ok) {
        const data = (await agentRes.json()) as AgentInfo;
        setAgent(data);
      }

      // Check payment status
      const statusRes = await fetch(`/api/checkout/order-status?agentId=${agentId}`);
      const status = (await statusRes.json()) as OrderStatus;
      setOrderStatus(status);

      // Check bypass availability (admin token in localStorage)
      const token = localStorage.getItem("robo_admin_token") ?? "";
      if (token) {
        const settingsRes = await fetch("/api/admin/payment-settings", {
          headers: { "x-admin-token": token },
        });
        if (settingsRes.ok) {
          const d = (await settingsRes.json()) as { payment?: { bypassEnabled?: boolean } };
          if (d.payment?.bypassEnabled) setBypassAvailable(true);
        }
      }

      setLoading(false);
    };
    void init();
  }, [agentId]);

  // Already paid — redirect straight to step6
  useEffect(() => {
    if (orderStatus?.paid && !loading) {
      setRedirecting(true);
      router.push(`/builder/${agentId}/step6`);
    }
  }, [orderStatus, loading, agentId, router]);

  const productId = PRODUCT_BY_TYPE[agent?.type ?? "chatbot"] ?? "CB-01";
  const agentLabel = TYPE_LABEL[agent?.type ?? "chatbot"] ?? "AI Agent";
  const agentName = agent?.config?.name ?? agent?.name ?? agentLabel;

  const applicableModels = BILLING_MODEL_OPTIONS.filter((m) =>
    m.applicableTo.includes(productId)
  );

  const handleContinueToCheckout = () => {
    if (!selectedModel) return;
    router.push(
      `/checkout/${agentId}/plan?model=${selectedModel}&product=${productId}&returnUrl=/builder/${agentId}/step6`
    );
  };

  const handleBypass = async () => {
    setBypassBusy(true);
    setError(null);
    const token = localStorage.getItem("robo_admin_token") ?? "";

    // First create a draft order
    const orderRes = await fetch("/api/checkout/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        productId,
        billingModel: selectedModel ?? "one_shot",
        amountUsd: 0,
        currency: "USD",
      }),
    });

    const orderData = (await orderRes.json()) as { order?: { id: string }; error?: string };
    if (!orderRes.ok || !orderData.order) {
      setError(orderData.error ?? "Failed to create order");
      setBypassBusy(false);
      return;
    }

    // Bypass the payment
    const bypassRes = await fetch("/api/checkout/bypass", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ orderId: orderData.order.id, actorId: "admin" }),
    });

    const bypassData = (await bypassRes.json()) as { success?: boolean; error?: string };
    if (bypassData.success) {
      router.push(`/builder/${agentId}/step6`);
    } else {
      setError(bypassData.error ?? "Bypass failed");
      setBypassBusy(false);
    }
  };

  if (loading || redirecting) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="text-slateText text-sm animate-pulse">
          {redirecting ? "Payment confirmed, loading export…" : "Checking payment status…"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy px-6 py-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <div className="text-white font-syne text-3xl font-bold mb-1">AI Builder</div>
            <div className="text-slateText">Step 6 — Checkout</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/builder/${agentId}/analysis`)}
              className="h-11 px-5 rounded-lg border border-navy-500 text-white font-bold hover:border-teal/40 hover:text-teal transition"
            >
              View analysis
            </button>
            <button
              type="button"
              onClick={() => router.push(`/builder/${agentId}/step5`)}
              className="h-11 px-5 rounded-lg border border-navy-500 text-white font-bold hover:border-teal/40 hover:text-teal transition"
            >
              Back
            </button>
          </div>
        </div>

        {/* Ready banner */}
        <div className="rounded-xl border border-teal/30 bg-teal/10 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-teal/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg
                className="w-5 h-5 text-teal"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="text-white font-bold text-lg mb-1">
                {agentName} is configured and ready to go live!
              </div>
              <div className="text-slateText text-sm leading-relaxed">
                Your {agentLabel.toLowerCase()} has passed the test harness. To publish it and
                download integration code, complete checkout below.
              </div>
            </div>
          </div>
        </div>

        {/* Agent summary */}
        <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-5 mb-6">
          <div className="text-white font-semibold mb-3">What you are activating</div>
          <div className="space-y-2">
            <SummaryRow icon="🤖" label="Agent" value={agentName} />
            <SummaryRow icon="📦" label="Product" value={`${agentLabel} · ${productId}`} />
            <SummaryRow
              icon="🔗"
              label="After checkout"
              value="Publish snapshot + download integration package (.zip)"
            />
          </div>
        </div>

        {/* Billing model selection */}
        <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-5 mb-6">
          <div className="text-white font-semibold mb-4">Choose a billing model</div>
          <div className="space-y-3">
            {applicableModels.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedModel(opt.id)}
                className={`w-full text-left rounded-lg border px-4 py-3 transition ${
                  selectedModel === opt.id
                    ? "border-teal bg-teal/10"
                    : "border-navy-500 hover:border-navy-400"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition ${
                      selectedModel === opt.id
                        ? "border-teal bg-teal"
                        : "border-navy-400"
                    }`}
                  />
                  <div>
                    <div className="text-white font-semibold text-sm">{opt.label}</div>
                    <div className="text-slateText text-xs mt-0.5">{opt.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 text-sm mb-4">
            {error}
          </div>
        )}

        {/* CTA buttons */}
        <div className="space-y-3">
          <button
            type="button"
            disabled={!selectedModel || bypassBusy}
            onClick={handleContinueToCheckout}
            className="w-full h-12 rounded-xl bg-teal text-navy font-bold text-base hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue to Checkout →
          </button>

          {bypassAvailable && (
            <button
              type="button"
              disabled={bypassBusy}
              onClick={() => void handleBypass()}
              className="w-full h-12 rounded-xl border-2 border-yellow-400/60 text-yellow-300 font-bold hover:bg-yellow-400/10 transition disabled:opacity-50"
            >
              {bypassBusy ? "Processing…" : "⚡ Activate without payment (Test Mode)"}
            </button>
          )}

          <p className="text-center text-slateText text-xs pt-1">
            {selectedModel
              ? `Selected: ${BILLING_MODEL_OPTIONS.find((m) => m.id === selectedModel)?.label}`
              : "Select a billing model to continue"}
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="w-5 text-center flex-shrink-0">{icon}</span>
      <span className="text-slateText w-28 flex-shrink-0">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
