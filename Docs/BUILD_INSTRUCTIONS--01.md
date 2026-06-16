# BA-001 — Build Instructions
**ROBO AI Agency · Business Intake Form · v1.2**
> These instructions are written for a coder AI agent to execute top-to-bottom. Build each section in order. Do not skip ahead.

---

## 0. Decisions (resolve before starting)

The following are open questions from the PDR. Use the recommended defaults below unless Gerardo has updated them:

| # | Decision | Default to use |
|---|----------|----------------|
| OQ-01 | Session store | Supabase (cross-device resume) |
| OQ-02 | AI temperature | `0.3` for predictable question selection |
| OQ-03 | Fallback if Anthropic down | Static next question from bank — no error screen |
| OQ-04 | GDPR consent placement | Inline at final submission step |
| OQ-06 | PDF renderer | `pdf-lib` (JS — same runtime as Next.js, no Python service) |
| OQ-07 | PDF storage | Supabase Storage |
| OQ-08 | PDF delivery | Signed download link in email (revocable) |
| OQ-09 | Analyzer trigger | Immediate after scrape complete |
| OQ-10 | Financial estimates if scraper blocked | Show with caveat note |
| OQ-11 | Sandbox hosting | Deploy to `/analyse/demo` on roboai.agency |

---

## 1. Project Scaffold

### 1.1 Create Next.js 14 App

```bash
npx create-next-app@14 robo-intake \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd robo-intake
```

### 1.2 Install Dependencies

```bash
# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Anthropic SDK
npm install @anthropic-ai/sdk

# Email
npm install resend

# PDF generation
npm install pdf-lib @pdf-lib/fontkit

# Validation
npm install zod

# Utilities
npm install uuid
npm install @types/uuid --save-dev

# n8n webhook client (for posting)
# No package needed — use native fetch
```

### 1.3 Environment Variables

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your_key_here

# Resend
RESEND_API_KEY=re_your_key_here
RESEND_FROM_EMAIL=analysis@roboai.agency

# n8n
N8N_WEBHOOK_URL=https://your-n8n.instance/webhook/ba-001-submit
N8N_WEBHOOK_SECRET=your_shared_secret_here

# Supabase Storage
SUPABASE_STORAGE_BUCKET=pdf-reports

# Owner alert email
OWNER_ALERT_EMAIL=gerardo@roboai.agency

# App
NEXT_PUBLIC_APP_URL=https://roboai.agency
CALENDAR_BOOKING_URL=https://cal.com/gerardo-robo
```

**CRITICAL — Never expose these to the client bundle:**
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only
- `ANTHROPIC_API_KEY` — server-side only
- `RESEND_API_KEY` — server-side only
- `N8N_WEBHOOK_SECRET` — server-side only

`NEXT_PUBLIC_SUPABASE_URL` is intentionally public (read-only anon key is NOT used; all writes go through API routes).

### 1.4 File Structure to Build

```
src/
├── app/
│   ├── analyse/
│   │   ├── page.tsx              ← Main intake form page (noindex)
│   │   ├── demo/
│   │   │   └── page.tsx          ← Sandbox wrapper page
│   │   └── layout.tsx            ← Analyse layout (noindex meta)
│   └── api/
│       ├── session/
│       │   └── route.ts          ← POST: create session → INSERT profiles row
│       ├── next-question/
│       │   └── route.ts          ← POST: call Anthropic → return next question
│       ├── answer/
│       │   └── route.ts          ← POST: UPDATE profiles column
│       ├── submit-profile/
│       │   └── route.ts          ← POST: finalize + webhook + confirmation email
│       ├── pipeline-status/
│       │   └── route.ts          ← GET: poll pipeline progress for holding page
│       └── gdpr-erase/
│           └── route.ts          ← DELETE: GDPR right-to-erasure
├── components/
│   ├── form/
│   │   ├── ConversationalForm.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── TypingIndicator.tsx
│   │   ├── ChipSelect.tsx
│   │   ├── MultiChipSelect.tsx
│   │   ├── FreeTextInput.tsx
│   │   └── ProgressDots.tsx
│   └── holding/
│       └── PipelineStatus.tsx
├── lib/
│   ├── supabase/
│   │   ├── server.ts             ← createServerClient (service role)
│   │   └── types.ts              ← Generated DB types
│   ├── anthropic/
│   │   ├── client.ts             ← Anthropic SDK singleton
│   │   ├── form-engine.ts        ← Next-question logic
│   │   └── analyzer.ts           ← Master Analyzer Agent
│   ├── pdf/
│   │   └── generator.ts          ← pdf-lib report builder
│   ├── email/
│   │   └── resend.ts             ← Confirmation + delivery templates
│   ├── questions.ts              ← Question bank constant (static fallback)
│   ├── product-catalogue.ts      ← 12 ROBO AI products static JSON
│   └── validations.ts            ← Zod schemas
├── i18n/
│   ├── en.ts
│   └── es.ts
public/
├── sandbox/
│   └── intake-form.html          ← Standalone sandbox (built separately)
└── fonts/
    └── (brand fonts if self-hosted)
```

---

## 2. Database — Supabase Setup

### 2.1 Enable pgcrypto Extension

Run in Supabase SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### 2.2 Create Tables

```sql
-- ─────────────────────────────────────────────
-- TABLE: profiles
-- ─────────────────────────────────────────────
CREATE TABLE public.profiles (
  profile_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  language            varchar(5) NOT NULL DEFAULT 'en',
  source_product_id   varchar(20),
  session_status      varchar(20) NOT NULL DEFAULT 'in_progress'
                        CHECK (session_status IN ('in_progress','submitted','expired')),

  -- Q-01 through Q-12
  industry            text,
  team_size           varchar(20)
                        CHECK (team_size IN ('1','2-5','6-20','21-50','50+')),
  revenue_range       varchar(20)
                        CHECK (revenue_range IN ('<10k','10-50k','50-200k','200k+')),
  top_time_cost       text,
  existing_tools      text[],
  bottleneck          text,
  budget_comfort      varchar(20)
                        CHECK (budget_comfort IN ('<500','500-2k','2k-5k','5k+')),
  success_definition  text,
  data_situation      text,
  urgency_flag        text,
  prior_ai_experience boolean,
  website_url         text,

  -- Contact (PII)
  contact_email       text NOT NULL,          -- stored AES-256 encrypted via pgcrypto
  contact_first_name  text NOT NULL,
  consent_marketing   boolean NOT NULL DEFAULT false,

  -- Meta
  questions_answered  integer NOT NULL DEFAULT 0,
  raw_answers_json    jsonb                   -- purged after 30 days
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- TABLE: scrape_results
-- ─────────────────────────────────────────────
CREATE TABLE public.scrape_results (
  scrape_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          uuid NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  scraped_at          timestamptz NOT NULL DEFAULT now(),
  scrape_status       varchar(20) NOT NULL
                        CHECK (scrape_status IN ('success','failed','blocked','timeout')),
  page_title          text,
  meta_description    text,
  detected_industry   text,
  services_detected   text[],
  tech_stack_detected text[],
  social_links        jsonb,
  content_summary     text,
  raw_html_snapshot   text,           -- first 50,000 chars; purged after 30 days
  error_message       text
);

-- ─────────────────────────────────────────────
-- TABLE: diagnoses
-- ─────────────────────────────────────────────
CREATE TABLE public.diagnoses (
  diagnosis_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id              uuid NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  generated_at            timestamptz NOT NULL DEFAULT now(),
  analyzer_model          varchar(50) NOT NULL,
  diagnosis_status        varchar(20) NOT NULL
                            CHECK (diagnosis_status IN ('complete','partial','failed')),
  pain_point_summary      text NOT NULL,
  inefficiency_score      integer NOT NULL CHECK (inefficiency_score BETWEEN 0 AND 100),
  top_pain_points         text[] NOT NULL,
  matched_products        jsonb NOT NULL,
  automation_opportunity  text,
  estimated_hours_saved   integer,
  estimated_cost_recovered integer,
  qa_pairs                jsonb NOT NULL,
  diagnosis_json_full     jsonb NOT NULL,
  pdf_report_url          text,
  pdf_generated_at        timestamptz
);
```

### 2.3 Row-Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;

-- DENY all by default (no client access)
-- Service role bypasses RLS automatically in Supabase
-- No policies needed — the absence of policies denies everything to anon/authenticated roles
-- Verify: anon SELECT on any table must return 401/empty
```

### 2.4 Auto-Purge Raw Fields (30-Day Retention)

Create a Supabase scheduled function (Database → Functions → Cron):

```sql
-- Run daily at 02:00 UTC
SELECT cron.schedule(
  'purge-raw-fields',
  '0 2 * * *',
  $$
    UPDATE public.profiles
    SET raw_answers_json = NULL
    WHERE created_at < now() - INTERVAL '30 days'
      AND raw_answers_json IS NOT NULL;

    UPDATE public.scrape_results
    SET raw_html_snapshot = NULL
    WHERE scraped_at < now() - INTERVAL '30 days'
      AND raw_html_snapshot IS NOT NULL;
  $$
);
```

### 2.5 Session Expiry (72-Hour Cron)

```sql
SELECT cron.schedule(
  'expire-sessions',
  '0 * * * *',   -- every hour
  $$
    UPDATE public.profiles
    SET session_status = 'expired'
    WHERE session_status = 'in_progress'
      AND updated_at < now() - INTERVAL '72 hours';
  $$
);
```

### 2.6 PII Encryption

`contact_email` must be encrypted before INSERT and decrypted on SELECT — handled in the API route, not at DB level directly.

In `src/lib/supabase/server.ts`, implement helpers:

```typescript
const ENCRYPTION_KEY = process.env.SUPABASE_ENCRYPTION_KEY!  // 32-char secret

// Use pgcrypto symmetric encryption via SQL function calls:
// INSERT: pgp_sym_encrypt(email, key)
// SELECT: pgp_sym_decrypt(contact_email::bytea, key)

// Alternatively: encrypt in TypeScript before writing using node:crypto AES-256-GCM
// and store the ciphertext as base64 text
```

Use Node.js `crypto.createCipheriv('aes-256-gcm', ...)` in TypeScript — simpler than pgcrypto calls. Add `SUPABASE_ENCRYPTION_KEY` (32-byte hex) to env vars.

### 2.7 Supabase Storage Bucket

In Supabase dashboard → Storage → New Bucket:
- Name: `pdf-reports`
- Public: **No** (private, signed URLs only)
- File size limit: 10 MB

---

## 3. Supabase Client (`src/lib/supabase/server.ts`)

```typescript
import { createClient } from '@supabase/supabase-js'

// Service role client — server-side only, never import in client components
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
```

---

## 4. Question Bank (`src/lib/questions.ts`)

```typescript
export type InputType = 'chip-single' | 'chip-multi' | 'free-text'

export interface Question {
  id: string        // 'Q-01' ... 'Q-12'
  field: string     // maps to profiles column
  domain: string
  en: string        // question text in English
  es: string        // question text in Spanish (es-MX)
  inputType: InputType
  options?: { value: string; labelEn: string; labelEs: string }[]
  required: boolean
}

export const QUESTION_BANK: Question[] = [
  {
    id: 'Q-01', field: 'industry', domain: 'Industry',
    en: 'What industry or sector does your business operate in?',
    es: '¿En qué industria o sector opera tu negocio?',
    inputType: 'chip-single',
    options: [
      { value: 'retail',       labelEn: 'Retail',         labelEs: 'Comercio minorista' },
      { value: 'logistics',    labelEn: 'Logistics',      labelEs: 'Logística' },
      { value: 'healthcare',   labelEn: 'Healthcare',     labelEs: 'Salud' },
      { value: 'construction', labelEn: 'Construction',   labelEs: 'Construcción' },
      { value: 'finance',      labelEn: 'Finance',        labelEs: 'Finanzas' },
      { value: 'hospitality',  labelEn: 'Hospitality',    labelEs: 'Hospitalidad' },
      { value: 'education',    labelEn: 'Education',      labelEs: 'Educación' },
      { value: 'professional', labelEn: 'Professional Services', labelEs: 'Servicios profesionales' },
      { value: 'manufacturing',labelEn: 'Manufacturing',  labelEs: 'Manufactura' },
      { value: 'other',        labelEn: 'Other',          labelEs: 'Otro' },
    ],
    required: true,
  },
  {
    id: 'Q-02', field: 'team_size', domain: 'Scale',
    en: 'How many people work in your business full-time?',
    es: '¿Cuántas personas trabajan en tu negocio a tiempo completo?',
    inputType: 'chip-single',
    options: [
      { value: '1',     labelEn: 'Just me',  labelEs: 'Solo yo' },
      { value: '2-5',   labelEn: '2–5',      labelEs: '2–5' },
      { value: '6-20',  labelEn: '6–20',     labelEs: '6–20' },
      { value: '21-50', labelEn: '21–50',    labelEs: '21–50' },
      { value: '50+',   labelEn: '50+',      labelEs: '50+' },
    ],
    required: true,
  },
  {
    id: 'Q-03', field: 'revenue_range', domain: 'Revenue',
    en: 'What is your approximate monthly revenue range?',
    es: '¿Cuál es tu rango aproximado de ingresos mensuales?',
    inputType: 'chip-single',
    options: [
      { value: '<10k',    labelEn: 'Under $10k',    labelEs: 'Menos de $10k' },
      { value: '10-50k',  labelEn: '$10k–$50k',     labelEs: '$10k–$50k' },
      { value: '50-200k', labelEn: '$50k–$200k',    labelEs: '$50k–$200k' },
      { value: '200k+',   labelEn: '$200k+',         labelEs: '$200k+' },
    ],
    required: false,
  },
  {
    id: 'Q-04', field: 'top_time_cost', domain: 'Time Cost',
    en: 'In your {industry} business, what task takes the most time each week?',
    es: 'En tu negocio de {industry}, ¿qué tarea consume más tiempo cada semana?',
    inputType: 'free-text',
    required: true,
  },
  {
    id: 'Q-05', field: 'existing_tools', domain: 'Tools',
    en: 'What software tools does your team of {team_size} use today?',
    es: 'Tu equipo de {team_size} personas, ¿qué herramientas de software usa hoy?',
    inputType: 'chip-multi',
    options: [
      { value: 'excel',       labelEn: 'Excel / Sheets', labelEs: 'Excel / Sheets' },
      { value: 'whatsapp',    labelEn: 'WhatsApp',        labelEs: 'WhatsApp' },
      { value: 'quickbooks',  labelEn: 'QuickBooks',      labelEs: 'QuickBooks' },
      { value: 'salesforce',  labelEn: 'Salesforce',      labelEs: 'Salesforce' },
      { value: 'hubspot',     labelEn: 'HubSpot',         labelEs: 'HubSpot' },
      { value: 'slack',       labelEn: 'Slack',           labelEs: 'Slack' },
      { value: 'notion',      labelEn: 'Notion',          labelEs: 'Notion' },
      { value: 'shopify',     labelEn: 'Shopify',         labelEs: 'Shopify' },
      { value: 'none',        labelEn: 'None / Paper',    labelEs: 'Ninguno / Papel' },
    ],
    required: false,
  },
  {
    id: 'Q-06', field: 'bottleneck', domain: 'Bottleneck',
    en: 'What is your single biggest operational bottleneck right now?',
    es: '¿Cuál es tu mayor cuello de botella operativo en este momento?',
    inputType: 'free-text',
    required: true,
  },
  {
    id: 'Q-07', field: 'budget_comfort', domain: 'Budget',
    en: 'What monthly budget feels comfortable for an AI solution?',
    es: '¿Qué presupuesto mensual te sientes cómodo/a para una solución de IA?',
    inputType: 'chip-single',
    options: [
      { value: '<500',    labelEn: 'Under $500/mo',  labelEs: 'Menos de $500/mes' },
      { value: '500-2k',  labelEn: '$500–$2,000/mo', labelEs: '$500–$2,000/mes' },
      { value: '2k-5k',   labelEn: '$2k–$5k/mo',     labelEs: '$2k–$5k/mes' },
      { value: '5k+',     labelEn: '$5k+/mo',         labelEs: '$5k+/mes' },
    ],
    required: true,
  },
  {
    id: 'Q-08', field: 'success_definition', domain: 'Goals',
    en: 'What would success look like for your {industry} business 6 months from now?',
    es: '¿Cómo se vería el éxito para tu negocio de {industry} dentro de 6 meses?',
    inputType: 'free-text',
    required: true,
  },
  {
    id: 'Q-09', field: 'data_situation', domain: 'Data',
    en: 'Do you currently manage any data or reports manually — spreadsheets, logs, forms?',
    es: '¿Actualmente gestionas datos o reportes de forma manual — hojas de cálculo, registros, formularios?',
    inputType: 'free-text',
    required: false,
  },
  {
    id: 'Q-10', field: 'urgency_flag', domain: 'Urgency',
    en: 'Is there a deadline or upcoming event driving this need?',
    es: '¿Hay algún plazo o evento próximo que impulse esta necesidad?',
    inputType: 'free-text',
    required: false,
  },
  {
    id: 'Q-11', field: 'prior_ai_experience', domain: 'Prior AI',
    en: 'Have you tried any AI tools or automation before?',
    es: '¿Has probado alguna herramienta de IA o automatización antes?',
    inputType: 'chip-single',
    options: [
      { value: 'yes',   labelEn: 'Yes',               labelEs: 'Sí' },
      { value: 'tried', labelEn: 'Tried but abandoned', labelEs: 'Intenté pero lo abandoné' },
      { value: 'no',    labelEn: 'No',                labelEs: 'No' },
    ],
    required: false,
  },
  {
    id: 'Q-12', field: 'website_url', domain: 'Website',
    en: 'What is your business website URL? (We\'ll analyse it to enrich your report)',
    es: '¿Cuál es la URL de tu sitio web? (Lo analizaremos para enriquecer tu reporte)',
    inputType: 'free-text',
    required: false,
  },
]

// Skip Q-05 tool follow-up if user selected 'none'
export function shouldSkip(questionId: string, answers: Record<string, unknown>): boolean {
  return false // AI engine handles branching; this is the static fallback
}
```

---

## 5. Product Catalogue (`src/lib/product-catalogue.ts`)

```typescript
// Placeholder — replace with real 12 products from Gerardo
// The Analyzer is constrained to ONLY use products from this list
export interface Product {
  product_id:   string   // e.g. 'IS-01'
  product_name: string
  category:     'IS' | 'CS' | 'PL'   // Intelligence Solutions / Consultancy / Platform
  description:  string   // one sentence
  best_for:     string[] // industries or use cases this fits best
  monthly_price_usd: number
}

export const PRODUCT_CATALOGUE: Product[] = [
  {
    product_id: 'IS-01',
    product_name: 'AI Inbox Triage',
    category: 'IS',
    description: 'Classifies and routes incoming emails/messages automatically.',
    best_for: ['logistics', 'professional', 'healthcare'],
    monthly_price_usd: 499,
  },
  // ... add all 12 products
]
```

---

## 6. API Routes

### 6.1 `POST /api/session` — Create Session

Called on page load. Creates the `profiles` row.

```typescript
// src/app/api/session/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Body = z.object({
  language: z.enum(['en', 'es']).default('en'),
  source_product_id: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const body = Body.parse(await req.json())
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      language: body.language,
      source_product_id: body.source_product_id ?? null,
      session_status: 'in_progress',
      questions_answered: 0,
      contact_email: '',        // placeholder — filled on final submit
      contact_first_name: '',   // placeholder
      consent_marketing: false,
    })
    .select('profile_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile_id: data.profile_id })
}
```

### 6.2 `POST /api/next-question` — AI Question Engine

The core AI call. Returns the next question definition for the client to render.

```typescript
// src/app/api/next-question/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { QUESTION_BANK } from '@/lib/questions'
import { z } from 'zod'

const client = new Anthropic()

const Body = z.object({
  profile_id: z.string().uuid(),
  answers_so_far: z.record(z.unknown()),   // { field: value, ... }
  questions_shown: z.array(z.string()),    // ['Q-01', 'Q-03', ...]
  language: z.enum(['en', 'es']),
})

export async function POST(req: NextRequest) {
  const body = Body.parse(await req.json())
  const { answers_so_far, questions_shown, language } = body

  const remaining = QUESTION_BANK.filter(q => !questions_shown.includes(q.id))
  const answeredCount = questions_shown.length
  const canFinishEarly = answeredCount >= 8

  // Build the question bank summary for the prompt
  const bankSummary = remaining.map(q => ({
    id: q.id,
    field: q.field,
    domain: q.domain,
    question: language === 'en' ? q.en : q.es,
    inputType: q.inputType,
    required: q.required,
  }))

  const systemPrompt = `You are the ROBO AI Agency conversation engine.
Your job: given what the user has already answered, select the BEST next question from the remaining bank.

Rules:
- Select exactly one question from the remaining bank.
- Prioritise required fields not yet answered.
- If user has no existing tools (existing_tools includes 'none'), skip Q-05 entirely.
- If Q-12 (website_url) is already answered, do not select Q-12 again.
- Personalise the question text: replace {industry} with the actual industry value, {team_size} with the actual team size — in the appropriate language.
- After 8 answers, also set "offer_early_completion": true in your response.
- Return ONLY valid JSON. No preamble. No markdown fences.

Response schema:
{
  "question_id": "Q-XX",
  "question_text": "personalised question text in the user's language",
  "field": "column_name",
  "input_type": "chip-single|chip-multi|free-text",
  "options": [{"value":"...", "label":"..."}] | null,
  "offer_early_completion": false
}`

  const userMessage = `
ANSWERS SO FAR: ${JSON.stringify(answers_so_far)}
QUESTIONS ALREADY SHOWN: ${JSON.stringify(questions_shown)}
REMAINING QUESTIONS: ${JSON.stringify(bankSummary)}
LANGUAGE: ${language}
ANSWERS COUNT: ${answeredCount}
CAN FINISH EARLY: ${canFinishEarly}
`

  // 5-second timeout — fallback to first remaining required question
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await client.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      },
      { signal: controller.signal }
    )
    clearTimeout(timeout)

    const json = JSON.parse((response.content[0] as { text: string }).text)
    return NextResponse.json(json)
  } catch {
    clearTimeout(timeout)
    // Static fallback: pick first remaining required question, or first remaining
    const fallback = remaining.find(q => q.required) ?? remaining[0]
    if (!fallback) return NextResponse.json({ done: true })

    return NextResponse.json({
      question_id: fallback.id,
      question_text: language === 'en' ? fallback.en : fallback.es,
      field: fallback.field,
      input_type: fallback.inputType,
      options: fallback.options?.map(o => ({
        value: o.value,
        label: language === 'en' ? o.labelEn : o.labelEs,
      })) ?? null,
      offer_early_completion: answeredCount >= 8,
    })
  }
}
```

### 6.3 `POST /api/answer` — Persist Each Answer

Called after every question is answered. Updates the `profiles` row in real time.

```typescript
// src/app/api/answer/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Body = z.object({
  profile_id: z.string().uuid(),
  field: z.string(),
  value: z.unknown(),
})

// Allowed fields — whitelist to prevent arbitrary column writes
const ALLOWED_FIELDS = new Set([
  'industry','team_size','revenue_range','top_time_cost','existing_tools',
  'bottleneck','budget_comfort','success_definition','data_situation',
  'urgency_flag','prior_ai_experience','website_url',
])

export async function POST(req: NextRequest) {
  const { profile_id, field, value } = Body.parse(await req.json())

  if (!ALLOWED_FIELDS.has(field)) {
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      [field]: value,
      questions_answered: supabase.rpc('increment', { row_id: profile_id }) as unknown as number,
    })
    .eq('profile_id', profile_id)

  // Simpler: fetch current count and increment manually
  // The above is pseudocode — use the pattern below:
  const { data: current } = await supabase
    .from('profiles')
    .select('questions_answered')
    .eq('profile_id', profile_id)
    .single()

  await supabase
    .from('profiles')
    .update({
      [field]: value,
      questions_answered: (current?.questions_answered ?? 0) + 1,
    })
    .eq('profile_id', profile_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

### 6.4 `POST /api/submit-profile` — Final Submission

Finalizes the profile, encrypts PII, fires n8n webhook, sends confirmation email.

```typescript
// src/app/api/submit-profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { encryptEmail } from '@/lib/crypto'
import { sendConfirmationEmail } from '@/lib/email/resend'

const Body = z.object({
  profile_id: z.string().uuid(),
  contact: z.object({
    email: z.string().email(),
    first_name: z.string().min(1),
    consent_marketing: z.boolean(),
  }),
  language: z.enum(['en', 'es']),
})

export async function POST(req: NextRequest) {
  const body = Body.parse(await req.json())
  const supabase = createServiceClient()

  // Fetch current profile state for the JSON snapshot
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('profile_id', body.profile_id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const encryptedEmail = encryptEmail(body.contact.email)

  // Build the canonical output JSON
  const profileJson = {
    profile_id: profile.profile_id,
    created_at: profile.created_at,
    language: profile.language,
    source_product_id: profile.source_product_id,
    business: {
      industry: profile.industry,
      team_size: profile.team_size,
      revenue_range: profile.revenue_range,
      website_url: profile.website_url,
    },
    pain_points: {
      top_time_cost: profile.top_time_cost,
      bottleneck: profile.bottleneck,
      data_situation: profile.data_situation,
      prior_ai_experience: profile.prior_ai_experience,
    },
    goals: {
      success_definition: profile.success_definition,
      urgency_flag: profile.urgency_flag,
    },
    tools: { existing_tools: profile.existing_tools ?? [] },
    budget: { budget_comfort: profile.budget_comfort },
    contact: {
      email: body.contact.email,
      first_name: body.contact.first_name,
      consent_marketing: body.contact.consent_marketing,
    },
  }

  // Update profiles row — mark submitted
  await supabase.from('profiles').update({
    session_status: 'submitted',
    contact_email: encryptedEmail,
    contact_first_name: body.contact.first_name,
    consent_marketing: body.contact.consent_marketing,
    raw_answers_json: profileJson,
  }).eq('profile_id', body.profile_id)

  // Fire n8n webhook (non-blocking — don't await, it has its own retry)
  fireN8nWebhook(profileJson).catch(console.error)

  // Send confirmation email via Resend
  await sendConfirmationEmail({
    to: body.contact.email,
    firstName: body.contact.first_name,
    language: body.language,
    industry: profile.industry ?? '',
    teamSize: profile.team_size ?? '',
    bottleneck: profile.bottleneck ?? '',
  })

  return NextResponse.json({ ok: true, profile_id: body.profile_id })
}

async function fireN8nWebhook(profileJson: object) {
  const url = process.env.N8N_WEBHOOK_URL!
  const secret = process.env.N8N_WEBHOOK_SECRET!

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': secret,
        },
        body: JSON.stringify(profileJson),
      })
      if (res.ok) return
    } catch {
      // exponential backoff: 1s, 2s, 4s
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
  }
  // Alert owner on final failure
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/alert`, {
    method: 'POST',
    body: JSON.stringify({ type: 'n8n_webhook_failed', profile_id: (profileJson as { profile_id: string }).profile_id }),
  })
}
```

### 6.5 `GET /api/pipeline-status?profile_id=` — Holding Page Polling

```typescript
// src/app/api/pipeline-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get('profile_id')
  if (!profileId) return NextResponse.json({ error: 'Missing profile_id' }, { status: 400 })

  const supabase = createServiceClient()

  const [{ data: profile }, { data: scrape }, { data: diagnosis }] = await Promise.all([
    supabase.from('profiles').select('session_status').eq('profile_id', profileId).single(),
    supabase.from('scrape_results').select('scrape_status').eq('profile_id', profileId).maybeSingle(),
    supabase.from('diagnoses').select('diagnosis_status, pdf_report_url').eq('profile_id', profileId).maybeSingle(),
  ])

  return NextResponse.json({
    submitted: profile?.session_status === 'submitted',
    scraped: !!scrape,
    analyzed: !!diagnosis,
    pdf_ready: !!diagnosis?.pdf_report_url,
    pdf_url: diagnosis?.pdf_report_url ?? null,
  })
}
```

### 6.6 `DELETE /api/gdpr-erase` — Right to Erasure

```typescript
// src/app/api/gdpr-erase/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Body = z.object({ profile_id: z.string().uuid() })

export async function DELETE(req: NextRequest) {
  const { profile_id } = Body.parse(await req.json())
  const supabase = createServiceClient()

  // CASCADE on FK deletes scrape_results + diagnoses automatically
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('profile_id', profile_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Remove PDF from storage
  await supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .remove([`${profile_id}/`])   // delete all files in this folder

  return NextResponse.json({ erased: true })
}
```

---

## 7. PII Encryption (`src/lib/crypto.ts`)

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const KEY = Buffer.from(process.env.SUPABASE_ENCRYPTION_KEY!, 'hex')  // 32 bytes = 64 hex chars
const ALGORITHM = 'aes-256-gcm'

export function encryptEmail(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv(12) + tag(16) + ciphertext — base64 encoded
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptEmail(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
```

Add `SUPABASE_ENCRYPTION_KEY` to env (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

---

## 8. Email Templates (`src/lib/email/resend.ts`)

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface ConfirmationParams {
  to: string
  firstName: string
  language: 'en' | 'es'
  industry: string
  teamSize: string
  bottleneck: string
}

export async function sendConfirmationEmail(params: ConfirmationParams) {
  const isEs = params.language === 'es'

  const subject = isEs
    ? `Tu Análisis ROBO AI Ha Comenzado — ${params.firstName}`
    : `Your ROBO AI Analysis Has Started — ${params.firstName}`

  const html = isEs
    ? confirmationHtmlEs(params)
    : confirmationHtmlEn(params)

  const text = isEs
    ? confirmationTextEs(params)
    : confirmationTextEn(params)

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject,
    html,
    text,
  })
}

function confirmationHtmlEn({ firstName, industry, teamSize, bottleneck }: ConfirmationParams) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'DM Sans', Arial, sans-serif; background: #0D1B2A; color: #ffffff; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
    .logo { color: #0EA5A0; font-size: 20px; font-weight: 700; margin-bottom: 32px; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { color: #CBD5E1; line-height: 1.6; margin-bottom: 16px; }
    .summary-card { background: #1E2D3D; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .summary-card dt { color: #0EA5A0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .summary-card dd { color: #ffffff; font-weight: 500; margin: 4px 0 16px 0; }
    .footer { margin-top: 40px; padding-top: 24px; border-top: 1px solid #1E2D3D; color: #64748B; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">ROBO AI Agency</div>
    <h1>Hi ${firstName}, your analysis has started.</h1>
    <p>We've received your business profile and our analysis engine is already at work. Here's a summary of what you shared:</p>
    <div class="summary-card">
      <dl>
        <dt>Industry</dt><dd>${industry}</dd>
        <dt>Team size</dt><dd>${teamSize}</dd>
        <dt>Biggest challenge</dt><dd>${bottleneck}</dd>
      </dl>
    </div>
    <p>Your tailored analysis will be ready within 24 hours. We'll email you a link to your personalised PDF report — no login required.</p>
    <p>If you have any questions in the meantime, just reply to this email.</p>
    <div class="footer">
      ROBO AI Agency · We analyse, demo, build and deploy AI solutions.<br>
      gerardoromero.ai · Confidential — prepared for ${firstName} only.
    </div>
  </div>
</body>
</html>`
}

function confirmationTextEn({ firstName, industry, teamSize, bottleneck }: ConfirmationParams) {
  return `Hi ${firstName},

Your ROBO AI analysis has started.

Here's what you shared:
- Industry: ${industry}
- Team size: ${teamSize}
- Biggest challenge: ${bottleneck}

Your tailored analysis will be ready within 24 hours. We'll email you a link to your personalised PDF report.

ROBO AI Agency
gerardoromero.ai`
}

// Mirror the above for ES:
function confirmationHtmlEs(params: ConfirmationParams) {
  // Same structure with Spanish copy
  return `<!-- ES version — same HTML, Spanish strings -->`
}

function confirmationTextEs({ firstName }: ConfirmationParams) {
  return `Hola ${firstName},\n\nTu análisis ROBO AI ha comenzado...`
}

// ─── PDF Delivery Email ───────────────────────────────────────────────────────

interface DeliveryParams {
  to: string
  firstName: string
  language: 'en' | 'es'
  pdfUrl: string
  pdfPassword: string
  profileId: string
}

export async function sendDeliveryEmail(params: DeliveryParams) {
  const isEs = params.language === 'es'

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: isEs
      ? `Tu Reporte ROBO AI Está Listo — ${params.firstName}`
      : `Your ROBO AI Report Is Ready — ${params.firstName}`,
    html: deliveryHtml(params, isEs),
    text: deliveryText(params, isEs),
  })
}

function deliveryHtml({ firstName, pdfUrl, pdfPassword, profileId }: DeliveryParams, isEs: boolean) {
  const heading = isEs ? `Tu reporte está listo, ${firstName}` : `Your report is ready, ${firstName}`
  const body = isEs
    ? 'Tu análisis personalizado está adjunto. Usa la contraseña de abajo para abrirlo.'
    : 'Your personalised analysis is ready. Use the password below to open it.'
  const ctaLabel = isEs ? 'Descargar mi reporte' : 'Download my report'
  const passLabel = isEs ? 'Contraseña del PDF' : 'PDF Password'
  const bookLabel = isEs ? 'Reserva tu sesión de revisión de 30 minutos' : 'Book your 30-minute walkthrough'

  return `
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; background:#0D1B2A; color:#fff; margin:0; padding:0; }
  .container { max-width:600px; margin:0 auto; padding:40px 24px; }
  .logo { color:#0EA5A0; font-size:20px; font-weight:700; margin-bottom:32px; }
  h1 { font-size:24px; margin-bottom:16px; }
  p { color:#CBD5E1; line-height:1.6; }
  .cta { display:inline-block; background:#0EA5A0; color:#fff; padding:14px 28px; border-radius:6px; text-decoration:none; font-weight:700; margin:24px 0; }
  .password-box { background:#1E2D3D; border-radius:8px; padding:16px 20px; margin:24px 0; }
  .password-box dt { color:#0EA5A0; font-size:12px; text-transform:uppercase; }
  .password-box dd { font-size:20px; font-weight:700; letter-spacing:0.1em; margin:8px 0 0; }
  .book { margin-top:24px; }
  .book a { color:#0EA5A0; }
  .footer { margin-top:40px; color:#64748B; font-size:12px; }
</style></head><body>
<div class="container">
  <div class="logo">ROBO AI Agency</div>
  <h1>${heading}</h1>
  <p>${body}</p>
  <a class="cta" href="${pdfUrl}">${ctaLabel}</a>
  <div class="password-box">
    <dl><dt>${passLabel}</dt><dd>${pdfPassword}</dd></dl>
  </div>
  <div class="book"><a href="${process.env.CALENDAR_BOOKING_URL}">${bookLabel} →</a></div>
  <div class="footer">Ref: ${profileId} · Confidential · ROBO AI Agency</div>
</div></body></html>`
}

function deliveryText({ pdfUrl, pdfPassword, profileId }: DeliveryParams, isEs: boolean) {
  return isEs
    ? `Tu reporte está listo.\n\nDescarga: ${pdfUrl}\nContraseña: ${pdfPassword}\n\nRef: ${profileId}`
    : `Your report is ready.\n\nDownload: ${pdfUrl}\nPassword: ${pdfPassword}\n\nRef: ${profileId}`
}
```

---

## 9. Master Analyzer Agent (`src/lib/anthropic/analyzer.ts`)

This is called by n8n via an HTTP request node pointing to a Next.js API route `/api/internal/analyze`.

```typescript
// src/lib/anthropic/analyzer.ts
import Anthropic from '@anthropic-ai/sdk'
import { PRODUCT_CATALOGUE } from '@/lib/product-catalogue'

const client = new Anthropic()

export async function runMasterAnalyzer(
  profile: Record<string, unknown>,
  scrapeResult: Record<string, unknown> | null
): Promise<{ json: Record<string, unknown>; isFormOnly: boolean }> {

  const isFormOnly = !scrapeResult || scrapeResult.scrape_status !== 'success'

  const systemPrompt = `You are the ROBO AI Agency Master Analyzer. Read the business profile (intake form) and scraped website summary, then produce a structured JSON diagnosis.

Rules:
- Cross-reference self-reported data with scraped website signals where available.
- Identify the 3 highest-impact pain points evidenced by BOTH sources where possible.
- Match 1–3 products from the provided catalogue (highest match_score first). NEVER hallucinate product names — use ONLY products from the catalogue.
- Generate an inefficiency_score (0–100) with reasoning grounded in the evidence.
- Estimate monthly hours saved and cost recovered — use conservative figures. Cite assumptions in financial_assumptions.
- Write pain_point_summary in 2–3 plain sentences, no jargon.
- Generate exactly 6–8 Q&A pairs for the client PDF. Questions from client perspective. Answers ≤80 words. Include source badge per pair.
- If industry from scrape ≠ self-reported industry (more than one taxonomy level apart), add to website_vs_form_conflicts.
- If running form-only (no scrape data), set data_source: "form_only" and note limitation in pain_point_summary.
- Return ONLY valid JSON. No preamble. No markdown fences.`

  const userMessage = `
BUSINESS PROFILE: ${JSON.stringify(profile, null, 2)}
WEBSITE DATA: ${scrapeResult ? JSON.stringify(scrapeResult, null, 2) : 'NOT AVAILABLE — analyse from form data only'}
PRODUCT CATALOGUE: ${JSON.stringify(PRODUCT_CATALOGUE, null, 2)}
`

  const attemptAnalysis = async (temperature: number) => {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    const text = (response.content[0] as { text: string }).text
    return JSON.parse(text)
  }

  // First attempt
  let parsed: Record<string, unknown>
  try {
    parsed = await attemptAnalysis(0.3)
  } catch {
    // Retry at lower temperature
    try {
      parsed = await attemptAnalysis(0.1)
    } catch {
      throw new Error('ANALYZER_FAILED')
    }
  }

  return { json: parsed, isFormOnly }
}
```

Create the internal API route that n8n calls:

```typescript
// src/app/api/internal/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runMasterAnalyzer } from '@/lib/anthropic/analyzer'
import { generatePdfReport } from '@/lib/pdf/generator'
import { sendDeliveryEmail } from '@/lib/email/resend'
import { decryptEmail } from '@/lib/crypto'
import { randomBytes } from 'crypto'
import { z } from 'zod'

const Body = z.object({
  profile_id: z.string().uuid(),
  secret: z.string(),  // n8n sends N8N_WEBHOOK_SECRET back for auth
})

export async function POST(req: NextRequest) {
  const { profile_id, secret } = Body.parse(await req.json())

  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const [{ data: profile }, { data: scrape }] = await Promise.all([
    supabase.from('profiles').select('*').eq('profile_id', profile_id).single(),
    supabase.from('scrape_results').select('*').eq('profile_id', profile_id).maybeSingle(),
  ])

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  let diagnosisStatus: 'complete' | 'partial' | 'failed' = 'complete'
  let diagnosisJson: Record<string, unknown>

  try {
    const { json, isFormOnly } = await runMasterAnalyzer(profile, scrape)
    diagnosisJson = json
    if (isFormOnly) diagnosisStatus = 'partial'
  } catch {
    diagnosisStatus = 'failed'
    // Alert owner
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/alert`, {
      method: 'POST',
      body: JSON.stringify({ type: 'analyzer_failed', profile_id }),
    })
    return NextResponse.json({ error: 'Analyzer failed' }, { status: 500 })
  }

  // Write diagnosis row
  const { data: diagnosis } = await supabase.from('diagnoses').insert({
    profile_id,
    analyzer_model: 'claude-sonnet-4-20250514',
    diagnosis_status: diagnosisStatus,
    pain_point_summary: diagnosisJson.pain_point_summary as string,
    inefficiency_score: diagnosisJson.inefficiency_score as number,
    top_pain_points: (diagnosisJson.top_pain_points as { pain: string }[]).map(p => p.pain),
    matched_products: diagnosisJson.matched_products,
    automation_opportunity: diagnosisJson.automation_opportunity as string,
    estimated_hours_saved: diagnosisJson.estimated_hours_saved as number,
    estimated_cost_recovered: diagnosisJson.estimated_cost_recovered as number,
    qa_pairs: diagnosisJson.qa_pairs,
    diagnosis_json_full: diagnosisJson,
  }).select('diagnosis_id').single()

  // Generate PDF
  const pdfPassword = randomBytes(4).toString('hex').toUpperCase()
  const pdfBytes = await generatePdfReport({
    profile,
    diagnosis: diagnosisJson,
    pdfPassword,
    isFormOnly: diagnosisStatus === 'partial',
  })

  // Upload to Supabase Storage
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const shortId = profile_id.split('-')[0]
  const filename = `ROBO_Analysis_${shortId}_${dateStr}.pdf`
  const storagePath = `${profile_id}/${filename}`

  await supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf' })

  const { data: signedUrl } = await supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 30)  // 30-day link

  // Update diagnosis with PDF URL
  await supabase.from('diagnoses').update({
    pdf_report_url: signedUrl?.signedUrl,
    pdf_generated_at: new Date().toISOString(),
  }).eq('diagnosis_id', diagnosis!.diagnosis_id)

  // Send delivery email
  const clientEmail = decryptEmail(profile.contact_email)
  await sendDeliveryEmail({
    to: clientEmail,
    firstName: profile.contact_first_name,
    language: profile.language as 'en' | 'es',
    pdfUrl: signedUrl!.signedUrl,
    pdfPassword,
    profileId: profile_id,
  })

  return NextResponse.json({ ok: true, diagnosis_id: diagnosis!.diagnosis_id })
}
```

---

## 10. PDF Generator (`src/lib/pdf/generator.ts`)

Use `pdf-lib`. Build an 8-section branded PDF.

```typescript
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

// Brand colours
const NAVY  = rgb(0.051, 0.106, 0.165)   // #0D1B2A
const TEAL  = rgb(0.055, 0.647, 0.627)   // #0EA5A0
const WHITE = rgb(1, 1, 1)
const GRAY  = rgb(0.796, 0.835, 0.886)   // #CBD5E1

interface GenerateParams {
  profile: Record<string, unknown>
  diagnosis: Record<string, unknown>
  pdfPassword: string
  isFormOnly: boolean
}

export async function generatePdfReport(params: GenerateParams): Promise<Uint8Array> {
  const { profile, diagnosis, pdfPassword, isFormOnly } = params

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const helvetica     = await doc.embedFont(StandardFonts.Helvetica)

  const W = 595.28  // A4 width in points
  const H = 841.89  // A4 height in points

  // ── SECTION 1: Cover page ──────────────────────────────────────────────────
  const cover = doc.addPage([W, H])
  cover.drawRectangle({ x: 0, y: 0, width: W, height: H, color: NAVY })

  // ROBO AI logo text
  cover.drawText('ROBO AI Agency', { x: 48, y: H - 80, font: helveticaBold, size: 22, color: TEAL })

  // Report title
  const firstName = profile.contact_first_name as string
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  cover.drawText(`Business Analysis Report`, { x: 48, y: H - 180, font: helveticaBold, size: 32, color: WHITE })
  cover.drawText(`Prepared for ${firstName}`, { x: 48, y: H - 225, font: helvetica, size: 16, color: GRAY })
  cover.drawText(dateStr, { x: 48, y: H - 255, font: helvetica, size: 14, color: GRAY })
  cover.drawText(`Ref: ${profile.profile_id}`, { x: 48, y: 48, font: helvetica, size: 10, color: GRAY })

  // ── SECTION 2: Executive Summary ──────────────────────────────────────────
  const summary = doc.addPage([W, H])
  summary.drawRectangle({ x: 0, y: 0, width: W, height: H, color: NAVY })

  const score = diagnosis.inefficiency_score as number
  summary.drawText('Executive Summary', { x: 48, y: H - 80, font: helveticaBold, size: 24, color: WHITE })

  // Inefficiency score gauge (simple text-based for now)
  summary.drawText(`Operational Inefficiency Score`, { x: 48, y: H - 140, font: helvetica, size: 12, color: TEAL })
  summary.drawText(`${score}/100`, { x: 48, y: H - 170, font: helveticaBold, size: 48, color: score > 60 ? rgb(1,0.4,0.4) : TEAL })

  // Pain point summary — wrap text
  const summaryText = diagnosis.pain_point_summary as string
  drawWrappedText(summary, summaryText, { x: 48, y: H - 260, font: helvetica, size: 13, color: GRAY, maxWidth: W - 96, lineHeight: 20 })

  if (isFormOnly) {
    summary.drawText('Note: Website analysis unavailable — report based on form data only.', {
      x: 48, y: H - 380, font: helvetica, size: 10, color: GRAY,
    })
  }

  // ── SECTION 3: Q&A pairs ──────────────────────────────────────────────────
  const qaPairs = diagnosis.qa_pairs as { question: string; answer: string; source: string }[]
  for (let i = 0; i < qaPairs.length; i += 2) {
    const page = doc.addPage([W, H])
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: NAVY })
    page.drawText('What We Found', { x: 48, y: H - 80, font: helveticaBold, size: 20, color: WHITE })

    let yOffset = H - 130
    const chunk = qaPairs.slice(i, i + 2)
    for (const pair of chunk) {
      page.drawText(pair.question, { x: 48, y: yOffset, font: helveticaBold, size: 13, color: TEAL })
      yOffset -= 22
      drawWrappedText(page, pair.answer, { x: 48, y: yOffset, font: helvetica, size: 12, color: GRAY, maxWidth: W - 96, lineHeight: 18 })
      const badgeLabel = sourceBadge(pair.source)
      page.drawText(badgeLabel, { x: 48, y: yOffset - 60, font: helvetica, size: 9, color: TEAL })
      yOffset -= 110
    }
  }

  // ── SECTION 4: Top 3 Pain Points ──────────────────────────────────────────
  const painPage = doc.addPage([W, H])
  painPage.drawRectangle({ x: 0, y: 0, width: W, height: H, color: NAVY })
  painPage.drawText('Your Top 3 Pain Points', { x: 48, y: H - 80, font: helveticaBold, size: 20, color: WHITE })

  const painPoints = diagnosis.top_pain_points as { rank: number; pain: string; evidence_source: string }[]
  let py = H - 140
  for (const pp of painPoints) {
    painPage.drawText(`${pp.rank}.`, { x: 48, y: py, font: helveticaBold, size: 14, color: TEAL })
    drawWrappedText(painPage, pp.pain, { x: 70, y: py, font: helvetica, size: 13, color: WHITE, maxWidth: W - 118, lineHeight: 18 })
    painPage.drawText(`Source: ${pp.evidence_source}`, { x: 70, y: py - 22, font: helvetica, size: 9, color: GRAY })
    py -= 80
  }

  // ── SECTION 5: Recommended Solutions ──────────────────────────────────────
  const productsPage = doc.addPage([W, H])
  productsPage.drawRectangle({ x: 0, y: 0, width: W, height: H, color: NAVY })
  productsPage.drawText('Recommended Solutions', { x: 48, y: H - 80, font: helveticaBold, size: 20, color: WHITE })

  const matched = diagnosis.matched_products as { product_name: string; match_score: number; rationale: string }[]
  let mpy = H - 140
  for (const product of matched) {
    productsPage.drawText(product.product_name, { x: 48, y: mpy, font: helveticaBold, size: 14, color: TEAL })
    productsPage.drawText(`Match: ${product.match_score}%`, { x: W - 120, y: mpy, font: helveticaBold, size: 12, color: WHITE })
    drawWrappedText(productsPage, product.rationale, { x: 48, y: mpy - 22, font: helvetica, size: 12, color: GRAY, maxWidth: W - 96, lineHeight: 18 })
    mpy -= 90
  }

  // ── SECTION 6: Financial Snapshot ─────────────────────────────────────────
  const finPage = doc.addPage([W, H])
  finPage.drawRectangle({ x: 0, y: 0, width: W, height: H, color: NAVY })
  finPage.drawText('Financial Snapshot', { x: 48, y: H - 80, font: helveticaBold, size: 20, color: WHITE })

  const hours = diagnosis.estimated_hours_saved as number
  const cost  = diagnosis.estimated_cost_recovered as number
  const assumptions = diagnosis.financial_assumptions as string

  finPage.drawText(`~${hours} hours/month saved`, { x: 48, y: H - 160, font: helveticaBold, size: 32, color: TEAL })
  finPage.drawText(`~$${cost.toLocaleString()}/month recovered`, { x: 48, y: H - 210, font: helveticaBold, size: 24, color: WHITE })
  finPage.drawText('Assumptions:', { x: 48, y: H - 280, font: helveticaBold, size: 11, color: GRAY })
  drawWrappedText(finPage, assumptions, { x: 48, y: H - 300, font: helvetica, size: 10, color: GRAY, maxWidth: W - 96, lineHeight: 16 })

  // ── SECTION 7: Next Steps (CTA) ────────────────────────────────────────────
  const ctaPage = doc.addPage([W, H])
  ctaPage.drawRectangle({ x: 0, y: 0, width: W, height: H, color: NAVY })
  ctaPage.drawText('What Happens Next?', { x: 48, y: H - 80, font: helveticaBold, size: 20, color: WHITE })
  ctaPage.drawText('Book your 30-minute walkthrough', { x: 48, y: H - 200, font: helveticaBold, size: 24, color: TEAL })
  ctaPage.drawText(process.env.CALENDAR_BOOKING_URL!, { x: 48, y: H - 240, font: helvetica, size: 14, color: GRAY })

  // ── SECTION 8: Footer on each page ────────────────────────────────────────
  const pages = doc.getPages()
  for (const page of pages) {
    page.drawText(`Confidential · ROBO AI Agency · gerardoromero.ai · Ref: ${profile.profile_id}`, {
      x: 48, y: 30, font: helvetica, size: 8, color: GRAY,
    })
  }

  // Encrypt PDF (read-only password)
  await doc.encrypt({
    ownerPassword: randomHex(16),
    userPassword: pdfPassword,
    permissions: {
      printing: 'lowResolution',
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
    },
  })

  return doc.save()
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; font: PDFFont; size: number; color: ReturnType<typeof rgb>; maxWidth: number; lineHeight: number }
) {
  const words = text.split(' ')
  let line = ''
  let y = opts.y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    const width = opts.font.widthOfTextAtSize(test, opts.size)
    if (width > opts.maxWidth && line) {
      page.drawText(line, { x: opts.x, y, font: opts.font, size: opts.size, color: opts.color })
      line = word
      y -= opts.lineHeight
    } else {
      line = test
    }
  }
  if (line) page.drawText(line, { x: opts.x, y, font: opts.font, size: opts.size, color: opts.color })
}

function sourceBadge(source: string): string {
  const map: Record<string, string> = {
    form: '● From your answers',
    scrape: '● From your website',
    both: '● Cross-referenced',
    inferred: '● Our analysis',
  }
  return map[source] ?? source
}

function randomHex(bytes: number): string {
  const { randomBytes } = require('crypto')
  return randomBytes(bytes).toString('hex')
}
```

---

## 11. Frontend — ConversationalForm Component

### 11.1 Design Tokens (Tailwind)

Add to `tailwind.config.ts`:

```typescript
theme: {
  extend: {
    colors: {
      navy: {
        DEFAULT: '#0D1B2A',
        800: '#1E2D3D',
        600: '#2D4460',
      },
      teal: {
        DEFAULT: '#0EA5A0',
        light: '#5EEAD4',
      },
    },
    fontFamily: {
      syne: ['Syne', 'sans-serif'],
      sans: ['DM Sans', 'sans-serif'],
    },
  },
},
```

Add to `src/app/layout.tsx` `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
```

### 11.2 `/analyse` Page

```typescript
// src/app/analyse/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },  // AC-noindex
}

export default function AnalyseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

```typescript
// src/app/analyse/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { ConversationalForm } from '@/components/form/ConversationalForm'
import { PipelineStatus } from '@/components/holding/PipelineStatus'

export default function AnalysePage() {
  const [profileId, setProfileId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [language, setLanguage] = useState<'en' | 'es'>('en')

  useEffect(() => {
    // Detect browser language
    const lang = navigator.language.startsWith('es') ? 'es' : 'en'
    setLanguage(lang)

    // Check for existing session in localStorage
    const stored = localStorage.getItem('robo_session')
    if (stored) {
      const { profileId: id, expiresAt } = JSON.parse(stored)
      if (new Date(expiresAt) > new Date()) {
        setProfileId(id)
        return
      }
    }

    // Create new session
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: lang,
        source_product_id: new URLSearchParams(window.location.search).get('product'),
      }),
    })
      .then(r => r.json())
      .then(({ profile_id }) => {
        setProfileId(profile_id)
        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
        localStorage.setItem('robo_session', JSON.stringify({ profileId: profile_id, expiresAt }))
      })
  }, [])

  if (!profileId) return <div className="min-h-screen bg-navy flex items-center justify-center"><div className="text-teal">Loading...</div></div>

  if (submitted) return <PipelineStatus profileId={profileId} language={language} />

  return (
    <ConversationalForm
      profileId={profileId}
      language={language}
      onLanguageChange={setLanguage}
      onSubmitted={() => setSubmitted(true)}
    />
  )
}
```

### 11.3 Core Form Component Structure

`ConversationalForm.tsx` — manages conversation state:

```typescript
// State shape:
type FormState = {
  messages: Message[]          // chat history rendered on screen
  answers: Record<string, unknown>  // { field: value }
  questionsShown: string[]     // Q-IDs in order shown
  currentQuestion: QuestionResponse | null
  isTyping: boolean
  canFinishEarly: boolean
  phase: 'form' | 'contact' | 'done'
}

// On mount: fetch first question from /api/next-question
// On each answer:
//   1. POST /api/answer { profile_id, field, value }
//   2. Add user bubble to messages
//   3. Show typing indicator (900–1300ms random delay)
//   4. POST /api/next-question with updated answers_so_far
//   5. Hide typing indicator, render new agent bubble + input
// On 8+ answers: show "Finish early" option above input
// On final submit: POST /api/submit-profile with contact info
```

`TypingIndicator.tsx`:
```tsx
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-navy-800 rounded-2xl rounded-bl-sm w-fit">
      {[0, 150, 300].map(delay => (
        <div
          key={delay}
          className="w-2 h-2 rounded-full bg-teal animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}
```

`ProgressDots.tsx`:
```tsx
// Props: total (10), current (0-based index), doneUpTo (index)
// Renders: filled teal dot (done), pulsing teal (active), dim (pending)
export function ProgressDots({ total, currentIndex }: { total: number; currentIndex: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-all ${
            i < currentIndex ? 'bg-teal' :
            i === currentIndex ? 'bg-teal ring-2 ring-teal/30 scale-125' :
            'bg-navy-600'
          }`}
        />
      ))}
    </div>
  )
}
```

`ChipSelect.tsx` — single select auto-advances on click:
```tsx
// On chip click: call onSelect(value) immediately — no confirm button
// Chips: bg-navy-800 border border-navy-600 hover:border-teal rounded-full px-4 py-2
// Selected: bg-teal text-navy font-semibold
```

`MultiChipSelect.tsx` — multi-select with Continue button:
```tsx
// Continue button only visible when selectedValues.length >= 1
// Button: bg-teal text-navy font-bold rounded-lg px-6 py-3
```

`FreeTextInput.tsx`:
```tsx
// Textarea: autoresize, max 5 rows, Enter key submits (Shift+Enter = newline)
// Send button visible alongside — click or Enter triggers onSubmit(value)
```

---

## 12. Holding Page Component (`src/components/holding/PipelineStatus.tsx`)

```typescript
'use client'
import { useEffect, useState } from 'react'

type Status = {
  submitted: boolean
  scraped: boolean
  analyzed: boolean
  pdf_ready: boolean
  pdf_url: string | null
}

const STAGES_EN = [
  'Submission received',
  'Analysing your website',
  'Running AI diagnosis',
  'Preparing your report',
]
const STAGES_ES = [
  'Solicitud recibida',
  'Analizando tu sitio web',
  'Ejecutando diagnóstico IA',
  'Preparando tu reporte',
]

export function PipelineStatus({ profileId, language }: { profileId: string; language: 'en' | 'es' }) {
  const [status, setStatus] = useState<Status | null>(null)
  const stages = language === 'es' ? STAGES_ES : STAGES_EN

  useEffect(() => {
    const poll = async () => {
      const res = await fetch(`/api/pipeline-status?profile_id=${profileId}`)
      const data = await res.json()
      setStatus(data)
      if (!data.pdf_ready) setTimeout(poll, 8000)  // poll every 8s
    }
    poll()
  }, [profileId])

  const activeStage = !status ? 0
    : status.pdf_ready ? 4
    : status.analyzed ? 3
    : status.scraped ? 2
    : 1

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-white text-2xl font-bold mb-8">
          {language === 'es' ? 'Tu análisis está en proceso' : 'Your analysis is underway'}
        </h1>
        <div className="space-y-4 mb-10">
          {stages.map((label, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className={`w-6 h-6 rounded-full flex-shrink-0 ${i < activeStage ? 'bg-teal' : i === activeStage ? 'bg-teal animate-pulse' : 'bg-navy-800'}`} />
              <span className={`text-left ${i <= activeStage ? 'text-white' : 'text-gray-600'}`}>{label}</span>
            </div>
          ))}
        </div>
        {status?.pdf_ready && status.pdf_url && (
          <a
            href={status.pdf_url}
            className="inline-block bg-teal text-navy font-bold rounded-lg px-8 py-4 text-lg"
          >
            {language === 'es' ? 'Descargar mi reporte' : 'Download my report'}
          </a>
        )}
      </div>
    </div>
  )
}
```

---

## 13. n8n Workflow Configuration

Set up in n8n dashboard. Three workflows:

### Workflow 1: Post-Submit Pipeline

**Trigger:** Webhook — receives POST from `/api/submit-profile`

**Nodes in sequence:**
1. **Webhook** — receives `profile_id`, validates `X-Webhook-Secret` header
2. **Wait 5s** (let confirmation email send first)
3. **HTTP Request** — POST to `https://ba-002-scraper/scrape` with `{ profile_id, website_url }`
4. **Poll** — every 30s, GET Supabase `scrape_results` for `profile_id`, exit when row exists (or 5-min timeout)
5. **HTTP Request** — POST `{APP_URL}/api/internal/analyze` with `{ profile_id, secret: N8N_WEBHOOK_SECRET }`
6. **Error handler** — if any node fails: send owner alert email via Resend

### Workflow 2: Session Expiry Check

**Trigger:** Schedule — every hour (set in Supabase cron per Section 2.5)

### Workflow 3: Raw Field Purge

**Trigger:** Schedule — daily 02:00 UTC (set in Supabase cron per Section 2.4)

---

## 14. i18n Strings

```typescript
// src/i18n/en.ts
export const en = {
  form: {
    resumePrompt: (q: number) => `You left off at question ${q} — pick up where you left?`,
    finishEarly: 'Finish here',
    continueBtn: 'Continue',
    sendBtn: 'Send',
    contactHeading: 'Last step — where should we send your report?',
    emailLabel: 'Your email address',
    nameLabel: 'Your first name',
    consentLabel: 'I agree to receive marketing communications from ROBO AI Agency',
    submitBtn: 'Get my free analysis',
  },
  pipeline: {
    heading: 'Your analysis is underway',
    stages: ['Submission received', 'Analysing your website', 'Running AI diagnosis', 'Preparing your report'],
    ready: 'Your report is ready',
    downloadBtn: 'Download my report',
    bookBtn: 'Book your 30-minute walkthrough',
  },
}

// src/i18n/es.ts — mirror with es-MX strings
export const es = {
  form: {
    resumePrompt: (q: number) => `Te quedaste en la pregunta ${q} — ¿continuamos donde lo dejaste?`,
    finishEarly: 'Terminar aquí',
    continueBtn: 'Continuar',
    sendBtn: 'Enviar',
    contactHeading: 'Último paso — ¿dónde enviamos tu reporte?',
    emailLabel: 'Tu correo electrónico',
    nameLabel: 'Tu nombre',
    consentLabel: 'Acepto recibir comunicaciones de marketing de ROBO AI Agency',
    submitBtn: 'Obtener mi análisis gratuito',
  },
  pipeline: {
    heading: 'Tu análisis está en proceso',
    stages: ['Solicitud recibida', 'Analizando tu sitio web', 'Ejecutando diagnóstico IA', 'Preparando tu reporte'],
    ready: 'Tu reporte está listo',
    downloadBtn: 'Descargar mi reporte',
    bookBtn: 'Reserva tu sesión de revisión de 30 minutos',
  },
}
```

---

## 15. Sandbox (`public/sandbox/intake-form.html`)

Build this as a completely self-contained single HTML file. No build step. No imports from the Next.js app.

**Required features (SB-01 through SB-08):**

```
- All 10 questions: Q-01 through Q-10 (skip Q-11 and Q-12 are optional, include Q-12)
- Scripted question sequence in JS (no API calls)
- Three input types:
    chip-single: click → auto-advance (no button)
    chip-multi: checkboxes → "Continue" button visible when ≥1 selected
    free-text: textarea, Enter key or "Send" button submits
- Follow-up questions personalise text using prior answers:
    Q-04 text includes {industry} from Q-01
    Q-05 text includes {team_size} from Q-02
    Q-08 text includes {industry} from Q-01
- Agent message bubbles on left (teal avatar circle with "R")
- User answer bubbles on right (navy-800 background)
- Typing indicator: 3-dot bounce CSS animation, 900–1300ms random delay before each Q
- Progress dot track at top: 10 dots, done=teal, active=pulsing teal, pending=dim
- Completion screen:
    Shows formatted JSON block matching BA-001 output schema
    profile_id: crypto.randomUUID() or manual UUID generation
    timestamp: new Date().toISOString()
    All collected field values populated
    "Start over" button resets ALL state, re-renders Q-01
- Colors: background #0D1B2A, accent #0EA5A0, text white/#CBD5E1
- Fonts: Google Fonts — Syne (headings) + DM Sans (body)
- No external JS libraries — vanilla only
- Keyboard accessible: Enter submits text fields
- sr-only <h2> for screen readers
```

---

## 16. Validation Schemas (`src/lib/validations.ts`)

```typescript
import { z } from 'zod'

export const ProfileSubmitSchema = z.object({
  profile_id: z.string().uuid(),
  contact: z.object({
    email: z.string().email('Valid email required'),
    first_name: z.string().min(1).max(100),
    consent_marketing: z.boolean(),
  }),
  language: z.enum(['en', 'es']),
})

export const AnswerSchema = z.object({
  profile_id: z.string().uuid(),
  field: z.enum([
    'industry','team_size','revenue_range','top_time_cost','existing_tools',
    'bottleneck','budget_comfort','success_definition','data_situation',
    'urgency_flag','prior_ai_experience','website_url',
  ]),
  value: z.unknown(),
})
```

---

## 17. Plausible Analytics

No cookies, no consent banner required. Add to `src/app/layout.tsx`:

```tsx
<script
  defer
  data-domain="roboai.agency"
  src="https://plausible.io/js/script.js"
/>
```

Track key events:
```typescript
// In ConversationalForm.tsx — track funnel steps
// window.plausible is injected by the Plausible script
declare const plausible: (event: string, opts?: { props: Record<string, string> }) => void

plausible('Form Started', { props: { language } })
plausible('Form Submitted', { props: { questions_answered: String(count) } })
```

---

## 18. Security Checklist (verify before deploy)

- [ ] `SUPABASE_SERVICE_ROLE_KEY` never appears in client bundle — run `grep -r "service_role" .next/static` → must be empty
- [ ] `ANTHROPIC_API_KEY` never in client bundle — same grep test
- [ ] All `/api/internal/*` routes verify `N8N_WEBHOOK_SECRET` header before processing
- [ ] Supabase RLS: `curl https://YOUR_PROJECT.supabase.co/rest/v1/profiles -H "apikey: ANON_KEY"` returns 0 rows
- [ ] `/analyse` page has `<meta name="robots" content="noindex, nofollow">`
- [ ] PDF signed URLs use `createSignedUrl` with expiry — not public URLs
- [ ] `contact_email` stored encrypted — verify raw value in DB is not plaintext

---

## 19. Deployment

### Vercel (preferred)

```bash
npm install -g vercel
vercel --prod
```

Set all environment variables in Vercel dashboard → Project Settings → Environment Variables.

Add to `vercel.json`:
```json
{
  "functions": {
    "src/app/api/internal/analyze/route.ts": {
      "maxDuration": 60
    }
  }
}
```

The `/api/internal/analyze` route needs 60s because it runs the Analyzer (45s timeout) + PDF generation + upload.

### Test deploy checklist

```bash
# 1. TypeScript
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. Build
npm run build

# 4. Security
grep -r "ANTHROPIC_API_KEY\|service_role" .next/static  # must return nothing
```

---

## 20. Test Coverage Map

| Test ID | What to test | How |
|---------|-------------|-----|
| T-02 | Chip auto-advances | Playwright: click chip → assert next Q visible within 400ms |
| T-03 | Enter key submits | Playwright: type in textarea + press Enter → assert next Q rendered |
| T-04 | Multi-select continue | Playwright: select ≥1 chip → assert button visible, click → assert array in state |
| T-05 | Follow-up personalisation | Unit: call next-question API with industry='logistics' → assert Q-04 text contains 'logistics' |
| T-07 | DB submit writes all columns | Integration: submit profile → query DB → assert session_status='submitted' |
| T-08 | Session resume | Integration: stop at Q-4, reload page, assert prior answers pre-filled |
| T-09 | GDPR erasure | Integration: call erase API → query profiles/scrape_results/diagnoses → all empty |
| T-10 | Analyzer happy path | Integration: call /api/internal/analyze → diagnoses row present, score 0-100 |
| T-18 | RLS client access | curl anon key → assert 401 |
| T-19 | Anthropic key not exposed | grep .next/static for key |
| T-20 | Sandbox 10 Qs sequence | Open sandbox.html in browser, complete all Qs, verify each one appears one at a time |
| T-21 | Sandbox JSON schema valid | On completion screen, parse JSON, assert profile_id and all required fields present |
| T-22 | Sandbox restart | Click restart → Q-01 shown, dot track reset, no prior answers |

---

*BA-001 · Build Instructions v1.0 · ROBO AI Agency · May 2026*
*Source: BA-001_PDR_v1.2_Business_Intake_Form.md*
