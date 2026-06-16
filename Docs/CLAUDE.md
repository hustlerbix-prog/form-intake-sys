# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**ROBO AI Agency — BA-001 Business Intake Form** (PDR v1.2)

This is the first module of the ROBO AI Agency integrated AI platform. It collects structured client intelligence through a conversational form and triggers a fully automated pipeline: website scrape → AI diagnosis → branded PDF report → email delivery.

The repository currently contains the Product Design Requirements document (`BA-001_PDR_v1.2_Business_Intake_Form.md`). Code is not yet scaffolded.

---

## Target Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), hosted on Vercel |
| Sandbox prototype | Single-file vanilla HTML/CSS/JS (no build step) |
| AI — Form engine | Anthropic API · `claude-sonnet-4-20250514` |
| AI — Analyzer | Anthropic API · `claude-sonnet-4-20250514` |
| Database | Supabase (Postgres + RLS) |
| File storage | Supabase Storage (or S3) |
| Orchestration | n8n (self-hosted or n8n.cloud) |
| PDF renderer | ReportLab (Python) or pdf-lib (JS) — decision pending OQ-06 |
| Email | Resend API |
| Analytics | Plausible (cookieless) |

---

## Architecture

### Five-Stage Automated Pipeline

```
BA-001 Form (UI)
    → profiles INSERT (Supabase)
    → n8n webhook → Resend confirmation email
    → BA-002 Website Scraper → scrape_results INSERT
    → Master Analyzer Agent (Anthropic API) → diagnoses INSERT
    → PDF Generator → Supabase Storage → delivery email
```

### Key Architectural Rules

- **All DB writes are server-side only.** No Supabase client key is ever exposed to the browser. All reads/writes go through Next.js API routes.
- **API routes to build:** `/api/next-question` (Anthropic call for dynamic question selection), `/api/submit-profile` (validates JSON + writes to Supabase + posts to n8n webhook).
- **Session state:** `localStorage` sync after every answered question (client-side), linked to a partial Supabase `profiles` row via `session_id`. Sessions expire after 72 hours.
- **AI form engine behavior:** Maintains a running JSON state object; selects the next question from the 12-question master bank based on collected answers; never repeats answered questions; handles ambiguous answers with one clarifying follow-up before advancing; detects minimum viable profile at 8 answers.
- **Master Analyzer:** Single Anthropic API call; returns only valid JSON (no preamble/markdown). Retry once at `temperature: 0.1` on invalid JSON. Fires only after `scrape_results` row exists for the `profile_id`. Timeout hard-capped at 45 s.
- **n8n orchestration:** Manages the scrape → analyze → PDF → email chain. Polls `scrape_results` for completion. Uses exponential backoff with 3 retries on webhook failures; sends owner alert on final failure.

### Database Schema (3 Tables)

- **`profiles`** — written by BA-001 on every answered question (`UPDATE` per Q); `session_status` cycles `in_progress → submitted → expired`. `contact_email` encrypted AES-256 via pgcrypto. `raw_answers_json` purged after 30 days.
- **`scrape_results`** — written by BA-002; FK to `profiles.profile_id`. `scrape_status` values: `success | failed | blocked | timeout`.
- **`diagnoses`** — written by Master Analyzer; FK to `profiles.profile_id`. Contains `qa_pairs` (6–8 pairs), `matched_products`, `inefficiency_score` (0–100), financial estimates, and `pdf_report_url` once generated.

---

## Output JSON Schema

The canonical profile JSON (posted to n8n and written to `profiles`):

```json
{
  "profile_id": "uuid-v4",
  "created_at": "ISO-8601",
  "language": "en | es",
  "business": { "industry", "team_size", "revenue_range", "website_url" },
  "pain_points": { "top_time_cost", "bottleneck", "data_situation", "prior_ai_experience" },
  "goals": { "success_definition", "urgency_flag" },
  "tools": { "existing_tools": ["string"] },
  "budget": { "budget_comfort" },
  "contact": { "email", "first_name", "consent_marketing" }
}
```

---

## Sandbox Prototype (v1.2 — Complete)

The sandbox is a single `.html` file with no dependencies except Google Fonts CDN. It implements all 10 questions using scripted JS (not live API calls), outputs valid JSON on completion, and serves as the demo/stakeholder artefact.

- Brand: navy `#0D1B2A` background, teal `#0EA5A0` accent, Syne + DM Sans fonts.
- Input types: single-select chips (auto-advance), multi-select chips (continue button), free-text textarea (Enter to submit).
- Per AC-10: must produce valid JSON matching the BA-001 schema with a generated `profile_id` and timestamp.

**Migration to production** means replacing scripted question logic with `/api/next-question` calls, adding Supabase writes, and wiring the submit to `/api/submit-profile`.

---

## Question Bank (Q-01 to Q-12)

| Q# | Field | Input Type |
|----|-------|------------|
| Q-01 | `industry` | Chip select |
| Q-02 | `team_size` | Chip select |
| Q-03 | `revenue_range` | Chip select |
| Q-04 | `top_time_cost` | Free text |
| Q-05 | `existing_tools` | Multi-select chips |
| Q-06 | `bottleneck` | Free text |
| Q-07 | `budget_comfort` | Chip select |
| Q-08 | `success_definition` | Free text |
| Q-09 | `data_situation` | Free text |
| Q-10 | `urgency_flag` | Free text |
| Q-11 | `prior_ai_experience` | Chip select |
| Q-12 | `website_url` | Free text |

---

## Security & Privacy Constraints

- Anthropic API key: server-side only — never in client bundle. Verify via browser network tab (T-19).
- Supabase RLS: all tables use service role only; client direct access must return 401 (T-18).
- GDPR: CASCADE delete across all three tables + remove PDF from storage within 48 h on erasure request.
- `/analyse` page must be `noindex`.
- PDF: unique read-only password per client; password sent separately from the download link.

---

## Performance SLAs

| Metric | Target |
|--------|--------|
| First question render | < 800 ms on 4G |
| AI question latency (p95) | < 2,500 ms |
| Master Analyzer completion | < 45 s |
| Full pipeline (form → PDF in inbox) | < 30 minutes |
| Confirmation email | < 60 s after submit |

---

## Localisation

- **Languages at launch:** English (`en-US`) and Spanish (`es-MX`). Auto-detect from browser locale; manual toggle available.
- All AI-generated content (Q&A pairs, summaries, labels) must be generated in the client's chosen language.
- PDF filename convention: `ROBO_Analysis_[profile_id_short]_[YYYYMMDD].pdf`.

---

## Open Decisions (check before implementing)

| # | Question | Owner |
|---|----------|-------|
| OQ-01 | Session store: localStorage only vs Supabase cross-device resume? | Gerardo |
| OQ-03 | Fallback if Anthropic API is down: static Q bank vs error + retry? | Gerardo |
| OQ-04 | GDPR consent: pre-form gate vs inline at submission? | Gerardo |
| OQ-06 | PDF renderer: ReportLab (Python) vs pdf-lib (JS)? | Dev |
| OQ-07 | PDF storage: Supabase Storage vs S3? | Gerardo |
| OQ-08 | PDF delivery: email attachment vs signed download link? | Gerardo |
| OQ-11 | Sandbox hosting: demo-only vs deploy to `/analyse/demo`? | Gerardo |

---

*Reference: `BA-001_PDR_v1.2_Business_Intake_Form.md` · ROBO AI Agency · May 2026*
