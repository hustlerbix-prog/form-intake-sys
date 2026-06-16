# ROBO AI Agency
## BA-004 · Master Analyzer Agent
### Product Requirements Document — v1.0 · May 2026

---

| Field | Value |
|---|---|
| Document type | PRD — Product Requirements Document |
| Version | 1.0 · May 2026 |
| Status | Draft — Ready for Sprint 3 |
| Epic | Business Analyser Bundle (BA-series) |
| Priority | P1 Critical |
| Story Points | 21 pts across 6 user stories |
| Sprint | Sprint 3 |
| Depends on | BA-001 (Intake Form) · BA-002 (Website Scraper) |
| Feeds | BA-003 (Proposal Generator) · BA-005 (Trello) |
| Author | Kevin Bonilla · CISA |
| Agency | ROBO AI Agency |

> **BA-004 is the intelligence core of the ROBO AI Agency platform.** It receives structured data from the Business Intake Form (BA-001) and enriched website data from the Scraper (BA-002), synthesises a full business diagnosis, and recommends a prioritised AI solution package drawn from the agency product catalogue — enabling automated consultancy at scale.

---

## Table of Contents

1. [Strategic Context & Platform Position](#1-strategic-context--platform-position)
2. [User Story & Bundle Overview](#2-user-story--bundle-overview)
3. [Acceptance Criteria](#3-acceptance-criteria)
4. [Functional Requirements — Input Ingestion Layer](#4-functional-requirements--input-ingestion-layer)
5. [Functional Requirements — Business Diagnosis Engine](#5-functional-requirements--business-diagnosis-engine)
6. [Functional Requirements — Product Catalogue Matcher](#6-functional-requirements--product-catalogue-matcher)
7. [Functional Requirements — Solution Proposal Output](#7-functional-requirements--solution-proposal-output)
8. [Agent Orchestration & Prompt Architecture](#8-agent-orchestration--prompt-architecture)
9. [Complete System Data Flow](#9-complete-system-data-flow)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Tech Stack](#11-tech-stack)
12. [Test Cases](#12-test-cases)
13. [Sprint Build Timeline](#13-sprint-build-timeline)
14. [Open Questions & Decisions](#14-open-questions--decisions)

---

## 1. Strategic Context & Platform Position

ROBO AI Agency is a senior AI automation practice with Big Four GRC credentials that builds and deploys real AI systems for SMBs — not a marketplace, not a reseller. BA-004 is the brain of the platform. Every data signal collected through BA-001 and every public intelligence gathered by BA-002 converges here into a structured, actionable diagnosis and a recommended AI solution package.

| Layer | Component | Role | Status |
|---|---|---|---|
| Client Acquisition | BA-001 Business Intake Form | Captures 8–12 signals: industry, team, revenue, bottlenecks, tools, goals | Live — v1.2 |
| Data Enrichment | BA-002 Website Scraper | Firecrawl scrape of client domain → content JSON + tech stack signals | Specified |
| Intelligence Core | **BA-004 Master Analyzer Agent** | Synthesises BA-001 + BA-002 → diagnosis JSON + product recommendations | **This PRD** |
| Proposal Engine | BA-003 Proposal Generator | Converts diagnosis + recommendations → branded PDF proposal | Dependency |
| Client Deliverable | PDF Q&A Report | First tangible output received by prospect within 30 min of submission | Phase 2 |
| Project Tracking | BA-005 Trello Automation | Auto-creates Trello card on payment confirmation | Specified |
| Products | IS / CS / MS / PL Catalogue | 12+ productised services matched by BA-004 to client profile | Catalogue |

> BA-004 is not a chatbot. It is a structured reasoning agent that reads a business profile, cross-references it against a product catalogue, and produces a defensible, evidence-based recommendation — the same analytical process a senior consultant would apply, at machine speed.

---

## 2. User Story & Bundle Overview

> *"As the Master Analyzer Agent, I receive the business profile from BA-001 and the scraped website data from BA-002, so that I can produce a structured business diagnosis and recommend the most appropriate AI solution package from the ROBO AI product catalogue — enabling the agency to deliver a tailored proposal within 30 minutes of a prospect submitting the intake form."*

### Pipeline Position

| Stage | ID | Component | Input | Output | Trigger |
|---|---|---|---|---|---|
| 1 | BA-001 | Business Intake Form | User answers (8–12 Q) | Structured JSON profile | User submits |
| 2 | BA-001 DB | Supabase Persistence | JSON profile | Rows in 3 tables | Auto on submit |
| 3 | BA-002 | Website Scraper (Firecrawl) | website_url field | Scraped content JSON | n8n post-submit |
| **4** | **BA-004** | **Master Analyzer Agent ← THIS PRD** | **DB profile + scraped data** | **Diagnosis JSON + recommendations** | **n8n post-scrape** |
| 5 | BA-003 | Proposal Generator | Diagnosis + recommendations | Branded PDF proposal | Auto post-analysis |
| 6 | BA-005 | Trello Automation | Payment confirmation | Trello card created | Stripe webhook |

---

## 3. Acceptance Criteria

| ID | Criterion | Test Method |
|---|---|---|
| AC-01 | Agent receives the full BA-001 Supabase profile payload and BA-002 scraped content JSON via n8n webhook within 5 seconds of scrape completion. | Integration test |
| AC-02 | Agent produces a structured diagnosis JSON within 45 seconds of receiving both inputs. Timeout triggers a fallback partial-analysis mode using BA-001 data only. | Load test |
| AC-03 | Diagnosis JSON contains all 9 required fields: `business_summary`, `operational_gaps[]`, `pain_priority_rank[]`, `automation_readiness_score` (0–100), `recommended_products[]`, `implementation_roadmap[]`, `estimated_monthly_value_usd`, `confidence_score`, and `reasoning_trace`. | Schema validation |
| AC-04 | Product recommendations reference valid product IDs from the catalogue (CB-01, CA-01, AVA-01, IS-01–05, CS-01–04, MS-01–03, AO-01–03). No hallucinated product codes. | Catalogue integrity check |
| AC-05 | Automation readiness scores below 40 trigger a human-escalation flag in the output JSON. Scores above 40 proceed to automated proposal. | Threshold test |
| AC-06 | Agent surfaces a primary recommendation (top 1–2 products) and an upsell path (next logical products). Both are present in the output JSON. | Output schema test |
| AC-07 | Each recommended product includes a `reasoning` field citing specific data points from BA-001 and/or BA-002 that justify the recommendation. | Reasoning quality review |
| AC-08 | Output JSON is valid and passes schema validation before being posted downstream to BA-003. Invalid output triggers a retry (max 2) before human escalation. | CI schema test |
| AC-09 | Language of analysis matches the language flag set in the BA-001 session (en / es). | Bilingual test |
| AC-10 | Full pipeline (BA-001 submit → BA-002 scrape → BA-004 analysis → BA-003 PDF ready) completes within 30 minutes. BA-004 step target: under 60 seconds. | E2E timing test |

---

## 4. Functional Requirements — Input Ingestion Layer

### 4.1 n8n Webhook Receiver

BA-004 is triggered by a POST request from n8n carrying two payloads: the structured business profile from Supabase (written by BA-001) and the scraped content JSON from Firecrawl (written by BA-002). Both must be present before analysis begins.

- Accept POST from n8n at internal endpoint `/analyze` with `content-type: application/json`
- Validate that both `profile` and `scraped_data` keys are present and non-empty
- If only `profile` is present (scrape failed or timed out), proceed with partial-analysis mode and set `data_source = 'intake_only'` in output
- Log `session_id`, `client_email`, `timestamp`, and `data_source` to Supabase `ba_analysis_log` table on receipt
- Return HTTP `202 Accepted` immediately; analysis runs asynchronously

### 4.2 Input Schema — BA-001 Profile Payload

Fields consumed from Supabase `business_profiles` table:

| Field | Type | Description | Required |
|---|---|---|---|
| session_id | UUID | Unique session identifier | Required |
| client_email | string | Prospect email for delivery | Required |
| language | enum | en / es | Required |
| industry | string | Q-01 chip answer | Required |
| team_size | string | Q-02 chip answer | Required |
| revenue_range | string | Q-03 chip answer | Required |
| top_time_cost | string | Q-04 free text | Required |
| existing_tools | string[] | Q-05 multi-select | Optional |
| bottleneck | string | Q-06 free text | Required |
| budget_comfort | string | Q-07 chip answer | Required |
| success_definition | string | Q-08 free text | Optional |
| data_situation | string | Q-09 free text | Optional |
| urgency | string | Q-10 free text | Optional |
| website_url | string | Q-11 URL | Optional |
| decision_authority | string | Q-12 chip answer | Optional |

### 4.3 Input Schema — BA-002 Scraped Data Payload

| Field | Type | Description | Required |
|---|---|---|---|
| domain | string | Scraped domain | Required |
| page_titles | string[] | Titles of scraped pages | Optional |
| body_text_summary | string | Summarised page content (max 4,000 tokens) | Required |
| detected_tools | string[] | Tech stack signals (e.g. Shopify, HubSpot, WordPress) | Optional |
| social_signals | object | LinkedIn / social presence indicators | Optional |
| scrape_status | enum | success / partial / failed | Required |
| scrape_timestamp | ISO 8601 | When scrape completed | Required |

---

## 5. Functional Requirements — Business Diagnosis Engine

### 5.1 Reasoning Framework

The diagnosis engine uses a structured chain-of-thought prompt sequence powered by `claude-sonnet-4-20250514`. It executes in four analytical passes:

**Pass 1 — Business Context Synthesis**
Reads the full profile and scraped data. Produces a 200-word plain-language business summary identifying the core value chain, primary revenue driver, and operational model.

**Pass 2 — Gap & Pain Analysis**
Maps the stated bottlenecks and time costs against the business model. Ranks the top 3 operational gaps by severity (revenue impact × frequency × manual effort). Produces `operational_gaps[]` and `pain_priority_rank[]`.

**Pass 3 — Automation Readiness Scoring**
Scores the business 0–100 on automation readiness using five dimensions: data availability, tool maturity, budget comfort, decision authority, and urgency. Produces `automation_readiness_score` and a reasoning trace.

**Pass 4 — Product Matching & Roadmap**
Matches the top-ranked pain points to the product catalogue. Selects a primary recommendation (highest impact, lowest friction) and an upsell path. Produces `recommended_products[]`, `implementation_roadmap[]`, and `estimated_monthly_value_usd`.

### 5.2 Automation Readiness Score — Dimensions

| Dimension | Max Score | Scoring Logic |
|---|---|---|
| Data Availability | 0–20 | Does the business have structured data, reports, or records that AI can consume? Score from form Q-09 and scraped signals. |
| Tool Maturity | 0–20 | Are existing tools API-capable or integration-ready? Inferred from Q-05 and BA-002 `detected_tools`. |
| Budget Comfort | 0–20 | Does stated budget comfort (Q-07) align with recommended product pricing? Scored against catalogue tiers. |
| Decision Authority | 0–20 | Is the form respondent the decision-maker? Q-12 signal. Sole decision-maker = 20; committee = 5. |
| Urgency | 0–20 | Is there a deadline or event driving the need (Q-10)? Hard deadline within 30 days = 20; no urgency = 5. |

### 5.3 Diagnosis Output Schema

| Field | Type | Description |
|---|---|---|
| business_summary | string | 200-word plain-language business description |
| operational_gaps | object[] | Top 3 gaps: `{gap_id, description, severity_score, evidence_source}` |
| pain_priority_rank | string[] | Ordered list of gap_ids by severity |
| automation_readiness_score | integer 0–100 | Composite score from 5 dimensions |
| readiness_dimension_breakdown | object | Score per dimension (data, tools, budget, authority, urgency) |
| recommended_products | object[] | `{product_id, product_name, tier, rationale, priority: primary\|upsell}` |
| implementation_roadmap | object[] | `{phase, title, duration_weeks, products[], description}` |
| estimated_monthly_value_usd | integer | Estimated monthly cost recovered or revenue protected |
| confidence_score | integer 0–100 | Agent confidence in recommendation quality |
| data_source | enum | full / intake_only |
| reasoning_trace | string | Internal chain-of-thought summary (QA use only, not shown to client) |
| human_escalation_flag | boolean | True if `readiness_score < 40` or `confidence_score < 60` |
| language | enum | en / es — matches BA-001 session language |

---

## 6. Functional Requirements — Product Catalogue Matcher

The catalogue matcher maps the top-ranked pain points to available ROBO AI products. It must only reference valid product IDs — no improvised or hallucinated services.

### 6.1 Product Catalogue Reference

| ID | Product | Description | Price | Best Fit |
|---|---|---|---|---|
| CB-01 | AI Chatbot | Customer-facing conversational agent with knowledge base | $299–$799/mo | Lead capture, customer support, FAQ automation |
| CA-01 | Company Analyzer | Business intelligence agent fed by CA-01 KB + RAG | $499/mo | Internal ops analysis, reporting, decision support |
| AVA-01 | AI Voice Assistant | Programmable voice agent with RAG/pgvector KB | $599–$1,199/mo | Phone support, appointment booking, order status |
| IS-01 | AI Onboarding Sprint | 5-day build + deploy of a core AI product | $2,500 fixed | First deployment, fastest path to live |
| IS-02 | Integration Sprint | Connect AI product to existing stack (CRM, ERP, etc.) | $1,800 fixed | Post-launch integrations |
| IS-03 | Data Pipeline Build | Structured data ingestion from manual/legacy sources | $2,200 fixed | Businesses with unstructured data |
| IS-04 | Voice Channel Deploy | AVA-01 configured for phone/IVR | $2,800 fixed | Phone-heavy businesses |
| IS-05 | Custom Agent Build | Bespoke AI agent beyond catalogue products | $3,500+ fixed | Unique use cases |
| CS-01 | AI Readiness Audit | 2-hour structured assessment + report | $750 fixed | Pre-purchase clarity |
| CS-02 | Strategy Workshop | Half-day AI roadmap session | $1,200 fixed | Leadership buy-in |
| CS-03 | Compliance Review | CISA-led GRC review of AI deployment | $1,500 fixed | Regulated industries |
| CS-04 | Change Mgmt Coaching | 3-session team adoption programme | $900 fixed | Resistance to adoption |
| MS-01 | Core Retainer | Monthly managed support for 1 AI product | $399/mo | Post-deployment maintenance |
| MS-02 | Growth Retainer | Monthly support + optimisation + reporting | $699/mo | Scale-up clients |
| MS-03 | Enterprise Retainer | Full-stack managed service, SLA-backed | $1,499/mo | High-complexity accounts |
| AO-01 | Bilingual Add-on | EN/ES language layer on any product | $199/mo | LatAm / bilingual markets |
| AO-02 | Analytics Dashboard | Usage + performance dashboard for any product | $149/mo | Reporting-focused clients |
| AO-03 | Priority Support | 4-hour SLA response, dedicated channel | $249/mo | Time-sensitive businesses |

### 6.2 Matching Logic

| Signal | Recommendation |
|---|---|
| Pain: manual data entry / reporting | → CA-01 + IS-03 (primary) · MS-01 (upsell) |
| Pain: customer support / FAQ volume | → CB-01 + IS-01 (primary) · AO-01 if bilingual market |
| Pain: phone handling / appointment booking | → AVA-01 + IS-04 (primary) · MS-02 (upsell) |
| Pain: no AI yet, unclear where to start | → CS-01 AI Readiness Audit (primary) · IS-01 (upsell) |
| Budget $200–$500/mo | → CB-01 or CA-01 · IS-01 to deploy · MS-01 to maintain |
| Budget $500–$1,500/mo | → AVA-01 or CA-01 bundle · IS-01 or IS-02 · MS-02 |
| Budget $1,500+/mo | → Full stack: CB-01 + CA-01 + AVA-01 · IS series · MS-03 |
| Regulated industry (finance, health, legal) | → CS-03 Compliance Review required before build |
| High urgency (deadline < 30 days) | → IS-01 Onboarding Sprint flagged as fast-track |
| LatAm market or bilingual ops | → AO-01 appended to any primary recommendation |

---

## 7. Functional Requirements — Solution Proposal Output

### 7.1 Recommended Products Object

Each entry in `recommended_products[]` must conform to:

```json
{
  "product_id": "CB-01",
  "product_name": "AI Chatbot",
  "tier": "primary",
  "monthly_price_usd": 499,
  "one_time_price_usd": 2500,
  "rationale": "Client reported 15+ hours/week on customer FAQ emails (Q-04). Website shows no live chat or support tooling (BA-002). CB-01 directly addresses this bottleneck.",
  "value_driver": "time_saved",
  "priority_rank": 1
}
```

### 7.2 Implementation Roadmap

The agent produces a phased delivery roadmap with 2–4 phases. Each phase includes:

- Phase number and title (e.g. "Phase 1 — Foundation")
- Duration in weeks
- Products deployed in this phase
- Plain-language description of what the client gains at phase completion
- Estimated cumulative monthly value at end of phase (USD)

### 7.3 Monthly Value Estimation

`estimated_monthly_value_usd` is calculated from the top 2 operational gaps using conservative assumptions. The agent must show its working in `reasoning_trace`.

| Gap Type | Estimation Formula |
|---|---|
| Manual data / reporting time cost | `team_size × avg_hours_saved_weekly × $35/hr × 4.3 weeks` |
| Customer support volume | `estimated_tickets_avoided × $8/ticket` |
| Phone handling | `calls_handled_by_AI × $12/call` |
| Revenue leakage (missed leads) | `conversion_rate × avg_deal_size × captured_leads_monthly` |

---

## 8. Agent Orchestration & Prompt Architecture

### 8.1 Model & API Configuration

| Parameter | Value |
|---|---|
| Model | `claude-sonnet-4-20250514` |
| Max tokens | 4,000 (diagnosis pass) · 2,000 (summary pass) |
| Temperature | 0.3 (structured output) · 0.5 (narrative summary) |
| System prompt strategy | Four-pass sequential with state carry-through |
| Output format | JSON-only for passes 1–3 · Markdown for reasoning trace |
| Retry policy | 2 retries on schema validation failure · exponential backoff |
| Timeout | 45 seconds per pass · 120 seconds total |
| Language routing | System prompt switches to Spanish if `language = 'es'` |

### 8.2 System Prompt Structure

Each pass uses a distinct system prompt. All prompts include:

- **Role definition:** *"You are the ROBO AI Agency Master Analyzer Agent — a senior AI automation consultant with 12+ years of GRC and operational experience."*
- Explicit output schema (JSON schema string) embedded in the prompt
- Instruction to cite evidence from input data for every recommendation
- Hard constraint: *"Only reference product IDs from the provided catalogue. Do not invent services."*
- Bilingual instruction: *"If language = es, respond in Latin American Spanish throughout."*
- Calibration instruction: *"If data quality is low (fewer than 6 answers), set confidence_score below 60 and set human_escalation_flag = true."*

### 8.3 n8n Orchestration Flow

| Step | Action | Description | Integration |
|---|---|---|---|
| 1 | Trigger | Webhook from BA-002 completion event | n8n |
| 2 | Data Fetch | Pull BA-001 profile from Supabase `ba_profiles` by `session_id` | n8n → Supabase |
| 3 | Merge Payload | Combine profile JSON + scrape JSON into single request body | n8n |
| 4 | BA-004 Call | POST merged payload to BA-004 analysis endpoint | n8n → BA-004 |
| 5 | Schema Validate | Validate response against diagnosis JSON schema | n8n |
| 6 | Retry / Escalate | On validation failure: retry ×2; then create human-escalation ticket | n8n |
| 7 | DB Write | Write diagnosis JSON to Supabase `ba_analyses` table | n8n → Supabase |
| 8 | BA-003 Trigger | POST diagnosis JSON to BA-003 Proposal Generator webhook | n8n → BA-003 |
| 9 | Log | Write pipeline completion log with timing to `ba_pipeline_log` | n8n → Supabase |

---

## 9. Complete System Data Flow

```
BA-001 Form Submit
  → Supabase Write
  → n8n Trigger
  → BA-002 Firecrawl Scrape (parallel)
  → n8n Merge Payload
  → BA-004 Analysis (4-pass Claude)
  → Schema Validation
  → Supabase ba_analyses Write
  → BA-003 Proposal Generate
  → Client Email (PDF)
  · BA-005 Trello Card (on payment)
```

### Timing Budget

| Step | Target Time | Notes |
|---|---|---|
| BA-001 → Supabase write | < 2 sec | On form submit |
| BA-002 Firecrawl scrape | < 60 sec | Parallel to DB write |
| n8n merge + BA-004 trigger | < 5 sec | After scrape completes |
| BA-004 4-pass analysis | < 45 sec | Core analysis window |
| Schema validation + DB write | < 5 sec | Post-analysis |
| BA-003 PDF generation | < 8 min | Async, client notified |
| **Total: form submit → PDF delivered** | **< 30 min** | **SLA target** |

---

## 10. Non-Functional Requirements

| Category | ID | Requirement |
|---|---|---|
| Performance | NFR-01 | End-to-end analysis (4 passes) completes within 45 seconds at 95th percentile. |
| Performance | NFR-02 | Partial-analysis mode (intake-only) completes within 20 seconds. |
| Reliability | NFR-03 | Analysis success rate ≥ 98% over 30-day rolling window. Failed analyses auto-escalate. |
| Reliability | NFR-04 | Schema validation enforced before any output leaves BA-004. Malformed JSON never reaches BA-003. |
| Data Quality | NFR-05 | Product recommendations must reference valid catalogue IDs only. Hallucination rate target: 0%. |
| Security | NFR-06 | All payloads transmitted over TLS 1.3. Supabase row-level security applied to `ba_analyses` table. |
| Security | NFR-07 | No PII (`client_email`, business name) included in Claude API calls — only operational profile data. |
| Observability | NFR-08 | Every analysis logged with `session_id`, timing, `confidence_score`, `escalation_flag`, and model version. |
| Scalability | NFR-09 | Architecture supports 100 concurrent analyses without queue degradation. |
| Bilingual | NFR-10 | Analysis quality is equivalent in EN and ES. Spanish output validated by a native reviewer before launch. |
| Auditability | NFR-11 | `reasoning_trace` retained in Supabase for 90 days. Available for QA review and model improvement. |

---

## 11. Tech Stack

| Layer | Tool | Role in BA-004 |
|---|---|---|
| AI / LLM | Anthropic API | `claude-sonnet-4-20250514` · 4-pass analysis chain |
| Orchestration | n8n (self-hosted) | Webhook trigger · payload merge · retry logic · downstream routing |
| Database | Supabase (PostgreSQL) | `ba_profiles` · `ba_analyses` · `ba_pipeline_log` tables |
| Vector Store | pgvector (Supabase) | Product catalogue embeddings for semantic matching (Phase 2) |
| Scraper | BA-002 / Firecrawl | Provides `scraped_data` payload |
| Infrastructure | Hetzner VPS + Docker | BA-004 runs as containerised Node.js service |
| Runtime | Node.js | HTTP server receiving n8n webhook · calling Anthropic API · writing Supabase |
| Validation | Zod (TypeScript) | JSON schema validation of diagnosis output before DB write |
| Monitoring | n8n execution logs + Supabase | Pipeline timing and error tracking |
| Payments | Stripe | Downstream trigger for BA-005 Trello automation |
| API Domain | api.roboai.agency/v1 | Internal service endpoint namespace |

---

## 12. Test Cases

| ID | Name | Input | Expected Result | Method |
|---|---|---|---|---|
| TC-01 | Full data analysis | Post valid BA-001 profile + BA-002 scraped data | Diagnosis JSON returned within 45s, all 13 fields present, product IDs valid | Pass/Fail |
| TC-02 | Partial data (intake only) | Post BA-001 profile with `scrape_status = failed` | Diagnosis returned with `data_source = intake_only`, `confidence_score ≤ 70` | Pass/Fail |
| TC-03 | Low readiness score escalation | Post profile with budget = $0–$200, no urgency, committee decision | `automation_readiness_score < 40`, `human_escalation_flag = true` | Pass/Fail |
| TC-04 | High readiness score | Post profile with high budget, sole owner, hard deadline in 7 days | `automation_readiness_score ≥ 75`, primary recommendation IS-01 | Pass/Fail |
| TC-05 | Invalid product hallucination | Run 50 analyses across varied profiles | Zero outputs contain product IDs not in catalogue | Statistical |
| TC-06 | Schema validation failure recovery | Inject malformed response from mock LLM | Retry triggered ×2; human escalation ticket created on 3rd failure | Pass/Fail |
| TC-07 | Spanish language output | Set `language = es` in BA-001 profile | Diagnosis JSON, `reasoning_trace`, and all string fields in Spanish | QA review |
| TC-08 | Timing SLA | 50 concurrent full analyses | 95th percentile completion < 45 seconds | Performance |
| TC-09 | Bilingual market detection | Industry = retail, website shows Spanish content | AO-01 add-on included in recommendations | Pass/Fail |
| TC-10 | PII exclusion | Inspect Claude API call payload | No `client_email` or business name in API request body | Security audit |

---

## 13. Sprint Build Timeline

**Sprint 3 · 10 working days · 21 story points**

| Story ID | Title | Scope | Points | Days |
|---|---|---|---|---|
| US-BA004-01 | Input ingestion layer | n8n webhook receiver · schema validation · partial-analysis mode | 5 pts | Days 1–2 |
| US-BA004-02 | Business diagnosis engine | 4-pass Claude prompt chain · readiness scoring · gap analysis | 5 pts | Days 3–5 |
| US-BA004-03 | Product catalogue matcher | Matching logic · catalogue reference · recommendation object builder | 4 pts | Days 5–6 |
| US-BA004-04 | Output schema + DB write | Zod validation · Supabase `ba_analyses` write · pipeline log write | 3 pts | Days 7–8 |
| US-BA004-05 | n8n downstream routing | BA-003 trigger · human escalation path · retry logic | 2 pts | Day 9 |
| US-BA004-06 | Bilingual + test coverage | ES prompt variants · 10 test cases · staging E2E run | 2 pts | Day 10 |

> **Dependencies:** BA-001 v1.2 must be live in Supabase before Sprint 3 begins. BA-002 must return valid `scraped_data` JSON to BA-004's webhook. BA-003 webhook endpoint must be available for integration testing by Day 9.

---

## 14. Open Questions & Decisions

| ID | Status | Question |
|---|---|---|
| OQ-01 | OPEN | **Product catalogue versioning** — how should BA-004 handle a product ID being deprecated or repriced mid-sprint? Should catalogue be fetched from Supabase at runtime or hardcoded in prompt? |
| OQ-02 | OPEN | **Value estimation calibration** — the monthly value formulas in §7.3 use assumed rates ($35/hr, $8/ticket). These need validation against real SMB benchmarks before launch. |
| OQ-03 | OPEN | **Human escalation routing** — when `human_escalation_flag = true`, where does the alert go? Slack, email, or direct Trello card? Owner: Kevin to confirm. |
| OQ-04 | OPEN | **CA-01 / AVA-01 bundle pricing** — should BA-004 be aware of bundle discounts and recommend them as a combined SKU, or recommend individual products and let BA-003 apply bundle logic? |
| OQ-05 | OPEN | **Reasoning trace visibility** — is `reasoning_trace` ever surfaced to the client in the proposal PDF, or is it internal-only? If internal, confirm data retention policy with GRC lead. |
| OQ-06 | DECISION NEEDED | **Phase 2 semantic matching via pgvector** — should the catalogue matcher in v1.0 use hardcoded rules (§6.2) or embed product descriptions and use cosine similarity? Decision affects Sprint 3 scope. |
| OQ-07 | OPEN | **Spanish prompt QA** — who performs the native-speaker validation of ES output before go-live? If Kevin, block Day 10 in Sprint 3 calendar. |

---

*End of Document — BA-004 Master Analyzer Agent PRD v1.0 · ROBO AI Agency · May 2026*

*Confidential · Kevin Bonilla · CISA*
