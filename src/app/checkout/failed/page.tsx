"use client";

import { useRouter } from "next/navigation";

export default function CheckoutFailedPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl p-10 text-center shadow-2xl">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-[#0D1B2A] mb-2">Payment Failed</h1>
        <p className="text-slate-500 text-sm mb-6">
          Payment was declined. Please check your card details or try another payment method.
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full bg-[#0D1B2A] text-white py-3 rounded-xl font-semibold hover:opacity-90 transition"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full border border-slate-200 text-slate-600 py-3 rounded-xl font-semibold hover:bg-slate-50 transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}
