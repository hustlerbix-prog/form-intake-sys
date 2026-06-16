# BA-001 — Business Intake Form
### Product Design Requirements · v1.2 · Consolidated Specification
**ROBO AI Agency** · *We analyse, demo, build and deploy AI solutions.*

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| v1.0 | May 2026 | Initial PDR — intake form, AC, NFR, test cases, sprint plan | Gerardo Romero |
| v1.1 | May 2026 | Added: DB persistence layer, Master Analyzer Agent, PDF Q&A Report Generator | Gerardo Romero |
| **v1.2** | **May 2026** | **Added: Sandbox Interactive Form — fully functional HTML/JS prototype. Platform positioned as first module of integrated AI agency system.** | **Gerardo Romero** |

---

## Document Metadata

| Field | Value |
|-------|-------|
| Epic | Business Analyser Bundle (BA-series) |
| Sprint | Sprint 1 + Sprint 2 |
| Story Points | 13 pts (8 form + 5 analyzer/report) |
| Status | v1.2 — Consolidated · Ready for Development |
| Owner | Gerardo Romero · CISA |
| Feeds | BA-002 (Website Scraper) · BA-003 (Proposal Generator) |
| Languages | English · Spanish (LatAm) · launch |
| Platform scope | ROBO AI Agency — first module of integrated AI agency system |
| Document type | PDR — Product Design Requirements |

---

## Table of Contents

1. [Strategic Context & Platform Positioning](#1-strategic-context--platform-positioning)
2. [User Story & Bundle Overview](#2-user-story--bundle-overview)
3. [Acceptance Criteria](#3-acceptance-criteria)
4. [Functional Requirements — Conversational Form](#4-functional-requirements--conversational-form)
5. [Functional Requirements — Database Persistence Layer](#5-functional-requirements--database-persistence-layer)
6. [Functional Requirements — Master Analyzer Agent](#6-functional-requirements--master-analyzer-agent)
7. [Functional Requirements — PDF Q&A Report Generator](#7-functional-requirements--pdf-qa-report-generator)
8. [Sandbox Interactive Form — v1.2 Specification](#8-sandbox-interactive-form--v12-specification)
9. [Complete System Data Flow](#9-complete-system-data-flow)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Tech Stack](#11-tech-stack)
12. [Test Cases](#12-test-cases)
13. [Sprint Build Timeline](#13-sprint-build-timeline)
14. [Open Questions & Decisions](#14-open-questions--decisions)

---

## 1. Strategic Context & Platform Positioning

ROBO AI Agency is a senior AI automation practice with Big Four GRC credentials. The agency analyses, demos, builds, and deploys real AI systems for SMBs. BA-001 is the commercial entry gate — the moment a curious visitor becomes a qualified, structured client record.

**v1.2 scope expansion.** This PDR now frames BA-001 as the first deployed module of a broader integrated AI agency platform that will eventually provide automated products and consultancy AI services end-to-end. The sandbox interactive form delivered in v1.2 is the first functional artefact of that platform, demonstrating the full conversation experience in a browser with no backend dependency.

| Platform Layer | Component | BA-001 Role | Status |
|----------------|-----------|-------------|--------|
| Client Acquisition | Conversational intake form | Entry point — collects all signals | v1.2 sandbox live |
| Data Infrastructure | Supabase DB (3 tables) | Persists all profile + enrichment data | Specified v1.1 |
| Intelligence | Master Analyzer Agent (Claude) | Diagnoses operations from form + website | Specified v1.1 |
| Automated Products | BA-002 Website Scraper | Enriches profile with public data | Dependency |
| Automated Products | BA-003 Proposal Generator | Produces tailored PDF solution proposal | Dependency |
| Client Deliverable | PDF Q&A Report | First tangible output client receives | Specified v1.1 |
| Consultancy Services | Human escalation layer | Gerardo review + walkthrough booking | Phase 2 |
| Automated Products | 12 product catalogue (IS/CS/PL) | Matched by Analyzer to client profile | Phase 2 |

> Every data point captured by BA-001 directly determines the quality of every downstream action in the platform. This form is not a lead-gen widget — it is the intelligence layer that makes automated consultancy possible.

---

## 2. User Story & Bundle Overview

> *"As a prospective client, I want to fill in a guided conversational form about my business so that the platform understands my operations, pain points, and goals — without me having to write a brief from scratch."*

### Five-stage automated pipeline

| Stage | Story ID | Component | Input | Output | Trigger |
|-------|----------|-----------|-------|--------|---------|
| 1 | BA-001 | Business Intake Form (UI) | User answers | JSON profile + DB write | User submits |
| 2 | BA-001 DB | Database Persistence Layer | JSON profile | Rows in Supabase | Auto on submit |
| 3 | BA-002 | Website Scraper Agent | `website_url` | Scraped content JSON | n8n post-submit |
| 4 | BA-001 MA | Master Analyzer Agent | DB + scraped data | Diagnosis JSON | n8n post-scrape |
| 5 | BA-001 PDF | PDF Q&A Report Generator | Diagnosis JSON | Client PDF report | Auto post-analyze |

---

## 3. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| **AC-01** | Form is conversational and AI-guided — each answer dynamically shapes the next question. No static, linear question list is acceptable. The AI model evaluates prior answers before generating the next prompt. |
| **AC-02** | Covers 8 to 12 questions across: industry vertical, team size, biggest time costs, existing tools, monthly revenue range, biggest operational bottleneck, and budget comfort level. |
| **AC-03** | Completable in under 15 minutes. Progress auto-saved at each step so the client can close and resume without data loss. |
| **AC-04** | On submission, a structured JSON business profile is automatically posted to the BA-002/BA-003 pipeline via n8n webhook. No manual step required. |
| **AC-05** | Client receives a confirmation email within 60 seconds of submission summarising what was shared and explaining next steps. |
| **AC-06** | Available in English and Spanish (LatAm) from day-one launch. Language auto-detected from browser locale with a manual toggle. |
| **AC-07** | All form data persisted to Supabase database in real time. Partial sessions recoverable. Data available immediately to Master Analyzer Agent. |
| **AC-08** | Master Analyzer Agent produces a structured diagnosis JSON by cross-referencing DB profile with scraped website data within 45 seconds of trigger. |
| **AC-09** | PDF Q&A Report generated from diagnosis data and delivered to client email within 30 minutes of form submission. |
| **AC-10** | Sandbox interactive form (HTML/JS prototype) accurately reflects the full conversation flow, all 10 questions, and produces a valid JSON output — deployable for demos and stakeholder review without a live backend. |

---

## 4. Functional Requirements — Conversational Form

### 4.1 AI-Guided Flow Engine

Powered by Anthropic API (`claude-sonnet-4-20250514`). Evaluates cumulative answers in real time to select the most contextually appropriate next question from the master bank.

- Maintain a running JSON state object updated after each answer submission.
- Select next question from the master bank based on collected data and remaining gaps — no static sequence.
- Branch intelligently: e.g. if user reports no existing tools, skip the tool-detail follow-up.
- Detect minimum viable profile (8 answers) and surface an early-completion option.
- Never repeat a question already answered in the current session.
- Handle short or ambiguous answers with a single clarifying follow-up before advancing.
- Personify answers in subsequent questions — use the client's industry, team size, and stated bottleneck by name.

### 4.2 Question Bank — 12-Question Master Set

The AI engine selects 8–12 questions per session. All questions available in English and Spanish.

| Q# | Domain | Question (EN) | Output Field | Input Type |
|----|--------|---------------|--------------|------------|
| Q-01 | Industry | What industry or sector does your business operate in? | `industry` | Chip select |
| Q-02 | Scale | How many people work in your business full-time? | `team_size` | Chip select |
| Q-03 | Revenue | What is your approximate monthly revenue range? | `revenue_range` | Chip select |
| Q-04 | Time Cost | What task or process takes the most time in your week? | `top_time_cost` | Free text |
| Q-05 | Tools | What software tools does your team use today? | `existing_tools` | Multi-select chips |
| Q-06 | Bottleneck | What is your single biggest operational bottleneck right now? | `bottleneck` | Free text |
| Q-07 | Budget | What monthly budget range feels comfortable for an AI solution? | `budget_comfort` | Chip select |
| Q-08 | Goals | What would success look like 6 months from now? | `success_definition` | Free text |
| Q-09 | Data | Do you have data or reports you currently manage manually? | `data_situation` | Free text |
| Q-10 | Urgency | Is there a deadline or event driving this need? | `urgency_flag` | Free text |
| Q-11 | Prior AI | Have you tried any AI tools or automation before? | `prior_ai_experience` | Chip select |
| Q-12 | Website | What is your business website URL? | `website_url` | Free text |

### 4.3 Output JSON Schema

Constructed on form completion and posted to n8n webhook. Also written to Supabase `profiles` table simultaneously.

```json
{
  "profile_id":        "uuid-v4",
  "created_at":        "ISO-8601 timestamp",
  "language":          "en | es",
  "source_product_id": "IS-01 | null",
  "business": {
    "industry":        "string",
    "team_size":       "'1' | '2-5' | '6-20' | '21-50' | '50+'",
    "revenue_range":   "'<10k' | '10-50k' | '50-200k' | '200k+' | null",
    "website_url":     "string | null"
  },
  "pain_points": {
    "top_time_cost":       "string",
    "bottleneck":          "string",
    "data_situation":      "string | null",
    "prior_ai_experience": "boolean | null"
  },
  "goals": {
    "success_definition": "string",
    "urgency_flag":       "string | null"
  },
  "tools": {
    "existing_tools": ["string"]
  },
  "budget": {
    "budget_comfort": "'<500' | '500-2k' | '2k-5k' | '5k+'"
  },
  "contact": {
    "email":             "string",
    "first_name":        "string",
    "consent_marketing": "boolean"
  }
}
```

### 4.4 Session Persistence

- `localStorage` sync after every answered question (client-side, zero-latency).
- Session ID generated on first load; linked to partial Supabase profile row.
- Resume prompt on return: *"You left off at question 4 — pick up where you left?"*
- Sessions expire after 72 hours of inactivity; partial data purged automatically.
- Resumed sessions show prior answers read-only with a per-field edit icon.

### 4.5 Confirmation Email

- **Subject (EN):** `Your ROBO AI Analysis Has Started — [First Name]`
- **Subject (ES):** `Tu Análisis ROBO AI Ha Comenzado — [Nombre]`
- Body: plain-language summary of industry, team size, top bottleneck — not raw field names.
- Timeline statement: *"Your tailored analysis will be ready within 24 hours."*
- No upsell links, no partner mentions, no sales language.
- Sent via Resend API within 60 seconds of webhook receipt.
- HTML template in ROBO AI brand colours; plain-text fallback required.

---

## 5. Functional Requirements — Database Persistence Layer

Supabase (Postgres + RLS) is the single source of truth for all pipeline stages. Three tables are required. All writes are server-side only — no client-side DB access.

### 5.1 Table: `profiles` (written by BA-001)

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `profile_id` | uuid | NN | PK · generated on form start |
| `created_at` | timestamptz | NN | Auto-set on INSERT |
| `updated_at` | timestamptz | NN | Auto-updated on any change |
| `language` | varchar(5) | NN | `'en'` \| `'es'` |
| `source_product_id` | varchar(20) | NULL | Pre-tagged from `?product=` param |
| `session_status` | varchar(20) | NN | `'in_progress'` \| `'submitted'` \| `'expired'` |
| `industry` | text | NULL | Q-01 |
| `team_size` | varchar(20) | NULL | Q-02 · enum |
| `revenue_range` | varchar(20) | NULL | Q-03 · enum |
| `top_time_cost` | text | NULL | Q-04 |
| `existing_tools` | text[] | NULL | Q-05 · array |
| `bottleneck` | text | NULL | Q-06 |
| `budget_comfort` | varchar(20) | NULL | Q-07 · enum |
| `success_definition` | text | NULL | Q-08 |
| `data_situation` | text | NULL | Q-09 |
| `urgency_flag` | text | NULL | Q-10 |
| `prior_ai_experience` | boolean | NULL | Q-11 |
| `website_url` | text | NULL | Q-12 |
| `contact_email` | text (AES-256) | NN | Encrypted via pgcrypto |
| `contact_first_name` | text | NN | Plain text |
| `consent_marketing` | boolean | NN | GDPR flag |
| `questions_answered` | integer | NN | Running count 0–12 |
| `raw_answers_json` | jsonb | NULL | Full audit record · purged after 30 days |

### 5.2 Table: `scrape_results` (written by BA-002)

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `scrape_id` | uuid | NN | PK |
| `profile_id` | uuid | NN | FK → `profiles.profile_id` |
| `scraped_at` | timestamptz | NN | Completion timestamp |
| `scrape_status` | varchar(20) | NN | `'success'` \| `'failed'` \| `'blocked'` \| `'timeout'` |
| `page_title` | text | NULL | `<title>` tag |
| `meta_description` | text | NULL | `<meta description>` |
| `detected_industry` | text | NULL | AI-inferred from content |
| `services_detected` | text[] | NULL | Services/products found |
| `tech_stack_detected` | text[] | NULL | CMS, e-commerce, analytics, etc. |
| `social_links` | jsonb | NULL | platform → URL dict |
| `content_summary` | text | NULL | 300-word AI summary of site purpose |
| `raw_html_snapshot` | text | NULL | First 50 000 chars · audit only |
| `error_message` | text | NULL | Populated if status ≠ `'success'` |

### 5.3 Table: `diagnoses` (written by Master Analyzer)

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `diagnosis_id` | uuid | NN | PK |
| `profile_id` | uuid | NN | FK → `profiles.profile_id` |
| `generated_at` | timestamptz | NN | Analyzer completion timestamp |
| `analyzer_model` | varchar(50) | NN | e.g. `'claude-sonnet-4-20250514'` |
| `diagnosis_status` | varchar(20) | NN | `'complete'` \| `'partial'` \| `'failed'` |
| `pain_point_summary` | text | NN | 2–3 sentence plain-language summary |
| `inefficiency_score` | integer | NN | 0–100 operational inefficiency score |
| `top_pain_points` | text[] | NN | Ranked list of 3 pain points |
| `matched_products` | jsonb | NN | `[{product_id, match_score, rationale}]` |
| `automation_opportunity` | text | NULL | Specific workflow flagged |
| `estimated_hours_saved` | integer | NULL | Monthly hours saved (conservative) |
| `estimated_cost_recovered` | integer | NULL | Monthly $ recovered |
| `qa_pairs` | jsonb | NN | `[{question, answer, source}]` · 6–8 pairs |
| `diagnosis_json_full` | jsonb | NN | Complete analyzer output |
| `pdf_report_url` | text | NULL | Signed storage URL once rendered |
| `pdf_generated_at` | timestamptz | NULL | PDF creation timestamp |

### 5.4 Write Strategy

| Event | Table | Operation | Trigger |
|-------|-------|-----------|---------|
| User starts form | `profiles` | INSERT `status='in_progress'` | Q-01 render |
| User answers each Q | `profiles` | UPDATE column + `questions_answered++` | Each submit |
| User submits form | `profiles` | UPDATE `status='submitted'` + JSON | Final step |
| BA-002 completes | `scrape_results` | INSERT full scrape row | n8n after BA-001 |
| Analyzer completes | `diagnoses` | INSERT full diagnosis row | n8n after BA-002 |
| PDF generated | `diagnoses` | UPDATE `pdf_report_url` + `pdf_generated_at` | Post PDF upload |
| Session expires 72h | `profiles` | UPDATE `status='expired'` | n8n scheduled job |

### 5.5 Privacy & Security Rules

- PII (`contact_email`) encrypted at rest via pgcrypto AES-256 inside Supabase.
- `raw_html_snapshot` and `raw_answers_json` auto-purged after 30 days.
- GDPR right-to-erasure: DELETE profile + CASCADE to all child tables; PDF removed from storage within 48 h.
- Row-level security (RLS) enabled on all tables — service role and admin role only; no client direct access.
- All reads/writes route through server-side Next.js API routes; no Supabase client key ever exposed to browser.

---

## 6. Functional Requirements — Master Analyzer Agent

The Master Analyzer is an n8n-orchestrated AI agent that fires after BA-002 completes. It reads the full business profile from `profiles` and scraped data from `scrape_results`, cross-references both, and produces a structured diagnosis written to `diagnoses` — which immediately triggers PDF generation.

### 6.1 Inputs

| Input Source | Table / Field | What It Provides |
|--------------|---------------|-----------------|
| Form answers | `profiles` — Q-01 through Q-12 columns | Industry, pain points, tools, budget, goals, urgency |
| Website scrape | `scrape_results.content_summary` | Plain-language summary of what the business does publicly |
| Website scrape | `scrape_results.services_detected` | Services/products — may differ from self-reported industry |
| Website scrape | `scrape_results.tech_stack_detected` | Existing technology stack — informs integration complexity |
| Website scrape | `scrape_results.detected_industry` | Cross-check against self-reported industry |
| Product catalogue | Static JSON (12 products) | Available ROBO AI solutions to match against profile |
| Pricing reference | Static pricing config | Monthly cost per product for financial projection |

### 6.2 Prompt Architecture

Single API call to `claude-sonnet-4-20250514`. Structured system + user message. Model returns only valid JSON — no preamble, no markdown fences.

```
SYSTEM:
You are the ROBO AI Agency Master Analyzer. Read the business profile
(intake form) and scraped website summary, then produce a structured JSON
diagnosis. Rules:
- Cross-reference self-reported data with scraped website signals
- Identify the 3 highest-impact pain points evidenced by BOTH sources where possible
- Match 1–3 products from the provided catalogue (highest match score first)
- Generate an inefficiency_score (0–100) with clear reasoning
- Estimate monthly hours saved and cost recovered (conservative, cite assumptions)
- Write plain-language pain_point_summary (2–3 sentences, no jargon)
- Generate exactly 6–8 Q&A pairs for the client PDF report
- NEVER hallucinate product names — use only products from the provided catalogue
Return ONLY valid JSON. No preamble. No markdown.

USER MESSAGE:
BUSINESS PROFILE:  { ...profiles row as JSON... }
WEBSITE DATA:      { ...scrape_results row as JSON... }
PRODUCT CATALOGUE: [ ...12 products... ]
```

### 6.3 Analyzer Output Schema (`diagnoses.diagnosis_json_full`)

```json
{
  "diagnosis_id":             "uuid-v4",
  "profile_id":               "uuid-v4",
  "generated_at":             "ISO-8601",
  "inefficiency_score":       75,
  "pain_point_summary":       "2–3 sentence plain-language summary",
  "top_pain_points": [
    { "rank": 1, "pain": "string", "evidence_source": "form|scrape|both" },
    { "rank": 2, "pain": "string", "evidence_source": "form|scrape|both" },
    { "rank": 3, "pain": "string", "evidence_source": "form|scrape|both" }
  ],
  "matched_products": [
    {
      "product_id":   "IS-01",
      "product_name": "string",
      "match_score":  88,
      "rationale":    "string"
    }
  ],
  "automation_opportunity":    "Specific identified workflow",
  "estimated_hours_saved":     40,
  "estimated_cost_recovered":  3200,
  "financial_assumptions":     "One sentence per assumption",
  "website_vs_form_conflicts": ["string — note any self-reported vs scraped mismatch"],
  "qa_pairs": [
    { "question": "string", "answer": "string", "source": "form|scrape|both|inferred" }
  ]
}
```

### 6.4 Operational Rules & Fallbacks

- Fires only after `scrape_results` row exists for the `profile_id` — n8n polls with 5-minute timeout.
- If `scrape_status = 'failed'` or `'blocked'`: Analyzer runs on form data only; marks `data_source = 'form_only'`.
- Invalid JSON response: retry once at temperature `0.1`. If second attempt fails: `diagnosis_status = 'failed'`, owner alert sent.
- Timeout at 45 seconds. Partial output saved; flagged for manual review. Owner notified.
- Estimated figures must cite assumptions in `financial_assumptions` — no fabrication without evidential basis.
- Product matching constrained to catalogue JSON only — hallucinated product names are a critical failure.
- If scraped industry ≠ self-reported industry by more than one taxonomy level, flag in `website_vs_form_conflicts`.

---

## 7. Functional Requirements — PDF Q&A Report Generator

A branded, client-facing PDF generated automatically after the Master Analyzer writes its diagnosis. It presents findings as answered questions — in the client's language, grounded in their specific data, and ending with matched product recommendations and a single CTA.

### 7.1 Report Page Structure

| Section | Content | Data Source |
|---------|---------|-------------|
| Cover | Client name, date, ROBO AI branding, report reference ID | `profiles` + `diagnoses.generated_at` |
| Executive Summary | `inefficiency_score` as visual gauge; `pain_point_summary` in large type | `diagnoses` |
| What We Found — Q&A | 6–8 question–answer pairs, one section each, with evidence source badge | `diagnoses.qa_pairs` |
| Your Top 3 Pain Points | Ranked pain points with evidence source labels | `diagnoses.top_pain_points` |
| Recommended Solutions | 1–3 matched products: name, match score, one-line rationale, pricing | `diagnoses.matched_products` |
| Financial Snapshot | Est. hours/month saved + cost recovered + assumptions footnote | `diagnoses` financial fields |
| Next Steps | Single CTA: *"Book your 30-minute walkthrough"* → calendar link | Static copy |
| Footer | Confidentiality notice, agency contact, `profile_id` for reference | `profiles.profile_id` |

### 7.2 Q&A Content Rules

- Exactly 6–8 pairs per report — generated by Analyzer, not templated.
- Questions framed from client's perspective (*"What is holding your team back?"*) — not from ROBO AI's view.
- Answers written in plain language (EN or ES per language flag) — no jargon, no JSON field names visible to client.
- Each answer includes an evidence badge: `From your answers` | `From your website` | `Our analysis` | `Cross-referenced`.
- Answers cite specific client data: *"Your team of 6 in logistics…"* not *"Based on your inputs…"*.
- Answer cap: 80 words. Question cap: 12 words.
- No product names or sales language in Q&A body — that section is analysis only.

### 7.3 Generation, Storage & Delivery

| Step | Action | Service |
|------|--------|---------|
| 1 | Analyzer writes diagnosis to `diagnoses` table | Supabase INSERT |
| 2 | n8n detects new row; triggers PDF generator node | n8n poll |
| 3 | PDF generator reads `diagnoses` + `profiles` rows | Supabase API |
| 4 | PDF rendered with ROBO AI brand template | ReportLab (Python) or pdf-lib (JS) |
| 5 | PDF uploaded to Supabase Storage or S3 | Storage API |
| 6 | `diagnoses.pdf_report_url` and `pdf_generated_at` updated | Supabase UPDATE |
| 7 | Delivery email sent with PDF link + unique password | Resend API |
| 8 | Holding page on `/analyse` updated: *"Your report is ready"* | n8n → WebSocket / polling |

**Delivery rules:**
- Total pipeline SLA: PDF delivered within 30 minutes of form submission.
- If scraper blocked: PDF generated without website section; client note shown.
- Bilingual: all generated copy (Q&A, summaries, labels) in client's chosen language.
- Filename convention: `ROBO_Analysis_[profile_id_short]_[YYYYMMDD].pdf`
- PDF password-protected (read-only); unique per-client password sent separately in delivery email.

---

## 8. Sandbox Interactive Form — v1.2 Specification

> **NEW in v1.2**

The v1.2 sandbox is a fully functional, self-contained HTML/JS implementation of the BA-001 intake form. It requires no backend, no API keys, and no database to run — deployable as a static file for demos, stakeholder review, investor presentations, and UX validation.

### 8.1 Sandbox Specification

| Attribute | Value |
|-----------|-------|
| Implementation | Single-file HTML + CSS + vanilla JS — no build step, no dependencies |
| Framework | None — pure browser-native code for maximum portability |
| Design language | ROBO AI Agency brand: navy `#0D1B2A` background, teal `#0EA5A0` accent, Syne + DM Sans typefaces |
| Visual theme | Dark conversational UI — agent avatar bubbles, user reply bubbles, typing indicator animation |
| Questions implemented | All 10 questions from the master bank (Q-01 through Q-10 / Q-12) |
| Input types | Single-select chips (auto-advance), multi-select chips (continue button), free-text textarea (Enter to submit) |
| Conversation personalisation | Follow-up questions reference prior answers by name (industry, team size appear in Q text) |
| Progress indicator | Dot-track in top bar — done / active / pending states update live across all questions |
| Typing simulation | Animated typing indicator (3-dot bounce) between transitions, 0.9–1.3 s delay |
| Session output | Completion screen renders live JSON profile matching BA-001 schema with generated `profile_id` and timestamp |
| Restart | Full reset button on completion screen — re-runs from Q-01 with cleared state |
| Accessibility | `sr-only <h2>` for screen readers; keyboard-navigable (Enter submits text fields) |
| Deployment | Single `.html` file; hostable on Vercel, Netlify, GitHub Pages, or opened locally |

### 8.2 Sandbox vs Production Comparison

| Capability | Sandbox (v1.2) | Production (v1.x target) |
|------------|----------------|--------------------------|
| Conversation flow | Scripted JS with personalisation | Anthropic API — fully dynamic, context-aware |
| Question selection | Fixed sequence of 10 Qs | AI selects 8–12 from bank based on answers |
| Data persistence | `localStorage` only (session) | Supabase DB — full schema, real-time writes |
| n8n pipeline | Not triggered | Auto-triggered on submit → scrape → analyze → PDF |
| Website scraping | Not performed | BA-002 Puppeteer/Playwright agent |
| Diagnosis | Not generated | Master Analyzer Agent (Claude API) |
| PDF report | Not generated | ReportLab/pdf-lib branded Q&A report |
| Email delivery | Not sent | Resend API within 60 s (confirm) + 30 min (PDF) |
| Language support | EN only (ES keys present) | Full EN + ES with auto-detect and toggle |
| Authentication | None | Supabase RLS + service role key |
| Deployment | Single static `.html` file | Next.js 14 on Vercel / Hetzner |

### 8.3 Sandbox Acceptance Criteria

| ID | Criterion |
|----|-----------|
| **SB-01** | All 10 questions render in correct conversational sequence — one at a time, agent bubble style. |
| **SB-02** | Three input types functional: chip (single-select auto-advance), multi-chip (continue button), free-text (Enter or send button). |
| **SB-03** | Follow-up questions reference prior answers by name — industry and team size appear in question wording. |
| **SB-04** | Progress dot indicator updates correctly through all 10 steps — active, done, pending states visible. |
| **SB-05** | Typing indicator (3-dot animation) appears between question transitions with realistic 0.9–1.3 s delay. |
| **SB-06** | Completion screen renders valid JSON matching the BA-001 output schema with `profile_id`, timestamp, and all collected fields. |
| **SB-07** | Restart button fully resets state — all answers cleared, Q-01 rendered fresh, dot track reset. |
| **SB-08** | Deployable as a single `.html` file with no external dependencies beyond Google Fonts CDN. |

### 8.4 Sandbox → Production Migration Path

| Step | Action Required | Effort |
|------|----------------|--------|
| M-01 | Replace scripted question logic with `/api/next-question` → Anthropic API call | Medium — 1–2 days |
| M-02 | Add Supabase client write on each answer submission | Low — 0.5 days |
| M-03 | Wire submit button to POST `/api/submit-profile` + n8n webhook | Low — 0.5 days |
| M-04 | Add session resume logic from Supabase row | Medium — 1 day |
| M-05 | Add ES translation strings and language toggle UI | Low — 0.5 days |
| M-06 | Add email field + consent checkbox before final submit | Low — 0.5 days |
| M-07 | Embed into Next.js `/analyse` page with WEB-002 design tokens | Low — 0.5 days |
| M-08 | Wire holding page progress indicator to n8n pipeline status | Medium — 1 day |

---

## 9. Complete System Data Flow — 12-Step Pipeline

| # | Step | System Action |
|---|------|--------------|
| 01 | User visits `/analyse` | Next.js loads; `session_id` generated; `profiles` INSERT `status='in_progress'` |
| 02 | User completes intake form | Each answer: `profiles` UPDATE + `localStorage` sync; dot progress advances |
| 03 | User submits form | `profiles` UPDATE `status='submitted'`; JSON validated; `raw_answers_json` stored |
| 04 | n8n webhook fires | Receives `profile_id`; queues BA-002 scraper; sends confirmation email via Resend |
| 05 | Confirmation email sent | Delivered <60 s; client sees holding page with live pipeline progress indicator |
| 06 | BA-002 scrapes website | Puppeteer fetches `website_url`; full row written to `scrape_results` table |
| 07 | n8n detects scrape complete | Polls `scrape_results` for `profile_id` match; triggers Analyzer node |
| 08 | **Master Analyzer runs** | Reads `profiles` + `scrape_results`; calls Anthropic API; writes `diagnoses` row |
| 09 | **PDF generator triggered** | n8n detects new `diagnoses` row; renders branded PDF from template |
| 10 | **PDF stored + URL saved** | PDF uploaded to Supabase Storage; `diagnoses.pdf_report_url` updated |
| 11 | **Delivery email sent** | Resend sends PDF link + read-only password to client inbox |
| 12 | **Holding page updates** | Progress indicator completes; *"Your report is ready — download now"* CTA shown |

> Steps 8–9 = Master Analyzer Agent. Steps 10–12 = PDF generation and delivery.

---

## 10. Non-Functional Requirements

| Category | Requirement | Metric / Threshold |
|----------|-------------|-------------------|
| Performance | Time to first Q render | < 800 ms on 4G connection |
| Performance | AI question latency (form engine) | < 2 500 ms p95 |
| Performance | Master Analyzer completion | < 45 s (hard timeout) |
| Performance | PDF generation | < 60 s after Analyzer writes |
| Performance | Total pipeline SLA (form → PDF) | < 30 minutes |
| Availability | Uptime | 99.5% monthly (Vercel / Hetzner) |
| Accessibility | WCAG standard | 2.1 AA — keyboard nav, screen reader |
| Accessibility | PDF accessibility | PDF/A — tagged headings for screen readers |
| Localisation | Languages at launch | EN (en-US) · ES (es-MX) — auto-detect + toggle |
| Database | Write durability | Supabase WAL + point-in-time recovery |
| Database | Row-level security | All tables — service role only; no client direct access |
| Security | PII encryption | AES-256 at rest via pgcrypto (`contact_email`) |
| Security | API key exposure | Anthropic key server-side only — never in client bundle |
| Security | PDF protection | Unique read-only password per client; sent separately |
| Security | PDF URL | UUID + signed token — not accessible without auth |
| Privacy | Data retention | `raw_*` fields purged after 30 days; PII on erasure within 48 h |
| Privacy | Cookie consent | No tracking cookies (Plausible cookieless); no banner required |
| SEO | `/analyse` page | `noindex` — form page only; homepage fully indexed |
| Mobile | Breakpoints | 375 px · 768 px · 1 280 px — all tested |
| Error handling | AI API timeout | Fallback to static next Q after 5 s — no error screen shown |
| Error handling | n8n webhook failure | 3 retries with exponential backoff; owner alert email on final fail |

---

## 11. Tech Stack

| Layer | Technology | Purpose | Added |
|-------|------------|---------|-------|
| Frontend | Next.js 14 (App Router) | Intake form, `/analyse` page, holding page | v1.0 |
| Sandbox prototype | Vanilla HTML/CSS/JS — single file | Static demo of full intake flow | v1.2 |
| AI — Form engine | Anthropic API · `claude-sonnet-4-20250514` | Dynamic question selection + branching | v1.0 |
| AI — Analyzer | Anthropic API · `claude-sonnet-4-20250514` | Master Analyzer — diagnosis generation | v1.1 |
| Database | Supabase (Postgres + RLS) | `profiles`, `scrape_results`, `diagnoses` tables | v1.1 |
| File storage | Supabase Storage (or S3) | PDF report storage and signed delivery URLs | v1.1 |
| Orchestration | n8n (self-hosted or n8n.cloud) | Full pipeline: scrape → analyze → PDF → email | v1.1 |
| PDF renderer | ReportLab (Python) or pdf-lib (JS) | Branded Q&A Report generation | v1.1 |
| Email | Resend API | Confirmation email + PDF delivery email | v1.0 |
| Scraper | BA-002 agent — Puppeteer / Playwright | Website content extraction | Dependency |
| Analytics | Plausible Analytics | Cookieless funnel tracking — GDPR compliant | v1.0 |
| Hosting | Vercel (free) or Hetzner VPS + Nginx | Frontend + API routes | v1.0 |
| Fonts (sandbox) | Google Fonts CDN — Syne + DM Sans | Sandbox prototype typography | v1.2 |

---

## 12. Test Cases — Complete Set

| ID | Type | Scenario | Pass Criterion |
|----|------|----------|----------------|
| T-01 | E2E | Happy path: form → DB → scrape → analyze → PDF → email | PDF in inbox within 30 min; all DB rows populated correctly |
| T-02 | Form | Chip select auto-advances to next Q | Next Q renders within 400 ms of chip tap |
| T-03 | Form | Free text Enter key submits answer | Answer submitted; next Q rendered; no page reload |
| T-04 | Form | Multi-select chips + continue button | Selected values joined as array in JSON; continue visible only when ≥1 selected |
| T-05 | Form | Follow-up personalisation | Q-04 text contains user's industry from Q-01 answer |
| T-06 | Form | Early completion at Q-8 | Option to finish early visible; JSON valid with 8 fields |
| T-07 | DB | Form submit writes all columns | All non-null columns populated; `session_status = 'submitted'` |
| T-08 | DB | Session resume at Q-4 | `profiles` row updated correctly; no duplicate INSERT; prior answers pre-filled |
| T-09 | DB | GDPR erasure | CASCADE deletes `scrape_results` + `diagnoses`; PDF removed from storage |
| T-10 | Analyzer | Happy path diagnosis | Valid JSON written; all required fields; `inefficiency_score` 0–100 |
| T-11 | Analyzer | Scraper blocked | Analyzer runs form-only; `diagnosis_status = 'partial'`; PDF notes limitation |
| T-12 | Analyzer | Industry conflict (form ≠ scrape) | `website_vs_form_conflicts` array non-empty |
| T-13 | Analyzer | API timeout after 45 s | Retry once at temp 0.1; owner alert if second fails |
| T-14 | PDF | All 8 sections present | Cover, summary, Q&A (6–8), pain points, products, financials, CTA, footer |
| T-15 | PDF | Spanish flag (`language = 'es'`) | All Q&A pairs and labels in es-MX; filename includes `'es'` |
| T-16 | PDF | Password protection | Read-only enforced; password sent separately in delivery email |
| T-17 | PDF | Delivery within 30 min | Email with valid link or attachment received before 30 min SLA |
| T-18 | Security | Supabase RLS — client direct access | 401 returned; no data accessible |
| T-19 | Security | Anthropic key exposure check | Browser network tab: key absent in all client-side requests |
| T-20 | Sandbox | All 10 Qs render in sequence | Each Q appears one at a time; no list visible simultaneously |
| T-21 | Sandbox | Completion JSON is schema-valid | JSON on completion screen matches BA-001 schema; `profile_id` present |
| T-22 | Sandbox | Restart clears all state | Q-01 renders fresh; dot track reset; no prior answer visible |
| T-23 | Sandbox | Single `.html` file deployment | File opens in browser with no 404 errors; no backend required |
| T-24 | Accessibility | Screen reader (NVDA / VoiceOver) | All Qs read aloud; answerable via keyboard only |
| T-25 | Performance | Mobile 4G throttle | First Q < 800 ms; AI latency < 2 500 ms p95 |

---

## 13. Sprint Build Timeline

| Week / Day | Task | Owner | Done When |
|------------|------|-------|-----------|
| **Week 0** | ✅ **COMPLETE** — Sandbox prototype (v1.2) built and validated | Claude / Dev | Interactive form live; JSON output verified |
| Week 1 · D1–2 | Scaffold `/analyse` page; WEB-002 design tokens; Supabase project + schema | Dev | Page renders with brand styles; 3 DB tables created with RLS |
| Week 1 · D3–4 | Integrate Anthropic API: `/api/next-question`; dynamic branching logic | Dev | Q-02 dynamically generated from Q-01 answer; no repeated questions |
| Week 1 · D5 | Question bank complete (Q-01–Q-12); personalisation in follow-ups | Dev | All paths tested; industry + team_size appear in follow-up Qs |
| Week 2 · D1 | Progress indicator + early-complete at Q-8; session persist to Supabase | Dev | Step counter visible; Q-8 offers "finish early"; resume tested |
| Week 2 · D2 | `/api/submit-profile`: JSON validate + Supabase write + n8n webhook POST | Dev | E2E: form submit → DB row written → n8n triggered |
| Week 2 · D3 | Confirmation email template (EN + ES); Resend API integration | Dev | Email delivered <60 s with correct summary and language |
| Week 2 · D4 | Spanish (es-MX) localisation: all strings translated; language toggle UI | Dev / Content | ES toggle switches all visible text; `lang = 'es'` in JSON |
| Week 2 · D5 | BA-002 Scraper integration; n8n polls `scrape_results` | Dev | Scraper fires after form submit; `scrape_results` row written |
| Week 3 · D1–2 | Master Analyzer: n8n node + Anthropic API call + `diagnoses` write | Dev | Valid diagnosis JSON in DB; `inefficiency_score` + `qa_pairs` populated |
| Week 3 · D3–4 | PDF Q&A Report: ReportLab template + all 8 sections + brand styling | Dev | PDF renders with all sections; correct data; branded cover |
| Week 3 · D5 | PDF storage + delivery email + holding page live update | Dev | PDF in Supabase Storage; delivery email with link + password sent <30 min |
| Week 4 | Accessibility audit; performance test; security review; staging deploy | Dev / QA | T-19 to T-25 all pass; Lighthouse Core Web Vitals green |
| Week 4 · Final | Production deploy; SEO meta; Plausible analytics; WEB-006 launch gate | Dev | Site live at roboai.agency; BA-001 full pipeline live end-to-end |

---

## 14. Open Questions & Decisions

| # | Question | Options | Owner | By |
|---|----------|---------|-------|----|
| OQ-01 | Session store: `localStorage` only vs Supabase? | localStorage (faster); Supabase (cross-device resume) | Gerardo | Week 1 D1 |
| OQ-02 | AI temperature for question selection? | 0.3 (predictable); 0.7 (varied follow-ups) | Dev | Week 1 D3 |
| OQ-03 | Fallback if Anthropic API is down? | Static question bank (no personalisation); error + retry CTA | Gerardo | Week 1 D5 |
| OQ-04 | GDPR consent: pre-form gate vs inline at submission? | Pre-form (cleaner legal basis); inline (less friction) | Gerardo | Week 1 D1 |
| OQ-05 | Spanish variant: es-MX vs es-ES? | es-MX — confirmed in PRD v1.0 | — | ✅ Done |
| OQ-06 | PDF renderer: ReportLab (Python) vs pdf-lib (JS)? | Python (control, matches existing tooling); JS (same runtime) | Dev | Week 3 D3 |
| OQ-07 | PDF storage: Supabase Storage vs S3? | Supabase (one less service); S3 (CDN edge, more control) | Gerardo | Week 1 D1 |
| OQ-08 | PDF delivery: email attachment vs download link? | Attach (simpler UX); Link (smaller email, revocable) | Gerardo | Week 3 D5 |
| OQ-09 | Analyzer trigger: immediate after scrape vs batched nightly? | Immediate (< 30 min SLA); Batch (lower cost, worse UX) | Gerardo | Week 1 D1 |
| OQ-10 | Financial estimates: show or suppress if scraper blocked? | Suppress (avoid inaccurate numbers); Show with caveat | Gerardo | Week 3 D2 |
| OQ-11 | Sandbox hosting: embed in claude.ai only vs deploy to roboai.agency? | claude.ai only (demo use); Deploy to `/analyse/demo` (public access) | Gerardo | Week 2 D1 |

---

*ROBO AI Agency · PDR BA-001 · v1.2 · May 2026 · Confidential*
*Gerardo Romero · CISA · Big Four GRC · gerardoromero.ai*
