# BA-002 · Website Scraper Agent
### Product Design Requirements · v1.0

> **ROBO AI Agency** · *We analyse, demo, build and deploy AI solutions.*
> Confidential · May 2026

---

| Field | Value |
|---|---|
| **Document** | PDR — Product Design Requirements |
| **ID** | BA-002 |
| **Title** | Website Scraper Agent |
| **Version** | v1.0 · May 2026 |
| **Author** | Gerardo Romero · CISA · Big Four GRC |
| **Epic** | Business Analyser Bundle (BA-series) |
| **Sprint** | Sprint 2 |
| **Status** | Draft — Ready for Development |
| **Story Points** | 8 pts |
| **Priority** | P1 Critical |
| **Depends on** | BA-001 (Business Intake Form) |
| **Feeds into** | BA-003 (Proposal Generator) |

---

## Table of Contents

1. [Purpose & Strategic Context](#1-purpose--strategic-context)
2. [User Story](#2-user-story)
3. [Acceptance Criteria](#3-acceptance-criteria)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Data Flow & Integration](#6-data-flow--integration)
7. [Output Schema — Web Context Document](#7-output-schema--web-context-document)
8. [Tech Stack](#8-tech-stack)
9. [Test Cases](#9-test-cases)
10. [Sprint Build Plan](#10-sprint-build-plan)
11. [Open Questions & Decisions](#11-open-questions--decisions)
12. [Dependencies & Downstream Impact](#12-dependencies--downstream-impact)

---

## 1. Purpose & Strategic Context

BA-002 is the second agent in the ROBO AI Agency automated analysis pipeline. Its single responsibility is to receive a URL from the BA-001 intake form, crawl the client's website, and return a structured Web Context Document to the BA-003 Proposal Generator — without any manual intervention.

Without web data, the downstream Analyzer and Proposal Generator must rely solely on self-reported form answers. Real websites contain signals that clients rarely articulate: the language they actually use with customers, the operational tools they have embedded, pricing hints, and the gap between how they describe themselves and how their site presents them. BA-002 closes that gap.

> **Agent Position in the BA Pipeline**
>
> `BA-001 (Intake Form)  →  BA-002 (Website Scraper)  →  BA-003 (Proposal Generator)`
>
> BA-002 is triggered automatically by n8n when BA-001 submits. It enriches the client record already persisted to Supabase and passes its structured output directly to BA-003.

---

## 2. User Story

> *"As a prospective client, I want the platform to scan my website automatically so that the analysis is enriched with real context about my business — without me needing to manually describe what I do or how I communicate."*

---

## 3. Acceptance Criteria

All criteria below must be met for BA-002 to be considered complete. Each maps to a test case in Section 9.

### AC-01 · Zero-touch trigger

- ✓ Agent accepts the client URL from the BA-001 Supabase record and begins scraping with no manual intervention. Trigger is fired by n8n webhook on BA-001 submission.

### AC-02 · Configurable depth crawl

- ✓ Agent crawls all indexable pages up to a configurable depth limit. Default depth is 3 levels from the root URL. Depth is set via environment variable `SCRAPER_MAX_DEPTH` and can be overridden per-run.
- ✓ Crawler respects `robots.txt` directives and does not crawl disallowed paths.
- ✓ Duplicate URLs (after normalisation) are deduplicated before processing.

### AC-03 · Structured report extraction

The scraper extracts and classifies the following signals from clean page text:

- ✓ **Services offered** — explicit service names, descriptions, and categories
- ✓ **Target audience** — named customer segments, industry verticals, or persona language
- ✓ **Tone of voice** — classified as one of: `formal` / `conversational` / `technical` / `sales-heavy` / `neutral`
- ✓ **Technology stack mentions** — any named tools, platforms, or integrations visible in copy or page source
- ✓ **Pricing signals** — presence of pricing pages, ranges, tiers, or 'contact for pricing' language
- ✓ **Operational tools** — identified widgets, embeds, or links: booking systems, chatbots, CRM forms, helpdesk portals, payment processors

### AC-04 · JavaScript rendering

- ✓ Agent handles websites that require JavaScript rendering, not just static HTML. Headless browser (Playwright / Puppeteer) is used for pages where the initial HTML body is empty or below a minimum content threshold.
- ✓ Rendering timeout is configurable via `SCRAPER_JS_TIMEOUT` (default: 10 seconds per page).

### AC-05 · Graceful failure handling

- ✓ If the URL is unreachable (DNS failure, 4xx/5xx response, TLS error, or timeout), the agent sets `web_scrape_status = 'failed'` in Supabase and passes an empty web context document with an error reason to BA-003.
- ✓ If scraping returns no usable content (total clean text < 200 characters), the agent flags `web_scrape_status = 'no_content'` and continues the pipeline.
- ✓ The BA-003 pipeline is never blocked by a BA-002 failure. A missing web context document is treated as an empty enrichment.

### AC-06 · Performance SLA

- ✓ Full scrape and Web Context Document generation completes in under 3 minutes for a typical SMB website (defined as: up to 50 indexable pages, no authentication wall, hosted on standard shared or cloud infrastructure).
- ✓ Per-page scrape time does not exceed 30 seconds. Pages exceeding this limit are skipped and logged.

### AC-07 · Structured output delivery

- ✓ Output is a valid Web Context Document (JSON schema defined in Section 7) written to the Supabase `web_context` table and passed to BA-003 automatically via n8n.
- ✓ Output includes a `confidence_score` (0.0–1.0) reflecting the completeness of extraction across the six signal categories.

---

## 4. Functional Requirements

### 4.1 Crawl Engine

The crawl engine is responsible for URL discovery, page fetching, and content extraction.

| Requirement | Description | Default / Constraint |
|---|---|---|
| Seed URL | Accept a single root URL from the intake record. Normalise trailing slashes and www/non-www variants before starting. | From Supabase `website_url` field |
| Depth limit | Crawl links up to N levels deep from the root. Level 0 = seed URL; Level 1 = pages directly linked from seed; etc. | Default: 3 |
| Page cap | Stop after a maximum number of unique pages to prevent runaway crawls on large sites. | Max: 100 pages |
| Scope | Only crawl pages within the same root domain. Do not follow external links. | Same-origin only |
| robots.txt | Fetch and parse `robots.txt` at the start of each crawl. Honour all `Disallow` directives. | Mandatory |
| Politeness delay | Insert a delay between consecutive requests to the same host. | 500 ms default |
| Concurrency | Crawl multiple pages in parallel to stay within the 3-minute SLA. | Max 5 concurrent |
| User-agent | Identify the crawler with a transparent user-agent string. | `ROBOAIBot/1.0` |

### 4.2 Rendering Strategy

The agent uses a two-pass rendering strategy to handle both static and JavaScript-rendered sites efficiently:

- **Pass 1 — Static fetch:** Retrieve the page using a standard HTTP GET. If the extracted text body exceeds the minimum content threshold (500 characters of clean text), use this response and skip Pass 2.
- **Pass 2 — Headless render:** If Pass 1 returns insufficient content, launch a headless Chromium instance (Playwright), wait for network idle or the JS timeout, and extract the rendered DOM text.
- Pages that fail both passes are marked `status = 'render_failed'` in the page log and excluded from extraction.

> **Rendering Timeout Configuration**
>
> `SCRAPER_JS_TIMEOUT` (env var) — maximum seconds to wait for a page to reach network-idle state.
> Default: 10 seconds. Recommended range: 5–30 seconds.
> Pages that exceed the timeout are abandoned and logged — never blocking the overall crawl.

### 4.3 Text Cleaning Pipeline

Raw HTML is not passed to the extraction model. All content goes through the following cleaning steps before analysis:

- Strip all HTML tags, preserving whitespace structure for heading/paragraph detection.
- Remove navigation menus, cookie banners, legal boilerplate, and repetitive footer text by pattern matching on common structural selectors (`nav`, `footer`, `#cookie-banner`, `.legal`, etc.).
- Remove duplicate paragraphs (same text appearing on multiple pages is deduplicated at the corpus level).
- Normalise whitespace: collapse multiple spaces and blank lines into single separators.
- Truncate per-page content at 3,000 tokens before passing to the extraction model.
- Total corpus passed to the LLM extraction step is capped at 15,000 tokens.

### 4.4 Extraction Model — Signal Classification

After cleaning, the consolidated corpus is passed to a `claude-sonnet-4-20250514` call with a structured extraction prompt. The model returns a JSON object conforming to the Web Context Document schema (Section 7).

| Signal | Extraction Logic | Output Format |
|---|---|---|
| Services offered | Identify distinct service names, categories, and short descriptions. Group by type if patterns emerge (e.g. consulting, software, training). | Array of objects: `{name, category, description}` |
| Target audience | Extract named customer segments, industries, company sizes, or role-level signals from the copy. | Array of strings |
| Tone of voice | Classify the dominant tone across the corpus. Choose the single best-fit label. | Enum: `formal` \| `conversational` \| `technical` \| `sales-heavy` \| `neutral` |
| Tech stack | Surface any explicitly named tools, platforms, or integrations. Include only names visible in page copy or detectable in page source meta tags. | Array of strings |
| Pricing signals | Detect presence of pricing content and classify the model. Capture any price figures found. | Object: `{present: bool, model: enum, figures: array}` |
| Operational tools | Detect embedded widgets or third-party tool links. Use both DOM inspection (iframe src, script src domains) and copy signals. | Array of objects: `{tool, category, confidence}` |

### 4.5 Graceful Degradation & Error Handling

The agent must never block the BA-003 pipeline. Error handling at each layer:

| Failure Scenario | Agent Behaviour | Supabase Status |
|---|---|---|
| URL unreachable (DNS, timeout, 5xx) | Log error, set empty web context, trigger BA-003 with flag. | `web_scrape_status = 'failed'` |
| No usable content returned | Log reason, set empty web context, continue. | `web_scrape_status = 'no_content'` |
| Partial scrape (some pages fail) | Continue with successfully scraped pages. Note pages skipped in metadata. | `web_scrape_status = 'partial'` |
| JS render timeout | Mark page as skipped. Continue crawl. | Per-page: `status = 'timeout'` |
| LLM extraction failure | Retry once. On second failure, pass raw cleaned text corpus with `extraction_status = 'raw'`. | `extraction_status = 'failed'` |
| Crawl exceeds 3-min SLA | Stop crawl, submit with pages scraped so far. | `web_scrape_status = 'timeout'` |

---

## 5. Non-Functional Requirements

### 5.1 Performance

- ✓ Full pipeline (crawl → clean → extract → store → trigger) completes in under 3 minutes for a typical SMB website (≤50 pages, publicly accessible, no JavaScript SPA).
- ✓ Per-page budget: static fetch ≤ 5 s; headless render ≤ 30 s (configurable).
- ✓ Concurrency: up to 5 pages crawled simultaneously per job.
- ✓ LLM extraction call: single consolidated call, ≤15,000 token corpus, targeting ≤30 s response time.

### 5.2 Reliability

- ✓ No uncaught exceptions — all errors are caught, logged, and result in a defined agent status code.
- ✓ Job retries: n8n retries the BA-002 node up to 2 times on uncaught agent failure before marking the job as failed and alerting.
- ✓ Idempotent: re-running BA-002 for the same `intake_id` overwrites the previous `web_context` record rather than creating a duplicate.

### 5.3 Security & Privacy

- ✓ The agent never stores raw HTML — only structured extracted data is persisted to Supabase.
- ✓ No authentication credentials are attempted. If a site requires login, it is treated as 'no content'.
- ✓ API keys for the LLM and Supabase are injected via environment variables — never hardcoded.
- ✓ Crawl activity is logged with timestamp, `intake_id`, and URL (not page content) for audit trail.

### 5.4 Observability

- ✓ Structured logs emitted to stdout in JSON format for each crawl event (`page_fetched`, `page_skipped`, `extraction_complete`, `error`).
- ✓ Crawl metrics persisted to Supabase `scrape_logs` table: `pages_attempted`, `pages_scraped`, `pages_skipped`, `total_duration_ms`, `token_count`.
- ✓ A scrape summary is written to the `web_context` record so downstream agents and the human reviewer can understand coverage.

---

## 6. Data Flow & Integration

### 6.1 Trigger

BA-002 is triggered by an n8n webhook fired immediately after BA-001 writes the intake form data to Supabase. The webhook payload contains:

- `intake_id` — UUID of the BA-001 Supabase record
- `website_url` — the URL entered by the client in the intake form
- `client_name` — for logging and the extraction prompt context

### 6.2 Supabase Reads

On trigger, the agent reads the full client profile from the `clients` table (BA-001 output) to provide context to the LLM extraction prompt. This allows the extraction model to be aware of the industry and self-reported services when classifying ambiguous content.

### 6.3 Supabase Writes

On completion, BA-002 writes one record to the `web_context` table (schema in Section 7) and updates the `scrape_status` field in the `clients` table.

### 6.4 BA-003 Trigger

On successful write (including graceful-failure states), BA-002 fires an n8n webhook to BA-003 passing the `intake_id`. BA-003 reads the `web_context` record from Supabase directly — BA-002 does not pass the full document in the webhook payload.

> **Integration Sequence**
>
> 1. BA-001 submits → n8n fires BA-002 webhook
> 2. BA-002 reads `clients` record from Supabase (`intake_id`)
> 3. BA-002 crawls `website_url`
> 4. BA-002 cleans and extracts structured signals via LLM
> 5. BA-002 writes `web_context` record to Supabase
> 6. BA-002 updates `clients.scrape_status` in Supabase
> 7. BA-002 fires BA-003 webhook with `intake_id`
> 8. BA-003 reads `web_context` from Supabase and proceeds

---

## 7. Output Schema — Web Context Document

The Web Context Document is the structured artefact passed from BA-002 to BA-003. It is stored in the Supabase `web_context` table and versioned by `intake_id`. The schema below is the v1.0 specification.

| Field | Type | Required | Description |
|---|---|---|---|
| `intake_id` | UUID | Yes | Foreign key to BA-001 `clients` record. |
| `scraped_at` | Timestamp | Yes | ISO 8601 timestamp of scrape completion. |
| `website_url` | String | Yes | Normalised root URL that was crawled. |
| `web_scrape_status` | Enum | Yes | `success` \| `partial` \| `no_content` \| `failed` \| `timeout` |
| `pages_scraped` | Integer | Yes | Count of pages where text was successfully extracted. |
| `pages_attempted` | Integer | Yes | Total pages discovered and attempted. |
| `services` | Array | No | Extracted services: `[{name, category, description}]` |
| `target_audience` | Array | No | Extracted audience segments as string array. |
| `tone_of_voice` | Enum | No | `formal` \| `conversational` \| `technical` \| `sales-heavy` \| `neutral` |
| `tech_stack` | Array | No | Named tools/platforms detected. String array. |
| `pricing_signals` | Object | No | `{present: bool, model: string, figures: array}` |
| `operational_tools` | Array | No | Detected widgets: `[{tool, category, confidence}]` |
| `confidence_score` | Float | Yes | 0.0–1.0. Reflects extraction coverage across 6 signal categories. |
| `error_reason` | String | No | Human-readable error message when `status != success`. |
| `raw_text_sample` | String | No | First 500 chars of clean corpus. Diagnostic only. |
| `extraction_status` | Enum | Yes | `extracted` \| `raw` \| `failed` |

---

## 8. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Orchestration | n8n | Native to the BA pipeline. Handles webhook trigger, retry logic, and BA-003 handoff. |
| Agent runtime | Node.js 20 / Python 3.12 | Node preferred for crawl engine (Playwright); Python acceptable if team preference. |
| Static fetch | Axios / fetch | Fast, minimal overhead for pages that render server-side. |
| JS rendering | Playwright (Chromium) | Industry standard. Handles SPAs, React/Next.js, lazy-loaded content. |
| HTML parsing | Cheerio / BeautifulSoup | Lightweight DOM parsing for link extraction and selector-based noise removal. |
| LLM extraction | Claude `claude-sonnet-4-20250514` | Structured JSON extraction via Anthropic API. Single consolidated call per job. |
| Database | Supabase (PostgreSQL) | Consistent with BA-001 and BA-003. `web_context` table added in this sprint. |
| Secrets | Environment variables | No secrets in code. Injected at runtime via n8n credentials or hosting env. |
| Logging | JSON stdout → n8n logs | Structured logs captured by n8n for each execution. |

---

## 9. Test Cases

| ID | Test Name | Input / Setup | Expected Result |
|---|---|---|---|
| TC-01 | Happy path — static site | Valid URL, static HTML, 10 pages, all signals present. | `web_scrape_status = success`; all 6 signal categories populated; `confidence_score > 0.7`; BA-003 triggered. |
| TC-02 | JavaScript-rendered site | Valid URL, Next.js SPA, requires headless render. | Pass 2 triggered; content extracted; `status = success`. |
| TC-03 | Depth limit enforcement | Site with 6 levels of pages; `SCRAPER_MAX_DEPTH = 3`. | Only pages at depth 0–3 are crawled. No depth-4+ pages in logs. |
| TC-04 | Page cap enforcement | Site with 200 indexable pages. | Crawl stops at 100 pages. `status = partial`. |
| TC-05 | Unreachable URL | URL returns 404 on all attempts. | `web_scrape_status = failed`; empty web context; BA-003 still triggered. |
| TC-06 | Empty content site | URL reachable but returns only navigation/footer HTML (<200 chars). | `web_scrape_status = no_content`; BA-003 still triggered. |
| TC-07 | robots.txt compliance | `robots.txt` disallows `/admin` and `/private`. | No requests made to disallowed paths. Logged as excluded. |
| TC-08 | Performance SLA | SMB site with 40 pages, mixed static/JS. | Total pipeline completes in < 180 seconds. |
| TC-09 | Idempotency | Run BA-002 twice for same `intake_id`. | Second run overwrites first `web_context` record. No duplicate rows. |
| TC-10 | Operational tools detection | Site with embedded Calendly and HubSpot form. | `operational_tools` array contains Calendly and HubSpot entries. |
| TC-11 | Pricing signals detection | Site has a `/pricing` page with three named tiers. | `pricing_signals.present = true`; `model = 'tiered'`; figures populated. |
| TC-12 | LLM extraction retry | LLM call returns 500 on first attempt. | Agent retries once. On second failure, passes raw corpus with `extraction_status = raw`. |

---

## 10. Sprint Build Plan

BA-002 is scoped for Sprint 2. It depends on BA-001 being complete and the Supabase schema extended with the `web_context` table.

| Task | Component | Description | Est. |
|---|---|---|---|
| T-01 | Supabase schema | Add `web_context` table and `scrape_logs` table. Add `scrape_status` column to `clients` table. Write migration script. | 0.5 day |
| T-02 | Crawl engine | Build URL discovery, depth limiter, page cap, `robots.txt` parser, and deduplication logic. | 1 day |
| T-03 | Static fetch layer | HTTP GET with timeout, retry, and status code handling. | 0.5 day |
| T-04 | Headless render layer | Playwright integration. Two-pass logic. JS timeout handling. | 1 day |
| T-05 | Text cleaning pipeline | HTML stripping, noise removal selectors, deduplication, truncation. | 0.5 day |
| T-06 | LLM extraction prompt | Design and test extraction prompt. Validate JSON schema output. Add retry logic. | 1 day |
| T-07 | Error handling & logging | All graceful degradation states. JSON structured logging. Supabase status writes. | 0.5 day |
| T-08 | n8n integration | Inbound webhook from BA-001. Outbound webhook to BA-003. Retry configuration. | 0.5 day |
| T-09 | Test cases | Execute TC-01 through TC-12. Document results. Fix failures. | 1 day |
| T-10 | Performance validation | Run TC-08 against 3 real SMB websites. Confirm 3-minute SLA. | 0.5 day |

**Total estimate: 7 developer days · 1.5 working weeks part-time (evenings + weekends).**

---

## 11. Open Questions & Decisions

| # | Question | Options / Notes | Owner |
|---|---|---|---|
| OQ-01 | Node.js or Python for the crawl agent? | Node.js + Playwright is the natural pairing. Python + Playwright also viable if the wider BA stack prefers Python. | Gerardo Romero |
| OQ-02 | Token budget — is 15,000 tokens per job sufficient? | Most SMB sites produce 5,000–10,000 clean tokens across 50 pages. Cap can be raised if edge cases emerge in testing. | Review after TC-01 |
| OQ-03 | `robots.txt` — honour `Crawl-delay` directive? | Some sites set `Crawl-delay > 2 s`. Honouring it could breach the 3-min SLA. Decision: honour up to 2 s, override above. | Gerardo Romero |
| OQ-04 | Should the scraper surface social profile links? | LinkedIn, Twitter/X, Instagram links are often present and could enrich BA-003. Not in v1.0 scope — flag for v1.1. | BA-003 team |
| OQ-05 | Alert channel for scrape failures? | n8n can send a Slack or email alert when `web_scrape_status = failed`. Confirm preferred channel before Sprint 2. | Gerardo Romero |

---

## 12. Dependencies & Downstream Impact

### 12.1 Upstream Dependency — BA-001

BA-002 cannot begin without a valid `intake_id` and `website_url` from BA-001. The Supabase `clients` table must be live and the n8n webhook from BA-001 must be configured before any BA-002 testing can occur.

### 12.2 Downstream Impact — BA-003

BA-003 (Proposal Generator) will read the `web_context` record created by BA-002. The quality of the proposal is directly proportional to the completeness of the web context. BA-003 must gracefully handle all `web_scrape_status` values including `failed` and `no_content`.

### 12.3 Supabase Schema Changes Required

The following schema changes are required before BA-002 development begins:

- New table: `web_context` (schema as per Section 7)
- New table: `scrape_logs` (`intake_id`, `page_url`, `status`, `duration_ms`, `error_reason`, `scraped_at`)
- New column: `clients.scrape_status` (enum: `pending` | `running` | `success` | `partial` | `no_content` | `failed` | `timeout`)

---

## Document Sign-off

| Field | Value |
|---|---|
| **Document** | BA-002 · Website Scraper Agent · PDR v1.0 |
| **Prepared by** | Kevin Bonilla · PO · ROBO AI Agency |
| **Status** | Draft — Ready for Development |
| **Date** | May 2026 |
| **Next review** | On completion of Sprint 2 · TC-01–TC-12 results |

---

*ROBO AI Agency · Confidential · May 2026*
