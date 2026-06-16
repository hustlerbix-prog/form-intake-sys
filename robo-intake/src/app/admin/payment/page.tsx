"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PaymentSettings, PoolPackage, ProductPrice } from "@/lib/server/paymentSettings";

interface EnvStatus {
  stripe: { secretKeyConfigured: boolean; webhookConfigured: boolean; publishableKeyConfigured: boolean };
  mercadopago: { accessTokenConfigured: boolean };
  braintree: { configured: boolean };
  resend: { configured: boolean };
}

interface ApiResponse {
  payment: PaymentSettings;
  envStatus: EnvStatus;
  persisted?: boolean;
}

const ALL_PROCESSORS = ["stripe", "mercadopago", "paypal"] as const;
type Processor = (typeof ALL_PROCESSORS)[number];

const DEFAULT_LATAM = "AR,BR,CL,CO,MX,PE,VE";

export default function AdminPaymentPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [payment, setPayment] = useState<PaymentSettings | null>(null);
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [latamInput, setLatamInput] = useState(DEFAULT_LATAM);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("robo_admin_token");
      if (saved) setToken(saved);
    } catch {
      void 0;
    }
  }, []);

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h["x-admin-token"] = token;
    return h;
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/payment-settings", { headers });
    if (!res.ok) {
      setError((await res.text()) || "Failed to load payment settings");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as ApiResponse;
    setPayment(data.payment);
    setEnvStatus(data.envStatus);
    setLatamInput((data.payment.latamCountries ?? []).join(","));
    setLoading(false);
  }, [headers]);

  useEffect(() => { void load(); }, [load]);

  const onSave = useCallback(async () => {
    if (!payment) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    const updated: PaymentSettings = {
      ...payment,
      latamCountries: latamInput
        .toUpperCase()
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length === 2),
    };

    try {
      localStorage.setItem("robo_admin_token", token);
    } catch {
      void 0;
    }

    const res = await fetch("/api/admin/payment-settings", {
      method: "PUT",
      headers,
      body: JSON.stringify({ payment: updated }),
    });

    if (!res.ok) {
      setError((await res.text()) || "Failed to save");
      setSaving(false);
      return;
    }

    const data = (await res.json()) as ApiResponse;
    setPayment(data.payment);
    setEnvStatus(data.envStatus);
    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }, [payment, headers, token, latamInput]);

  const updatePool = (id: string, patch: Partial<PoolPackage>) => {
    if (!payment) return;
    setPayment({
      ...payment,
      poolPackages: payment.poolPackages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  };

  const updateProduct = (productId: string, patch: Partial<ProductPrice>) => {
    if (!payment) return;
    setPayment({
      ...payment,
      productPricing: payment.productPricing.map((p) =>
        p.productId === productId ? { ...p, ...patch } : p
      ),
    });
  };

  const toggleProcessor = (proc: Processor) => {
    if (!payment) return;
    const current = payment.enabledProcessors;
    const enabled = current.includes(proc)
      ? current.filter((p) => p !== proc)
      : [...current, proc];
    setPayment({ ...payment, enabledProcessors: enabled });
  };

  return (
    <div className="px-6 py-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Payment Settings</h1>
        <p className="mt-2 text-slate-500 text-sm">
          Configure PAY-100 billing models, processor routing, pool packages, and product pricing.
        </p>
      </div>

      {/* Auth token */}
      <div className="flex items-center gap-3 mb-8">
        <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Admin token</label>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="h-10 w-full max-w-xs rounded-lg border border-slate-300 px-3 text-sm"
          placeholder="ADMIN_TOKEN"
          type="password"
        />
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="h-10 px-4 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50"
        >
          Reload
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading || !payment ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-8">
          {/* ── Section 1: Bypass & General ── */}
          <Section title="General" description="Sandbox bypass and global payment behaviour.">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Payment Bypass</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    When enabled, agency admins see a ⚡ Test Mode banner and can skip real
                    transactions. Override with <code>PAYMENT_BYPASS_ENABLED</code> env var.
                  </div>
                </div>
                <Toggle
                  value={payment.bypassEnabled}
                  onChange={(v) => setPayment({ ...payment, bypassEnabled: v })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Low-balance alert (%)">
                  <NumberInput
                    value={payment.lowBalanceAlertPct}
                    onChange={(v) => setPayment({ ...payment, lowBalanceAlertPct: v })}
                    min={1}
                    max={100}
                  />
                  <p className="text-xs text-slate-400 mt-1">Alert fires when balance drops below this % of prepaid amount.</p>
                </Field>
                <Field label="Auto top-up increment ($)">
                  <NumberInput
                    value={payment.autoTopUpIncrement}
                    onChange={(v) => setPayment({ ...payment, autoTopUpIncrement: v })}
                    min={0}
                    step={5}
                  />
                </Field>
                <Field label="Annual discount (%)">
                  <NumberInput
                    value={payment.annualDiscountPct}
                    onChange={(v) => setPayment({ ...payment, annualDiscountPct: v })}
                    min={0}
                    max={100}
                  />
                  <p className="text-xs text-slate-400 mt-1">Shown to clients on pool package selector.</p>
                </Field>
              </div>
            </div>
          </Section>

          {/* ── Section 2: Processor Credentials Status ── */}
          <Section
            title="Processor Credentials"
            description="Configured via environment variables — status only. Set keys in .env.local or Vercel dashboard."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CredentialCard
                name="Stripe"
                items={[
                  { label: "Secret key", ok: envStatus?.stripe.secretKeyConfigured ?? false },
                  { label: "Publishable key", ok: envStatus?.stripe.publishableKeyConfigured ?? false },
                  { label: "Webhook secret", ok: envStatus?.stripe.webhookConfigured ?? false },
                ]}
                envVars={[
                  "STRIPE_SECRET_KEY / STRIPE_SECRET_KEY_TEST",
                  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
                  "STRIPE_WEBHOOK_SECRET",
                ]}
              />
              <CredentialCard
                name="MercadoPago"
                items={[
                  { label: "Access token", ok: envStatus?.mercadopago.accessTokenConfigured ?? false },
                ]}
                envVars={["MP_ACCESS_TOKEN / MP_ACCESS_TOKEN_TEST"]}
              />
              <CredentialCard
                name="PayPal / Braintree"
                items={[
                  { label: "Credentials", ok: envStatus?.braintree.configured ?? false },
                ]}
                envVars={["BRAINTREE_MERCHANT_ID, BRAINTREE_PUBLIC_KEY, BRAINTREE_PRIVATE_KEY"]}
              />
              <CredentialCard
                name="Resend (receipts)"
                items={[
                  { label: "API key", ok: envStatus?.resend.configured ?? false },
                ]}
                envVars={["RESEND_API_KEY"]}
              />
            </div>
          </Section>

          {/* ── Section 3: Processor Routing ── */}
          <Section
            title="Processor Routing"
            description="Enable processors and configure which countries route to MercadoPago."
          >
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-3">Enabled processors</p>
                <div className="flex gap-3 flex-wrap">
                  {ALL_PROCESSORS.map((proc) => (
                    <button
                      key={proc}
                      type="button"
                      onClick={() => toggleProcessor(proc)}
                      className={`px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                        payment.enabledProcessors.includes(proc)
                          ? "bg-[#0D1B2A] text-white border-[#0D1B2A]"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {PROCESSOR_LABELS[proc]}
                      {payment.enabledProcessors.includes(proc) ? " ✓" : ""}
                    </button>
                  ))}
                </div>
              </div>

              <Field label="LATAM countries (ISO 2-letter, comma-separated)">
                <input
                  value={latamInput}
                  onChange={(e) => setLatamInput(e.target.value.toUpperCase())}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-mono"
                  placeholder="AR,BR,CL,CO,MX,PE,VE"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Clients in these countries are routed to MercadoPago (if enabled).
                </p>
              </Field>
            </div>
          </Section>

          {/* ── Section 4: Pool Packages ── */}
          <Section
            title="Subscription Pool Packages"
            description="Configure pricing tiers for the shared token + minute subscription model."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    {["Tier", "Tokens/mo", "Minutes/mo", "Monthly $", "Annual $", "Active"].map(
                      (h) => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {payment.poolPackages.map((pkg) => (
                    <tr key={pkg.id} className="border-b border-slate-100">
                      <td className="py-3 px-3 font-semibold text-[#0D1B2A]">{pkg.name}</td>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          value={pkg.tokensPm}
                          onChange={(e) => updatePool(pkg.id, { tokensPm: Number(e.target.value) })}
                          className="w-28 h-8 rounded border border-slate-200 px-2 text-xs font-mono"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          value={pkg.minutesPm}
                          onChange={(e) => updatePool(pkg.id, { minutesPm: Number(e.target.value) })}
                          className="w-20 h-8 rounded border border-slate-200 px-2 text-xs font-mono"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          value={pkg.priceMonthly}
                          onChange={(e) => updatePool(pkg.id, { priceMonthly: Number(e.target.value) })}
                          className="w-20 h-8 rounded border border-slate-200 px-2 text-xs font-mono"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          value={pkg.priceAnnual}
                          onChange={(e) => updatePool(pkg.id, { priceAnnual: Number(e.target.value) })}
                          className="w-20 h-8 rounded border border-slate-200 px-2 text-xs font-mono"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <Toggle
                          value={pkg.active}
                          onChange={(v) => updatePool(pkg.id, { active: v })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ── Section 5: Product Pricing ── */}
          <Section
            title="Product Pricing (One-Shot)"
            description="Set the catalog price for one-shot purchases per product SKU."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    {["SKU", "Product Name", "One-Shot Price (USD)", "Active"].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payment.productPricing.map((p) => (
                    <tr key={p.productId} className="border-b border-slate-100">
                      <td className="py-3 px-3 font-mono text-xs text-slate-600">{p.productId}</td>
                      <td className="py-3 px-3 font-semibold text-[#0D1B2A]">{p.name}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 text-xs">$</span>
                          <input
                            type="number"
                            value={p.oneShotPrice}
                            onChange={(e) =>
                              updateProduct(p.productId, { oneShotPrice: Number(e.target.value) })
                            }
                            className="w-24 h-8 rounded border border-slate-200 px-2 text-xs font-mono"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Toggle
                          value={p.active}
                          onChange={(v) => updateProduct(p.productId, { active: v })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Save bar */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-400">
              {success ? (
                <span className="text-[#0EA5A0] font-semibold">✓ Saved successfully</span>
              ) : (
                "Changes are saved encrypted to disk (requires SETTINGS_ENCRYPTION_KEY)."
              )}
            </div>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving}
              className="h-11 px-6 rounded-lg bg-[#0D1B2A] text-white font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Payment Settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────── Sub-components ────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="font-bold text-slate-900">{title}</h2>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-slate-800 mb-1">{label}</div>
      {children}
    </label>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        value ? "bg-[#0EA5A0]" : "bg-slate-200"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          value ? "left-5" : "left-0.5"
        }`}
      />
    </button>
  );
}

function NumberInput({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      step={step}
      className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
    />
  );
}

function CredentialCard({
  name,
  items,
  envVars,
}: {
  name: string;
  items: { label: string; ok: boolean }[];
  envVars: string[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="font-semibold text-slate-800 text-sm mb-3">{name}</div>
      <div className="space-y-1 mb-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                item.ok ? "bg-green-400" : "bg-slate-300"
              }`}
            />
            <span className={item.ok ? "text-slate-700" : "text-slate-400"}>
              {item.label}: {item.ok ? "Configured" : "Not set"}
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-0.5">
        {envVars.map((v) => (
          <div key={v} className="text-xs text-slate-400 font-mono leading-relaxed">
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}

const PROCESSOR_LABELS: Record<Processor, string> = {
  stripe: "Stripe",
  mercadopago: "MercadoPago",
  paypal: "PayPal / Braintree",
};
