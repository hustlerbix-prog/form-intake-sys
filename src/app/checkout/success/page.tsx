"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("order_id") ?? searchParams.get("session_id") ?? "";
  const returnUrl = searchParams.get("returnUrl") ?? "";

  const handleContinue = () => {
    if (returnUrl) {
      router.push(returnUrl);
    } else {
      router.push("/builder");
    }
  };

  const isBuilderReturn = returnUrl.includes("/builder/");

  return (
    <div className="max-w-md w-full bg-white rounded-2xl p-10 text-center shadow-2xl">
      <div className="w-16 h-16 bg-[#0EA5A0]/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg
          className="w-8 h-8 text-[#0EA5A0]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-[#0D1B2A] mb-2">Payment Confirmed!</h1>
      <p className="text-slate-500 text-sm mb-6">
        Your payment has been received. A receipt has been sent to your email.
      </p>

      {orderId && (
        <div className="bg-slate-50 rounded-lg px-4 py-2 text-xs text-slate-400 font-mono mb-6">
          Order: {orderId.slice(0, 20)}{orderId.length > 20 ? "…" : ""}
        </div>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleContinue}
          className="block w-full bg-[#0EA5A0] text-white py-3 rounded-xl font-semibold hover:opacity-90 transition text-center"
        >
          {isBuilderReturn ? "Continue to Export & Publish →" : "Go to Builder →"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/settings")}
          className="block w-full border border-slate-200 text-slate-600 py-3 rounded-xl font-semibold hover:bg-slate-50 transition text-center"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <main className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-white">Loading…</div>}>
        <SuccessContent />
      </Suspense>
    </main>
  );
}
