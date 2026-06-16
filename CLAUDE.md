# CLAUDE.md — ROBO AI Agency · form_intake workspace

This file documents the working codebase for Claude Code sessions. The canonical spec lives in `Docs/`. The actual built app lives in `robo-intake/`.

---

## Project Overview

**ROBO AI Agency** — automated pipeline from prospect intake to deployed AI agent.

| Module | Doc | Status |
|--------|-----|--------|
| BA-001 Business Intake Form | `Docs/BA-001_PDR_v1.2_Business_Intake_Form.md` | **Live (built)** |
| BA-002 Website Scraper | `Docs/BA002_PDR_v1_1_Website_Scraper_Agent.md` | **Built — integrated** |
| BA-004 Master Analyzer Agent | `Docs/BA004_PRD_v1_0_Master_Analyzer_Agent.md` | **Built — integrated** |
| WEB-007 AI Builder Platform | `WEB007_PRD_v1_0_AI_Builder_Platform.md` | **Partially built** |
| PAY-100 Payment & Checkout | `Docs/PAY-100_PRD_v1_0.md` + `Docs/PAY-100_Dev_Instructions_v1_0.md` | **Built** |

The primary working directory is `robo-intake/` — a Next.js 14 App Router project.

---

## Tech Stack (as built)

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14.2 (App Router), TypeScript |
| Hosting | Vercel (target) |
| AI | Anthropic SDK `@anthropic-ai/sdk` — `claude-sonnet-4-20250514` |
| Database | Supabase (Postgres + service-role only — no client key in browser) |
| PDF | `pdf-lib` + `@pdf-lib/fontkit` |
| Email | Resend API |
| Scraper | Playwright (headless) + Zyte API fallback |
| Styling | Tailwind CSS 3 |
| Validation | Zod v4 (`^4.4.3`) |
| Payment | Stripe v22 · MercadoPago · Braintree · `jszip` |
| Testing | Vitest |
| Analytics | Plausible (planned) |

---

## Directory Structure

```
form_intake/
├── CLAUDE.md                          ← this file
├── WEB007_PRD_v1_0_AI_Builder_Platform.md
├── Docs/                              ← all PRDs and build instructions
│   ├── CLAUDE.md                      ← older spec-only CLAUDE.md (keep for reference)
│   ├── BA-001_PDR_v1.2_...md
│   ├── BA002_PDR_v1_1_...md
│   └── ...
└── robo-intake/                       ← Next.js app (all code lives here)
    ├── src/
    │   ├── app/
    │   │   ├── analyse/               ← main intake form UI (noindex)
    │   │   │   ├── page.tsx           ← form page (uses ConversationalForm)
    │   │   │   ├── layout.tsx         ← noindex meta
    │   │   │   └── demo/page.tsx      ← scripted sandbox demo
    │   │   ├── admin/settings/        ← AI provider admin panel
    │   │   ├── admin/payment/         ← PAY-100 payment settings admin panel
    │   │   ├── builder/[agentId]/     ← WEB-007 agent builder wizard
    │   │   │   ├── step1/ … step6/
    │   │   │   └── checkout/          ← payment gate (between step5 and step6)
    │   │   ├── checkout/[agentId]/    ← PAY-100 4-step checkout flow
    │   │   │   ├── billing-model/
    │   │   │   ├── plan/
    │   │   │   ├── summary/
    │   │   │   └── payment/
    │   │   ├── checkout/success|failed|pending/
    │   │   ├── api/
    │   │   │   ├── next-question/     ← AI question selection (Anthropic call)
    │   │   │   ├── answer/            ← save an answer, get next question
    │   │   │   ├── submit-profile/    ← finalize submission, kick pipeline
    │   │   │   ├── session/           ← create/resume session
    │   │   │   ├── pipeline-status/   ← poll scrape → analyze → pdf progress
    │   │   │   ├── download/json/     ← download submission JSON
    │   │   │   ├── download/pdf/      ← download generated PDF
    │   │   │   ├── gdpr-erase/        ← GDPR erasure endpoint
    │   │   │   ├── agents/[agentId]/  ← WEB-007 agent CRUD + KB + chat + export
    │   │   │   ├── builder/start/     ← start builder from profile
    │   │   │   ├── admin/ai-settings/ ← admin AI config
    │   │   │   ├── admin/payment-settings/ ← PAY-100 payment config (ADMIN_TOKEN required)
    │   │   │   ├── checkout/create-order|stripe-session|mp-preference|braintree-*|bypass|order-status/
    │   │   │   ├── webhooks/stripe|mercadopago/
    │   │   │   └── publish/[agentId]/ ← publish gate + zip generation
    │   │   └── page.tsx               ← landing / redirect
    │   ├── components/
    │   │   ├── form/                  ← ConversationalForm, ChipSelect, FreeTextInput, etc.
    │   │   └── holding/PipelineStatus.tsx
    │   └── lib/
    │       ├── questions.ts           ← QUESTION_BANK (Q-01 to Q-12, bilingual)
    │       ├── validations.ts         ← Zod schemas for all API routes
    │       ├── payment/               ← PAY-100: keys, billing-models, processor-router, schemas, bypass, order-actions
    │       ├── metering/record.ts     ← recordUsage, getRemainingBalance
    │       ├── publish/               ← gate.ts (canPublish), package.ts (zip generator)
    │       ├── email/receipt.ts       ← Resend receipt (graceful if RESEND_API_KEY unset)
    │       ├── supabase/admin.ts      ← supabaseAdmin singleton — payment/publish routes use THIS, not supabaseClient.ts
    │       ├── server/
    │       │   ├── store.ts           ← in-memory session store (globalThis.__roboStore)
    │       │   ├── questionEngine.ts  ← AI-powered next-question selector
    │       │   ├── masterAnalyzer.ts  ← BA-004 full diagnosis report (Anthropic)
    │       │   ├── scraper.ts         ← BA-002 website scraper (Playwright + Zyte)
    │       │   ├── supabaseClient.ts  ← scraper-only Supabase client (do NOT use in payment code)
    │       │   ├── builderStore.ts    ← WEB-007 in-memory agent/KB store
    │       │   ├── llmClient.ts       ← shared Anthropic client wrapper
    │       │   ├── adminSettings.ts   ← encrypted AI settings (.data/admin_settings.enc, magic ROBO1)
    │       │   ├── paymentSettings.ts ← encrypted payment config (.data/payment_settings.enc, magic RPAY1)
    │       │   ├── adminAuth.ts       ← ADMIN_TOKEN bearer auth
    │       │   └── logging.ts         ← JSONL append logger → .data/*.log
    │       └── pdf/generator.ts       ← pdf-lib PDF generator
    ├── scripts/
    │   ├── run_url_only_flow.py       ← CLI: scrape a URL, run analyzer, output JSON
    │   └── test_scrape.mjs            ← quick scraper smoke test
    └── .data/                         ← runtime data (gitignored)
        ├── analysis.log               ← JSONL pipeline events
        ├── scraper.log                ← JSONL scrape events
        ├── admin_settings.enc         ← encrypted AI/scraper settings (magic: ROBO1)
        └── payment_settings.enc       ← encrypted PAY-100 settings (magic: RPAY1)
```

---

## Pipeline Architecture

```
User fills /analyse form (ConversationalForm)
    → POST /api/session          (create/resume — returns profile_id)
    → POST /api/next-question    (AI selects next Q from bank)
    → POST /api/answer           (saves answer; triggers scrape on website_url)
    → POST /api/submit-profile   (finalises submission)
         → store.startPipeline()
              1. scrapeWebsite()        → BA-002 (Playwright / Zyte)
              2. generateFullReport()   → BA-004 Master Analyzer (Anthropic)
              3. generateIntakePdf()    → pdf-lib PDF
    → GET  /api/pipeline-status  (poll: submitted/scraped/analyzed/pdf_ready)
    → GET  /api/download/pdf     (stream PDF bytes)
    → GET  /api/download/json    (stream submission JSON)
```

### Key Architectural Rules

- **All DB writes are server-side only.** `SUPABASE_SERVICE_ROLE_KEY` never reaches the browser. Supabase is written to via `supabaseClient.ts` (server module only).
- **Session state:** In-memory `globalThis.__roboStore` (Map) + `localStorage` on client. Sessions expire after 72 h. `SUPABASE_URL` is optional — if unset, Supabase writes are silently skipped (local dev works without DB).
- **AI form engine:** `questionEngine.ts` calls Anthropic API to pick the next question from `QUESTION_BANK`. Returns the question object; never repeats answered questions.
- **Master Analyzer:** Single Anthropic call in `masterAnalyzer.ts`. Returns only valid JSON. Fires after scrape completes (or immediately if no URL). Hard timeout 45 s.
- **Scraper:** `scraper.ts` uses Playwright for JS-rendered pages, falls back to `ZYTE_API_KEY` if set. Configurable via env vars (`SCRAPE_TIMEOUT_MS`, `SCRAPER_MAX_PAGES`, etc.).
- **Website scrape starts early:** When the user answers Q-12 (`website_url`), `store.saveAnswer()` immediately fires `startWebsiteScrape()` in the background — so it's often done before submission.

---

## API Routes Reference

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/session` | Create or resume a session |
| POST | `/api/next-question` | AI picks next question |
| POST | `/api/answer` | Save answer, return next question |
| POST | `/api/submit-profile` | Finalise, kick pipeline |
| GET | `/api/pipeline-status?profile_id=` | Poll pipeline stages |
| GET | `/api/download/json?profile_id=` | Download submission JSON |
| GET | `/api/download/pdf?profile_id=` | Stream PDF |
| POST | `/api/gdpr-erase` | Erase all profile data |
| GET/PUT | `/api/admin/ai-settings` | Read/write AI config (ADMIN_TOKEN required) |
| GET/PUT | `/api/admin/payment-settings` | Read/write PAY-100 config (ADMIN_TOKEN required) |
| POST | `/api/builder/start` | Start WEB-007 builder from profile |
| GET/PUT/DELETE | `/api/agents/[agentId]` | Agent CRUD |
| POST | `/api/agents/[agentId]/chat` | Live test agent chat |
| POST | `/api/agents/[agentId]/kb/text` | Add KB text source |
| POST | `/api/agents/[agentId]/kb/upload` | Upload KB file |
| GET | `/api/agents/[agentId]/kb/sources` | List KB sources |
| POST | `/api/agents/[agentId]/publish` | Publish agent (WEB-007 builder export) |
| GET | `/api/agents/[agentId]/export/[format]` | Export (mcp/api/widget/code) |
| GET | `/api/checkout/order-status?agentId=` | Check if agent has a paid order |
| POST | `/api/checkout/create-order` | Create draft order, auto-route processor |
| POST | `/api/checkout/stripe-session` | Stripe Checkout hosted session |
| POST | `/api/checkout/mp-preference` | MercadoPago Checkout Pro preference |
| GET | `/api/checkout/braintree-token` | Braintree client token |
| POST | `/api/checkout/braintree-sale` | Submit Braintree transaction |
| POST | `/api/checkout/bypass` | Bypass payment — admin only (ADMIN_TOKEN + bypass enabled) |
| POST | `/api/webhooks/stripe` | Stripe signed webhook receiver |
| POST | `/api/webhooks/mercadopago` | MercadoPago webhook receiver |
| POST | `/api/publish/[agentId]` | PAY-100 publish gate + zip generation (requires paid order) |

---

## Output JSON Schema (`CanonicalSubmissionJson`)

```ts
{
  profile_id: string;            // UUID v4
  created_at: string;            // ISO-8601
  language: "en" | "es";
  source_product_id: string | null;
  answers_raw: Record<string, unknown>;
  questionnaire: Array<{ layer, question_id, field, question, answer }>;
  website_scrape: ScrapeResult | null;
  full_report: FullReport | null;
  business: { industry, team_size, revenue_range, website_url };
  operations: { core_ops };
  pain_points: { top_time_cost, bottleneck, data_situation, decision_speed, risk_areas[], prior_ai_experience };
  goals: { success_definition, urgency_flag };
  tools: { existing_tools[] };
  budget: { budget_comfort };
  contact: { email, first_name, consent_marketing } | null;
}
```

---

## Question Bank (Q-01 to Q-12)

| Q# | Field | Input Type |
|----|-------|------------|
| Q-01 | `industry` | chip-single |
| Q-02 | `team_size` | chip-single |
| Q-03 | `revenue_range` | chip-single |
| Q-04 | `top_time_cost` | free-text |
| Q-05 | `existing_tools` | chip-multi |
| Q-06 | `bottleneck` | free-text |
| Q-07 | `budget_comfort` | chip-single |
| Q-08 | `success_definition` | free-text |
| Q-09 | `data_situation` | free-text |
| Q-10 | `urgency_flag` | free-text |
| Q-11 | `prior_ai_experience` | chip-single |
| Q-12 | `website_url` | free-text |

AI selects the order dynamically; minimum viable profile = 8 answers.

---

## Database Schema (3 Tables — Supabase)

- **`profiles`** — one row per session. `session_status`: `in_progress → submitted → expired`. `contact_email` encrypted AES-256 via pgcrypto. `raw_answers_json` purged after 30 days.
- **`scrape_results`** — FK to `profiles.profile_id`. `scrape_status`: `success | failed | blocked | timeout`.
- **`diagnoses`** — FK to `profiles.profile_id`. Contains `qa_pairs`, `matched_products`, `inefficiency_score` (0–100), financial estimates, `pdf_report_url`.

> Note: Supabase is currently used only for `scrape_results` persistence (`supabaseClient.ts`). The in-memory store is the primary runtime store. Full Supabase integration (profiles, diagnoses) is spec'd but not yet fully wired.

---

## Environment Variables

See `robo-intake/.env.example` for the full list. Key variables:

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes (AI features) | Anthropic API — question engine + analyzer |
| `SUPABASE_URL` | Optional | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase admin key (server-only) |
| `RESEND_API_KEY` | Optional | Email delivery |
| `RESEND_FROM_EMAIL` | Optional | Sender for receipts (default: `receipts@roboai.agency`) |
| `ZYTE_API_KEY` | Optional | Scraper fallback for blocked sites |
| `ADMIN_TOKEN` | Yes (admin) | Bearer token for `/api/admin/*` |
| `SETTINGS_ENCRYPTION_KEY` | Yes (admin) | AES key for both `admin_settings.enc` and `payment_settings.enc` |
| `CALENDAR_BOOKING_URL` | Optional | Injected into PDF footer |
| `SCRAPE_TIMEOUT_MS` | Optional | Default 25000 |
| `SCRAPER_MAX_PAGES` | Optional | Default 6 |
| `STRIPE_SECRET_KEY` / `STRIPE_SECRET_KEY_TEST` | PAY-100 | Stripe processor (test key used when `NODE_ENV !== production`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `_TEST` | PAY-100 | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` / `_TEST` | PAY-100 | Stripe webhook signature verification |
| `MP_ACCESS_TOKEN` / `MP_ACCESS_TOKEN_TEST` | PAY-100 | MercadoPago processor |
| `BRAINTREE_ENVIRONMENT` | PAY-100 | `'production'` or `'sandbox'` |
| `BRAINTREE_MERCHANT_ID` / `_TEST` | PAY-100 | Braintree credentials |
| `PAYMENT_BYPASS_ENABLED` | PAY-100 | `'true'` enables test bypass; never `true` in production |

---

## Dev Commands

All run from `robo-intake/`:

```bash
npm run dev        # start dev server on :3000
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest run
```

---

## Brand & UI

- Background: navy `#0D1B2A`
- Accent: teal `#0EA5A0`
- Fonts: Syne (headings) + DM Sans (body) via Google Fonts
- Input types: single-select chips (auto-advance), multi-select chips (continue button), free-text textarea (Enter to submit)
- `/analyse` route is `noindex`

---

## Security Constraints

- Anthropic API key: server-side only — never in client bundle. Verify via browser network tab (T-19).
- Supabase: service role key server-only. RLS blocks direct client access (must return 401, T-18).
- GDPR: CASCADE delete across all three tables + remove PDF from storage within 48 h on erasure request (`/api/gdpr-erase`).
- PDF: unique read-only password per client; password sent separately from download link.
- Admin routes: protected by `ADMIN_TOKEN` bearer auth via `adminAuth.ts`.

---

## Performance SLAs

| Metric | Target |
|--------|--------|
| First question render | < 800 ms on 4G |
| AI question latency (p95) | < 2,500 ms |
| Master Analyzer completion | < 45 s |
| Full pipeline (form → PDF ready) | < 30 minutes |
| Confirmation email | < 60 s after submit |

---

## Open Decisions (check before implementing)

| # | Question | Owner |
|---|----------|-------|
| OQ-01 | Session store: localStorage only vs Supabase cross-device resume? | Gerardo |
| OQ-03 | Fallback if Anthropic API is down: static Q bank vs error + retry? | Gerardo |
| OQ-04 | GDPR consent: pre-form gate vs inline at submission? | Gerardo |
| OQ-06 | PDF renderer: currently `pdf-lib` (JS) — confirmed over ReportLab? | Dev |
| OQ-07 | PDF storage: currently in-memory — persist to Supabase Storage vs S3? | Gerardo |
| OQ-08 | PDF delivery: currently direct download — add email with signed link? | Gerardo |
| OQ-11 | Sandbox: `/analyse/demo` route exists — promote to permanent demo URL? | Gerardo |

---

## WEB-007 Builder Status (Sprint 4)

The agent builder wizard is at `builder/[agentId]/step1–6/` plus a payment gate at `builder/[agentId]/checkout/`. The in-memory `builderStore.ts` manages draft agents and their knowledge bases. Builder starts from a completed intake profile (`/api/builder/start`). Export formats (MCP, API, Widget, Raw Code) are wired at `/api/agents/[agentId]/export/[format]`.

**Builder flow (effective 7 steps):**
```
step1 (template) → step2 → step3 → step4 → step5 (test harness)
  → builder/[agentId]/checkout  (PAY-100 payment gate)
       ├── already paid → auto-redirect to step6
       └── not paid → billing-model picker → /checkout/[agentId]/... → step6
  → step6 (export / publish)
```

**Note:** Step 5 "Continue" goes to `/builder/${agentId}/checkout`, NOT `step6`. Do not revert this routing.

---

## Gotchas & Version Notes

- **Zod v4** (`^4.4.3`): `z.record()` requires **two** args — `z.record(z.string(), z.unknown())`, not `z.record(z.unknown())`.
- **Stripe v22** API version string is `"2026-05-27.dahlia"` (not the old date-only format). Check with `node -e "const s=require('stripe');console.log(s.API_VERSION)"`.
- **Next.js App Router**: `export const config = {api:{bodyParser:false}}` is deprecated and **causes a build error**. Use `export const dynamic = "force-dynamic"` instead.
- **`useSearchParams()`** must be wrapped in `<Suspense>` in any page that can be statically rendered, or the build fails at the prerender step.
- **`??` + `||` mixing** is rejected by TypeScript strict mode — write `a ?? (b || null)` not `a ?? b || null`.
- **Two Supabase clients exist**: `lib/supabase/admin.ts` (singleton, used by payment/publish/metering) and `lib/server/supabaseClient.ts` (scraper only). Do not mix them.
- **Payment bypass** requires both: `ADMIN_TOKEN` header in the request AND bypass enabled in payment settings. It also requires Supabase to create a draft order before calling bypass.
- **`step5/page.tsx` and `builderStore.ts`** had pre-existing type errors; they were fixed in this session but watch for regressions.
- **`PlanSettings` fallback in `plan/page.tsx`**: the `.catch()` fallback must include all required fields (`autoTopUpIncrement`, `annualDiscountPct`) — omitting them causes a type error.
- **Supabase is optional for intake/scraper** (`SUPABASE_URL` unset → silently skipped). However, **PAY-100 routes require Supabase** — `requireSupabaseAdmin()` throws if not configured.

---

*Author: Kevin Bonilla · CISA · ROBO AI Agency*
*Last updated: June 2026*
