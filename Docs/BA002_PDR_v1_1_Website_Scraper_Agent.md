# BA-002 · Website Scraper Agent
### Product Design Requirements · v1.1

> **ROBO AI Agency** · *We analyse, demo, build and deploy AI solutions.*
> Confidential · May 2026

---

| Field | Value |
|---|---|
| **Document** | PDR — Product Design Requirements |
| **ID** | BA-002 |
| **Title** | Website Scraper Agent |
| **Version** | v1.1 · May 2026 |
| **Previous version** | v1.0 · May 2026 |
| **Author** | Kevin Bonilla · PO · ROBO AI Agency |
| **Epic** | Business Analyser Bundle (BA-series) |
| **Sprint** | Sprint 2 |
| **Status** | Draft — Ready for Development |
| **Story Points** | 13 pts *(revised from 8 — scope expanded)* |
| **Priority** | P1 Critical |
| **Depends on** | BA-001 (Business Intake Form) |
| **Feeds into** | BA-003 (Proposal Generator) |

---

## Changelog — v1.0 → v1.1

| # | Change | Reason |
|---|---|---|
| 1 | AC-04 revised — JS rendering trigger changed from timeout-based to DOM content-based | Live test on `cateringco.mx` (GoDaddy SPA) returned raw CSS/HTML skeleton. Timer alone is insufficient. |
| 2 | AC-03 expanded — extraction signals increased from 6 to 10 | Services, contact info, about us, geo coverage, social proof, and brand language were absent from the live scrape. |
| 3 | AC-05 revised — `confidence_score < 0.2` overrides status to `low_confidence` | A technically successful HTTP 200 with no usable content was labelled `success`, misleading BA-003. |
| 4 | New Section 5 — Web Technology Detection | Added requirement to detect the site's CMS/framework, hosting stack, and embedded third-party tools for product integration planning. |
| 5 | New Section 10 — Technical Implementation Instructions | Full developer-ready spec for Claude Code or any IDE. Covers project structure, environment, all modules, Supabase schema, and deployment. |
| 6 | OQ-06 added — BA-002 deployment target (n8n Cloud vs deployed function) | Playwright cannot run inside n8n's sandboxed Code node. Decision documented. |
| 7 | Story points revised 8 → 13 | Accounts for tech detection module, expanded extraction schema, DOM-condition rendering, and implementation instructions. |

---

## Table of Contents

1. [Purpose & Strategic Context](#1-purpose--strategic-context)
2. [User Story](#2-user-story)
3. [Acceptance Criteria](#3-acceptance-criteria)
4. [Functional Requirements](#4-functional-requirements)
5. [Web Technology Detection](#5-web-technology-detection)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Data Flow & Integration](#7-data-flow--integration)
8. [Output Schema — Web Context Document](#8-output-schema--web-context-document)
9. [Tech Stack](#9-tech-stack)
10. [Technical Implementation Instructions](#10-technical-implementation-instructions)
11. [Test Cases](#11-test-cases)
12. [Sprint Build Plan](#12-sprint-build-plan)
13. [Open Questions & Decisions](#13-open-questions--decisions)
14. [Dependencies & Downstream Impact](#14-dependencies--downstream-impact)

---

## 1. Purpose & Strategic Context

BA-002 is the second agent in the ROBO AI Agency automated analysis pipeline. Its single responsibility is to receive a URL from the BA-001 intake form, crawl the client's website, and return a structured Web Context Document to the BA-003 Proposal Generator — without any manual intervention.

Without web data, the downstream Analyzer and Proposal Generator must rely solely on self-reported form answers. Real websites contain signals that clients rarely articulate: the language they actually use with customers, the operational tools they have embedded, pricing hints, and the gap between how they describe themselves and how their site presents them. BA-002 closes that gap.

**v1.1 adds a critical new layer:** web technology detection. Knowing that a client runs on WordPress, Shopify, HubSpot, or a GoDaddy website builder is not just a curiosity — it directly informs which ROBO AI products can integrate with them, at what complexity, and at what cost. This signal feeds BA-003's product recommendations.

> **Agent Position in the BA Pipeline**
>
> `BA-001 (Intake Form)  →  BA-002 (Website Scraper)  →  BA-003 (Proposal Generator)`
>
> BA-002 is triggered automatically by n8n when BA-001 submits. It enriches the client record in Supabase and passes its structured output directly to BA-003.

---

## 2. User Story

> *"As a prospective client, I want the platform to scan my website automatically so that the analysis is enriched with real context about my business — without me needing to manually describe what I do or how I communicate."*

**Supplementary story (internal — BA-003 and product team):**

> *"As a ROBO AI proposal agent, I need to know what technology stack the client's website is built on so that I can recommend products that will integrate smoothly, flag integration complexity, and avoid recommending solutions that are incompatible with their stack."*

---

## 3. Acceptance Criteria

All criteria below must be met for BA-002 to be considered complete. Each maps to a test case in Section 11.

### AC-01 · Zero-touch trigger

- ✓ Agent accepts the client URL from the BA-001 Supabase record and begins scraping with no manual intervention. Trigger is fired by n8n webhook on BA-001 submission.

### AC-02 · Configurable depth crawl

- ✓ Agent crawls all indexable pages up to a configurable depth limit. Default depth is 3 levels from the root URL. Depth is set via environment variable `SCRAPER_MAX_DEPTH` and can be overridden per-run.
- ✓ Crawler respects `robots.txt` directives and does not crawl disallowed paths.
- ✓ Duplicate URLs (after normalisation) are deduplicated before processing.

### AC-03 · Expanded structured extraction *(revised v1.1)*

The scraper extracts and classifies the following ten signal categories from clean page text:

**Original six signals:**
- ✓ **Services offered** — full service catalog: names, categories, descriptions as written on the site
- ✓ **Target audience** — named customer segments, industry verticals, or persona language
- ✓ **Tone of voice** — classified as: `formal` / `conversational` / `technical` / `sales-heavy` / `neutral`
- ✓ **Technology stack mentions** — tools, platforms, or integrations named in copy or page source
- ✓ **Pricing signals** — pricing pages, ranges, tiers, or 'contact for pricing' language
- ✓ **Operational tools** — booking widgets, chatbots, CRM forms, helpdesk portals, payment processors

**Four new signals added in v1.1:**
- ✓ **Contact information** — phone numbers, email addresses, WhatsApp links, physical addresses, operating hours
- ✓ **About / brand story** — founding narrative, mission statement, differentiators, brand positioning language
- ✓ **Geographic coverage** — cities, regions, countries served; delivery or service radius language
- ✓ **Social proof** — testimonials, named clients, event types referenced, awards, press mentions

### AC-04 · JavaScript rendering — DOM-condition based *(revised v1.1)*

- ✓ Agent uses a **two-pass rendering strategy**. Pass 1 is a fast static HTTP GET. Pass 2 (headless Chromium via Playwright) is triggered if clean text body is under 500 characters **OR** if the `<main>`, `<article>`, or `<section>` elements contain fewer than 3 child nodes with text content.
- ✓ Pass 2 waits for `networkidle` state **AND** verifies that a primary content selector (`main`, `[role="main"]`, `.content`, `#content`, `article`) contains visible text before extracting — not just a timer.
- ✓ If neither condition is met after the JS timeout, the page is marked `render_failed` and skipped — not treated as successful.
- ✓ Rendering timeout is configurable via `SCRAPER_JS_TIMEOUT` (default: 15 seconds, increased from 10 s).

### AC-05 · Graceful failure handling with confidence gating *(revised v1.1)*

- ✓ If the URL is unreachable (DNS failure, 4xx/5xx response, TLS error, or timeout), the agent sets `web_scrape_status = 'failed'` and passes an empty web context document to BA-003.
- ✓ If scraping returns no usable content (total clean text < 200 characters across all pages), the agent flags `web_scrape_status = 'no_content'`.
- ✓ **New:** If scraping technically succeeds (HTTP 200, content returned) but `confidence_score < 0.2`, the agent overrides `web_scrape_status` to `'low_confidence'` — never `'success'`. BA-003 is informed the enrichment is unreliable.
- ✓ The BA-003 pipeline is never blocked by any BA-002 failure state.

### AC-06 · Performance SLA

- ✓ Full pipeline completes in under 3 minutes for a typical SMB website (≤50 indexable pages, publicly accessible).
- ✓ Per-page budget: static fetch ≤ 5 s; headless render ≤ 30 s.

### AC-07 · Structured output delivery

- ✓ Output is a valid Web Context Document (schema in Section 8) written to the Supabase `web_context` table.
- ✓ `confidence_score` (0.0–1.0) reflects coverage across all 10 signal categories.
- ✓ `tech_profile` object populated with detected CMS, framework, hosting, and integration signals (Section 5).

---

## 4. Functional Requirements

### 4.1 Crawl Engine

| Requirement | Description | Default / Constraint |
|---|---|---|
| Seed URL | Accept a single root URL. Normalise trailing slashes and www/non-www variants before starting. | From Supabase `website_url` |
| Depth limit | Crawl links up to N levels from root. Level 0 = seed; Level 1 = pages directly linked; etc. | Default: 3 |
| Page cap | Stop after max unique pages to prevent runaway crawls. | Max: 100 pages |
| Scope | Same root domain only. No external links. | Same-origin only |
| Priority pages | Crawl these slugs first if found: `/about`, `/services`, `/pricing`, `/contact`, `/our-work`, `/nosotros`, `/servicios`, `/contacto` | Configurable list |
| robots.txt | Fetch, parse, honour all `Disallow` directives. | Mandatory |
| Politeness delay | Delay between consecutive requests to same host. | 500 ms default |
| Concurrency | Parallel page crawls. | Max 5 concurrent |
| User-agent | Transparent crawler identifier. | `ROBOAIBot/1.0` |

### 4.2 Rendering Strategy *(revised v1.1)*

**Pass 1 — Static fetch:**
1. HTTP GET with 10 s timeout.
2. Extract visible text using Cheerio, stripping nav/footer/cookie selectors.
3. If clean text ≥ 500 characters **AND** `<main>`/`<article>`/`<section>` has ≥ 3 child nodes with text → accept, skip Pass 2.
4. Otherwise → proceed to Pass 2.

**Pass 2 — Headless render:**
1. Launch Playwright Chromium in headless mode.
2. Navigate to URL.
3. Wait for `networkidle` event (max `SCRAPER_JS_TIMEOUT` seconds).
4. **Content verification check:** query `main, [role="main"], article, .content, #content` — if selector returns a node with visible text of ≥ 300 characters, proceed. If not, extend wait by 3 s and check once more.
5. Extract full DOM text.
6. If still under threshold after both checks → mark `render_failed`, skip page.

> **Why this matters for SPA sites (GoDaddy, Wix, Squarespace, Webflow)**
>
> These builders hydrate content asynchronously after `DOMContentLoaded`. A timer-only wait
> often captures the shell before content has loaded. The DOM content verification check
> ensures actual business content is present before extraction proceeds.

### 4.3 Text Cleaning Pipeline

Applied to every page before it enters the extraction corpus:

1. Strip all HTML tags, preserving heading/paragraph whitespace structure.
2. Remove structural noise via CSS selector targeting: `nav`, `header`, `footer`, `#cookie-banner`, `.cookie`, `.legal`, `.disclaimer`, `[aria-hidden="true"]`.
3. Remove duplicate paragraphs — same text on multiple pages is deduplicated at corpus level.
4. Normalise whitespace: collapse multiple spaces and blank lines into single separators.
5. Detect and flag language (ES / EN / other) per page using `franc` or equivalent.
6. Truncate per-page content at 3,000 tokens.
7. Total corpus capped at 20,000 tokens *(increased from 15,000 to accommodate 10-signal extraction)*.

### 4.4 LLM Extraction — 10-Signal Classification

Single `claude-sonnet-4-20250514` call per job. System prompt instructs the model to return only valid JSON conforming to the Web Context Document schema. No preamble, no markdown fences.

**Extraction prompt structure:**

```
SYSTEM:
You are a business intelligence extraction agent. You will receive the cleaned text corpus
from a business website, plus the client's self-reported profile from their intake form.
Extract all signals listed below. Return ONLY a valid JSON object. No preamble.
If a signal cannot be determined, return null for that field.

SIGNALS TO EXTRACT:
1. services        — full catalog [{name, category, description, pricing_hint}]
2. target_audience — segments, industries, company sizes [array of strings]
3. tone_of_voice   — single label: formal|conversational|technical|sales-heavy|neutral
4. tech_stack      — named tools visible in copy or meta [array of strings]
5. pricing_signals — {present, model, figures[], contact_for_pricing}
6. operational_tools — [{tool, category, confidence, integration_url}]
7. contact_info    — {phone[], email[], whatsapp, address, hours}
8. brand_story     — {tagline, mission, differentiators[], founding_year}
9. geo_coverage    — {cities[], regions[], countries[], service_radius}
10. social_proof   — {testimonials_present, client_names[], event_types[], awards[]}

INTAKE FORM CONTEXT (use to resolve ambiguity):
{intake_form_json}

WEBSITE CORPUS:
{cleaned_corpus}
```

### 4.5 Graceful Degradation & Error Handling *(revised v1.1)*

| Failure Scenario | Agent Behaviour | `web_scrape_status` |
|---|---|---|
| URL unreachable (DNS, timeout, 5xx) | Log error, set empty web context, trigger BA-003 with flag. | `failed` |
| No usable content returned | Log reason, empty web context, continue. | `no_content` |
| HTTP 200 but `confidence_score < 0.2` | Override status. BA-003 warned enrichment is unreliable. | `low_confidence` *(new)* |
| Partial scrape (some pages fail) | Continue with successful pages. Log skipped pages. | `partial` |
| JS render timeout / DOM check failed | Mark page skipped. Continue crawl. | Per-page: `render_failed` |
| LLM extraction failure | Retry once. On second failure, pass raw corpus. | `extraction_status = raw` |
| Crawl exceeds 3-min SLA | Stop, submit pages scraped so far. | `timeout` |

---

## 5. Web Technology Detection

> **This is a new section added in v1.1.** Technology detection runs in parallel with the content scrape and populates the `tech_profile` object in the Web Context Document. Its output directly informs which ROBO AI products BA-003 can recommend and how complex the integration will be.

### 5.1 Why Technology Detection Matters

Knowing the client's web technology stack answers three critical questions for ROBO AI:

- **Can our products integrate?** A client on WordPress can receive CB-01 (AI Chatbot) via a plugin. A client on a locked GoDaddy builder may require an iframe embed or a separate landing page.
- **What is the integration complexity?** Shopify = low (REST API + webhooks). Custom-built React app = medium. Legacy PHP site = high.
- **What does their current stack signal about their technical maturity?** A client using HubSpot CRM is already in the ecosystem. A client on Excel has no CRM — a different conversation entirely.

### 5.2 Detection Method

Technology detection uses three parallel approaches, combined for maximum coverage:

**A) HTTP Response Headers**

Inspect response headers for known platform fingerprints:

| Header / Value | Platform Detected |
|---|---|
| `X-Powered-By: PHP/x.x` | PHP-based CMS (likely WordPress, Laravel, Drupal) |
| `X-Generator: WordPress x.x` | WordPress (version captured) |
| `Server: Squarespace` | Squarespace |
| `x-wix-request-id` present | Wix |
| `X-Shopify-Stage` present | Shopify |
| `x-vercel-id` present | Vercel-hosted (likely Next.js) |
| `X-HubSpot-*` headers | HubSpot CMS |
| `CF-Ray` present | Cloudflare (hosting/CDN layer) |

**B) HTML Source Inspection**

Scan raw HTML `<head>` and `<body>` for known fingerprints before any JS rendering:

```
CMS / Builder detection:
- <meta name="generator" content="WordPress x.x">           → WordPress
- <meta name="generator" content="Wix.com Website Builder"> → Wix
- <link rel="stylesheet" href="*squarespace*">              → Squarespace
- data-ux="..." attributes (GoDaddy Website Builder)        → GoDaddy
- <script src="*webflow*">                                  → Webflow
- <script src="*shopify*">                                  → Shopify
- <meta name="generator" content="Framer">                  → Framer

JS Framework detection (script src patterns):
- /_next/static/                                            → Next.js
- /wp-content/ or /wp-includes/                             → WordPress
- react, react-dom in script src                            → React
- vue.js or vue.min.js                                      → Vue.js
- angular.min.js or @angular                                → Angular
- gtag.js or analytics.js                                   → Google Analytics
- fbq (Facebook Pixel)                                      → Meta Pixel
- intercom-snippet                                          → Intercom
- hs-scripts.js                                             → HubSpot
- drift.js                                                  → Drift
- crisp.chat                                                → Crisp Chat
- tawk.to                                                   → Tawk.to
- calendly.com/assets                                       → Calendly
- js.stripe.com                                             → Stripe
- checkout.paypal.com                                       → PayPal

E-commerce signals:
- <script src="*shopify*">                                  → Shopify
- WooCommerce body class                                     → WooCommerce
- Tiendanube script patterns                                → Tiendanube (LATAM)
- MercadoPago scripts                                       → MercadoPago (LATAM)
```

**C) Third-party DNS / WHOIS enrichment (optional, v1.1 flag)**

If `SCRAPER_DNS_ENRICHMENT=true`, perform a DNS lookup on the root domain to detect:
- Hosting provider (Cloudflare, AWS, GoDaddy, Hetzner, HostGator)
- MX records revealing email provider (Google Workspace, Microsoft 365, Zoho)
- SPF/TXT records revealing marketing platforms (Mailchimp, HubSpot, Klaviyo)

### 5.3 Integration Complexity Scoring

After detection, the agent assigns an **integration complexity score** to guide BA-003 product recommendations:

| Score | Label | Criteria | Implication for ROBO AI |
|---|---|---|---|
| 1 | **Plug-and-play** | WordPress, Shopify, Webflow, Wix (with JS embeds) | CB-01 chatbot deploys via script tag or plugin. AVA-01 can embed. Low effort. |
| 2 | **Standard** | HubSpot CMS, Squarespace, Framer, Webflow | Script tag embed works. Some CMS restrictions. Medium config. |
| 3 | **Custom integration** | Next.js, React, Vue, Angular custom builds | API-first approach needed. Developer access required on client side. |
| 4 | **High complexity** | GoDaddy Website Builder, Jimdo, locked SaaS builders | Limited embed options. May require separate landing page or subdomain deployment. |
| 5 | **No website / offline** | No site found, parked domain, under construction | Propose standalone ROBO AI landing page as part of the engagement. |

### 5.4 LATAM-Specific Platform Detection

Given the agency's Latin American market focus, additional detection patterns are required:

| Platform | Detection Signal | Relevance |
|---|---|---|
| **Tiendanube** | `tiendanube.com` in scripts or DNS | Leading SMB e-commerce in MX, AR, BR, CO |
| **MercadoPago** | `mp.js` or `mercadopago` in scripts | Dominant payment processor in LATAM |
| **MercadoShops** | `mercadoshops` in page source | MercadoLibre-hosted storefronts |
| **Shopify ES** | `myshopify.com` DNS + Spanish content | Growing in MX and CO |
| **GoDaddy Website Builder** | `data-ux` attributes, `secureserver.net` DNS | Very common in MX SMB segment |
| **WhatsApp Business** | `wa.me/` links or WhatsApp widget scripts | Primary SMB comms channel in LATAM — integration signal |
| **Hotmart** | `hotmart.com` in links | Digital product / course sales (BR, MX, CO) |

---

## 6. Non-Functional Requirements

### 6.1 Performance

- ✓ Full pipeline (crawl → detect → clean → extract → store → trigger) completes in under 3 minutes for a typical SMB website (≤50 pages, publicly accessible).
- ✓ Tech detection runs in parallel with page crawl — zero additional wall-clock time.
- ✓ Per-page budget: static fetch ≤ 5 s; headless render ≤ 30 s.
- ✓ LLM extraction: single consolidated call, ≤20,000 token corpus, targeting ≤30 s.

### 6.2 Reliability

- ✓ No uncaught exceptions — all errors caught, logged, result in a defined status code.
- ✓ n8n retries BA-002 up to 2 times on uncaught failure before alerting.
- ✓ Idempotent: re-running BA-002 for the same `intake_id` overwrites previous records.

### 6.3 Security & Privacy

- ✓ Raw HTML never persisted — only structured extracted data stored in Supabase.
- ✓ No authentication credentials attempted against client sites.
- ✓ All API keys injected via environment variables — never hardcoded.
- ✓ Crawl audit log: timestamp, `intake_id`, URL — no page content.

### 6.4 Observability

- ✓ JSON structured logs to stdout for: `page_fetched`, `page_skipped`, `render_failed`, `tech_detected`, `extraction_complete`, `error`.
- ✓ Crawl metrics to Supabase `scrape_logs`: `pages_attempted`, `pages_scraped`, `pages_skipped`, `render_pass2_count`, `total_duration_ms`, `token_count`.
- ✓ `tech_profile` and `confidence_score` visible in `web_context` record for human review.

---

## 7. Data Flow & Integration

### 7.1 Trigger

n8n webhook fired by BA-001 on form submission. Payload:

```json
{
  "intake_id": "uuid",
  "website_url": "https://example.com",
  "client_name": "Acme Co",
  "industry": "Catering"
}
```

### 7.2 Supabase Reads

Read full `clients` record (BA-001 output) to inject intake form context into the LLM extraction prompt.

### 7.3 Supabase Writes

- Write `web_context` record (schema Section 8)
- Update `clients.scrape_status`
- Write page-level rows to `scrape_logs`

### 7.4 BA-003 Trigger

On completion (any status), fire n8n webhook to BA-003 with `intake_id`. BA-003 reads `web_context` from Supabase directly.

> **Integration Sequence**
>
> 1. BA-001 submits → n8n fires BA-002 webhook
> 2. BA-002 reads `clients` record (intake_id)
> 3. BA-002 crawls website — tech detection runs in parallel
> 4. BA-002 cleans corpus, runs 10-signal LLM extraction
> 5. BA-002 writes `web_context` to Supabase
> 6. BA-002 updates `clients.scrape_status`
> 7. BA-002 fires BA-003 webhook with `intake_id`
> 8. BA-003 reads `web_context` and generates proposal

---

## 8. Output Schema — Web Context Document

Stored in Supabase `web_context` table. v1.1 adds `contact_info`, `brand_story`, `geo_coverage`, `social_proof`, and `tech_profile`.

### 8.1 Core Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `intake_id` | UUID | Yes | Foreign key to BA-001 `clients` record. |
| `scraped_at` | Timestamp | Yes | ISO 8601 timestamp of scrape completion. |
| `website_url` | String | Yes | Normalised root URL crawled. |
| `web_scrape_status` | Enum | Yes | `success` \| `partial` \| `no_content` \| `low_confidence` \| `failed` \| `timeout` |
| `pages_scraped` | Integer | Yes | Pages where text was successfully extracted. |
| `pages_attempted` | Integer | Yes | Total pages discovered and attempted. |
| `render_pass2_count` | Integer | Yes | Pages that required headless JS rendering. |
| `confidence_score` | Float | Yes | 0.0–1.0. Coverage across all 10 signal categories. |
| `extraction_status` | Enum | Yes | `extracted` \| `raw` \| `failed` |
| `error_reason` | String | No | Human-readable error when `status != success`. |
| `detected_language` | String | Yes | Primary language of site content: `es` \| `en` \| `pt` \| `other` |
| `raw_text_sample` | String | No | First 500 chars of clean corpus. Diagnostic only. |

### 8.2 Content Extraction Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `services` | Array | No | `[{name, category, description, pricing_hint}]` |
| `target_audience` | Array | No | Audience segments as string array. |
| `tone_of_voice` | Enum | No | `formal` \| `conversational` \| `technical` \| `sales-heavy` \| `neutral` |
| `pricing_signals` | Object | No | `{present, model, figures[], contact_for_pricing}` |
| `operational_tools` | Array | No | `[{tool, category, confidence, integration_url}]` |
| `contact_info` | Object | No | `{phone[], email[], whatsapp, address, hours}` |
| `brand_story` | Object | No | `{tagline, mission, differentiators[], founding_year}` |
| `geo_coverage` | Object | No | `{cities[], regions[], countries[], service_radius}` |
| `social_proof` | Object | No | `{testimonials_present, client_names[], event_types[], awards[]}` |

### 8.3 Tech Profile Fields *(new in v1.1)*

| Field | Type | Required | Description |
|---|---|---|---|
| `tech_profile` | Object | Yes | Full technology detection result (see below). |
| `tech_profile.cms` | String | No | Detected CMS or website builder: `wordpress` \| `shopify` \| `wix` \| `squarespace` \| `webflow` \| `godaddy` \| `framer` \| `tiendanube` \| `hubspot_cms` \| `custom` \| `unknown` |
| `tech_profile.js_framework` | String | No | Detected JS framework: `nextjs` \| `react` \| `vue` \| `angular` \| `none` \| `unknown` |
| `tech_profile.hosting` | String | No | Inferred hosting provider. |
| `tech_profile.email_provider` | String | No | Detected from MX records: `google` \| `microsoft` \| `zoho` \| `other` |
| `tech_profile.analytics` | Array | No | Detected analytics tools: `[google_analytics, meta_pixel, hotjar, ...]` |
| `tech_profile.crm_signals` | Array | No | Detected CRM/marketing tools: `[hubspot, salesforce, mailchimp, ...]` |
| `tech_profile.payment_processors` | Array | No | `[stripe, paypal, mercadopago, ...]` |
| `tech_profile.chat_tools` | Array | No | `[intercom, drift, crisp, tawk, whatsapp_widget, ...]` |
| `tech_profile.booking_tools` | Array | No | `[calendly, acuity, cal_com, ...]` |
| `tech_profile.ecommerce_signals` | Array | No | `[woocommerce, shopify_checkout, mercadoshops, ...]` |
| `tech_profile.latam_tools` | Array | No | LATAM-specific: `[tiendanube, mercadopago, hotmart, ...]` |
| `tech_profile.integration_complexity` | Integer | Yes | 1–5 score. See Section 5.3. |
| `tech_profile.integration_notes` | String | No | Human-readable integration implication for BA-003. |
| `tech_profile.whatsapp_present` | Boolean | Yes | `wa.me` link or WhatsApp widget detected. |

---

## 9. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Orchestration | n8n Cloud | Handles webhook trigger, retry logic, BA-003 handoff. No infrastructure overhead. |
| Agent deployment | Railway or Render (Node.js service) | Playwright cannot run in n8n Code node. Deployed function exposes POST endpoint. n8n calls it. |
| Agent runtime | Node.js 20 | Native Playwright support. Async/await concurrency model fits crawl pattern well. |
| Static fetch | `axios` | Fast, timeout-configurable HTTP client. |
| JS rendering | Playwright (Chromium) | Handles SPAs, GoDaddy, Wix, Next.js. DOM content-check support. |
| HTML parsing | Cheerio | Lightweight DOM parsing for link extraction and noise removal selectors. |
| Tech detection | Custom module (`wappalyzer-core` or pattern matching) | `wappalyzer-core` (npm) provides 1,500+ technology fingerprints out of the box. |
| Language detection | `franc` (npm) | Lightweight language classifier. Used to flag ES/EN/PT corpus for BA-003 tone matching. |
| LLM extraction | Claude `claude-sonnet-4-20250514` | Structured JSON extraction. Single consolidated call per job. |
| Database | Supabase (PostgreSQL) | Consistent with BA-001 and BA-003. |
| Secrets | Environment variables | Injected at runtime. Never in code. |
| Logging | JSON stdout → Railway/Render logs + n8n | Structured logs per execution. |

---

## 10. Technical Implementation Instructions

> **These instructions are written for Claude Code or any IDE agent.** Follow them in sequence. Do not skip sections. Each module is independently testable before integration.

### 10.1 Project Setup

```bash
# Initialise project
mkdir ba-002-scraper && cd ba-002-scraper
npm init -y

# Core dependencies
npm install axios cheerio playwright franc-min wappalyzer-core \
            @supabase/supabase-js dotenv

# Install Playwright Chromium browser
npx playwright install chromium

# Dev dependencies
npm install --save-dev typescript @types/node tsx nodemon jest
```

**Directory structure:**

```
ba-002-scraper/
├── src/
│   ├── index.ts              # Express server — POST /scrape endpoint
│   ├── crawler/
│   │   ├── fetchStatic.ts    # Pass 1: axios HTTP fetch
│   │   ├── fetchHeadless.ts  # Pass 2: Playwright DOM-condition render
│   │   ├── linkExtractor.ts  # Cheerio link discovery + deduplication
│   │   └── robotsParser.ts   # robots.txt fetch and Disallow enforcement
│   ├── cleaner/
│   │   ├── htmlCleaner.ts    # Strip HTML, remove noise selectors
│   │   ├── deduplicator.ts   # Cross-page paragraph deduplication
│   │   └── tokenizer.ts      # Truncate to token budget
│   ├── detector/
│   │   ├── techDetector.ts   # Wappalyzer + custom pattern matching
│   │   ├── headerAnalyser.ts # HTTP response header fingerprinting
│   │   ├── dnsEnricher.ts    # Optional DNS/MX lookup
│   │   └── complexityScorer.ts # Integration complexity 1–5 scoring
│   ├── extractor/
│   │   ├── llmExtractor.ts   # Claude API call + JSON parsing
│   │   └── prompt.ts         # System and user prompt templates
│   ├── db/
│   │   ├── supabaseClient.ts # Supabase singleton
│   │   ├── writeContext.ts   # web_context upsert
│   │   └── writeLogs.ts      # scrape_logs insert
│   └── types/
│       └── webContext.ts     # TypeScript types for all schema objects
├── .env.example
├── Dockerfile
└── package.json
```

### 10.2 Environment Variables

```bash
# .env.example

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Scraper config
SCRAPER_MAX_DEPTH=3
SCRAPER_MAX_PAGES=100
SCRAPER_CONCURRENCY=5
SCRAPER_STATIC_TIMEOUT=10000        # ms
SCRAPER_JS_TIMEOUT=15000            # ms
SCRAPER_MIN_CONTENT_CHARS=500       # Pass 1 acceptance threshold
SCRAPER_POLITENESS_DELAY=500        # ms between requests
SCRAPER_TOKEN_BUDGET_PER_PAGE=3000
SCRAPER_TOKEN_BUDGET_TOTAL=20000
SCRAPER_DNS_ENRICHMENT=false        # Enable DNS/MX detection

# n8n outbound webhook (BA-003 trigger)
N8N_BA003_WEBHOOK_URL=https://your-n8n.cloud/webhook/ba003-trigger

# Server
PORT=3000
```

### 10.3 Module: `fetchStatic.ts`

```typescript
// src/crawler/fetchStatic.ts
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface StaticFetchResult {
  url: string;
  status: number;
  html: string;
  headers: Record<string, string>;
  cleanText: string;
  passedThreshold: boolean;
}

const NOISE_SELECTORS = [
  'nav', 'header', 'footer', '.cookie', '#cookie-banner',
  '.legal', '.disclaimer', '[aria-hidden="true"]',
  'script', 'style', 'noscript', 'svg', 'img'
];

export async function fetchStatic(url: string): Promise<StaticFetchResult> {
  const timeout = parseInt(process.env.SCRAPER_STATIC_TIMEOUT || '10000');
  const minChars = parseInt(process.env.SCRAPER_MIN_CONTENT_CHARS || '500');

  const response = await axios.get(url, {
    timeout,
    headers: { 'User-Agent': 'ROBOAIBot/1.0' },
    validateStatus: () => true, // Don't throw on 4xx/5xx
  });

  const $ = cheerio.load(response.data);
  NOISE_SELECTORS.forEach(sel => $(sel).remove());

  const cleanText = $('body').text()
    .replace(/\s+/g, ' ')
    .trim();

  // DOM content check: does main/article/section have real children?
  const contentNodes = $('main, [role="main"], article, section')
    .filter((_, el) => $(el).text().trim().length > 50).length;

  const passedThreshold = cleanText.length >= minChars && contentNodes >= 3;

  return {
    url,
    status: response.status,
    html: response.data,
    headers: response.headers as Record<string, string>,
    cleanText,
    passedThreshold,
  };
}
```

### 10.4 Module: `fetchHeadless.ts`

```typescript
// src/crawler/fetchHeadless.ts
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

const CONTENT_SELECTORS = [
  'main', '[role="main"]', 'article',
  '.content', '#content', '#main', '.main-content'
];

const NOISE_SELECTORS = [
  'nav', 'header', 'footer', '.cookie', '#cookie-banner',
  'script', 'style', 'noscript', 'svg'
];

export interface HeadlessFetchResult {
  cleanText: string;
  passedThreshold: boolean;
  renderStatus: 'success' | 'timeout' | 'render_failed';
}

export async function fetchHeadless(url: string): Promise<HeadlessFetchResult> {
  const jsTimeout = parseInt(process.env.SCRAPER_JS_TIMEOUT || '15000');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({ 'User-Agent': 'ROBOAIBot/1.0' });

  try {
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: jsTimeout,
    });

    // DOM content verification — wait for real content to hydrate
    let contentText = '';
    for (const selector of CONTENT_SELECTORS) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        const el = await page.$(selector);
        if (el) {
          contentText = await el.innerText();
          if (contentText.trim().length >= 300) break;
        }
      } catch {
        continue; // selector not found — try next
      }
    }

    // Fallback: full body if no content selector matched
    if (contentText.length < 300) {
      const html = await page.content();
      const $ = cheerio.load(html);
      NOISE_SELECTORS.forEach(sel => $(sel).remove());
      contentText = $('body').text().replace(/\s+/g, ' ').trim();
    }

    const passedThreshold = contentText.trim().length >= 300;

    return {
      cleanText: contentText.trim(),
      passedThreshold,
      renderStatus: passedThreshold ? 'success' : 'render_failed',
    };

  } catch (err: any) {
    const isTimeout = err.message?.includes('timeout');
    return {
      cleanText: '',
      passedThreshold: false,
      renderStatus: isTimeout ? 'timeout' : 'render_failed',
    };
  } finally {
    await browser.close();
  }
}
```

### 10.5 Module: `techDetector.ts`

```typescript
// src/detector/techDetector.ts
// Uses wappalyzer-core for broad coverage + custom LATAM patterns

import Wappalyzer from 'wappalyzer-core';

export interface TechProfile {
  cms: string;
  js_framework: string;
  hosting: string;
  email_provider: string;
  analytics: string[];
  crm_signals: string[];
  payment_processors: string[];
  chat_tools: string[];
  booking_tools: string[];
  ecommerce_signals: string[];
  latam_tools: string[];
  integration_complexity: number;
  integration_notes: string;
  whatsapp_present: boolean;
}

// Custom LATAM + SMB patterns not in Wappalyzer
const CUSTOM_PATTERNS: Record<string, { category: string; pattern: RegExp }[]> = {
  payment_processors: [
    { category: 'mercadopago', pattern: /mercadopago|mp\.js|sdk\.mercadopago/i },
    { category: 'conekta', pattern: /conekta\.io|cdn\.conekta/i },
    { category: 'openpay', pattern: /openpay\.mx/i },
  ],
  ecommerce_signals: [
    { category: 'tiendanube', pattern: /tiendanube\.com|nuvemshop/i },
    { category: 'mercadoshops', pattern: /mercadoshops\.com/i },
    { category: 'hotmart', pattern: /hotmart\.com/i },
  ],
  chat_tools: [
    { category: 'whatsapp_widget', pattern: /wa\.me\/|api\.whatsapp\.com\/send/i },
    { category: 'tawk', pattern: /tawk\.to/i },
    { category: 'crisp', pattern: /crisp\.chat/i },
  ],
  booking_tools: [
    { category: 'calendly', pattern: /calendly\.com/i },
    { category: 'cal_com', pattern: /cal\.com/i },
    { category: 'acuity', pattern: /acuityscheduling\.com/i },
  ],
};

const COMPLEXITY_MAP: Record<string, number> = {
  wordpress: 1, shopify: 1, wix: 1, webflow: 2, squarespace: 2,
  framer: 2, hubspot_cms: 2, nextjs: 3, react: 3, vue: 3,
  angular: 3, godaddy: 4, custom: 3, unknown: 3,
};

export async function detectTech(
  url: string,
  html: string,
  headers: Record<string, string>
): Promise<TechProfile> {

  // Run Wappalyzer detection
  const wappalyzer = new Wappalyzer();
  const detected = await wappalyzer.analyze({ url, html, headers });

  const cms = extractCMS(detected) || 'unknown';
  const js_framework = extractFramework(detected, html) || 'unknown';
  const analytics = extractCategory(detected, 'Analytics');
  const crm_signals = extractCategory(detected, 'CRM');
  const payment_processors = [
    ...extractCategory(detected, 'Payment processors'),
    ...matchCustom(html, CUSTOM_PATTERNS.payment_processors),
  ];
  const chat_tools = [
    ...extractCategory(detected, 'Live chat'),
    ...matchCustom(html, CUSTOM_PATTERNS.chat_tools),
  ];
  const booking_tools = matchCustom(html, CUSTOM_PATTERNS.booking_tools);
  const ecommerce_signals = [
    ...extractCategory(detected, 'Ecommerce'),
    ...matchCustom(html, CUSTOM_PATTERNS.ecommerce_signals),
  ];
  const latam_tools = [
    ...matchCustom(html, CUSTOM_PATTERNS.payment_processors).filter(t =>
      ['mercadopago', 'conekta', 'openpay'].includes(t)
    ),
    ...matchCustom(html, CUSTOM_PATTERNS.ecommerce_signals),
  ];

  const whatsapp_present = /wa\.me\/|api\.whatsapp\.com\/send/i.test(html);

  const hosting = extractHosting(headers);
  const email_provider = extractEmailFromHeaders(headers);
  const integration_complexity = COMPLEXITY_MAP[cms] ?? 3;
  const integration_notes = buildIntegrationNote(cms, integration_complexity, chat_tools, payment_processors);

  return {
    cms, js_framework, hosting, email_provider, analytics,
    crm_signals, payment_processors, chat_tools, booking_tools,
    ecommerce_signals, latam_tools, integration_complexity,
    integration_notes, whatsapp_present,
  };
}

function extractCMS(detected: any): string {
  const cms_map: Record<string, string> = {
    'WordPress': 'wordpress', 'Shopify': 'shopify', 'Wix': 'wix',
    'Squarespace': 'squarespace', 'Webflow': 'webflow', 'Framer': 'framer',
    'HubSpot CMS': 'hubspot_cms', 'GoDaddy Website Builder': 'godaddy',
  };
  for (const [name, key] of Object.entries(cms_map)) {
    if (detected.technologies?.find((t: any) => t.name === name)) return key;
  }
  return 'unknown';
}

function extractFramework(detected: any, html: string): string {
  if (detected.technologies?.find((t: any) => t.name === 'Next.js')) return 'nextjs';
  if (detected.technologies?.find((t: any) => t.name === 'React')) return 'react';
  if (detected.technologies?.find((t: any) => t.name === 'Vue.js')) return 'vue';
  if (detected.technologies?.find((t: any) => t.name === 'Angular')) return 'angular';
  return 'none';
}

function extractCategory(detected: any, category: string): string[] {
  return (detected.technologies || [])
    .filter((t: any) => t.categories?.some((c: any) => c.name === category))
    .map((t: any) => t.name.toLowerCase().replace(/\s+/g, '_'));
}

function matchCustom(html: string, patterns: { category: string; pattern: RegExp }[]): string[] {
  return patterns.filter(p => p.pattern.test(html)).map(p => p.category);
}

function extractHosting(headers: Record<string, string>): string {
  if (headers['x-vercel-id']) return 'vercel';
  if (headers['cf-ray']) return 'cloudflare';
  if (headers['x-amz-cf-id']) return 'aws_cloudfront';
  if (headers['server']?.toLowerCase().includes('apache')) return 'apache';
  if (headers['server']?.toLowerCase().includes('nginx')) return 'nginx';
  return 'unknown';
}

function extractEmailFromHeaders(headers: Record<string, string>): string {
  // MX record detection would require DNS lookup — placeholder for dnsEnricher
  return 'unknown';
}

function buildIntegrationNote(
  cms: string,
  complexity: number,
  chatTools: string[],
  paymentTools: string[]
): string {
  const notes: string[] = [];
  if (complexity === 1) notes.push('CB-01 chatbot can be deployed via script tag with minimal setup.');
  if (complexity === 4) notes.push('GoDaddy builder has limited embed options — consider standalone landing page for CB-01.');
  if (chatTools.length > 0) notes.push(`Existing chat tool detected (${chatTools.join(', ')}) — CB-01 would replace or complement.`);
  if (paymentTools.includes('mercadopago')) notes.push('MercadoPago detected — LATAM payment integration available.');
  if (cms === 'wordpress') notes.push('WordPress plugin deployment available for CB-01 and AVA-01 embed.');
  return notes.join(' ') || 'Standard integration path. Developer access may be required.';
}
```

### 10.6 Module: `llmExtractor.ts`

```typescript
// src/extractor/llmExtractor.ts
import Anthropic from '@anthropic-ai/sdk';
import { EXTRACTION_SYSTEM_PROMPT, buildUserPrompt } from './prompt';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function extractSignals(
  corpus: string,
  intakeFormData: Record<string, any>
): Promise<Record<string, any>> {

  const userPrompt = buildUserPrompt(corpus, intakeFormData);

  const makeCall = async (): Promise<Record<string, any>> => {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('');

    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  };

  try {
    return await makeCall();
  } catch (err) {
    console.error('LLM extraction attempt 1 failed, retrying...', err);
    try {
      return await makeCall();
    } catch (err2) {
      console.error('LLM extraction attempt 2 failed. Returning raw corpus marker.', err2);
      return { extraction_failed: true, raw_corpus: corpus.slice(0, 500) };
    }
  }
}
```

### 10.7 Module: `prompt.ts`

```typescript
// src/extractor/prompt.ts

export const EXTRACTION_SYSTEM_PROMPT = `
You are a business intelligence extraction agent for ROBO AI Agency.
You receive the cleaned text corpus from a business website and the client's intake form data.
Extract all signals below. Return ONLY a valid JSON object. No preamble. No markdown.
If a signal cannot be determined from the content, return null for that field.
Respond in the same language as the website content when classifying text fields.

SIGNALS TO EXTRACT:
{
  "services": [{name, category, description, pricing_hint}],
  "target_audience": ["string"],
  "tone_of_voice": "formal|conversational|technical|sales-heavy|neutral",
  "tech_stack": ["string"],
  "pricing_signals": {
    "present": bool,
    "model": "tiered|flat|per_seat|contact_for_pricing|freemium|unknown",
    "figures": ["string"],
    "contact_for_pricing": bool
  },
  "operational_tools": [{tool, category, confidence, integration_url}],
  "contact_info": {
    "phone": ["string"],
    "email": ["string"],
    "whatsapp": "string|null",
    "address": "string|null",
    "hours": "string|null"
  },
  "brand_story": {
    "tagline": "string|null",
    "mission": "string|null",
    "differentiators": ["string"],
    "founding_year": "string|null"
  },
  "geo_coverage": {
    "cities": ["string"],
    "regions": ["string"],
    "countries": ["string"],
    "service_radius": "string|null"
  },
  "social_proof": {
    "testimonials_present": bool,
    "client_names": ["string"],
    "event_types": ["string"],
    "awards": ["string"]
  }
}
`;

export function buildUserPrompt(
  corpus: string,
  intakeFormData: Record<string, any>
): string {
  return `
INTAKE FORM CONTEXT (use to resolve ambiguity in the corpus):
${JSON.stringify(intakeFormData, null, 2)}

WEBSITE CORPUS:
${corpus}
`.trim();
}
```

### 10.8 Module: `index.ts` — Express Server

```typescript
// src/index.ts — POST /scrape endpoint called by n8n
import express from 'express';
import { runScrape } from './scraper'; // orchestrates all modules

const app = express();
app.use(express.json());

app.post('/scrape', async (req, res) => {
  const { intake_id, website_url, client_name, industry } = req.body;

  if (!intake_id || !website_url) {
    return res.status(400).json({ error: 'intake_id and website_url required' });
  }

  // Respond immediately — n8n does not wait for scrape to complete
  res.status(202).json({ status: 'accepted', intake_id });

  // Run scrape async
  runScrape({ intake_id, website_url, client_name, industry }).catch(err => {
    console.error(JSON.stringify({ event: 'scrape_fatal_error', intake_id, error: err.message }));
  });
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => console.log(`BA-002 scraper listening on :${PORT}`));
```

### 10.9 Supabase Schema Migration

```sql
-- Run in Supabase SQL editor before Sprint 2 development begins

-- 1. Add scrape_status to clients table (BA-001)
ALTER TABLE clients
  ADD COLUMN scrape_status TEXT DEFAULT 'pending'
  CHECK (scrape_status IN (
    'pending', 'running', 'success', 'partial',
    'no_content', 'low_confidence', 'failed', 'timeout'
  ));

-- 2. web_context table
CREATE TABLE web_context (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  scraped_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  website_url           TEXT NOT NULL,
  web_scrape_status     TEXT NOT NULL CHECK (web_scrape_status IN (
                          'success', 'partial', 'no_content',
                          'low_confidence', 'failed', 'timeout'
                        )),
  pages_scraped         INTEGER NOT NULL DEFAULT 0,
  pages_attempted       INTEGER NOT NULL DEFAULT 0,
  render_pass2_count    INTEGER NOT NULL DEFAULT 0,
  confidence_score      FLOAT NOT NULL DEFAULT 0.0,
  extraction_status     TEXT NOT NULL CHECK (extraction_status IN ('extracted', 'raw', 'failed')),
  detected_language     TEXT,
  error_reason          TEXT,
  raw_text_sample       TEXT,

  -- Content extraction (JSONB for flexibility)
  services              JSONB,
  target_audience       JSONB,
  tone_of_voice         TEXT,
  pricing_signals       JSONB,
  operational_tools     JSONB,
  contact_info          JSONB,
  brand_story           JSONB,
  geo_coverage          JSONB,
  social_proof          JSONB,

  -- Tech profile
  tech_profile          JSONB NOT NULL DEFAULT '{}',

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (intake_id) -- one web_context per intake — upsert on re-run
);

-- 3. scrape_logs table (page-level)
CREATE TABLE scrape_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  page_url        TEXT NOT NULL,
  depth           INTEGER,
  render_pass     INTEGER, -- 1 = static, 2 = headless
  status          TEXT CHECK (status IN ('success', 'render_failed', 'timeout', 'skipped', 'disallowed')),
  duration_ms     INTEGER,
  token_count     INTEGER,
  error_reason    TEXT,
  scraped_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX idx_web_context_intake_id ON web_context(intake_id);
CREATE INDEX idx_scrape_logs_intake_id ON scrape_logs(intake_id);
```

### 10.10 Dockerfile

```dockerfile
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Install Playwright Chromium in the container
RUN npx playwright install chromium

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 10.11 n8n Workflow Configuration

**BA-002 n8n node setup (HTTP Request node):**

```
Node type:    HTTP Request
Method:       POST
URL:          https://your-ba002-service.railway.app/scrape
Body (JSON):  {
                "intake_id":   "{{ $json.intake_id }}",
                "website_url": "{{ $json.website_url }}",
                "client_name": "{{ $json.client_name }}",
                "industry":    "{{ $json.industry }}"
              }
Response:     202 Accepted (async — n8n does not wait)
Retry:        2 attempts, 30 s delay
On error:     Branch to alert node (email/Slack to Kevin)
```

**BA-002 → BA-003 trigger (fired by the scraper service directly via HTTP):**

The scraper calls `N8N_BA003_WEBHOOK_URL` on completion using axios:

```typescript
await axios.post(process.env.N8N_BA003_WEBHOOK_URL!, {
  intake_id,
  web_scrape_status: result.web_scrape_status,
  confidence_score: result.confidence_score,
});
```

### 10.12 Confidence Score Calculation

```typescript
// Calculate confidence_score from 0.0 to 1.0
// Each of the 10 signals contributes equally (0.1 per signal)
export function calculateConfidence(extracted: Record<string, any>): number {
  const signals = [
    'services', 'target_audience', 'tone_of_voice', 'tech_stack',
    'pricing_signals', 'operational_tools', 'contact_info',
    'brand_story', 'geo_coverage', 'social_proof'
  ];

  const populated = signals.filter(key => {
    const val = extracted[key];
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') return Object.keys(val).some(k => val[k] !== null && val[k] !== undefined);
    return true;
  });

  return parseFloat((populated.length / signals.length).toFixed(2));
}
```

---

## 11. Test Cases

| ID | Test Name | Input / Setup | Expected Result |
|---|---|---|---|
| TC-01 | Happy path — static site | Valid URL, static HTML, 10 pages, all signals present. | `status = success`; all 10 signals populated; `confidence_score > 0.7`; BA-003 triggered. |
| TC-02 | JavaScript SPA — GoDaddy builder | `cateringco.mx` or equivalent GoDaddy SPA. | Pass 2 triggered; DOM content check passes; real content extracted; `status != low_confidence`. |
| TC-03 | JavaScript SPA — Next.js | Valid Next.js site requiring hydration. | Pass 2 triggered; content extracted; `status = success`. |
| TC-04 | Depth limit enforcement | Site with 6 levels; `SCRAPER_MAX_DEPTH = 3`. | Only depth 0–3 crawled. No depth-4+ pages in logs. |
| TC-05 | Page cap enforcement | Site with 200 indexable pages. | Crawl stops at 100. `status = partial`. |
| TC-06 | Unreachable URL | URL returns 404. | `status = failed`; empty context; BA-003 still triggered. |
| TC-07 | Low confidence gating | HTTP 200 but only nav/footer HTML returned. | `confidence_score < 0.2`; `status = low_confidence` (NOT `success`). |
| TC-08 | robots.txt compliance | `robots.txt` disallows `/admin`. | No requests to disallowed paths. Logged as `disallowed`. |
| TC-09 | Performance SLA | 40-page SMB site, mixed static/JS. | Total pipeline < 180 seconds. |
| TC-10 | Idempotency | Run BA-002 twice for same `intake_id`. | Second run overwrites first `web_context`. No duplicate rows. |
| TC-11 | Operational tools detection | Site with Calendly and HubSpot. | `operational_tools` contains both entries. |
| TC-12 | Pricing signals | `/pricing` page with three tiers. | `pricing_signals.present = true`; `model = 'tiered'`. |
| TC-13 | Contact info extraction | Site has phone, email, WhatsApp link. | `contact_info.phone`, `email`, `whatsapp` all populated. |
| TC-14 | Tech detection — WordPress | WordPress site with WooCommerce. | `tech_profile.cms = 'wordpress'`; `ecommerce_signals` includes `woocommerce`; `integration_complexity = 1`. |
| TC-15 | Tech detection — GoDaddy | GoDaddy Website Builder site. | `tech_profile.cms = 'godaddy'`; `integration_complexity = 4`; integration note warns of limited embed options. |
| TC-16 | LATAM tool detection | Site with MercadoPago checkout. | `tech_profile.payment_processors` includes `mercadopago`; `latam_tools` populated. |
| TC-17 | WhatsApp detection | Site with `wa.me/` link. | `tech_profile.whatsapp_present = true`. |
| TC-18 | LLM extraction retry | LLM returns 500 on attempt 1. | Retries once. On second failure, `extraction_status = raw`. |

---

## 12. Sprint Build Plan

| Task | Component | Description | Est. |
|---|---|---|---|
| T-01 | Supabase schema | Run migration script (Section 10.9). Verify indexes. | 0.5 day |
| T-02 | Project setup | Init Node.js project, install deps, configure env. | 0.5 day |
| T-03 | Static fetch module | `fetchStatic.ts` with DOM content check. | 0.5 day |
| T-04 | Headless render module | `fetchHeadless.ts` with DOM-condition wait. | 1 day |
| T-05 | Crawl engine | `linkExtractor.ts`, `robotsParser.ts`, depth limiter, page cap, priority URLs. | 1 day |
| T-06 | Text cleaning pipeline | `htmlCleaner.ts`, `deduplicator.ts`, `tokenizer.ts`. | 0.5 day |
| T-07 | Tech detection module | `techDetector.ts` with Wappalyzer + custom LATAM patterns. | 1 day |
| T-08 | LLM extraction | `llmExtractor.ts`, `prompt.ts`, confidence score, retry logic. | 1 day |
| T-09 | DB writes | `writeContext.ts` upsert, `writeLogs.ts`, `clients` status update. | 0.5 day |
| T-10 | Express server + n8n integration | `index.ts`, BA-003 webhook trigger, error handling. | 0.5 day |
| T-11 | Dockerfile + deployment | Build image, deploy to Railway/Render, set env vars. | 0.5 day |
| T-12 | Test cases TC-01 to TC-18 | Execute all tests. Document results. Fix failures. | 1.5 days |
| T-13 | Performance validation | TC-09 on 3 real SMB websites. Confirm 3-min SLA. | 0.5 day |

**Total estimate: 10 developer days · ~2 working weeks part-time.**

---

## 13. Open Questions & Decisions

| # | Question | Options / Notes | Owner |
|---|---|---|---|
| OQ-01 | Node.js or Python for the crawl agent? | **Decision: Node.js 20.** Playwright + async/await is the natural fit. Python viable but adds context switching. | Kevin Bonilla |
| OQ-02 | Token budget — 20,000 tokens per job sufficient? | Most SMB sites produce 5,000–10,000 clean tokens. 20k accommodates 10-signal extraction comfortably. Review after TC-01. | Review after TC-01 |
| OQ-03 | `robots.txt` Crawl-delay — honour above 2 s? | Decision: honour up to 2 s, override above to protect SLA. | Kevin Bonilla |
| OQ-04 | Surface social profile links (LinkedIn, Instagram)? | Not in v1.1. Flag for v1.2 — adds value for BA-003 brand analysis. | BA-003 team |
| OQ-05 | Alert channel for scrape failures? | n8n email or Slack alert when `status = failed`. Confirm channel. | Kevin Bonilla |
| OQ-06 | BA-002 deployment target? | **Decision: Railway or Render** (Node.js service). Playwright cannot run in n8n Code node sandbox. n8n calls the deployed function via HTTP Request node. | Kevin Bonilla |
| OQ-07 | Enable DNS enrichment (`SCRAPER_DNS_ENRICHMENT`)? | Off by default. Enable once initial tests confirm email provider detection adds value to BA-003 proposals. | Review after Sprint 2 |

---

## 14. Dependencies & Downstream Impact

### 14.1 Upstream — BA-001

BA-002 cannot run without a valid `intake_id` and `website_url` from BA-001. The Supabase `clients` table and the n8n BA-001 webhook must be live before BA-002 testing begins.

### 14.2 Downstream — BA-003

BA-003 now has access to 10 content signals plus the `tech_profile` object. The proposal generator should use `tech_profile.integration_complexity` to tier its product recommendations, and `tech_profile.whatsapp_present` + `tech_profile.latam_tools` to tailor LATAM-specific messaging.

BA-003 must gracefully handle all `web_scrape_status` values including the new `low_confidence` state.

### 14.3 Supabase Schema Changes

- New table: `web_context` (Section 10.9)
- New table: `scrape_logs` (Section 10.9)
- New column: `clients.scrape_status`

### 14.4 Product Integration Implications

| `tech_profile.cms` | CB-01 Deploy Method | AVA-01 Deploy Method | Complexity |
|---|---|---|---|
| `wordpress` | Plugin or script tag | Iframe embed or script tag | Low |
| `shopify` | Script tag via theme | Iframe embed | Low |
| `webflow` | Script tag in page settings | Script tag | Medium |
| `wix` | Wix App Market or Velo JS | Limited — separate page | Medium |
| `godaddy` | HTML embed block | Very limited — consider subdomain | High |
| `nextjs` / `react` | Script tag or SDK integration | SDK or API integration | Medium |
| `custom` | Developer access required | API integration | Medium–High |
| `unknown` | Assess manually | Assess manually | Unknown |

---

## Document Sign-off

| Field | Value |
|---|---|
| **Document** | BA-002 · Website Scraper Agent · PDR v1.1 |
| **Prepared by** | Kevin Bonilla · PO · ROBO AI Agency |
| **Status** | Draft — Ready for Development |
| **Date** | May 2026 |
| **Supersedes** | BA-002 PDR v1.0 |
| **Next review** | On completion of Sprint 2 · TC-01–TC-18 results |

---

*ROBO AI Agency · Confidential · May 2026*
