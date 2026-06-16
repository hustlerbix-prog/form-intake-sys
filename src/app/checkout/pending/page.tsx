"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function PendingContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id") ?? "";

  return (
    <div className="max-w-md w-full bg-white rounded-2xl p-10 text-center shadow-2xl">
      <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg
          className="w-8 h-8 text-yellow-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-[#0D1B2A] mb-2">Payment Pending</h1>
      <p className="text-slate-500 text-sm mb-6">
        Your payment is being processed. This may take a few minutes. You will receive a
        confirmation email once the payment is confirmed.
      </p>

      {orderId && (
        <div className="bg-slate-50 rounded-lg px-4 py-2 text-xs text-slate-400 font-mono mb-6">
          Order: {orderId}
        </div>
      )}

      <Link
        href="/"
        className="block w-full border border-slate-200 text-slate-600 py-3 rounded-xl font-semibold hover:bg-slate-50 transition text-center"
      >
        Back to Home
      </Link>
    </div>
  );
}

export default function CheckoutPendingPage() {
  return (
    <main className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-white">Loading…</div>}>
        <PendingContent />
      </Suspense>
    </main>
  );
}
