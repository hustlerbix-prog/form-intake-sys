# BA-004 — Master Analyzer Agent Build Instructions
**ROBO AI Agency · Business Analyser Bundle · v1.0**
> Standalone Node.js/TypeScript service. Execute these instructions top-to-bottom to build and deploy. Do not skip sections.

---

## 0. What This Service Does

BA-004 is the intelligence core of the ROBO AI Agency pipeline. Triggered by n8n after BA-002 completes, it receives a merged payload containing the BA-001 business profile and BA-002 scraped website data. It executes a **4-pass Claude chain-of-thought analysis**, validates the output against a Zod schema, writes a full diagnosis to Supabase `ba_analyses`, and fires the BA-003 Proposal Generator webhook.

**Pipeline position:** BA-001 → BA-002 → **BA-004** → BA-003

```
n8n  ──POST /analyze──▶  BA-004 Express Server (Hetzner)
                               │
                               ├─ PII Strip (remove email, name from Claude payload)
                               │
                               ├─ Pass 1 — Business Context Synthesis (Claude)
                               ├─ Pass 2 — Gap & Pain Analysis (Claude)
                               ├─ Pass 3 — Automation Readiness Scoring (Claude)
                               ├─ Pass 4 — Product Matching & Roadmap (Claude)
                               │
                               ├─ Zod schema validation
                               │
                               ├─ Supabase (service role)
                               │     └─ INSERT ba_analyses row
                               │     └─ INSERT ba_pipeline_log row
                               │
                               └─ POST BA-003 webhook (async)
```

**This is NOT a serverless function.** The 4-pass analysis runs 45–90 seconds. Deploy as a Docker container on Hetzner VPS, the same server as BA-002 (add a second service to the docker-compose).

---

## 1. Open Decisions — Defaults Applied

| # | Question | Default Used |
|---|----------|--------------|
| OQ-01 | Product catalogue versioning | Hardcoded in `src/catalogue.ts`. Update the file and redeploy when pricing changes. |
| OQ-03 | Human escalation routing | Resend email alert to `OWNER_ALERT_EMAIL`. Owner confirms Slack/Trello routing later. |
| OQ-06 | Catalogue matching strategy | Hardcoded rule-based matching (§6.2 of PRD). pgvector semantic matching is Phase 2. |

---

## 2. Project Scaffold

### 2.1 Create Project

```bash
mkdir ba-004-analyzer && cd ba-004-analyzer
npm init -y
npm install typescript ts-node @types/node --save-dev
npx tsc --init
```

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 2.2 Install Dependencies

```bash
# Server
npm install express
npm install @types/express --save-dev

# AI
npm install @anthropic-ai/sdk

# Database
npm install @supabase/supabase-js

# Validation
npm install zod

# Utilities
npm install uuid dotenv
npm install @types/uuid --save-dev
```

### 2.3 Environment Variables

Create `.env`:

```bash
# Server
PORT=3002
ANALYZER_SECRET=your_shared_secret_matching_n8n

# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your_key_here

# BA-003 downstream webhook
BA003_WEBHOOK_URL=https://your-ba003-endpoint/propose
BA003_WEBHOOK_SECRET=your_ba003_shared_secret

# Owner alert (Resend)
OWNER_ALERT_EMAIL=gerardo@roboai.agency
RESEND_API_KEY=re_your_key_here
RESEND_FROM_EMAIL=alerts@roboai.agency

# Timeouts (ms)
PASS_TIMEOUT_MS=45000
TOTAL_TIMEOUT_MS=120000

# App URL (for self-referential log links)
APP_URL=https://analyzer.roboai.agency
```

### 2.4 File Structure

```
ba-004-analyzer/
├── src/
│   ├── server.ts           ← Express app + /analyze endpoint + /health
│   ├── types.ts            ← Shared TypeScript types + enums
│   ├── catalogue.ts        ← ROBO AI product catalogue (hardcoded)
│   ├── pii.ts              ← Strip PII before sending to Claude (NFR-07)
│   ├── analyzer.ts         ← Orchestrates the 4-pass Claude chain
│   ├── passes/
│   │   ├── pass1-context.ts    ← Business Context Synthesis
│   │   ├── pass2-gaps.ts       ← Gap & Pain Analysis
│   │   ├── pass3-readiness.ts  ← Automation Readiness Scoring
│   │   └── pass4-products.ts   ← Product Matching & Roadmap
│   ├── schema-validator.ts ← Zod schema validation of final output
│   ├── db.ts               ← Supabase client + write ba_analyses
│   ├── notifier.ts         ← POST to BA-003 webhook
│   └── alert.ts            ← Owner alert via Resend on failures
├── .env
├── .dockerignore
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 3. Database — New Tables

Run in Supabase SQL editor:

```sql
-- ─────────────────────────────────────────────────────────────
-- TABLE: ba_analyses
-- Written by BA-004. One row per profile_id after analysis.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.ba_analyses (
  analysis_id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id                    uuid NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  analyzer_model                varchar(60) NOT NULL,
  data_source                   varchar(20) NOT NULL CHECK (data_source IN ('full', 'intake_only')),
  language                      varchar(5) NOT NULL DEFAULT 'en',

  -- Pass 1 output
  business_summary              text NOT NULL,

  -- Pass 2 output
  operational_gaps              jsonb NOT NULL,   -- object[]
  pain_priority_rank            text[] NOT NULL,  -- ordered gap_ids

  -- Pass 3 output
  automation_readiness_score    integer NOT NULL CHECK (automation_readiness_score BETWEEN 0 AND 100),
  readiness_dimension_breakdown jsonb NOT NULL,   -- { data, tools, budget, authority, urgency }

  -- Pass 4 output
  recommended_products          jsonb NOT NULL,   -- object[]
  implementation_roadmap        jsonb NOT NULL,   -- object[]
  estimated_monthly_value_usd   integer NOT NULL,

  -- Metadata
  confidence_score              integer NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  human_escalation_flag         boolean NOT NULL DEFAULT false,
  reasoning_trace               text,             -- internal QA only, not shown to client
  full_diagnosis_json           jsonb NOT NULL,   -- complete output snapshot

  -- Downstream
  ba003_notified_at             timestamptz,
  ba003_notification_status     varchar(20) CHECK (ba003_notification_status IN ('sent', 'failed', 'skipped'))
);

-- ─────────────────────────────────────────────────────────────
-- TABLE: ba_pipeline_log
-- One row per analysis run. Captures timing for SLA monitoring.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.ba_pipeline_log (
  log_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          uuid NOT NULL,
  session_id          varchar(255),
  triggered_at        timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  duration_ms         integer,
  pass1_ms            integer,
  pass2_ms            integer,
  pass3_ms            integer,
  pass4_ms            integer,
  data_source         varchar(20),
  confidence_score    integer,
  escalation_flag     boolean,
  analyzer_model      varchar(60),
  status              varchar(20) NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'complete', 'failed', 'escalated')),
  error_detail        text
);

-- ─────────────────────────────────────────────────────────────
-- TABLE: ba_analysis_log
-- Receipt log. Written immediately on webhook arrival.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.ba_analysis_log (
  receipt_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at         timestamptz NOT NULL DEFAULT now(),
  profile_id          uuid,
  data_source         varchar(20),
  scrape_status       varchar(20),
  ip_address          varchar(45)
);

-- ─────────────────────────────────────────────────────────────
-- RLS: deny all direct client access
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.ba_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ba_pipeline_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ba_analysis_log ENABLE ROW LEVEL SECURITY;
-- No policies = deny all. Service role bypasses RLS.

-- ─────────────────────────────────────────────────────────────
-- INDEX: common query patterns
-- ─────────────────────────────────────────────────────────────
CREATE INDEX ba_analyses_profile_id_idx ON public.ba_analyses(profile_id);
CREATE INDEX ba_pipeline_log_profile_id_idx ON public.ba_pipeline_log(profile_id);
CREATE INDEX ba_pipeline_log_triggered_at_idx ON public.ba_pipeline_log(triggered_at DESC);

-- ─────────────────────────────────────────────────────────────
-- PURGE: reasoning_trace after 90 days (NFR-11)
-- ─────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'purge-reasoning-trace',
  '0 3 * * *',
  $$
    UPDATE public.ba_analyses
    SET reasoning_trace = NULL
    WHERE created_at < now() - INTERVAL '90 days'
      AND reasoning_trace IS NOT NULL;
  $$
);
```

---

## 4. Types (`src/types.ts`)

```typescript
// ── Input types ─────────────────────────────────────────────────────────────

export interface BA001Profile {
  profile_id: string
  language: 'en' | 'es'
  industry: string | null
  team_size: string | null
  revenue_range: string | null
  top_time_cost: string | null
  existing_tools: string[] | null
  bottleneck: string | null
  budget_comfort: string | null
  success_definition: string | null
  data_situation: string | null
  urgency_flag: string | null
  prior_ai_experience: boolean | null
  website_url: string | null
  questions_answered: number
  // PII fields stripped before Claude calls
  contact_email?: string
  contact_first_name?: string
}

export interface BA002ScrapedData {
  domain: string | null
  page_titles: string[] | null
  body_text_summary: string | null
  detected_tools: string[] | null
  social_signals: Record<string, unknown> | null
  scrape_status: 'success' | 'partial' | 'failed' | 'blocked' | 'timeout'
  scrape_timestamp: string | null
  content_summary?: string | null
  tech_stack_detected?: string[] | null
}

export interface AnalyzeWebhookBody {
  profile: BA001Profile
  scraped_data: BA002ScrapedData | null
  secret: string
}

// ── Pass output types ────────────────────────────────────────────────────────

export interface Pass1Output {
  business_summary: string
}

export interface OperationalGap {
  gap_id: string
  description: string
  severity_score: number
  evidence_source: 'form' | 'scrape' | 'both' | 'inferred'
}

export interface Pass2Output {
  operational_gaps: OperationalGap[]
  pain_priority_rank: string[]
}

export interface ReadinessDimensions {
  data_availability: number
  tool_maturity: number
  budget_comfort: number
  decision_authority: number
  urgency: number
}

export interface Pass3Output {
  automation_readiness_score: number
  readiness_dimension_breakdown: ReadinessDimensions
  readiness_reasoning: string
}

export interface RecommendedProduct {
  product_id: string
  product_name: string
  tier: 'primary' | 'upsell'
  monthly_price_usd: number | null
  one_time_price_usd: number | null
  rationale: string
  value_driver: string
  priority_rank: number
}

export interface RoadmapPhase {
  phase: number
  title: string
  duration_weeks: number
  products: string[]
  description: string
  cumulative_monthly_value_usd: number
}

export interface Pass4Output {
  recommended_products: RecommendedProduct[]
  implementation_roadmap: RoadmapPhase[]
  estimated_monthly_value_usd: number
  value_reasoning: string
}

// ── Final diagnosis ──────────────────────────────────────────────────────────

export interface DiagnosisOutput {
  business_summary: string
  operational_gaps: OperationalGap[]
  pain_priority_rank: string[]
  automation_readiness_score: number
  readiness_dimension_breakdown: ReadinessDimensions
  recommended_products: RecommendedProduct[]
  implementation_roadmap: RoadmapPhase[]
  estimated_monthly_value_usd: number
  confidence_score: number
  data_source: 'full' | 'intake_only'
  reasoning_trace: string
  human_escalation_flag: boolean
  language: 'en' | 'es'
}

// ── Product catalogue ────────────────────────────────────────────────────────

export interface Product {
  id: string
  name: string
  description: string
  monthly_price_usd: number | null
  one_time_price_usd: number | null
  best_fit: string[]
}
```

---

## 5. Product Catalogue (`src/catalogue.ts`)

```typescript
import { Product } from './types'

// Hardcoded v1.0 catalogue — update here + redeploy when prices change (OQ-01)
export const PRODUCT_CATALOGUE: Product[] = [
  {
    id: 'CB-01',
    name: 'AI Chatbot',
    description: 'Customer-facing conversational agent with knowledge base for lead capture, FAQ automation, and customer support.',
    monthly_price_usd: 499,
    one_time_price_usd: null,
    best_fit: ['lead_capture', 'customer_support', 'faq_automation', 'retail', 'hospitality', 'healthcare'],
  },
  {
    id: 'CA-01',
    name: 'Company Analyzer',
    description: 'Internal business intelligence agent fed by a knowledge base and RAG for ops analysis, reporting, and decision support.',
    monthly_price_usd: 499,
    one_time_price_usd: null,
    best_fit: ['internal_ops', 'reporting', 'decision_support', 'manual_data_entry', 'finance', 'professional'],
  },
  {
    id: 'AVA-01',
    name: 'AI Voice Assistant',
    description: 'Programmable voice agent with RAG/pgvector knowledge base for phone support, appointment booking, and order status.',
    monthly_price_usd: 899,
    one_time_price_usd: null,
    best_fit: ['phone_support', 'appointment_booking', 'order_status', 'logistics', 'healthcare', 'hospitality'],
  },
  {
    id: 'IS-01',
    name: 'AI Onboarding Sprint',
    description: '5-day build and deploy of a core AI product — the fastest path to live.',
    monthly_price_usd: null,
    one_time_price_usd: 2500,
    best_fit: ['first_deployment', 'all'],
  },
  {
    id: 'IS-02',
    name: 'Integration Sprint',
    description: 'Connect an AI product to the existing stack: CRM, ERP, helpdesk.',
    monthly_price_usd: null,
    one_time_price_usd: 1800,
    best_fit: ['post_launch', 'crm_integration', 'erp_integration'],
  },
  {
    id: 'IS-03',
    name: 'Data Pipeline Build',
    description: 'Structured data ingestion from manual or legacy sources into AI-consumable format.',
    monthly_price_usd: null,
    one_time_price_usd: 2200,
    best_fit: ['unstructured_data', 'manual_data_entry', 'legacy_systems', 'reporting'],
  },
  {
    id: 'IS-04',
    name: 'Voice Channel Deploy',
    description: 'AVA-01 configured for phone/IVR deployment.',
    monthly_price_usd: null,
    one_time_price_usd: 2800,
    best_fit: ['phone_heavy', 'call_center', 'logistics', 'healthcare'],
  },
  {
    id: 'IS-05',
    name: 'Custom Agent Build',
    description: 'Bespoke AI agent beyond the standard catalogue for unique use cases.',
    monthly_price_usd: null,
    one_time_price_usd: 3500,
    best_fit: ['unique_use_case', 'custom'],
  },
  {
    id: 'CS-01',
    name: 'AI Readiness Audit',
    description: '2-hour structured assessment and written report. Best first step for clients with low clarity.',
    monthly_price_usd: null,
    one_time_price_usd: 750,
    best_fit: ['low_readiness', 'unclear_starting_point', 'no_ai_experience'],
  },
  {
    id: 'CS-02',
    name: 'Strategy Workshop',
    description: 'Half-day AI roadmap session for leadership buy-in.',
    monthly_price_usd: null,
    one_time_price_usd: 1200,
    best_fit: ['committee_decision', 'leadership_alignment', 'roadmap_needed'],
  },
  {
    id: 'CS-03',
    name: 'Compliance Review',
    description: 'CISA-led GRC review of AI deployment for regulated industries.',
    monthly_price_usd: null,
    one_time_price_usd: 1500,
    best_fit: ['finance', 'healthcare', 'legal', 'regulated_industry'],
  },
  {
    id: 'CS-04',
    name: 'Change Management Coaching',
    description: '3-session team adoption programme to overcome resistance.',
    monthly_price_usd: null,
    one_time_price_usd: 900,
    best_fit: ['team_resistance', 'adoption_barrier'],
  },
  {
    id: 'MS-01',
    name: 'Core Retainer',
    description: 'Monthly managed support for 1 AI product.',
    monthly_price_usd: 399,
    one_time_price_usd: null,
    best_fit: ['post_deployment_maintenance', 'small_budget'],
  },
  {
    id: 'MS-02',
    name: 'Growth Retainer',
    description: 'Monthly support + optimisation + reporting for scale-up clients.',
    monthly_price_usd: 699,
    one_time_price_usd: null,
    best_fit: ['scale_up', 'growth_phase', 'medium_budget'],
  },
  {
    id: 'MS-03',
    name: 'Enterprise Retainer',
    description: 'Full-stack managed service with SLA for high-complexity accounts.',
    monthly_price_usd: 1499,
    one_time_price_usd: null,
    best_fit: ['high_complexity', 'enterprise', 'large_budget'],
  },
  {
    id: 'AO-01',
    name: 'Bilingual Add-on',
    description: 'EN/ES language layer on any product for LatAm and bilingual markets.',
    monthly_price_usd: 199,
    one_time_price_usd: null,
    best_fit: ['latam_market', 'bilingual_ops', 'spanish_language'],
  },
  {
    id: 'AO-02',
    name: 'Analytics Dashboard',
    description: 'Usage and performance dashboard for any deployed AI product.',
    monthly_price_usd: 149,
    one_time_price_usd: null,
    best_fit: ['reporting_focused', 'metrics_driven'],
  },
  {
    id: 'AO-03',
    name: 'Priority Support',
    description: '4-hour SLA response with dedicated channel for time-sensitive businesses.',
    monthly_price_usd: 249,
    one_time_price_usd: null,
    best_fit: ['high_urgency', 'time_sensitive', 'revenue_critical'],
  },
]

// Lookup helper
export function getProduct(id: string): Product | undefined {
  return PRODUCT_CATALOGUE.find(p => p.id === id)
}

// Validate that all product IDs in a list exist in the catalogue
export function validateProductIds(ids: string[]): string[] {
  const valid = new Set(PRODUCT_CATALOGUE.map(p => p.id))
  return ids.filter(id => !valid.has(id))
}
```

---

## 6. PII Stripper (`src/pii.ts`)

Implements NFR-07: no `client_email`, business name, or personal identifiers sent to Claude.

```typescript
import { BA001Profile } from './types'

export interface SanitisedProfile {
  language: 'en' | 'es'
  industry: string | null
  team_size: string | null
  revenue_range: string | null
  top_time_cost: string | null
  existing_tools: string[] | null
  bottleneck: string | null
  budget_comfort: string | null
  success_definition: string | null
  data_situation: string | null
  urgency_flag: string | null
  prior_ai_experience: boolean | null
  website_domain: string | null   // domain only, not full URL with paths
  questions_answered: number
}

export function sanitiseProfile(profile: BA001Profile): SanitisedProfile {
  let domain: string | null = null
  if (profile.website_url) {
    try {
      domain = new URL(profile.website_url).hostname.replace(/^www\./, '')
    } catch {
      domain = null
    }
  }

  return {
    language: profile.language,
    industry: profile.industry,
    team_size: profile.team_size,
    revenue_range: profile.revenue_range,
    top_time_cost: profile.top_time_cost,
    existing_tools: profile.existing_tools,
    bottleneck: profile.bottleneck,
    budget_comfort: profile.budget_comfort,
    success_definition: profile.success_definition,
    data_situation: profile.data_situation,
    urgency_flag: profile.urgency_flag,
    prior_ai_experience: profile.prior_ai_experience,
    website_domain: domain,
    questions_answered: profile.questions_answered,
  }
}

// Sanitise scrape data — remove any embedded emails or personal names
export function sanitiseScrapedData(scraped: Record<string, unknown>): Record<string, unknown> {
  const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const clean = JSON.parse(JSON.stringify(scraped))

  // Walk top-level string fields and redact emails
  for (const key of Object.keys(clean)) {
    if (typeof clean[key] === 'string') {
      clean[key] = (clean[key] as string).replace(EMAIL_REGEX, '[email redacted]')
    }
  }
  // Exclude raw_html_snapshot — never send to Claude
  delete clean.raw_html_snapshot

  return clean
}
```

---

## 7. Pass 1 — Business Context Synthesis (`src/passes/pass1-context.ts`)

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { SanitisedProfile, Pass1Output } from '../types'
import { BA002ScrapedData } from '../types'

const TIMEOUT_MS = parseInt(process.env.PASS_TIMEOUT_MS ?? '45000', 10)

function buildSystemPrompt(language: 'en' | 'es'): string {
  const langInstruction = language === 'es'
    ? 'Respond ENTIRELY in Latin American Spanish (es-MX). All fields including business_summary must be in Spanish.'
    : 'Respond in English.'

  return `You are the ROBO AI Agency Master Analyzer Agent — a senior AI automation consultant with 12+ years of GRC and operational experience. ${langInstruction}

PASS 1 — BUSINESS CONTEXT SYNTHESIS

Read the business profile (from the intake form) and the scraped website data. Produce a 200-word plain-language business summary that identifies:
- The core value chain (what they sell and to whom)
- Primary revenue driver
- Operational model (how work gets done day-to-day)
- Key constraints visible from the data

Analytical tone only. No marketing language. No padding.

Return ONLY valid JSON matching this schema. No preamble. No markdown fences.
{
  "business_summary": "string — exactly 150-220 words, analytical tone"
}`
}

export async function runPass1(
  client: Anthropic,
  profile: SanitisedProfile,
  scraped: Record<string, unknown> | null
): Promise<Pass1Output> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  const userMessage = `BUSINESS PROFILE (from intake form):
${JSON.stringify(profile, null, 2)}

WEBSITE DATA (from scraper):
${scraped ? JSON.stringify(scraped, null, 2) : 'NOT AVAILABLE — website was not scraped or scrape failed.'}`

  try {
    const response = await client.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: 0.5,
        system: buildSystemPrompt(profile.language),
        messages: [{ role: 'user', content: userMessage }],
      },
      { signal: controller.signal }
    )
    clearTimeout(timer)
    const text = (response.content[0] as { text: string }).text
    return JSON.parse(text) as Pass1Output
  } catch (err) {
    clearTimeout(timer)
    throw new Error(`Pass 1 failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}
```

---

## 8. Pass 2 — Gap & Pain Analysis (`src/passes/pass2-gaps.ts`)

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { SanitisedProfile, Pass1Output, Pass2Output } from '../types'

const TIMEOUT_MS = parseInt(process.env.PASS_TIMEOUT_MS ?? '45000', 10)

function buildSystemPrompt(language: 'en' | 'es'): string {
  const langInstruction = language === 'es'
    ? 'Respond ENTIRELY in Latin American Spanish (es-MX). All string fields must be in Spanish.'
    : 'Respond in English.'

  return `You are the ROBO AI Agency Master Analyzer Agent. ${langInstruction}

PASS 2 — GAP & PAIN ANALYSIS

Given the business context summary, the intake form profile, and scraped website data, identify the top 3 operational gaps. Rank them by severity: revenue_impact × frequency × manual_effort_hours.

For each gap, provide:
- gap_id: short snake_case identifier (e.g. "manual_reporting", "inbound_lead_handling")
- description: 1–2 plain sentences describing the gap and its business impact
- severity_score: integer 1–10 (10 = highest impact)
- evidence_source: "form" | "scrape" | "both" | "inferred"
  Use "both" only when you can cite specific evidence from EACH source.
  Use "inferred" when the gap is a logical consequence of the data, not directly stated.

pain_priority_rank: array of gap_ids ordered highest to lowest severity.

Return ONLY valid JSON. No preamble. No markdown fences.
{
  "operational_gaps": [
    {
      "gap_id": "string",
      "description": "string",
      "severity_score": integer 1-10,
      "evidence_source": "form|scrape|both|inferred"
    }
  ],
  "pain_priority_rank": ["gap_id_1", "gap_id_2", "gap_id_3"]
}`
}

export async function runPass2(
  client: Anthropic,
  profile: SanitisedProfile,
  scraped: Record<string, unknown> | null,
  pass1: Pass1Output
): Promise<Pass2Output> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  const userMessage = `BUSINESS CONTEXT SUMMARY (from Pass 1):
${pass1.business_summary}

BUSINESS PROFILE (intake form):
${JSON.stringify(profile, null, 2)}

WEBSITE DATA:
${scraped ? JSON.stringify(scraped, null, 2) : 'NOT AVAILABLE'}`

  try {
    const response = await client.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: 0.3,
        system: buildSystemPrompt(profile.language),
        messages: [{ role: 'user', content: userMessage }],
      },
      { signal: controller.signal }
    )
    clearTimeout(timer)
    return JSON.parse((response.content[0] as { text: string }).text) as Pass2Output
  } catch (err) {
    clearTimeout(timer)
    throw new Error(`Pass 2 failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}
```

---

## 9. Pass 3 — Automation Readiness Scoring (`src/passes/pass3-readiness.ts`)

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { SanitisedProfile, Pass1Output, Pass2Output, Pass3Output } from '../types'

const TIMEOUT_MS = parseInt(process.env.PASS_TIMEOUT_MS ?? '45000', 10)

function buildSystemPrompt(language: 'en' | 'es'): string {
  const langInstruction = language === 'es'
    ? 'Respond ENTIRELY in Latin American Spanish (es-MX). All string fields must be in Spanish.'
    : 'Respond in English.'

  return `You are the ROBO AI Agency Master Analyzer Agent. ${langInstruction}

PASS 3 — AUTOMATION READINESS SCORING

Score this business 0–100 on automation readiness across five dimensions. Apply the scoring rules exactly.

DIMENSION SCORING RULES:
1. data_availability (0–20)
   20 = Business has structured data, clean records, reports, spreadsheets AI can consume.
   10 = Mixed structured/unstructured data.
   0  = All paper, WhatsApp, verbal — no structured data at all.
   Source: Q-09 (data_situation) + BA-002 tech stack signals.

2. tool_maturity (0–20)
   20 = Business uses API-capable tools (Salesforce, HubSpot, Shopify, Slack, etc.)
   10 = Uses common SMB software (Excel, QuickBooks) but not API-native.
   0  = No software tools or paper only.
   Source: Q-05 (existing_tools) + BA-002 detected_tools.

3. budget_comfort (0–20)
   Score against these ranges:
   "$5k+/mo" (5k+) = 20 | "$2k–$5k/mo" (2k-5k) = 15 | "$500–$2k/mo" (500-2k) = 10 | "Under $500/mo" (<500) = 5
   Source: Q-07 (budget_comfort).

4. decision_authority (0–20)
   Sole owner/decision-maker = 20 | Small team, owner decides = 15 | Team-based but single approver = 10 | Committee/Board = 5
   Infer from Q-02 (team_size) and tone of Q-08 (success_definition).

5. urgency (0–20)
   Hard deadline within 30 days = 20 | Deadline within 90 days = 15 | Vague urgency = 10 | No urgency = 5
   Source: Q-10 (urgency_flag).

COMPOSITE SCORE = sum of five dimensions (max 100).

automation_readiness_score: the composite integer.
readiness_reasoning: 2–3 sentences explaining the score, citing specific signals. Internal use only.

Return ONLY valid JSON. No preamble. No markdown fences.
{
  "automation_readiness_score": integer 0-100,
  "readiness_dimension_breakdown": {
    "data_availability": integer 0-20,
    "tool_maturity": integer 0-20,
    "budget_comfort": integer 0-20,
    "decision_authority": integer 0-20,
    "urgency": integer 0-20
  },
  "readiness_reasoning": "string — 2-3 sentences citing specific signals"
}`
}

export async function runPass3(
  client: Anthropic,
  profile: SanitisedProfile,
  scraped: Record<string, unknown> | null,
  pass1: Pass1Output,
  pass2: Pass2Output
): Promise<Pass3Output> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  const userMessage = `BUSINESS CONTEXT: ${pass1.business_summary}

TOP GAPS: ${JSON.stringify(pass2.operational_gaps, null, 2)}

BUSINESS PROFILE (intake form):
${JSON.stringify(profile, null, 2)}

WEBSITE DATA:
${scraped ? JSON.stringify(scraped, null, 2) : 'NOT AVAILABLE'}`

  try {
    const response = await client.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        temperature: 0.3,
        system: buildSystemPrompt(profile.language),
        messages: [{ role: 'user', content: userMessage }],
      },
      { signal: controller.signal }
    )
    clearTimeout(timer)
    return JSON.parse((response.content[0] as { text: string }).text) as Pass3Output
  } catch (err) {
    clearTimeout(timer)
    throw new Error(`Pass 3 failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}
```

---

## 10. Pass 4 — Product Matching & Roadmap (`src/passes/pass4-products.ts`)

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { SanitisedProfile, Pass1Output, Pass2Output, Pass3Output, Pass4Output } from '../types'
import { PRODUCT_CATALOGUE } from '../catalogue'

const TIMEOUT_MS = parseInt(process.env.PASS_TIMEOUT_MS ?? '45000', 10)

function buildSystemPrompt(language: 'en' | 'es'): string {
  const langInstruction = language === 'es'
    ? 'Respond ENTIRELY in Latin American Spanish (es-MX). All string fields (rationale, description, value_reasoning) must be in Spanish. Product IDs remain unchanged.'
    : 'Respond in English.'

  return `You are the ROBO AI Agency Master Analyzer Agent. ${langInstruction}

PASS 4 — PRODUCT MATCHING & ROADMAP

Match the top-ranked pain points to the product catalogue. Select a primary recommendation (highest impact, lowest friction for this client's readiness level) and 1–2 upsell products.

MATCHING LOGIC (apply in order):
- Pain: manual data entry / reporting → CA-01 + IS-03 (primary) · MS-01 (upsell)
- Pain: customer support / FAQ volume → CB-01 + IS-01 (primary) · AO-01 if bilingual
- Pain: phone handling / appointment booking → AVA-01 + IS-04 (primary) · MS-02 (upsell)
- Pain: no AI yet / unclear starting point → CS-01 (primary) · IS-01 (upsell)
- Budget <500/mo → CB-01 or CA-01 · IS-01 to deploy · MS-01 to maintain
- Budget 500-2k → AVA-01 or CA-01 bundle · IS-01 or IS-02 · MS-02
- Budget 2k+ → Full stack: CB-01 + CA-01 + AVA-01 · IS series · MS-03
- Regulated industry (finance, healthcare, legal) → CS-03 REQUIRED before build
- High urgency (< 30 days) → IS-01 flagged as fast-track
- LatAm market / Spanish language → AO-01 appended to any primary recommendation

CRITICAL RULES:
- Only use product IDs from the provided catalogue. NEVER invent new IDs.
- Every recommended product must include a rationale citing specific evidence from the profile and/or scrape data.
- tier must be "primary" for the top 1–2 products and "upsell" for additional products.
- priority_rank: 1 = highest priority.

MONTHLY VALUE ESTIMATION (use conservative assumptions):
- Manual data / reporting: team_size × avg_hours_saved_weekly × $35/hr × 4.3 weeks
- Customer support volume: estimated_tickets_avoided × $8/ticket
- Phone handling: calls_handled_by_AI × $12/call
- Revenue leakage: conversion_rate × avg_deal_size × captured_leads_monthly
Show your calculation in value_reasoning.

ROADMAP: 2–4 phases. Phase 1 = highest impact, lowest friction.

Return ONLY valid JSON. No preamble. No markdown fences.
{
  "recommended_products": [
    {
      "product_id": "string — from catalogue",
      "product_name": "string",
      "tier": "primary|upsell",
      "monthly_price_usd": number|null,
      "one_time_price_usd": number|null,
      "rationale": "string — cite specific evidence from profile or scrape",
      "value_driver": "string — e.g. time_saved | revenue_captured | cost_avoided",
      "priority_rank": integer
    }
  ],
  "implementation_roadmap": [
    {
      "phase": integer,
      "title": "string — e.g. Phase 1 — Foundation",
      "duration_weeks": integer,
      "products": ["product_id"],
      "description": "string — what the client gains at completion",
      "cumulative_monthly_value_usd": integer
    }
  ],
  "estimated_monthly_value_usd": integer,
  "value_reasoning": "string — show calculation with assumptions"
}`
}

export async function runPass4(
  client: Anthropic,
  profile: SanitisedProfile,
  scraped: Record<string, unknown> | null,
  pass1: Pass1Output,
  pass2: Pass2Output,
  pass3: Pass3Output
): Promise<Pass4Output> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  const userMessage = `BUSINESS CONTEXT: ${pass1.business_summary}

TOP GAPS (ranked): ${JSON.stringify(pass2.operational_gaps, null, 2)}
PAIN PRIORITY RANK: ${JSON.stringify(pass2.pain_priority_rank)}

READINESS SCORE: ${pass3.automation_readiness_score}/100
READINESS BREAKDOWN: ${JSON.stringify(pass3.readiness_dimension_breakdown, null, 2)}

BUSINESS PROFILE:
${JSON.stringify(profile, null, 2)}

WEBSITE DATA:
${scraped ? JSON.stringify(scraped, null, 2) : 'NOT AVAILABLE'}

PRODUCT CATALOGUE (only use IDs from this list):
${JSON.stringify(PRODUCT_CATALOGUE.map(p => ({ id: p.id, name: p.name, description: p.description, monthly_price_usd: p.monthly_price_usd, one_time_price_usd: p.one_time_price_usd })), null, 2)}`

  try {
    const response = await client.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        temperature: 0.3,
        system: buildSystemPrompt(profile.language),
        messages: [{ role: 'user', content: userMessage }],
      },
      { signal: controller.signal }
    )
    clearTimeout(timer)
    return JSON.parse((response.content[0] as { text: string }).text) as Pass4Output
  } catch (err) {
    clearTimeout(timer)
    throw new Error(`Pass 4 failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}
```

---

## 11. Schema Validator (`src/schema-validator.ts`)

```typescript
import { z } from 'zod'
import { DiagnosisOutput } from './types'
import { validateProductIds } from './catalogue'

const OperationalGapSchema = z.object({
  gap_id:          z.string().min(1),
  description:     z.string().min(10),
  severity_score:  z.number().int().min(1).max(10),
  evidence_source: z.enum(['form', 'scrape', 'both', 'inferred']),
})

const ReadinessDimensionsSchema = z.object({
  data_availability: z.number().int().min(0).max(20),
  tool_maturity:     z.number().int().min(0).max(20),
  budget_comfort:    z.number().int().min(0).max(20),
  decision_authority:z.number().int().min(0).max(20),
  urgency:           z.number().int().min(0).max(20),
})

const RecommendedProductSchema = z.object({
  product_id:       z.string().min(1),
  product_name:     z.string().min(1),
  tier:             z.enum(['primary', 'upsell']),
  monthly_price_usd:  z.number().nullable(),
  one_time_price_usd: z.number().nullable(),
  rationale:        z.string().min(10),
  value_driver:     z.string().min(1),
  priority_rank:    z.number().int().min(1),
})

const RoadmapPhaseSchema = z.object({
  phase:                         z.number().int().min(1),
  title:                         z.string().min(1),
  duration_weeks:                z.number().int().min(1),
  products:                      z.array(z.string()),
  description:                   z.string().min(10),
  cumulative_monthly_value_usd:  z.number().int(),
})

const DiagnosisOutputSchema = z.object({
  business_summary:              z.string().min(50),
  operational_gaps:              z.array(OperationalGapSchema).min(1).max(3),
  pain_priority_rank:            z.array(z.string()).min(1),
  automation_readiness_score:    z.number().int().min(0).max(100),
  readiness_dimension_breakdown: ReadinessDimensionsSchema,
  recommended_products:          z.array(RecommendedProductSchema).min(1),
  implementation_roadmap:        z.array(RoadmapPhaseSchema).min(2).max(4),
  estimated_monthly_value_usd:   z.number().int().min(0),
  confidence_score:              z.number().int().min(0).max(100),
  data_source:                   z.enum(['full', 'intake_only']),
  reasoning_trace:               z.string().optional(),
  human_escalation_flag:         z.boolean(),
  language:                      z.enum(['en', 'es']),
})

export interface ValidationResult {
  valid: boolean
  errors: string[]
  hallucinatedProductIds: string[]
}

export function validateDiagnosis(output: unknown): ValidationResult {
  const errors: string[] = []
  let hallucinatedProductIds: string[] = []

  const result = DiagnosisOutputSchema.safeParse(output)
  if (!result.success) {
    errors.push(...result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`))
  } else {
    // AC-04: validate product IDs against catalogue
    const ids = result.data.recommended_products.map(p => p.product_id)
    hallucinatedProductIds = validateProductIds(ids)
    if (hallucinatedProductIds.length > 0) {
      errors.push(`Hallucinated product IDs: ${hallucinatedProductIds.join(', ')}`)
    }

    // Validate readiness score = sum of dimensions
    const dims = result.data.readiness_dimension_breakdown
    const dimSum = dims.data_availability + dims.tool_maturity + dims.budget_comfort + dims.decision_authority + dims.urgency
    if (Math.abs(dimSum - result.data.automation_readiness_score) > 5) {
      errors.push(`automation_readiness_score (${result.data.automation_readiness_score}) deviates >5 from dimension sum (${dimSum})`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    hallucinatedProductIds,
  }
}
```

---

## 12. Analyzer Orchestrator (`src/analyzer.ts`)

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { BA001Profile, BA002ScrapedData, DiagnosisOutput } from './types'
import { sanitiseProfile, sanitiseScrapedData } from './pii'
import { runPass1 } from './passes/pass1-context'
import { runPass2 } from './passes/pass2-gaps'
import { runPass3 } from './passes/pass3-readiness'
import { runPass4 } from './passes/pass4-products'
import { validateDiagnosis } from './schema-validator'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const TOTAL_TIMEOUT_MS = parseInt(process.env.TOTAL_TIMEOUT_MS ?? '120000', 10)
const MODEL = 'claude-sonnet-4-20250514'

export interface AnalyzerResult {
  diagnosis: DiagnosisOutput
  timings: { pass1_ms: number; pass2_ms: number; pass3_ms: number; pass4_ms: number }
}

export async function runAnalysis(
  profile: BA001Profile,
  scrapedData: BA002ScrapedData | null
): Promise<AnalyzerResult> {
  const isFormOnly = !scrapedData || scrapedData.scrape_status !== 'success'
  const dataSource: 'full' | 'intake_only' = isFormOnly ? 'intake_only' : 'full'
  const language = profile.language

  // Strip PII before any Claude call (NFR-07)
  const safeProfile = sanitiseProfile(profile)
  const safeScrape = scrapedData && !isFormOnly
    ? sanitiseScrapedData(scrapedData as unknown as Record<string, unknown>)
    : null

  const totalDeadline = Date.now() + TOTAL_TIMEOUT_MS
  const timings = { pass1_ms: 0, pass2_ms: 0, pass3_ms: 0, pass4_ms: 0 }

  // ── Pass 1 ────────────────────────────────────────────────────────────────
  let t = Date.now()
  const pass1 = await runPass1(client, safeProfile, safeScrape)
  timings.pass1_ms = Date.now() - t

  if (Date.now() > totalDeadline) throw new Error('Total timeout exceeded after Pass 1')

  // ── Pass 2 ────────────────────────────────────────────────────────────────
  t = Date.now()
  const pass2 = await runPass2(client, safeProfile, safeScrape, pass1)
  timings.pass2_ms = Date.now() - t

  if (Date.now() > totalDeadline) throw new Error('Total timeout exceeded after Pass 2')

  // ── Pass 3 ────────────────────────────────────────────────────────────────
  t = Date.now()
  const pass3 = await runPass3(client, safeProfile, safeScrape, pass1, pass2)
  timings.pass3_ms = Date.now() - t

  if (Date.now() > totalDeadline) throw new Error('Total timeout exceeded after Pass 3')

  // ── Pass 4 ────────────────────────────────────────────────────────────────
  t = Date.now()
  const pass4 = await runPass4(client, safeProfile, safeScrape, pass1, pass2, pass3)
  timings.pass4_ms = Date.now() - t

  // ── Confidence score ──────────────────────────────────────────────────────
  const answeredCount = profile.questions_answered
  const baseConfidence = Math.min(100, answeredCount * 8)          // 8pts per answer, cap 100
  const scrapePenalty = isFormOnly ? 15 : 0
  const readinessPenalty = pass3.automation_readiness_score < 30 ? 10 : 0
  const confidenceScore = Math.max(0, baseConfidence - scrapePenalty - readinessPenalty)

  // ── Human escalation flag (AC-05) ────────────────────────────────────────
  const humanEscalationFlag =
    pass3.automation_readiness_score < 40 || confidenceScore < 60

  // ── Reasoning trace ──────────────────────────────────────────────────────
  const reasoningTrace = [
    `Data source: ${dataSource}`,
    `Questions answered: ${answeredCount}`,
    `Readiness score: ${pass3.automation_readiness_score} (${JSON.stringify(pass3.readiness_dimension_breakdown)})`,
    `Readiness reasoning: ${pass3.readiness_reasoning}`,
    `Confidence calculation: base=${baseConfidence} scrape_penalty=${scrapePenalty} readiness_penalty=${readinessPenalty} final=${confidenceScore}`,
    `Value estimation: ${pass4.value_reasoning}`,
    `Timings: pass1=${timings.pass1_ms}ms pass2=${timings.pass2_ms}ms pass3=${timings.pass3_ms}ms pass4=${timings.pass4_ms}ms`,
  ].join('\n')

  const diagnosis: DiagnosisOutput = {
    business_summary:              pass1.business_summary,
    operational_gaps:              pass2.operational_gaps,
    pain_priority_rank:            pass2.pain_priority_rank,
    automation_readiness_score:    pass3.automation_readiness_score,
    readiness_dimension_breakdown: pass3.readiness_dimension_breakdown,
    recommended_products:          pass4.recommended_products,
    implementation_roadmap:        pass4.implementation_roadmap,
    estimated_monthly_value_usd:   pass4.estimated_monthly_value_usd,
    confidence_score:              confidenceScore,
    data_source:                   dataSource,
    reasoning_trace:               reasoningTrace,
    human_escalation_flag:         humanEscalationFlag,
    language,
  }

  // ── Schema validation (NFR-04) — validate before returning ───────────────
  const validation = validateDiagnosis(diagnosis)
  if (!validation.valid) {
    throw new Error(`Schema validation failed: ${validation.errors.join(' | ')}`)
  }

  return { diagnosis, timings }
}
```

---

## 13. Supabase Writer (`src/db.ts`)

```typescript
import { createClient } from '@supabase/supabase-js'
import { DiagnosisOutput } from './types'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function writeAnalysis(
  profileId: string,
  diagnosis: DiagnosisOutput,
  timings: { pass1_ms: number; pass2_ms: number; pass3_ms: number; pass4_ms: number },
  totalMs: number,
  logId: string
): Promise<string> {
  const { data, error } = await supabase.from('ba_analyses').insert({
    profile_id:                    profileId,
    analyzer_model:                'claude-sonnet-4-20250514',
    data_source:                   diagnosis.data_source,
    language:                      diagnosis.language,
    business_summary:              diagnosis.business_summary,
    operational_gaps:              diagnosis.operational_gaps,
    pain_priority_rank:            diagnosis.pain_priority_rank,
    automation_readiness_score:    diagnosis.automation_readiness_score,
    readiness_dimension_breakdown: diagnosis.readiness_dimension_breakdown,
    recommended_products:          diagnosis.recommended_products,
    implementation_roadmap:        diagnosis.implementation_roadmap,
    estimated_monthly_value_usd:   diagnosis.estimated_monthly_value_usd,
    confidence_score:              diagnosis.confidence_score,
    human_escalation_flag:         diagnosis.human_escalation_flag,
    reasoning_trace:               diagnosis.reasoning_trace ?? null,
    full_diagnosis_json:           diagnosis,
  }).select('analysis_id').single()

  if (error) throw new Error(`DB write failed: ${error.message}`)

  // Update pipeline log with completion timing
  await supabase.from('ba_pipeline_log').update({
    completed_at:   new Date().toISOString(),
    duration_ms:    totalMs,
    pass1_ms:       timings.pass1_ms,
    pass2_ms:       timings.pass2_ms,
    pass3_ms:       timings.pass3_ms,
    pass4_ms:       timings.pass4_ms,
    data_source:    diagnosis.data_source,
    confidence_score: diagnosis.confidence_score,
    escalation_flag:  diagnosis.human_escalation_flag,
    analyzer_model: 'claude-sonnet-4-20250514',
    status:         diagnosis.human_escalation_flag ? 'escalated' : 'complete',
  }).eq('log_id', logId)

  return data!.analysis_id
}

export async function writeReceiptLog(
  profileId: string,
  dataSource: string,
  scrapeStatus: string,
  ipAddress: string
): Promise<string> {
  const { data, error } = await supabase.from('ba_analysis_log').insert({
    profile_id:   profileId,
    data_source:  dataSource,
    scrape_status: scrapeStatus,
    ip_address:   ipAddress,
  }).select('receipt_id').single()

  if (error) {
    console.error('[BA-004] Receipt log write failed:', error.message)
    return 'log_failed'
  }
  return data!.receipt_id
}

export async function writePipelineLog(
  profileId: string,
  sessionId: string | null
): Promise<string> {
  const { data, error } = await supabase.from('ba_pipeline_log').insert({
    profile_id:  profileId,
    session_id:  sessionId,
    status:      'running',
  }).select('log_id').single()

  if (error) {
    console.error('[BA-004] Pipeline log write failed:', error.message)
    return 'log_failed'
  }
  return data!.log_id
}

export async function failPipelineLog(logId: string, errorDetail: string): Promise<void> {
  await supabase.from('ba_pipeline_log').update({
    status:       'failed',
    completed_at: new Date().toISOString(),
    error_detail: errorDetail.slice(0, 1000),
  }).eq('log_id', logId)
}
```

---

## 14. BA-003 Notifier (`src/notifier.ts`)

```typescript
import { DiagnosisOutput } from './types'

export async function notifyBA003(
  profileId: string,
  analysisId: string,
  diagnosis: DiagnosisOutput
): Promise<void> {
  const url = process.env.BA003_WEBHOOK_URL
  const secret = process.env.BA003_WEBHOOK_SECRET

  if (!url) {
    console.warn('[BA-004] BA003_WEBHOOK_URL not configured — skipping BA-003 notification')
    return
  }

  const payload = {
    profile_id:   profileId,
    analysis_id:  analysisId,
    data_source:  diagnosis.data_source,
    language:     diagnosis.language,
    human_escalation_flag: diagnosis.human_escalation_flag,
    // Pass diagnosis summary for BA-003 to use without fetching DB
    business_summary:            diagnosis.business_summary,
    recommended_products:        diagnosis.recommended_products,
    implementation_roadmap:      diagnosis.implementation_roadmap,
    estimated_monthly_value_usd: diagnosis.estimated_monthly_value_usd,
    automation_readiness_score:  diagnosis.automation_readiness_score,
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { 'X-Webhook-Secret': secret } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        console.log(`[BA-004] BA-003 notified for ${profileId}`)
        return
      }
      console.warn(`[BA-004] BA-003 webhook returned ${res.status} — attempt ${attempt + 1}`)
    } catch (err) {
      console.warn(`[BA-004] BA-003 webhook attempt ${attempt + 1} failed:`, err)
    }
    // Exponential backoff: 2s, 4s
    if (attempt < 2) await new Promise(r => setTimeout(r, Math.pow(2, attempt + 1) * 1000))
  }

  throw new Error('BA-003 notification failed after 3 attempts')
}
```

---

## 15. Alert Handler (`src/alert.ts`)

```typescript
interface AlertPayload {
  type: 'analysis_failed' | 'schema_validation_failed' | 'db_write_failed' | 'ba003_notify_failed' | 'human_escalation'
  profile_id: string
  detail?: string
  confidence_score?: number
  readiness_score?: number
}

export async function alertOwner(payload: AlertPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const to     = process.env.OWNER_ALERT_EMAIL
  const from   = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !to || !from) {
    console.error('[BA-004] Alert config missing — cannot send alert', payload)
    return
  }

  const isEscalation = payload.type === 'human_escalation'
  const subject = isEscalation
    ? `[BA-004 ESCALATION] Human review required — ${payload.profile_id}`
    : `[BA-004 ALERT] ${payload.type} — ${payload.profile_id}`

  const text = [
    `Alert type: ${payload.type}`,
    `Profile ID: ${payload.profile_id}`,
    payload.detail ? `Detail: ${payload.detail}` : null,
    payload.confidence_score != null ? `Confidence score: ${payload.confidence_score}` : null,
    payload.readiness_score != null ? `Readiness score: ${payload.readiness_score}` : null,
    `Time: ${new Date().toISOString()}`,
    isEscalation ? '\nACTION REQUIRED: Review this profile manually and send a personalised response.' : null,
  ].filter(Boolean).join('\n')

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text }),
    })
  } catch (err) {
    console.error('[BA-004] Failed to send owner alert:', err)
  }
}
```

---

## 16. Express Server (`src/server.ts`)

```typescript
import express, { Request, Response } from 'express'
import { z } from 'zod'
import * as dotenv from 'dotenv'
import { runAnalysis } from './analyzer'
import { writeAnalysis, writeReceiptLog, writePipelineLog, failPipelineLog } from './db'
import { notifyBA003 } from './notifier'
import { alertOwner } from './alert'

dotenv.config()

const app = express()
app.use(express.json({ limit: '2mb' }))

const AnalyzeBody = z.object({
  profile: z.object({
    profile_id:        z.string().uuid(),
    language:          z.enum(['en', 'es']).default('en'),
    industry:          z.string().nullable().optional(),
    team_size:         z.string().nullable().optional(),
    revenue_range:     z.string().nullable().optional(),
    top_time_cost:     z.string().nullable().optional(),
    existing_tools:    z.array(z.string()).nullable().optional(),
    bottleneck:        z.string().nullable().optional(),
    budget_comfort:    z.string().nullable().optional(),
    success_definition:z.string().nullable().optional(),
    data_situation:    z.string().nullable().optional(),
    urgency_flag:      z.string().nullable().optional(),
    prior_ai_experience: z.boolean().nullable().optional(),
    website_url:       z.string().nullable().optional(),
    questions_answered:z.number().default(0),
    contact_email:     z.string().optional(),
    contact_first_name:z.string().optional(),
  }),
  scraped_data: z.object({
    domain:             z.string().nullable().optional(),
    page_titles:        z.array(z.string()).nullable().optional(),
    body_text_summary:  z.string().nullable().optional(),
    detected_tools:     z.array(z.string()).nullable().optional(),
    social_signals:     z.record(z.unknown()).nullable().optional(),
    scrape_status:      z.enum(['success', 'partial', 'failed', 'blocked', 'timeout']),
    scrape_timestamp:   z.string().nullable().optional(),
    content_summary:    z.string().nullable().optional(),
    tech_stack_detected:z.array(z.string()).nullable().optional(),
  }).nullable().optional(),
  secret: z.string(),
})

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'ba-004-analyzer', model: 'claude-sonnet-4-20250514' })
})

app.post('/analyze', async (req: Request, res: Response) => {
  const ip = req.headers['x-forwarded-for']?.toString() ?? req.socket.remoteAddress ?? 'unknown'

  let body: z.infer<typeof AnalyzeBody>
  try {
    body = AnalyzeBody.parse(req.body)
  } catch (err) {
    return res.status(400).json({ error: 'Invalid request body', detail: String(err) })
  }

  if (body.secret !== process.env.ANALYZER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { profile, scraped_data } = body
  const profileId = profile.profile_id
  const dataSource = !scraped_data || scraped_data.scrape_status !== 'success' ? 'intake_only' : 'full'

  // Return 202 immediately — analysis is async
  res.status(202).json({ accepted: true, profile_id: profileId, data_source: dataSource })

  // Log receipt
  const [logId] = await Promise.all([
    writePipelineLog(profileId, null),
    writeReceiptLog(profileId, dataSource, scraped_data?.scrape_status ?? 'not_provided', ip),
  ])

  const startTime = Date.now()
  let retryCount = 0
  const MAX_RETRIES = 2

  while (retryCount <= MAX_RETRIES) {
    try {
      console.log(`[BA-004] Starting analysis for ${profileId} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`)

      const { diagnosis, timings } = await runAnalysis(profile, scraped_data ?? null)
      const totalMs = Date.now() - startTime

      const analysisId = await writeAnalysis(profileId, diagnosis, timings, totalMs, logId)
      console.log(`[BA-004] Analysis complete: ${profileId} → ${analysisId} (${totalMs}ms)`)

      // Human escalation alert
      if (diagnosis.human_escalation_flag) {
        await alertOwner({
          type: 'human_escalation',
          profile_id: profileId,
          confidence_score: diagnosis.confidence_score,
          readiness_score: diagnosis.automation_readiness_score,
          detail: `Data source: ${dataSource}`,
        })
      }

      // Notify BA-003 (fire and forget — do not block)
      notifyBA003(profileId, analysisId, diagnosis).catch(async (err) => {
        console.error(`[BA-004] BA-003 notification failed for ${profileId}:`, err)
        await alertOwner({ type: 'ba003_notify_failed', profile_id: profileId, detail: String(err) })
      })

      return  // success — exit loop

    } catch (err) {
      retryCount++
      const detail = err instanceof Error ? err.message : String(err)
      console.error(`[BA-004] Analysis attempt ${retryCount} failed for ${profileId}:`, detail)

      if (retryCount > MAX_RETRIES) {
        await failPipelineLog(logId, detail)
        await alertOwner({ type: 'analysis_failed', profile_id: profileId, detail })
        return
      }

      // Wait before retry (exponential backoff: 2s, 4s)
      await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000))
    }
  }
})

const PORT = parseInt(process.env.PORT ?? '3002', 10)
app.listen(PORT, () => console.log(`[BA-004] Analyzer listening on :${PORT}`))
```

---

## 17. `package.json` Scripts

```json
{
  "scripts": {
    "dev":   "ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint":  "tsc --noEmit"
  }
}
```

---

## 18. Docker

### `Dockerfile`

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

RUN addgroup --system analyzer && adduser --system --ingroup analyzer analyzer
RUN chown -R analyzer:analyzer /app
USER analyzer

EXPOSE 3002
CMD ["node", "dist/server.js"]
```

### `.dockerignore`

```
node_modules
dist
.env
*.md
.git
src
```

### Build and run locally (testing)

```bash
docker build -t ba-004-analyzer .

docker run -p 3002:3002 \
  --env-file .env \
  ba-004-analyzer

# Test health
curl http://localhost:3002/health

# Test analysis (replace UUIDs + secret)
curl -X POST http://localhost:3002/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "your_shared_secret",
    "profile": {
      "profile_id": "00000000-0000-0000-0000-000000000001",
      "language": "en",
      "industry": "retail",
      "team_size": "6-20",
      "revenue_range": "50-200k",
      "top_time_cost": "manually entering orders into spreadsheets takes 3 hours daily",
      "existing_tools": ["excel", "shopify"],
      "bottleneck": "no automation between Shopify and accounting system",
      "budget_comfort": "500-2k",
      "success_definition": "orders flow automatically without manual entry",
      "data_situation": "we have Shopify export CSVs but they need manual cleaning",
      "urgency_flag": "we go into peak season in 6 weeks",
      "prior_ai_experience": false,
      "website_url": "https://example-retail.com",
      "questions_answered": 10
    },
    "scraped_data": {
      "domain": "example-retail.com",
      "scrape_status": "success",
      "body_text_summary": "Online retail store selling home goods. Uses Shopify. No live chat visible.",
      "detected_tools": ["Shopify", "Google Analytics"],
      "tech_stack_detected": ["Shopify", "Google Analytics"],
      "scrape_timestamp": "2026-05-27T10:00:00Z"
    }
  }'
# Expected: {"accepted":true,"profile_id":"...","data_source":"full"}
# Then check ba_analyses in Supabase ~60-90s later
```

---

## 19. Hetzner Deployment

### Deploy alongside BA-002 (same server, second container)

On the existing BA-002 Hetzner server, add BA-004 to docker-compose:

```yaml
# /opt/roboai-services/docker-compose.yml
version: '3.8'
services:
  scraper:
    image: ba-002-scraper:latest
    restart: always
    env_file: ba-002.env
    ports:
      - "127.0.0.1:3001:3001"
    shm_size: '1gb'
    deploy:
      resources:
        limits:
          memory: 2g

  analyzer:
    image: ba-004-analyzer:latest
    restart: always
    env_file: ba-004.env
    ports:
      - "127.0.0.1:3002:3002"
    deploy:
      resources:
        limits:
          memory: 512m
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Nginx config for BA-004

Add to Nginx on the Hetzner server:

```nginx
server {
    listen 80;
    server_name analyzer.roboai.agency;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 150s;    # > 120s TOTAL_TIMEOUT to avoid Nginx killing the connection
        proxy_connect_timeout 10s;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/ba-004 /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d analyzer.roboai.agency   # add SSL
```

---

## 20. n8n Workflow Nodes for BA-004

These nodes extend the existing BA-002 n8n workflow (the "Wait for Scrape Result" node already exists — add these after it).

### Node: "Build Analyzer Payload"

- **Type:** Code (JavaScript)
- **Position:** After "Wait for Scrape Result" exits with `found: true`

```javascript
// Fetch full profile from Supabase
const profileId = $('Trigger BA-001 Webhook').first().json.profile_id;
const supabaseUrl = $env.SUPABASE_URL;
const serviceKey  = $env.SUPABASE_SERVICE_ROLE_KEY;

const [profileRes, scrapeRes] = await Promise.all([
  fetch(`${supabaseUrl}/rest/v1/profiles?profile_id=eq.${profileId}&select=*`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
  }),
  fetch(`${supabaseUrl}/rest/v1/scrape_results?profile_id=eq.${profileId}&select=*`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
  }),
]);

const profiles = await profileRes.json();
const scrapes  = await scrapeRes.json();

if (!profiles.length) throw new Error(`Profile not found: ${profileId}`);

return [{
  json: {
    profile:      profiles[0],
    scraped_data: scrapes.length ? scrapes[0] : null,
    secret:       $env.ANALYZER_SECRET,
  },
}];
```

### Node: "Trigger BA-004 Analyzer"

- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://analyzer.roboai.agency/analyze`
- **Body (JSON expression):** `{{ $json }}`
- **Expected response:** `202 Accepted`
- **On HTTP error:** continue to error handler (analysis failure handled by BA-004 internally)
- **Timeout:** 30 seconds (BA-004 returns 202 immediately)

### Node: "Log BA-004 Trigger"

- **Type:** Code
- Writes to `ba_pipeline_log` that the n8n trigger was fired (optional — BA-004 does this internally)

### Node: "Error Handler — Full Pipeline"

- **Type:** Error Trigger
- On any node failure in the workflow:
  - HTTP Request to Resend: send alert to `OWNER_ALERT_EMAIL`
  - Log failure to Supabase `ba_pipeline_log`

### Complete n8n Post-Submit Workflow Sequence

```
Webhook (BA-001 submit)
  → Wait 5s
  → Trigger BA-002 Scraper (POST /scrape)
  → Poll scrape_results (loop every 30s, max 10 iterations)
  → IF found: Build Analyzer Payload (fetch profile + scrape from Supabase)
  → Trigger BA-004 Analyzer (POST /analyze) — returns 202
  → [BA-004 runs async: 4-pass Claude → DB write → BA-003 notify]
  → Log pipeline triggered
  → Error handler on any failure
```

---

## 21. Error Handling Summary

| Scenario | BA-004 Behaviour | Pipeline Impact |
|----------|-----------------|-----------------|
| Both profile + scrape present | Full 4-pass analysis | `data_source: full` |
| Scrape failed/blocked/timeout | Analysis runs on profile only | `data_source: intake_only`, confidence capped at 70 |
| Profile missing required fields | Analysis runs, confidence reduced | `confidence_score < 60`, escalation flag set |
| Claude API timeout (single pass) | Pass throws, caught by retry loop | Retry with exponential backoff |
| Schema validation failure | Retry up to 2 times | On 3rd failure: alert owner, fail pipeline log |
| Hallucinated product IDs in output | Schema validation catches, retry | Included in schema validation error |
| readiness_score < 40 | Analysis completes normally | `human_escalation_flag: true`, owner alerted |
| confidence_score < 60 | Analysis completes normally | `human_escalation_flag: true`, owner alerted |
| DB write fails | Throws, outer retry handles | Owner alerted on final failure |
| BA-003 notification fails | Retried 3×, then owner alerted | Analysis already written — BA-003 can be re-triggered manually |
| Total timeout (120s) exceeded | Pass throws mid-chain | Full retry from Pass 1 |

---

## 22. Test Cases

| ID | Test | How to Verify |
|----|------|--------------|
| TC-01 | Full data analysis | POST valid profile + scrape → check `ba_analyses` within 90s → all 13 fields present, product IDs valid, schema validates |
| TC-02 | Intake-only (scrape failed) | POST profile with `scrape_status: "failed"` → `data_source: intake_only`, `confidence_score ≤ 70` |
| TC-03 | Low readiness escalation | POST profile: budget `<500`, no urgency, team 50+ → `automation_readiness_score < 40`, `human_escalation_flag: true`, owner alert email received |
| TC-04 | High readiness | POST profile: budget `5k+`, sole owner, urgency "7 days", rich data situation → `automation_readiness_score ≥ 75`, IS-01 in recommendations |
| TC-05 | No product hallucination | Run 20 analyses across varied profiles → `validateProductIds()` returns empty array on every output |
| TC-06 | Schema validation failure recovery | Mock Pass 4 to return invalid JSON → retry triggered ×2; owner alert on 3rd failure |
| TC-07 | Spanish output | Set `language: "es"` → all string fields in Spanish, product IDs unchanged |
| TC-08 | PII exclusion | Add console.log to each pass to print user message → confirm no email addresses in output |
| TC-09 | Bilingual market detection | Industry = retail, body_text_summary mentions Spanish content → AO-01 in recommendations |
| TC-10 | Timing SLA | 10 sequential analyses → check `ba_pipeline_log.duration_ms` for p95 < 90,000ms |
| TC-11 | 202 response time | POST to /analyze → response time < 500ms (returns before analysis starts) |
| TC-12 | Invalid secret | POST with wrong secret → 401, no DB row written |
| TC-13 | Health check | GET /health → `{"ok":true}` |
| TC-14 | Minimum viable profile | POST profile with only 6 answers → analysis runs, `confidence_score < 60`, `human_escalation_flag: true` |

---

## 23. Security Checklist

- [ ] `ANALYZER_SECRET` matches value in n8n environment variables
- [ ] `ANTHROPIC_API_KEY` not logged anywhere — grep: `grep -r "ANTHROPIC\|sk-ant" dist/`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` not logged — `grep -r "service_role" dist/`
- [ ] Server binds to `127.0.0.1:3002` only — nginx proxies externally
- [ ] HTTPS enforced on `analyzer.roboai.agency` via certbot
- [ ] `contact_email` and `contact_first_name` never appear in Claude API call payloads — verify by logging sanitised profiles in dev
- [ ] Zod schema rejects non-UUID `profile_id` → prevents injection
- [ ] `/health` returns no sensitive data
- [ ] All outbound BA-003 webhook calls include `X-Webhook-Secret` header

---

## 24. Monitoring

```bash
# Healthcheck cron (every 5 min)
*/5 * * * * curl -sf https://analyzer.roboai.agency/health || \
  curl -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"from":"alerts@roboai.agency","to":"gerardo@roboai.agency","subject":"BA-004 DOWN","text":"Analyzer health check failed"}'
```

SLA tracking query (run in Supabase SQL editor):

```sql
-- p50, p95, p99 analysis duration over last 7 days
SELECT
  percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_ms,
  COUNT(*) FILTER (WHERE status = 'complete')   AS completed,
  COUNT(*) FILTER (WHERE status = 'failed')     AS failed,
  COUNT(*) FILTER (WHERE status = 'escalated')  AS escalated,
  COUNT(*) FILTER (WHERE escalation_flag = true) AS human_escalations
FROM public.ba_pipeline_log
WHERE triggered_at > now() - INTERVAL '7 days';
```

---

*BA-004 Master Analyzer Agent · Build Instructions v1.0 · ROBO AI Agency · May 2026*
*Depends on: BA-001 v1.2 (profiles table) · BA-002 (scrape_results table)*
*Feeds: BA-003 Proposal Generator (via webhook)*
