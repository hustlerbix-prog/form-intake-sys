# ROBO AI Agency
## WEB-007 · AI Builder Platform Dashboard
### Product Requirements Document — v1.0 · May 2026

---

| Field | Value |
|---|---|
| Document type | PRD — Product Requirements Document |
| Version | 1.0 · May 2026 |
| Status | Draft — Ready for Sprint 4 |
| Epic | AI Builder Platform (WEB-series) |
| Priority | P1 Critical |
| Story Points | 34 pts across 8 user stories |
| Sprint | Sprint 4 |
| Depends on | BA-001 · BA-002 · BA-003 · CB-01 · AVA-01 · CA-01 |
| Feeds | Export layer (MCP / API / Widget / Raw Code) |
| Author | Kevin Bonilla · CISA |
| Agency | ROBO AI Agency |

> **WEB-007 is the operator and client-facing control plane of the ROBO AI Agency platform.** It consolidates intake data, knowledge base management, conversation flow design, agent configuration, live testing, and multi-format export into a single authenticated dashboard — enabling both the agency operator (Kevin) and end-clients to build, iterate, and deploy AI agents without engineering involvement.

---

## Table of Contents

1. [Strategic Context & Platform Position](#1-strategic-context--platform-position)
2. [User Stories & Bundle Overview](#2-user-stories--bundle-overview)
3. [Acceptance Criteria](#3-acceptance-criteria)
4. [Functional Requirements — Dashboard Shell & Navigation](#4-functional-requirements--dashboard-shell--navigation)
5. [Functional Requirements — AI Builder Wizard](#5-functional-requirements--ai-builder-wizard)
6. [Functional Requirements — Knowledge Base Manager](#6-functional-requirements--knowledge-base-manager)
7. [Functional Requirements — Flow Builder](#7-functional-requirements--flow-builder)
8. [Functional Requirements — Configuration & Persona](#8-functional-requirements--configuration--persona)
9. [Functional Requirements — Test Harness](#9-functional-requirements--test-harness)
10. [Functional Requirements — Export Factory](#10-functional-requirements--export-factory)
11. [Role-Based Access Control](#11-role-based-access-control)
12. [Data Model & API Contracts](#12-data-model--api-contracts)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Tech Stack](#14-tech-stack)
15. [Test Cases](#15-test-cases)
16. [Sprint Build Timeline](#16-sprint-build-timeline)
17. [Open Questions & Decisions](#17-open-questions--decisions)

---

## 1. Strategic Context & Platform Position

ROBO AI Agency automates the full lifecycle from prospect intake to deployed AI agent. WEB-007 is the control plane that sits between the intake pipeline (BA-series) and the live deployment targets (CB-01, AVA-01, CA-01).

| Layer | Component | Role | Status |
|---|---|---|---|
| Client Acquisition | BA-001 Business Intake Form | Captures prospect profile · triggers pipeline | Live — v1.2 |
| Data Enrichment | BA-002 Website Scraper | Firecrawl scrape → knowledge base seed | Specified |
| Intelligence Core | BA-004 Master Analyzer Agent | Diagnosis + product recommendation | PRD v1.0 |
| Proposal Engine | BA-003 Proposal Generator | Branded PDF sent within 30 min | Specified |
| **Control Plane** | **WEB-007 AI Builder Platform** | **Operator + client dashboard · This PRD** | **This PRD** |
| Products | CB-01 · AVA-01 · CA-01 | Chatbot · Voice · Agent runtimes | In development |
| Export Layer | MCP · API · Widget · Raw Code | Deployment targets | Designed |
| Project Tracking | BA-005 Trello Automation | Auto-card on payment | Specified |

> The platform serves two distinct personas: the **Operator** (Kevin / agency admin) who manages all clients and agents, and the **Client** who has a scoped view of their own agents, knowledge base, and configuration. The same codebase serves both via role-based access control.

---

## 2. User Stories & Bundle Overview

### Primary User Story (Epic)

> *"As an agency operator, I need a unified platform where I can receive intake submissions, seed and manage client knowledge bases, guide clients through a step-by-step AI agent builder, configure agent behaviour, test agents in a live sandbox, and export the finished agent in MCP, API, Widget, or Raw Code format — so that the entire journey from prospect to deployed agent is automated, repeatable, and requires zero engineering involvement from the client."*

### Secondary User Story (Client persona)

> *"As a client, I want to log into my dashboard, see the AI tools ROBO AI has built for me, upload additional knowledge base documents, make simple configuration edits, test my agent, and copy the embed code or API key — without needing to contact support."*

### User Story Map

| Story ID | Persona | Story | Points |
|---|---|---|---|
| WEB-007-US-01 | Operator | Dashboard shell, navigation, auth, RBAC | 3 |
| WEB-007-US-02 | Operator + Client | Agent type selection & template picker | 3 |
| WEB-007-US-03 | Operator + Client | Knowledge base manager (intake + uploads) | 5 |
| WEB-007-US-04 | Operator | Visual flow builder (nodes, branches, tool calls) | 8 |
| WEB-007-US-05 | Operator + Client | Agent configuration & persona editor | 3 |
| WEB-007-US-06 | Operator + Client | Live test harness (chat + voice preview) | 5 |
| WEB-007-US-07 | Operator + Client | Export factory (MCP / API / Widget / Raw Code) | 5 |
| WEB-007-US-08 | Operator | Client & intake management views | 2 |
| **Total** | | | **34 pts** |

---

## 3. Acceptance Criteria

| ID | Criterion | Verification |
|---|---|---|
| AC-01 | Authenticated user lands on Dashboard within 2 seconds of login. Dashboard displays accurate counts for active agents, clients, KB documents, and weekly conversations. | Integration test · Lighthouse perf audit |
| AC-02 | Builder wizard enforces step sequencing: steps 3–6 are disabled until KB is confirmed seeded (step 2). Step progression state persists across page refresh via localStorage. | E2E test (Playwright) |
| AC-03 | Knowledge base manager ingests BA-001 intake JSON and BA-002 scrape JSON automatically within 60 seconds of n8n webhook trigger. No manual operator action required. | n8n automation test |
| AC-04 | Uploaded files (PDF, DOCX, TXT) are chunked, embedded via pgvector, and marked "Indexed" within 3 minutes. Files > 10 MB are rejected with a user-facing error. | Unit test + load test |
| AC-05 | Flow builder canvas supports: add node, add conditional branch, add tool call block, delete node, reorder via drag-and-drop. Minimum viable flow: Start → Intent → RAG Lookup → Respond → End. | Manual QA + snapshot test |
| AC-06 | Configuration editor saves persona name, tone, language, system prompt, and all behaviour toggles. Changes are reflected immediately in the test harness (no publish step required for testing). | Integration test |
| AC-07 | Test harness chat window renders agent responses within 3 seconds. Voice preview initiates a Twilio test call to operator's registered phone within 10 seconds of clicking "Test voice call". | Manual QA |
| AC-08 | Export factory generates all four artefacts on demand: (a) MCP SSE endpoint URL with client UUID, (b) REST API base URL + sample curl command, (c) `<script>` embed snippet, (d) downloadable Node.js ZIP. Each export is versioned and tied to the current saved configuration. | Integration test |
| AC-09 | Client persona sees only their own agents, KB sources, and export artefacts. Operator persona sees all clients. Cross-client data access returns 403. | Security test |
| AC-10 | All UI text renders correctly in English and Spanish. Language toggle persists in user profile. | Manual QA bilingual |

---

## 4. Functional Requirements — Dashboard Shell & Navigation

### FR-4.1 — Authentication & Session
- Supabase Auth (email/password + magic link)
- JWT session with 24-hour expiry and silent refresh
- Role claim in JWT: `operator` or `client`
- Failed login → generic error (no credential enumeration)

### FR-4.2 — Navigation Structure

```
Sidebar (Operator view)
├── Dashboard          — stats + recent activity feed
├── AI Builder         — 6-step wizard (primary CTA)
├── My Agents          — all agents across all clients
├── Knowledge Base     — global pgvector store manager
├── Clients            — client table + per-client detail
├── Intake Pipeline    — BA-001 → BA-002 → BA-003 Kanban
├── Analytics          — conversation + usage metrics (Phase 2)
└── Settings           — account, billing, API keys

Sidebar (Client view)
├── My Dashboard       — own agents + usage
├── My Agents          — own agents only
├── Knowledge Base     — own KB sources only
└── Settings           — profile + language
```

### FR-4.3 — Dashboard Metrics Cards
| Metric | Source | Refresh |
|---|---|---|
| Active Agents | Supabase `agents` table | Real-time |
| Clients | Supabase `clients` table | Real-time |
| KB Documents | pgvector chunk count | On demand |
| Conversations (weekly) | Agent logs | Hourly |

### FR-4.4 — Recent Activity Feed
- Last 5 intake submissions (company, time, pipeline stage)
- Last 5 agent state changes (name, status, timestamp)
- Per-client KB usage bar chart (% of allocated vector quota)

---

## 5. Functional Requirements — AI Builder Wizard

The builder is a 6-step linear wizard with persistent state. Each step is a distinct view rendered in the main canvas. Navigation via left-rail step list or Back / Continue footer buttons.

### Step 1 — Choose Type

**Purpose:** Select the agent type and a pre-built template.

**Templates available:**

| Template ID | Name | Base product | Description |
|---|---|---|---|
| TPL-01 | AI Chatbot | CB-01 | Web chat · FAQs, lead capture, escalation |
| TPL-02 | Voice Assistant | AVA-01 | Phone · Twilio · bilingual EN/ES |
| TPL-03 | AI Agent | CA-01 | Autonomous · tools · CRM integration |
| TPL-04 | Lead Qualifier | CB-01 variant | Structured intake · lead scoring |
| TPL-05 | Booking Assistant | AVA-01 variant | Calendar sync · confirmations |
| TPL-06 | Custom Agent | Blank | Full control · no defaults |

- Selecting a template pre-populates Steps 3–5 with sensible defaults
- Template selection is editable at any point before export

### Step 2 — Knowledge Base

**Purpose:** Connect and confirm knowledge sources before building begins.

**Auto-loaded sources (from intake pipeline):**
- BA-001 form JSON (indexed on submission)
- BA-002 scrape JSON (indexed post-scrape, ~30 min after submission)

**Manual sources (operator or client):**
- File upload: PDF, DOCX, TXT (max 10 MB per file, 50 MB per agent)
- URL: crawl a single URL or sitemap
- Plain text: paste directly

**Indexing status states:** `Queued` → `Processing` → `Indexed` → `Error`

**Requirement:** Continue button on Step 2 is disabled until at least one source is `Indexed`.

### Step 3 — Flow Builder

**Purpose:** Design the conversation graph visually.

**Node types:**

| Node | Description |
|---|---|
| Start | Entry point — always present, not deletable |
| Message | Static text output |
| Listen | Await user input |
| Intent Router | Classify input → branch |
| RAG Lookup | Query pgvector KB · returns top-k chunks |
| Condition | Boolean branch (if/else) |
| Tool Call | External API call (calendar, CRM, etc.) |
| Escalate | Hand off to human (email / Slack / Trello) |
| End | Terminate session |

**Canvas requirements:**
- Nodes connected via directed edges
- Drag-to-reorder
- Click node → inline property editor panel (right rail)
- Add branch via `+` on any node output
- Keyboard delete on selected node
- Auto-save every 30 seconds

**Default flow (pre-populated from template):**
`Start → Greet → Intent Router → RAG Lookup → [Found: Respond → Follow-up?] [Not found: Escalate]`

### Step 4 — Configure

**Purpose:** Set agent identity, language, and runtime behaviour.

**Fields:**

| Field | Type | Default |
|---|---|---|
| Agent name | Text | `{ClientName} Assistant` |
| Language | Select | Bilingual EN/ES |
| Persona tone | Select | Professional |
| Fallback behaviour | Select | Escalate to human |
| System prompt | Textarea | Template default |
| RAG active | Toggle | On |
| Lead capture | Toggle | On |
| Human escalation | Toggle | On |
| Conversation memory | Toggle | Off |
| Bilingual auto-detect | Toggle | On |

**System prompt guidelines** displayed inline (collapsible):
- Keep under 500 tokens
- Do not instruct the agent to claim to be human
- Include escalation language in the user's expected language

### Step 5 — Test

**Purpose:** Validate agent before export in a sandboxed environment.

**Chat preview:**
- Full-fidelity agent response via `api.roboai.agency/v1/agents/{id}/chat`
- Displays active configuration summary (read-only)
- Reset conversation button
- "Inject error" button (simulates no-KB-answer scenario)

**Voice preview:**
- Button triggers Twilio test call to operator's registered number
- Uses same AVA-01 runtime as production
- Call transcript displayed after hang-up

**Diagnostics panel:**
- Last RAG query and retrieved chunks (expandable)
- Response latency (ms)
- Model token usage (input / output)

### Step 6 — Export

**Purpose:** Generate deployment artefacts from the saved configuration.

| Format | Artefact | Notes |
|---|---|---|
| MCP Connection | `mcp.roboai.agency/{client-uuid}/sse` | SSE endpoint · requires MCP host |
| REST API | `api.roboai.agency/v1/agents/{id}/chat` | Full docs linked · API key required |
| Web Widget | `<script src="roboai.agency/widget.js" data-agent="{id}">` | Float button · mobile-ready · CSP-safe |
| Raw Code | Node.js ZIP package | Self-hostable · includes env config template |

**All artefacts are versioned** — each export generates a snapshot tied to the configuration hash. Prior versions accessible from agent settings.

---

## 6. Functional Requirements — Knowledge Base Manager

- **Global view** (operator): all sources across all agents, filterable by client
- **Agent view**: sources scoped to a single agent
- Source cards show: name, type icon, size, chunk count, status, last indexed timestamp
- **Upload modal**: drag-and-drop zone + file picker + URL input
- **Delete source**: confirmation modal → removes chunks from pgvector, updates status
- **Re-index**: force re-crawl / re-chunk a source
- KB quota display: used / allocated per agent (default 50 MB)

---

## 7. Functional Requirements — Flow Builder

*(Expanded from §5 Step 3)*

### Canvas Architecture
- Rendered in Next.js with **React Flow** library
- Nodes stored as JSON graph in Supabase `agent_flows` table
- Auto-layout option (dagre) for complex graphs
- Pan + zoom (mouse wheel / trackpad)
- Mini-map for graphs > 10 nodes

### Node Property Editor (right rail)
Each node type exposes different properties:
- **Message node:** text content, delay (ms), typing indicator toggle
- **Intent Router:** list of intents + branch labels (add/remove)
- **RAG Lookup:** top-k (1–10), similarity threshold (0.5–0.95), fallback message
- **Tool Call:** method (GET/POST), URL, headers (key-value), response mapping
- **Condition:** expression builder (variable comparisons)

### Validation
- Builder validates graph before allowing export: no orphaned nodes, Start has exactly one outgoing edge, at least one End or Escalate node present
- Validation errors shown inline on offending nodes

---

## 8. Functional Requirements — Configuration & Persona

- System prompt editor with character/token counter
- Prompt templates library (collapsible panel) — pull in a starter block
- Tone presets: Professional, Friendly, Formal, Casual, Empathetic
- Language options: EN, ES, Bilingual (auto-detect)
- Model selector (operator only): claude-sonnet-4-6, claude-haiku-4-5 (client locked to default)
- Advanced settings (operator only): max_tokens, temperature, top_p
- **Save draft** vs **Publish** — draft changes only affect the test harness; Publish pushes to live export artefacts

---

## 9. Functional Requirements — Test Harness

### Chat Simulator
- Uses production agent runtime (not a mock)
- Conversation stored temporarily in browser memory (not persisted unless "Save transcript" clicked)
- Supports multi-turn conversation (full history sent in each API call)
- Visual indicator when RAG is invoked (KB source chip shown below bot message)
- Suggested test phrases auto-generated from KB content (3 shown on load)

### Voice Simulator
- Operator enters phone number → Twilio outbound call initiated
- Call audio transcribed live via Deepgram/Twilio STT
- Transcript displayed in real-time alongside chat-style bubble view
- Test call limited to 5 minutes

### Reset & Scenarios
- Reset clears conversation and re-initialises session
- Scenario presets: "Escalation path", "KB miss", "Lead capture", "Booking flow" — each pre-seeds an opening message

---

## 10. Functional Requirements — Export Factory

### MCP Export
- Generates unique SSE endpoint: `mcp.roboai.agency/{client-uuid}/sse`
- One-click copy
- "Test connection" button pings endpoint and returns status
- Instructions for Claude Desktop config (collapsible)

### API Export
- Displays base URL + auth header example
- Links to full Swagger/OpenAPI docs at `api.roboai.agency/v1/docs`
- "Generate new API key" button (invalidates previous key after 24h)
- Rate limits shown: requests/min, tokens/day

### Widget Export
- Preview of widget in a mock webpage (iframe)
- Customisation options: primary colour (hex), position (bottom-left / bottom-right), greeting message, avatar URL
- One-click copy of `<script>` embed snippet
- CDN-hosted, SRI hash provided

### Raw Code Export
- ZIP includes: `index.js`, `agent-config.json`, `knowledge/` folder, `README.md`, `.env.example`
- Built targeting Node.js 20 LTS
- Includes Dockerfile for self-hosted deployment on Hetzner

---

## 11. Role-Based Access Control

| Feature | Operator | Client |
|---|---|---|
| View all clients | ✓ | ✗ |
| View own agents | ✓ | ✓ |
| Create/delete agent | ✓ | ✗ (request via operator) |
| Edit flow builder | ✓ | Read-only |
| Edit configuration | ✓ | Limited (name, tone, language) |
| Upload KB sources | ✓ | ✓ (own agents only) |
| Delete KB sources | ✓ | ✗ |
| Access test harness | ✓ | ✓ |
| Export MCP / Raw Code | ✓ | ✓ |
| Model selector | ✓ | ✗ |
| Advanced AI settings | ✓ | ✗ |
| View intake pipeline | ✓ | ✗ |
| Manage billing | ✓ | View only |

---

## 12. Data Model & API Contracts

### Core Tables (Supabase)

```sql
agents (
  id uuid PRIMARY KEY,
  client_id uuid REFERENCES clients(id),
  name text,
  type text CHECK (type IN ('chatbot','voice','agent')),
  template_id text,
  status text CHECK (status IN ('draft','testing','live','archived')),
  config jsonb,          -- persona, toggles, model params
  flow_graph jsonb,      -- React Flow node/edge JSON
  created_at timestamptz,
  updated_at timestamptz
)

kb_sources (
  id uuid PRIMARY KEY,
  agent_id uuid REFERENCES agents(id),
  name text,
  type text CHECK (type IN ('intake','scrape','upload','url')),
  status text CHECK (status IN ('queued','processing','indexed','error')),
  chunk_count int,
  size_bytes bigint,
  indexed_at timestamptz
)

exports (
  id uuid PRIMARY KEY,
  agent_id uuid REFERENCES agents(id),
  format text CHECK (format IN ('mcp','api','widget','rawcode')),
  version text,
  config_hash text,
  artefact_url text,
  created_at timestamptz
)
```

### Key API Endpoints

```
POST   /v1/agents                          — create agent
GET    /v1/agents/{id}                     — get agent + config
PATCH  /v1/agents/{id}                     — update config / flow
DELETE /v1/agents/{id}                     — soft delete

POST   /v1/agents/{id}/kb/sources         — add KB source
DELETE /v1/agents/{id}/kb/sources/{sid}   — remove source
POST   /v1/agents/{id}/kb/sources/{sid}/reindex

POST   /v1/agents/{id}/chat               — test harness conversation
POST   /v1/agents/{id}/voice/test-call    — initiate Twilio test call

POST   /v1/agents/{id}/export/{format}    — generate export artefact
GET    /v1/agents/{id}/exports            — list all export versions
```

---

## 13. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Dashboard load < 2s (LCP). Agent chat response < 3s p95. KB indexing < 3 min per 10 MB. |
| Availability | 99.5% uptime SLA for dashboard and API. Twilio voice 99.9%. |
| Security | HTTPS everywhere. JWT auth. RLS on all Supabase tables. No PII in LLM prompts. SOC 2-aligned logging. |
| Scalability | Horizontal scaling on Hetzner. pgvector index supports 10M+ vectors. n8n queue handles burst intake. |
| Accessibility | WCAG 2.1 AA. Keyboard navigable. Screen-reader labels on all controls. |
| Internationalisation | EN / ES UI. All user-facing strings externalised to i18n JSON. Date/currency locale-aware. |
| Browser support | Chrome 120+, Firefox 120+, Safari 17+, Edge 120+. Mobile Chrome/Safari. |
| Data residency | EU region primary (Hetzner Falkenstein). CA clients offered CA region option. |

---

## 14. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Deployed on Hetzner · SSR for dashboard |
| Styling | Tailwind CSS | Custom tokens: navy #0D1B2A · teal #0EA5A0 |
| Fonts | Syne + DM Sans | Display + body |
| Flow builder canvas | React Flow | Node graph · dagre layout |
| Auth | Supabase Auth | JWT · magic link · RBAC via claims |
| Database | Supabase (PostgreSQL) | RLS policies per role |
| Vector store | pgvector (Supabase) | Shared across CB-01 · AVA-01 · CA-01 |
| File storage | Supabase Storage | KB uploads bucket |
| LLM | Claude claude-sonnet-4-6 (Anthropic) | Test harness + agent runtime |
| Orchestration | n8n (self-hosted) | Intake → KB indexing webhooks |
| Voice | Twilio Programmable Voice | AVA-01 test calls |
| Scraping | Firecrawl | BA-002 source |
| Payments | Stripe | Billing · export unlock |
| Infra | Hetzner VPS · Docker | Self-hosted |
| API domain | api.roboai.agency/v1 | |
| MCP server | mcp.roboai.agency/{uuid}/sse | Per-client SSE |

---

## 15. Test Cases

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| TC-01 | Operator login | Navigate to dashboard URL → enter credentials | Redirect to dashboard with correct stats |
| TC-02 | Client login | Login as client role | Only own agents visible; flow builder read-only |
| TC-03 | New agent wizard — full flow | Select template → confirm KB → build flow → configure → test → export | Agent created, KB indexed, export artefacts generated |
| TC-04 | KB auto-seed from intake | Submit BA-001 form → wait 60s | KB source appears as "Indexed" in dashboard |
| TC-05 | KB upload rejection | Upload file > 10 MB | Error message shown; file not ingested |
| TC-06 | Flow builder — orphaned node | Delete all edges from a node → attempt export | Validation error shown on orphaned node |
| TC-07 | Test harness chat | Open test harness → send message → inspect response | Response within 3s; RAG chip shown if KB invoked |
| TC-08 | Voice test call | Click "Test voice call" → answer phone | Twilio call received within 10s; transcript shown |
| TC-09 | Export — Widget | Click "Copy embed code" | Correct `<script>` tag copied with agent ID |
| TC-10 | Export — MCP | Click "Copy endpoint" | Correct SSE URL with client UUID copied |
| TC-11 | Export — Raw Code | Click "Download package" | ZIP downloaded containing index.js + README |
| TC-12 | Cross-client access | Client A attempts GET /v1/agents/{client-B-agent-id} | 403 Forbidden |
| TC-13 | Draft vs Publish | Edit system prompt → test → do NOT publish | Live artefacts unchanged; test harness uses draft |
| TC-14 | Language toggle | Switch UI to Spanish | All UI strings render in ES; agent language default updated |

---

## 16. Sprint Build Timeline

### Sprint 4 — 10 days

| Day | Deliverable | Story | Points |
|---|---|---|---|
| 1–2 | Dashboard shell: layout, auth, nav, RBAC, stats cards | WEB-007-US-01 | 3 |
| 2–3 | Template picker + agent type selection | WEB-007-US-02 | 3 |
| 3–5 | KB manager: auto-seed webhook, upload, indexing status | WEB-007-US-03 | 5 |
| 5–7 | Configuration editor + persona + behaviour toggles | WEB-007-US-05 | 3 |
| 7–8 | Test harness: chat simulator + diagnostics | WEB-007-US-06 | 5 |
| 8–9 | Export factory: MCP + API + Widget + Raw Code | WEB-007-US-07 | 5 |
| 9–10 | Client table, intake Kanban, QA, bug fix | WEB-007-US-08 | 2 |

### Sprint 5 — 10 days (Phase 2)

| Deliverable | Points |
|---|---|
| Flow builder canvas (React Flow) | 8 |
| Voice test harness (Twilio integration) | 3 |
| Analytics page | 3 |
| Mobile responsive pass | 2 |
| Bilingual i18n full pass | 2 |
| **Total Sprint 5** | **18** |

---

## 17. Open Questions & Decisions

| ID | Question | Options | Owner | Due |
|---|---|---|---|---|
| OQ-01 | Flow builder in Sprint 4 or Sprint 5? | (a) MVP text-based flow in S4, visual React Flow in S5 · (b) Full React Flow in S4 (adds 8pts, may slip) | Kevin | Before Sprint 4 kickoff |
| OQ-02 | Client self-service agent creation? | (a) Clients can initiate wizard · (b) Operator-only creation, clients edit only | Kevin | Before RBAC implementation |
| OQ-03 | Export version history retention? | (a) Keep all versions · (b) Keep last 5 only · (c) Paid plan controls retention | Kevin | Before export factory build |
| OQ-04 | Widget customisation scope? | (a) Colour + position only · (b) Full white-label (logo, fonts, custom CSS) | Kevin | Before widget export build |
| OQ-05 | Voice test call billing? | Twilio test calls cost ~$0.01/min — include in plan or charge per call? | Kevin | Before voice harness build |
| OQ-06 | Draft/Publish model — applies to flow and config or config only? | (a) Config only, flow always live on save · (b) Both gated behind Publish | Kevin | Before test harness build |
| OQ-07 | Self-serve client onboarding? | Can clients sign up and trigger BA-001 themselves, or is all intake operator-managed? | Kevin | Platform go-to-market decision |

---

*Document prepared by Kevin Bonilla · ROBO AI Agency · May 2026*
*Next review: Sprint 4 kickoff · Version 1.1 target: post-Sprint 4 retrospective*
