# PAY-100 · Payment & Checkout Module
## Product Requirements Document — v1.0

**Document:** PAY-100-PRD-v1.0
**Author:** Kevin Bonilla · PO · ROBO AI Agency
**Date:** 2026-06-14
**Status:** Draft
**Parent Product:** WEB-007 AI Builder Platform
**Related Modules:** CB-100 (Chatbot Builder), AVA-01 (Voice Assistant), CA-01 (Company Analyzer)

---

## Table of Contents

1. [Overview & Purpose](#1-overview--purpose)
2. [User Journey Context](#2-user-journey-context)
3. [Billing Models](#3-billing-models)
4. [Payment Processors](#4-payment-processors)
5. [Checkout Flow](#5-checkout-flow)
6. [Post-Payment: Publish Gate & Code Download](#6-post-payment-publish-gate--code-download)
7. [Sandbox / Test Bypass](#7-sandbox--test-bypass)
8. [Billing Dashboard & Metering](#8-billing-dashboard--metering)
9. [Data Model](#9-data-model)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Open Questions](#11-open-questions)
12. [Out of Scope](#12-out-of-scope)

---

## 1. Overview & Purpose

### 1.1 Problem Statement

After a client completes agent configuration in the AI Builder (AI Chatbot, VS-01 Voice Secretary, VS-02 Leads Hunter, VS-03 IVR Routing, AI Agent, or Custom Agent), there is currently no mechanism to:

- Collect payment before the agent goes live
- Gate publishing and integration code download behind confirmed payment
- Support the three distinct commercial models ROBO AI Agency offers (usage-based, one-shot, subscription pool)
- Route payment to the optimal processor based on the client's geography

### 1.2 Goal

Build a payment and checkout module (PAY-100) that sits between "configuration complete" and "publish/download," enforces the payment gate, supports multiple billing models and processors, and provides a bypass toggle for agency QA and demo scenarios.

### 1.3 Success Metrics

| Metric | Target |
|--------|--------|
| Checkout completion rate | ≥ 80% of sessions that reach the billing model step |
| Payment failure retry success | ≥ 60% of failed payments recovered on retry |
| Time from payment confirmation to code download | ≤ 90 seconds |
| Receipt email delivery time | ≤ 30 seconds from webhook |
| LATAM processor coverage (% of LATAM clients) | ≥ 95% served by MercadoPago or Stripe |

---

## 2. User Journey Context

```
AI Builder Step 1 — Choose Template
        ↓
AI Builder Steps 2–5 — Configure Agent (CB-100 / AVA-01 / CA-01)
        ↓
AI Builder Step 6 — [PAY-100] Checkout
  ├── 6a. Select Billing Model
  ├── 6b. Configure Plan Details
  ├── 6c. Enter Payment (or bypass)
  ├── 6d. Confirmation & Receipt
        ↓
AI Builder Step 7 — Publish & Download Integration Code
```

The payment module is triggered once the agent passes a `config_complete` validation check. It is skipped only when `PAYMENT_BYPASS_ENABLED = true` and the acting user has `role = agency_admin`.

---

## 3. Billing Models

### 3.1 Usage-Based Billing

Clients pay for what they consume, measured in **tokens** (text agents) or **minutes** (voice agents), or both (hybrid agents).

**Sub-variants:**

| Sub-type | Description | Best For |
|----------|-------------|----------|
| **Prepaid** | Client loads a credit balance. Agent deducts from balance per use. Low-balance alert at configurable threshold (default 20%). | SMBs who want cost certainty |
| **Postpaid** | Agency runs the agent; client receives invoice at end of billing cycle. Spending cap enforced. | Enterprise / agency-managed deployments |
| **Pay-as-You-Go (PAYG)** | No minimum commitment. Charge per API call in real time. No credit balance required. | Pilots, low-volume deployments |

**Metering units:**

| Agent Type | Metering Unit | Notes |
|------------|---------------|-------|
| AI Chatbot (CB-01) | Tokens (input + output) | Claude Sonnet ≈ $3/$15 per 1M tokens in/out |
| VS-01 Voice Secretary | Minutes (talk time) | Retell AI minute-based billing |
| VS-02 Leads Hunter | Minutes + per-call | Outbound dial time + connection fee |
| VS-03 IVR Routing | Minutes | Inbound handle time |
| AI Agent (CA-01) | Tokens + tool calls | Blended rate |

**Overage handling options (required selection at checkout):**
- `hard_cap` — Agent pauses when balance exhausted; client must top up.
- `auto_top_up` — System charges stored payment method for a configurable increment when balance drops below threshold.

### 3.2 One-Shot Payment

A single non-recurring charge based on the product SKU price from the `product_pricing` table. Suitable for implementation services (IS-xxx), consultancy packages (CS-xxx), and fixed-scope chatbot setups.

Discount codes and agency partner discounts are applied pre-checkout. Taxes calculated based on client billing country and product category (digital service).

### 3.3 Subscription Pool Package

A recurring monthly or annual subscription that provides a shared pool of tokens and/or minutes distributed across all agents on the client's account.

**Pool tiers (indicative — final pricing in `pool_packages` table):**

| Tier | Tokens / Month | Minutes / Month | Monthly Price (USD) |
|------|---------------|-----------------|---------------------|
| Starter | 500K | 500 | $99 |
| Growth | 2M | 2,000 | $299 |
| Scale | 10M | 10,000 | $799 |
| Enterprise | Custom | Custom | Custom |

**Pool mechanics:**
- Balance shared across all `active` agents on the account.
- Per-agent consumption visible in billing dashboard.
- Proration calculated on tier changes.
- Renewal on billing anniversary (monthly or annual).

---

## 4. Payment Processors

### 4.1 Processor Selection Matrix

ROBO AI Agency serves clients in LATAM, UK, EU, and North America. No single processor provides optimal coverage for all regions at competitive fees.

| Region | Primary Processor | Fallback |
|--------|-------------------|---------|
| LATAM (AR, BR, CL, CO, MX, PE, VE) | MercadoPago | Stripe |
| North America (US, CA) | Stripe | PayPal (Braintree) |
| UK / EU | Stripe | PayPal (Braintree) |
| Rest of World | Stripe | PayPal (Braintree) |

**Routing logic:**

```
1. Read client.billing_country from onboarding profile (BA-001 intake).
2. If billing_country IN LATAM_COUNTRIES → preferred_processor = 'mercadopago'
3. Else → preferred_processor = 'stripe'
4. If preferred_processor checkout fails → fallback_processor activated.
5. Client may manually switch processor before confirming payment.
```

### 4.2 Stripe

- **Use cases:** Global card processing, subscription billing, invoicing, PAYG usage billing.
- **Integration:** Stripe Checkout (hosted) or Stripe Elements (embedded) for one-shot and prepaid. Stripe Billing for subscriptions and postpaid invoicing.
- **Sandbox:** Stripe test mode keys via `STRIPE_SECRET_KEY_TEST` / `STRIPE_PUBLISHABLE_KEY_TEST`.
- **Webhooks:** `/api/webhooks/stripe` — signed with `STRIPE_WEBHOOK_SECRET`.
  - `payment_intent.succeeded` → activate order
  - `payment_intent.payment_failed` → surface error to client
  - `invoice.paid` → activate/renew subscription
  - `customer.subscription.updated` → sync plan tier
  - `customer.subscription.deleted` → suspend agent

### 4.3 MercadoPago

- **Coverage:** Argentina, Brazil, Chile, Colombia, Mexico, Peru, Venezuela.
- **Supported payment methods:** Credit/debit cards (Visa, MC, Amex), OXXO cash (MX), Pix (BR), local installments.
- **Integration:** MercadoPago Checkout Pro (hosted redirect); webhook callback to `/api/webhooks/mercadopago`.
- **Sandbox:** MercadoPago test credentials via `MP_ACCESS_TOKEN_TEST`; test cards documented at developers.mercadopago.com.
- **Webhook events:** `payment.updated` (status: approved/rejected/pending).

### 4.4 PayPal (Braintree)

- **Use cases:** Fallback for North America / EU; clients who prefer PayPal wallet; regions with limited Stripe/MercadoPago coverage.
- **Integration:** Braintree Drop-in UI or PayPal JS SDK v5.
- **Sandbox:** Braintree sandbox credentials via `BRAINTREE_MERCHANT_ID_TEST`, `BRAINTREE_PUBLIC_KEY_TEST`, `BRAINTREE_PRIVATE_KEY_TEST`.

> **OQ-114:** Confirm whether to use Braintree Drop-in or PayPal JS SDK v5 as the primary PayPal integration path.

### 4.5 Credential Security

All processor credentials stored in **Supabase Vault** (AES-256 at rest). Environment variables accessed only server-side via Next.js API routes. Card data never touches ROBO AI servers — tokenized exclusively by the processor SDK. PCI DSS SAQ A or SAQ A-EP scope applies depending on integration method chosen.

---

## 5. Checkout Flow

### 5.1 Step-by-Step

```
Step 6a — Billing Model Selection
  Client selects: Usage-Based | One-Shot | Subscription Pool
  System disables non-applicable models per product SKU.
  
Step 6b — Plan Configuration
  Usage-Based: choose Prepaid / Postpaid / PAYG, select tier, set cap/policy.
  One-Shot: review pricing, apply promo code.
  Pool: select tier, choose monthly/annual, review proration.
  
Step 6c — Order Summary
  Display: Product, SKU, billing model, plan details, subtotal, taxes, total.
  "Edit" links per line item.
  
Step 6d — Payment
  Processor selected (auto-routed or manually switched).
  Client enters payment details via processor SDK (hosted/embedded).
  [Optional: Bypass banner if PAYMENT_BYPASS_ENABLED = true]
  
Step 6e — Confirmation
  Redirect to /checkout/success?order_id={id}
  Success screen + "Publish Your Agent" CTA.
  Receipt email dispatched via Resend.
```

### 5.2 Error States

| Error | User Message | Action |
|-------|-------------|--------|
| Payment declined | "Payment was declined. Please check your card details or try another payment method." | Retry button; preserve cart |
| Processor timeout | "Payment processor is temporarily unavailable. Please try again in a moment." | Retry + fallback processor offer |
| Webhook not received within 60s | System polls Stripe/MP for status; if still pending, show "Payment pending" state | Auto-resolve when webhook arrives |
| Config validation fails | "Your agent configuration is incomplete. Please return to Step [N] to resolve the issue." | Block checkout until resolved |

---

## 6. Post-Payment: Publish Gate & Code Download

### 6.1 Publish Gate

The **Publish** button on the Agent Detail page is locked (`disabled`) until:

```
order.status = 'paid' AND order.product_id = agent.product_id
```

On publish:
1. `agent.status` → `published`
2. Immutable versioned snapshot of bot config created (`bot_config_snapshots` table).
3. Integration code package generated (see 6.2).
4. `audit_log` entry written: `{actor_id, agent_id, order_id, action: 'publish', timestamp}`.

### 6.2 Integration Code Package

On publish or manual re-download, the system generates a `.zip` containing:

| File | Contents |
|------|----------|
| `README.md` | Setup guide, environment requirements |
| `embed.html` | Chat widget `<script>` snippet with agent ID pre-filled |
| `.env.example` | Required environment variables |
| `api-config.json` | Agent endpoint, webhook URL, scoped API key |
| `webhook-guide.md` | Event schema and integration examples |

Download link provided on-screen and emailed. Agency admin can regenerate the package at any time (new scoped API key issued; old key revoked).

---

## 7. Sandbox / Test Bypass

### 7.1 Purpose

Enables agency developers and admins to test the full checkout → publish → download flow without real payment transactions. Essential for:

- QA/CI pipeline runs
- Client demo sessions (Maple & Oak Catering Co. demo profile)
- Internal sprint demos

### 7.2 Behavior

| Setting | Behavior |
|---------|----------|
| `PAYMENT_BYPASS_ENABLED=false` (default prod) | Normal payment flow; no bypass option shown |
| `PAYMENT_BYPASS_ENABLED=true` + `role=agency_admin` | Yellow "⚡ Test Mode" banner visible in checkout; "Complete Payment" bypasses processor |
| Bypass order | `order.payment_method = 'bypass'`; `order.status = 'paid'`; audit log entry with `bypass=true` |

All downstream post-payment flows (publish gate, email, code generation) fire normally in bypass mode to validate the E2E path.

Bypass orders are tagged `[TEST]` in the admin orders table and excluded from revenue reporting.

---

## 8. Billing Dashboard & Metering

### 8.1 Client Dashboard — Billing Section

| Widget | Data Source |
|--------|-------------|
| Current Plan | `orders` + `pool_packages` |
| Balance / Usage (current period) | `usage_ledger` aggregate |
| Per-Agent Consumption | `usage_ledger` grouped by `agent_id` |
| Invoices & Receipts | Stripe/MP invoice records + `orders` |
| Top-Up / Upgrade CTA | Shown when balance < alert threshold |

### 8.2 Usage Ledger

Every API call (chatbot message, voice minute, tool call) writes a record to `usage_ledger`:

```
{
  id, account_id, agent_id, order_id,
  event_type,           -- 'token_in' | 'token_out' | 'minute' | 'tool_call'
  quantity,             -- units consumed
  unit_cost_usd,
  total_cost_usd,
  created_at
}
```

Near-real-time updates (≤ 60 seconds lag). Balance computed as:

```
available = prepaid_balance - SUM(usage_ledger.total_cost_usd)
```

---

## 9. Data Model

### 9.1 Key Tables

**`orders`**
```sql
id              UUID PRIMARY KEY
account_id      UUID REFERENCES accounts(id)
product_id      TEXT                          -- e.g. 'CB-01', 'AVA-01'
agent_id        UUID REFERENCES agents(id)
billing_model   TEXT CHECK IN ('usage_prepaid','usage_postpaid','usage_payg','one_shot','pool')
plan_details    JSONB                         -- tier, cap, overage_policy, etc.
processor       TEXT CHECK IN ('stripe','mercadopago','paypal','bypass')
processor_ref   TEXT                          -- Stripe PaymentIntent ID, MP payment ID, etc.
amount_usd      NUMERIC(10,2)
currency        TEXT DEFAULT 'USD'
status          TEXT CHECK IN ('draft','pending','paid','failed','refunded')
bypass          BOOLEAN DEFAULT FALSE
created_at      TIMESTAMPTZ DEFAULT NOW()
paid_at         TIMESTAMPTZ
```

**`usage_ledger`** (as above)

**`pool_packages`**
```sql
id              UUID PRIMARY KEY
name            TEXT
tokens_pm       BIGINT
minutes_pm      INTEGER
price_monthly   NUMERIC(8,2)
price_annual    NUMERIC(8,2)
active          BOOLEAN DEFAULT TRUE
```

**`product_pricing`**
```sql
product_id      TEXT PRIMARY KEY             -- 'CB-01', 'IS-001', etc.
name            TEXT
one_shot_price  NUMERIC(8,2)
currency        TEXT DEFAULT 'USD'
active          BOOLEAN DEFAULT TRUE
```

---

## 10. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Security** | PCI DSS SAQ A scope; no card data on ROBO AI servers; credentials in Supabase Vault |
| **Availability** | Checkout flow: 99.9% uptime SLA; graceful fallback if primary processor is down |
| **Latency** | Payment page load < 2s; post-payment redirect < 3s; code download generation < 90s |
| **Idempotency** | Webhook handlers are idempotent; duplicate events do not double-charge or double-provision |
| **Audit** | All payment and publish events written to `audit_log` with actor, timestamp, and outcome |
| **Compliance** | Tax calculation per client billing country; digital services VAT where required (EU) |
| **Internationalisation** | UI in EN/ES (bilingual per ROBO AI standard); currency display in client's local currency where supported |

---

## 11. Open Questions

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| OQ-110 | MercadoPago: auto-route silently by country vs. show processor choice to client? | Kevin | Open |
| OQ-111 | Conekta (MX-specific) needed, or does MercadoPago OXXO coverage suffice for Mexico? | Kevin | Open |
| OQ-112 | Postpaid: charge payment method on file at cycle end vs. issue net-7 invoice? | Kevin | Open |
| OQ-113 | Pool packages: multi-currency (MXN/USD/EUR) or USD-only at agency billing level? | Kevin | Open |
| OQ-114 | PayPal: Braintree Drop-in UI vs. PayPal JS SDK v5? | Dev | Open |
| OQ-115 | Annual subscription discount rate for pool packages (e.g., 2 months free = ~16%)? | Kevin | Open |

---

## 12. Out of Scope (v1.0)

- Crypto payments (flagged for future consideration)
- Affiliate / referral billing
- Multi-party splits or marketplace payouts (Stripe Connect)
- In-app upgrade/downgrade mid-billing-cycle for one-shot products
- Dunning management (automatic failed-payment retry sequences) — v1.1

---

*PAY-100 PRD v1.0 — ROBO AI Agency · Kevin Bonilla · 2026-06-14*
