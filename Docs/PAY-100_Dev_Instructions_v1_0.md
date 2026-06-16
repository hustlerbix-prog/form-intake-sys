# PAY-100 · Payment & Checkout Module
## Developer Coding Instructions — v1.0

**Document:** PAY-100-DEV-v1.0
**Author:** Kevin Bonilla · PO · ROBO AI Agency
**Date:** 2026-06-14
**Stack:** Next.js 14 App Router · Supabase · Stripe · MercadoPago · PayPal Braintree · Zod · Resend

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Environment Variables](#2-environment-variables)
3. [Database Schema](#3-database-schema)
4. [Billing Model Selection UI](#4-billing-model-selection-ui)
5. [Processor Routing Logic](#5-processor-routing-logic)
6. [Stripe Integration](#6-stripe-integration)
7. [MercadoPago Integration](#7-mercadopago-integration)
8. [PayPal / Braintree Integration](#8-paypal--braintree-integration)
9. [Webhook Handlers](#9-webhook-handlers)
10. [Sandbox Bypass](#10-sandbox-bypass)
11. [Publish Gate & Integration Code Generation](#11-publish-gate--integration-code-generation)
12. [Usage Metering](#12-usage-metering)
13. [Zod Schemas](#13-zod-schemas)
14. [Security Rules](#14-security-rules)
15. [Testing Checklist](#15-testing-checklist)

---

## 1. Architecture Overview

```
Client Browser
  └─ Next.js App Router (app/checkout/*)
       ├─ Step 6a: /checkout/[agentId]/billing-model
       ├─ Step 6b: /checkout/[agentId]/plan
       ├─ Step 6c: /checkout/[agentId]/summary
       ├─ Step 6d: /checkout/[agentId]/payment
       ├─ /checkout/success
       └─ /checkout/failed

API Routes (app/api/)
  ├─ /api/checkout/create-order        POST — create draft order in Supabase
  ├─ /api/checkout/stripe-session      POST — create Stripe Checkout session
  ├─ /api/checkout/mp-preference       POST — create MercadoPago preference
  ├─ /api/checkout/braintree-token     POST — get Braintree client token
  ├─ /api/checkout/braintree-sale      POST — submit Braintree transaction
  ├─ /api/webhooks/stripe              POST — Stripe webhook receiver
  ├─ /api/webhooks/mercadopago         POST — MercadoPago webhook receiver
  ├─ /api/publish/[agentId]            POST — publish agent post-payment
  └─ /api/integrations/download/[agentId]  GET — generate + return .zip

Supabase (Postgres + RLS)
  ├─ orders
  ├─ usage_ledger
  ├─ pool_packages
  ├─ product_pricing
  └─ audit_log
```

---

## 2. Environment Variables

Add all variables to `.env.local` (local) and Supabase/Vercel environment config (production). **Never commit secrets.**

```bash
# ─── Supabase ────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=           # Server-side only; never expose to client

# ─── Stripe ──────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=                   # sk_live_...
STRIPE_SECRET_KEY_TEST=              # sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # pk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST=  # pk_test_...
STRIPE_WEBHOOK_SECRET=               # whsec_...
STRIPE_WEBHOOK_SECRET_TEST=          # whsec_... (different per test endpoint)

# ─── MercadoPago ─────────────────────────────────────────────────────────────
MP_ACCESS_TOKEN=                     # APP_USR-... (prod)
MP_ACCESS_TOKEN_TEST=                # TEST-...
MP_WEBHOOK_SECRET=                   # Used for notification validation

# ─── PayPal / Braintree ───────────────────────────────────────────────────────
BRAINTREE_ENVIRONMENT=               # 'production' | 'sandbox'
BRAINTREE_MERCHANT_ID=
BRAINTREE_PUBLIC_KEY=
BRAINTREE_PRIVATE_KEY=
BRAINTREE_MERCHANT_ID_TEST=
BRAINTREE_PUBLIC_KEY_TEST=
BRAINTREE_PRIVATE_KEY_TEST=

# ─── Payment Bypass ───────────────────────────────────────────────────────────
PAYMENT_BYPASS_ENABLED=false         # Set 'true' only in dev/staging

# ─── Resend (email receipts) ──────────────────────────────────────────────────
RESEND_API_KEY=
RESEND_FROM_EMAIL=receipts@roboai.agency

# ─── App ──────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://app.roboai.agency
NODE_ENV=production                  # 'development' | 'staging' | 'production'
```

**Processor key selection helper:**

```typescript
// lib/payment/keys.ts
export const stripeKey = () =>
  process.env.NODE_ENV === 'production'
    ? process.env.STRIPE_SECRET_KEY!
    : process.env.STRIPE_SECRET_KEY_TEST!;

export const mpToken = () =>
  process.env.NODE_ENV === 'production'
    ? process.env.MP_ACCESS_TOKEN!
    : process.env.MP_ACCESS_TOKEN_TEST!;
```

---

## 3. Database Schema

Run these migrations in Supabase SQL editor.

```sql
-- ──────────────────────────────────────────────────────────────────────────────
-- pool_packages
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE pool_packages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  tokens_pm     BIGINT,
  minutes_pm    INTEGER,
  price_monthly NUMERIC(8,2) NOT NULL,
  price_annual  NUMERIC(8,2),
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- product_pricing
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE product_pricing (
  product_id      TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  one_shot_price  NUMERIC(8,2),
  currency        TEXT DEFAULT 'USD',
  active          BOOLEAN DEFAULT TRUE
);

-- ──────────────────────────────────────────────────────────────────────────────
-- orders
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts(id),
  product_id      TEXT NOT NULL,
  agent_id        UUID REFERENCES agents(id),
  billing_model   TEXT NOT NULL CHECK (billing_model IN (
                    'usage_prepaid','usage_postpaid','usage_payg',
                    'one_shot','pool')),
  plan_details    JSONB DEFAULT '{}',
  processor       TEXT CHECK (processor IN (
                    'stripe','mercadopago','paypal','bypass')),
  processor_ref   TEXT,
  amount_usd      NUMERIC(10,2),
  currency        TEXT DEFAULT 'USD',
  status          TEXT DEFAULT 'draft' CHECK (status IN (
                    'draft','pending','paid','failed','refunded')),
  bypass          BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  paid_at         TIMESTAMPTZ
);

CREATE INDEX orders_account_id_idx ON orders(account_id);
CREATE INDEX orders_agent_id_idx ON orders(agent_id);
CREATE INDEX orders_status_idx ON orders(status);

-- ──────────────────────────────────────────────────────────────────────────────
-- usage_ledger
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE usage_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts(id),
  agent_id        UUID REFERENCES agents(id),
  order_id        UUID REFERENCES orders(id),
  event_type      TEXT CHECK (event_type IN (
                    'token_in','token_out','minute','tool_call')),
  quantity        BIGINT NOT NULL,
  unit_cost_usd   NUMERIC(12,6) NOT NULL,
  total_cost_usd  NUMERIC(10,4) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX usage_ledger_account_period_idx
  ON usage_ledger(account_id, created_at DESC);
CREATE INDEX usage_ledger_agent_idx ON usage_ledger(agent_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- RLS Policies
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own orders" ON orders
  FOR SELECT USING (account_id = auth.uid());
CREATE POLICY "Service role manages orders" ON orders
  USING (auth.role() = 'service_role');

ALTER TABLE usage_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own usage" ON usage_ledger
  FOR SELECT USING (account_id = auth.uid());
CREATE POLICY "Service role manages usage" ON usage_ledger
  USING (auth.role() = 'service_role');
```

---

## 4. Billing Model Selection UI

```typescript
// app/checkout/[agentId]/billing-model/page.tsx
'use client';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { BILLING_MODEL_OPTIONS } from '@/lib/payment/billing-models';

export default function BillingModelPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  // agent.product_id passed via server component or URL param to filter options
  const options = BILLING_MODEL_OPTIONS; // filtered by product SKU server-side

  const handleContinue = () => {
    if (!selected) return;
    router.push(`/checkout/${agentId}/plan?model=${selected}`);
  };

  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <p className="text-sm text-muted mb-2">Step 6 — Checkout</p>
      <h1 className="text-2xl font-semibold mb-6">Choose a Billing Model</h1>
      <div className="grid gap-4">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSelected(opt.id)}
            className={`border rounded-xl p-5 text-left transition
              ${selected === opt.id
                ? 'border-[#0EA5A0] bg-[#0EA5A0]/5'
                : 'border-gray-200 hover:border-gray-400'}`}
          >
            <div className="font-semibold">{opt.label}</div>
            <div className="text-sm text-muted mt-1">{opt.description}</div>
            <div className="text-xs mt-2 text-[#0EA5A0]">Best for: {opt.bestFor}</div>
          </button>
        ))}
      </div>
      <button
        disabled={!selected}
        onClick={handleContinue}
        className="mt-8 w-full bg-[#0D1B2A] text-white py-3 rounded-xl
                   disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue →
      </button>
    </main>
  );
}
```

```typescript
// lib/payment/billing-models.ts
export const BILLING_MODEL_OPTIONS = [
  {
    id: 'usage_prepaid',
    label: 'Usage-Based · Prepaid',
    description: 'Load credit in advance. Agent deducts per token or minute used.',
    bestFor: 'SMBs wanting cost certainty',
    applicableTo: ['CB-01', 'AVA-01', 'CA-01'],
  },
  {
    id: 'usage_postpaid',
    label: 'Usage-Based · Postpaid',
    description: 'Run now, invoice at end of billing cycle. Set a spending cap.',
    bestFor: 'Agency-managed enterprise deployments',
    applicableTo: ['CB-01', 'AVA-01', 'CA-01'],
  },
  {
    id: 'usage_payg',
    label: 'Pay-as-You-Go',
    description: 'No minimum. Charged per API call or voice minute in real time.',
    bestFor: 'Pilots and low-volume deployments',
    applicableTo: ['CB-01', 'AVA-01', 'CA-01'],
  },
  {
    id: 'one_shot',
    label: 'One-Shot Payment',
    description: 'Single payment at catalog price. No recurring commitment.',
    bestFor: 'Fixed-scope implementations and consultancy',
    applicableTo: ['IS-001', 'CS-001', 'CB-01'],
  },
  {
    id: 'pool',
    label: 'Subscription Pool',
    description: 'Monthly/annual bundle of tokens + minutes shared across all your agents.',
    bestFor: 'Multi-agent deployments',
    applicableTo: ['CB-01', 'AVA-01', 'CA-01'],
  },
];
```

---

## 5. Processor Routing Logic

```typescript
// lib/payment/processor-router.ts
const LATAM_COUNTRIES = new Set([
  'AR', 'BR', 'CL', 'CO', 'MX', 'PE', 'VE',
]);

export type Processor = 'stripe' | 'mercadopago' | 'paypal' | 'bypass';

export function selectProcessor(billingCountry: string): {
  primary: Processor;
  fallback: Processor;
} {
  if (LATAM_COUNTRIES.has(billingCountry.toUpperCase())) {
    return { primary: 'mercadopago', fallback: 'stripe' };
  }
  return { primary: 'stripe', fallback: 'paypal' };
}
```

---

## 6. Stripe Integration

### 6.1 Create Checkout Session (One-Shot & Prepaid)

```typescript
// app/api/checkout/stripe-session/route.ts
import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { stripeKey } from '@/lib/payment/keys';
import { supabaseAdmin } from '@/lib/supabase/admin';

const stripe = new Stripe(stripeKey(), { apiVersion: '2024-06-20' });

export async function POST(req: NextRequest) {
  const { orderId, agentId, priceAmountCents, productName, successUrl, cancelUrl } =
    await req.json();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: productName },
        unit_amount: priceAmountCents,
      },
      quantity: 1,
    }],
    metadata: { orderId, agentId },
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
  });

  // Update order with pending processor_ref
  await supabaseAdmin
    .from('orders')
    .update({ processor: 'stripe', processor_ref: session.id, status: 'pending' })
    .eq('id', orderId);

  return NextResponse.json({ url: session.url });
}
```

### 6.2 Stripe Subscription (Pool Packages)

```typescript
// app/api/checkout/stripe-subscription/route.ts
export async function POST(req: NextRequest) {
  const { orderId, customerId, stripePriceId } = await req.json();

  const session = await stripe.checkout.sessions.create({
    customer: customerId,          // Stripe customer created at account signup
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [{ price: stripePriceId, quantity: 1 }],
    metadata: { orderId },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?order_id=${orderId}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/failed`,
  });

  await supabaseAdmin
    .from('orders')
    .update({ processor: 'stripe', processor_ref: session.id, status: 'pending' })
    .eq('id', orderId);

  return NextResponse.json({ url: session.url });
}
```

---

## 7. MercadoPago Integration

```typescript
// app/api/checkout/mp-preference/route.ts
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';
import { mpToken } from '@/lib/payment/keys';
import { supabaseAdmin } from '@/lib/supabase/admin';

const mp = new MercadoPagoConfig({ accessToken: mpToken() });

export async function POST(req: NextRequest) {
  const { orderId, agentId, amount, productName, payerEmail, billingCountry } =
    await req.json();

  const preference = new Preference(mp);

  const result = await preference.create({
    body: {
      items: [{
        id: orderId,
        title: productName,
        quantity: 1,
        currency_id: 'USD',
        unit_price: amount,
      }],
      payer: { email: payerEmail },
      external_reference: orderId,
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?order_id=${orderId}`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/failed`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/pending`,
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
    },
  });

  await supabaseAdmin
    .from('orders')
    .update({
      processor: 'mercadopago',
      processor_ref: result.id,
      status: 'pending',
    })
    .eq('id', orderId);

  // Return both sandbox (init_point sandbox) and production (init_point) URLs
  return NextResponse.json({
    url: process.env.NODE_ENV === 'production'
      ? result.init_point
      : result.sandbox_init_point,
  });
}
```

**Install:** `npm install mercadopago`

---

## 8. PayPal / Braintree Integration

```typescript
// app/api/checkout/braintree-token/route.ts
import braintree from 'braintree';
import { NextResponse } from 'next/server';

function gateway() {
  const isTest = process.env.BRAINTREE_ENVIRONMENT !== 'production';
  return new braintree.BraintreeGateway({
    environment: isTest
      ? braintree.Environment.Sandbox
      : braintree.Environment.Production,
    merchantId: isTest
      ? process.env.BRAINTREE_MERCHANT_ID_TEST!
      : process.env.BRAINTREE_MERCHANT_ID!,
    publicKey: isTest
      ? process.env.BRAINTREE_PUBLIC_KEY_TEST!
      : process.env.BRAINTREE_PUBLIC_KEY!,
    privateKey: isTest
      ? process.env.BRAINTREE_PRIVATE_KEY_TEST!
      : process.env.BRAINTREE_PRIVATE_KEY!,
  });
}

export async function GET() {
  const { clientToken } = await gateway().clientToken.generate({});
  return NextResponse.json({ clientToken });
}
```

```typescript
// app/api/checkout/braintree-sale/route.ts
export async function POST(req: NextRequest) {
  const { orderId, nonce, amount } = await req.json();

  const result = await gateway().transaction.sale({
    amount: String(amount),
    paymentMethodNonce: nonce,
    options: { submitForSettlement: true },
  });

  if (result.success) {
    await activateOrder(orderId, 'paypal', result.transaction.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { error: result.message },
    { status: 400 }
  );
}
```

**Install:** `npm install braintree`

---

## 9. Webhook Handlers

### 9.1 Stripe Webhook

```typescript
// app/api/webhooks/stripe/route.ts
import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { stripeKey } from '@/lib/payment/keys';
import { activateOrder, failOrder } from '@/lib/payment/order-actions';

const stripe = new Stripe(stripeKey(), { apiVersion: '2024-06-20' });

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;
  const secret = process.env.NODE_ENV === 'production'
    ? process.env.STRIPE_WEBHOOK_SECRET!
    : process.env.STRIPE_WEBHOOK_SECRET_TEST!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata.orderId;
      await activateOrder(orderId, 'stripe', pi.id);
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      await failOrder(pi.metadata.orderId);
      break;
    }
    case 'invoice.paid': {
      const inv = event.data.object as Stripe.Invoice;
      const orderId = inv.subscription_details?.metadata?.orderId;
      if (orderId) await activateOrder(orderId, 'stripe', inv.id);
      break;
    }
    case 'customer.subscription.deleted': {
      // suspend agent — implement per agent lifecycle spec
      break;
    }
  }

  return NextResponse.json({ received: true });
}

export const config = { api: { bodyParser: false } };
```

### 9.2 MercadoPago Webhook

```typescript
// app/api/webhooks/mercadopago/route.ts
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';
import { mpToken } from '@/lib/payment/keys';
import { activateOrder, failOrder } from '@/lib/payment/order-actions';

const mp = new MercadoPagoConfig({ accessToken: mpToken() });

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.type === 'payment') {
    const payment = new Payment(mp);
    const paymentData = await payment.get({ id: body.data.id });

    const orderId = paymentData.external_reference!;

    switch (paymentData.status) {
      case 'approved':
        await activateOrder(orderId, 'mercadopago', String(paymentData.id));
        break;
      case 'rejected':
        await failOrder(orderId);
        break;
      // 'pending', 'in_process' — no action; await next event
    }
  }

  return NextResponse.json({ received: true });
}
```

### 9.3 Shared Order Action Helpers

```typescript
// lib/payment/order-actions.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendReceiptEmail } from '@/lib/email/receipt';
import type { Processor } from './processor-router';

export async function activateOrder(
  orderId: string,
  processor: Processor,
  processorRef: string
) {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .update({
      status: 'paid',
      processor,
      processor_ref: processorRef,
      paid_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select('*, agents(*)')
    .single();

  if (!order) return;

  // Write audit log
  await supabaseAdmin.from('audit_log').insert({
    actor_id: order.account_id,
    entity_type: 'order',
    entity_id: orderId,
    action: 'payment_confirmed',
    meta: { processor, processor_ref: processorRef },
  });

  // Send receipt
  await sendReceiptEmail(order);
}

export async function failOrder(orderId: string) {
  await supabaseAdmin
    .from('orders')
    .update({ status: 'failed' })
    .eq('id', orderId);
}
```

---

## 10. Sandbox Bypass

```typescript
// lib/payment/bypass.ts
import { supabaseAdmin } from '@/lib/supabase/admin';

export function isBypassEnabled(): boolean {
  return process.env.PAYMENT_BYPASS_ENABLED === 'true';
}

export async function processBypassOrder(
  orderId: string,
  actorId: string
): Promise<void> {
  await supabaseAdmin
    .from('orders')
    .update({
      status: 'paid',
      processor: 'bypass',
      processor_ref: `bypass-${Date.now()}`,
      bypass: true,
      paid_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  await supabaseAdmin.from('audit_log').insert({
    actor_id: actorId,
    entity_type: 'order',
    entity_id: orderId,
    action: 'bypass_payment',
    meta: { note: 'Payment bypassed — test/demo mode' },
  });
}
```

**Checkout UI — bypass banner:**

```tsx
// In /checkout/[agentId]/payment/page.tsx
{isBypassEnabled && userRole === 'agency_admin' && (
  <div className="bg-yellow-50 border border-yellow-300 text-yellow-800
                  rounded-lg px-4 py-3 mb-6 flex items-center gap-2 text-sm">
    <span>⚡</span>
    <span><strong>Test Mode — Payment Bypassed.</strong> No real transaction will occur.</span>
  </div>
)}
```

---

## 11. Publish Gate & Integration Code Generation

### 11.1 Publish Gate Check

```typescript
// lib/publish/gate.ts
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function canPublish(agentId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('orders')
    .select('status')
    .eq('agent_id', agentId)
    .eq('status', 'paid')
    .limit(1)
    .single();

  return !!data;
}
```

### 11.2 Publish Action

```typescript
// app/api/publish/[agentId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { canPublish } from '@/lib/publish/gate';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createBotConfigSnapshot } from '@/lib/publish/snapshot';
import { generateIntegrationPackage } from '@/lib/publish/package';

export async function POST(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const { agentId } = params;
  const { actorId } = await req.json();

  if (!(await canPublish(agentId))) {
    return NextResponse.json({ error: 'Payment required' }, { status: 402 });
  }

  // 1. Create immutable config snapshot
  const snapshot = await createBotConfigSnapshot(agentId);

  // 2. Set agent to published
  await supabaseAdmin
    .from('agents')
    .update({ status: 'published', published_snapshot_id: snapshot.id })
    .eq('id', agentId);

  // 3. Generate integration package
  const downloadUrl = await generateIntegrationPackage(agentId, snapshot);

  // 4. Audit log
  await supabaseAdmin.from('audit_log').insert({
    actor_id: actorId,
    entity_type: 'agent',
    entity_id: agentId,
    action: 'publish',
    meta: { snapshot_id: snapshot.id },
  });

  return NextResponse.json({ success: true, downloadUrl });
}
```

### 11.3 Integration Code Package Generator

```typescript
// lib/publish/package.ts
import JSZip from 'jszip';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function generateIntegrationPackage(
  agentId: string,
  snapshot: any
): Promise<string> {
  const zip = new JSZip();

  const embedScript = `
<script>
  window.ROBOAI_AGENT_ID = "${agentId}";
  window.ROBOAI_ENDPOINT = "${process.env.NEXT_PUBLIC_APP_URL}/api/chat";
</script>
<script src="${process.env.NEXT_PUBLIC_APP_URL}/widget/chat.js" async></script>
`.trim();

  const envExample = [
    'ROBOAI_AGENT_ID=your-agent-id',
    'ROBOAI_API_KEY=your-scoped-api-key',
    'ROBOAI_WEBHOOK_URL=https://your-domain.com/webhooks/roboai',
  ].join('\n');

  const apiConfig = JSON.stringify(
    {
      agent_id: agentId,
      endpoint: `${process.env.NEXT_PUBLIC_APP_URL}/api/chat`,
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/agents/${agentId}/webhooks`,
      scoped_api_key: snapshot.scoped_api_key,
      version: snapshot.version,
    },
    null,
    2
  );

  zip.file('README.md', generateReadme(agentId));
  zip.file('embed.html', embedScript);
  zip.file('.env.example', envExample);
  zip.file('api-config.json', apiConfig);
  zip.file('webhook-guide.md', generateWebhookGuide());

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const path = `integrations/${agentId}/package-${snapshot.version}.zip`;

  await supabaseAdmin.storage.from('integration-packages').upload(path, buffer, {
    contentType: 'application/zip',
    upsert: true,
  });

  const { data } = supabaseAdmin.storage
    .from('integration-packages')
    .getPublicUrl(path);

  return data.publicUrl;
}
```

**Install:** `npm install jszip`

---

## 12. Usage Metering

Call `recordUsage` after every agent API response:

```typescript
// lib/metering/record.ts
import { supabaseAdmin } from '@/lib/supabase/admin';

interface UsageEvent {
  accountId: string;
  agentId: string;
  orderId: string;
  eventType: 'token_in' | 'token_out' | 'minute' | 'tool_call';
  quantity: number;
  unitCostUsd: number;
}

export async function recordUsage(event: UsageEvent) {
  const total = event.quantity * event.unitCostUsd;

  await supabaseAdmin.from('usage_ledger').insert({
    account_id: event.accountId,
    agent_id: event.agentId,
    order_id: event.orderId,
    event_type: event.eventType,
    quantity: event.quantity,
    unit_cost_usd: event.unitCostUsd,
    total_cost_usd: total,
  });
}

// Balance check (for hard cap / low-balance alert)
export async function getRemainingBalance(
  accountId: string,
  prepaidAmount: number
): Promise<number> {
  const { data } = await supabaseAdmin
    .from('usage_ledger')
    .select('total_cost_usd')
    .eq('account_id', accountId)
    .gte('created_at', currentBillingPeriodStart());

  const spent = data?.reduce((sum, r) => sum + r.total_cost_usd, 0) ?? 0;
  return prepaidAmount - spent;
}

function currentBillingPeriodStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
```

---

## 13. Zod Schemas

```typescript
// lib/payment/schemas.ts
import { z } from 'zod';

export const CreateOrderSchema = z.object({
  agentId: z.string().uuid(),
  productId: z.string(),
  billingModel: z.enum([
    'usage_prepaid', 'usage_postpaid', 'usage_payg', 'one_shot', 'pool',
  ]),
  planDetails: z.record(z.unknown()).optional(),
  amountUsd: z.number().positive(),
  currency: z.string().default('USD'),
});

export const StripeSessionSchema = z.object({
  orderId: z.string().uuid(),
  agentId: z.string().uuid(),
  priceAmountCents: z.number().int().positive(),
  productName: z.string(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const MpPreferenceSchema = z.object({
  orderId: z.string().uuid(),
  agentId: z.string().uuid(),
  amount: z.number().positive(),
  productName: z.string(),
  payerEmail: z.string().email(),
  billingCountry: z.string().length(2),
});

export const BypassOrderSchema = z.object({
  orderId: z.string().uuid(),
});
```

---

## 14. Security Rules

| Rule | Implementation |
|------|---------------|
| No card data on ROBO AI servers | Use Stripe Elements / Braintree Drop-in / MP Checkout Pro — all hosted/embedded tokenization |
| Credentials never in client bundle | All processor keys server-side only; never prefixed `NEXT_PUBLIC_` |
| Webhook signature verification | Stripe: `stripe.webhooks.constructEvent`; MP: validate `x-signature` header |
| PCI scope | SAQ A (Stripe hosted) or SAQ A-EP (Elements/Braintree embedded) |
| RLS enforced | `orders` and `usage_ledger` tables have RLS; `service_role` key only on server |
| Bypass restricted | `PAYMENT_BYPASS_ENABLED` checked server-side AND `role = agency_admin` checked; never trust client assertion |
| Idempotency | Webhook handlers check current `order.status` before updating; guard against duplicate events |
| Audit trail | Every state transition writes to `audit_log` via `supabaseAdmin` (not client) |

---

## 15. Testing Checklist

### Unit Tests
- [ ] `selectProcessor` returns `mercadopago` for MX, BR, AR, CO, CL, PE; `stripe` for US, UK, DE
- [ ] `isBypassEnabled` reads `PAYMENT_BYPASS_ENABLED` correctly
- [ ] `getRemainingBalance` returns correct value with mock usage ledger
- [ ] Zod schemas reject invalid payloads

### Integration Tests (Sandbox)
- [ ] Stripe test card `4242 4242 4242 4242` completes one-shot payment; order → `paid`
- [ ] Stripe test card `4000 0000 0000 9995` triggers failure; order → `failed`; retry re-renders
- [ ] MercadoPago sandbox card completes payment; webhook fires; order → `paid`
- [ ] Braintree sandbox nonce `fake-valid-nonce` completes payment
- [ ] Stripe subscription created; `invoice.paid` webhook activates pool order
- [ ] Stripe subscription deleted; agent suspended

### E2E (Bypass Mode — Maple & Oak Catering Co. demo profile)
- [ ] `PAYMENT_BYPASS_ENABLED=true` + `role=agency_admin` → yellow banner visible
- [ ] "Complete Payment" in bypass mode → order `status = paid`, `bypass = true`
- [ ] Publish gate unlocks; agent moves to `published`
- [ ] `.zip` integration package generated and downloadable
- [ ] Receipt email sent via Resend (check preview in staging)
- [ ] Bypass order tagged `[TEST]` in admin orders table
- [ ] Revenue reports exclude bypass orders

---

*PAY-100 Developer Coding Instructions v1.0 — ROBO AI Agency · Kevin Bonilla · 2026-06-14*
