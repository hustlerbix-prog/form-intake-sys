# WEB-007 — AI Builder Platform Dashboard Build Instructions
**ROBO AI Agency · Control Plane · v1.0**
> Next.js 14 App Router monolith. Execute sections in order. Sprint 4 delivers the full dashboard shell, KB manager, config editor, test harness, and export factory. Sprint 5 adds the React Flow visual canvas, voice harness, analytics, and full i18n.

---

## 0. What This Platform Does

WEB-007 is the operator and client-facing control plane of the ROBO AI Agency. It sits between the intake pipeline (BA-series) and the live deployment targets (CB-01, AVA-01, CA-01).

```
BA-001 Intake → BA-002 Scraper → BA-004 Analyzer
                                        │
                                        ▼
                              WEB-007 Dashboard (this)
                              ┌──────────────────────┐
                              │  Dashboard Shell       │
                              │  AI Builder Wizard     │
                              │   Step 1: Choose Type  │
                              │   Step 2: KB Manager   │
                              │   Step 3: Flow Builder │
                              │   Step 4: Configure    │
                              │   Step 5: Test Harness │
                              │   Step 6: Export       │
                              │  Client Management     │
                              │  Intake Pipeline Kanban│
                              └──────────────────────┘
                                        │
                              ┌─────────┼─────────┐
                              ▼         ▼         ▼
                             MCP      REST API   Widget
                        (SSE/uuid)  (api.roboai) (embed)
```

**Two personas share one codebase via RBAC:**
- **Operator** (Kevin / agency admin) — full access to all clients, all agents, flow builder, model settings
- **Client** — scoped to their own agents and KB; flow builder is read-only; limited config edits

**Sprint 4 deliverables (this file):**
- Dashboard shell + Supabase auth + RBAC
- Template picker (Step 1)
- KB manager with auto-seed + file upload + indexing (Step 2)
- Configuration editor (Step 4)
- Chat test harness (Step 5)
- Export factory — MCP, API, Widget, Raw Code (Step 6)
- Client table + Intake Pipeline Kanban

**Sprint 5 (deferred — see §16):**
- React Flow visual canvas (replaces text-based flow list)
- Twilio voice test harness
- Analytics page
- Full i18n pass
- Mobile responsive pass

---

## 1. Open Decisions — Defaults Applied

| # | Question | Default Applied |
|---|---|---|
| OQ-01 | Flow builder in S4 or S5? | **Text-based flow list in S4** (MVP nodes as ordered list with property drawer). React Flow visual canvas in S5. |
| OQ-02 | Client self-service agent creation? | **Operator-only creation.** Clients edit name, tone, language only. No client-initiated wizard. |
| OQ-03 | Export version history retention? | **Keep last 5 versions** per agent per format. Oldest pruned on new export. |
| OQ-04 | Widget customisation scope? | **Colour + position only** (primary hex, bottom-left/right). Full white-label is Phase 2. |
| OQ-05 | Voice test call billing? | **Included in plan.** Twilio cost ~$0.01/min absorbed. Cap at 5 min per call. |
| OQ-06 | Draft/Publish model scope? | **Both flow and config** are gated behind Publish. Test harness always uses draft; live export artefacts use the last published snapshot. |
| OQ-07 | Self-serve client onboarding? | **Operator-managed only.** No public client signup. Operator creates client record manually. |

---

## 2. Project Scaffold

### 2.1 Create Project

```bash
npx create-next-app@14 web-007-dashboard \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*"
cd web-007-dashboard
```

### 2.2 Install Dependencies

```bash
# Auth + Database
npm install @supabase/supabase-js @supabase/ssr

# AI (test harness + embedding)
npm install @anthropic-ai/sdk

# Flow builder (Sprint 5 — install now, use in S5)
npm install reactflow @xyflow/react

# KB: file processing
npm install pdf-parse mammoth

# KB: chunking + vector embedding
npm install @xenova/transformers

# Export: ZIP generation
npm install jszip

# Voice (Sprint 5 — install now, wire in S5)
npm install twilio

# UI components
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-tabs @radix-ui/react-switch @radix-ui/react-select \
  @radix-ui/react-tooltip @radix-ui/react-progress

# Icons
npm install lucide-react

# Drag-and-drop (KB list, node reorder)
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# i18n
npm install next-intl

# Validation
npm install zod

# Utilities
npm install uuid clsx tailwind-merge
npm install @types/uuid --save-dev

# Fonts (via next/font — no npm install needed)
```

Update `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy:  { DEFAULT: "#0D1B2A", 800: "#122234", 600: "#1a3048" },
        teal:  { DEFAULT: "#0EA5A0", 600: "#0c8f8a", 400: "#2bbfba" },
      },
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        body:    ["var(--font-dm-sans)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
```

### 2.3 Environment Variables

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Auth
JWT_SECRET=your-jwt-secret-32-chars-min

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Voice (Sprint 5)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
OPERATOR_TEST_PHONE=+1...

# n8n webhooks
N8N_KB_SEED_WEBHOOK=https://n8n.roboai.agency/webhook/kb-seed
N8N_EXPORT_WEBHOOK=https://n8n.roboai.agency/webhook/export-ready

# App
NEXT_PUBLIC_APP_URL=https://dashboard.roboai.agency
NEXT_PUBLIC_API_BASE=https://api.roboai.agency/v1
NEXT_PUBLIC_MCP_BASE=https://mcp.roboai.agency
NEXT_PUBLIC_WIDGET_CDN=https://roboai.agency/widget.js

# Embedding model (local, no external API)
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
EMBEDDING_DIMENSIONS=384
```

### 2.4 Project Structure

```
src/
├── app/
│   ├── layout.tsx                    — root layout (fonts, providers)
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── callback/route.ts         — Supabase auth callback
│   └── (dashboard)/
│       ├── layout.tsx                — sidebar + topbar shell
│       ├── page.tsx                  — Dashboard home (stats + feed)
│       ├── builder/
│       │   ├── page.tsx              — Wizard entry (step router)
│       │   ├── [agentId]/
│       │   │   ├── step1/page.tsx    — Choose Type
│       │   │   ├── step2/page.tsx    — Knowledge Base
│       │   │   ├── step3/page.tsx    — Flow Builder (text MVP)
│       │   │   ├── step4/page.tsx    — Configure
│       │   │   ├── step5/page.tsx    — Test Harness
│       │   │   └── step6/page.tsx    — Export Factory
│       ├── agents/page.tsx           — All agents table
│       ├── knowledge-base/page.tsx   — Global KB manager
│       ├── clients/
│       │   ├── page.tsx              — Client table (operator only)
│       │   └── [clientId]/page.tsx   — Client detail
│       ├── pipeline/page.tsx         — Intake Kanban (operator only)
│       └── settings/page.tsx
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── WizardStepRail.tsx
│   ├── dashboard/
│   │   ├── StatsCard.tsx
│   │   └── ActivityFeed.tsx
│   ├── builder/
│   │   ├── TemplateGrid.tsx          — Step 1
│   │   ├── KbSourceList.tsx          — Step 2
│   │   ├── KbUploadModal.tsx
│   │   ├── FlowNodeList.tsx          — Step 3 (text MVP)
│   │   ├── ConfigEditor.tsx          — Step 4
│   │   ├── TestHarnessChat.tsx       — Step 5
│   │   ├── DiagnosticsPanel.tsx
│   │   └── ExportPanel.tsx           — Step 6
│   └── ui/
│       ├── Button.tsx
│       ├── Badge.tsx
│       ├── Card.tsx
│       └── StatusDot.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 — browser Supabase client
│   │   ├── server.ts                 — server Supabase client (service role)
│   │   └── middleware.ts             — auth + RBAC middleware helper
│   ├── ai/
│   │   ├── anthropic.ts              — Anthropic SDK wrapper
│   │   ├── embed.ts                  — local embedding via Transformers.js
│   │   └── testHarness.ts            — chat conversation runner
│   ├── kb/
│   │   ├── chunker.ts                — text chunking (512 tokens, 50-token overlap)
│   │   ├── ingester.ts               — orchestrates chunk → embed → upsert
│   │   ├── parsers.ts                — PDF, DOCX, TXT extractors
│   │   └── crawler.ts                — single-URL web crawl
│   ├── export/
│   │   ├── mcp.ts                    — MCP SSE endpoint URL generator
│   │   ├── api.ts                    — REST API artefact builder
│   │   ├── widget.ts                 — Widget embed snippet builder
│   │   └── rawcode.ts                — Node.js ZIP package builder
│   └── types.ts                      — shared TypeScript types
├── middleware.ts                      — Next.js edge middleware (auth guard)
└── i18n/
    ├── en.json
    └── es.json
```

---

## 3. Supabase Setup

### 3.1 Enable pgvector

Run in Supabase SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3.2 Database Schema

```sql
-- ─── Clients ──────────────────────────────────────────────────────────────────
CREATE TABLE clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name            text NOT NULL,
  email           text NOT NULL,
  company         text,
  intake_profile_id uuid,                   -- links to BA-001 profiles table
  status          text CHECK (status IN ('prospect','active','churned')) DEFAULT 'prospect',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ─── Agents ───────────────────────────────────────────────────────────────────
CREATE TABLE agents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text CHECK (type IN ('chatbot','voice','agent')) NOT NULL,
  template_id     text NOT NULL DEFAULT 'TPL-01',
  status          text CHECK (status IN ('draft','testing','live','archived')) DEFAULT 'draft',
  config          jsonb NOT NULL DEFAULT '{}',     -- persona, toggles, model params
  flow_graph      jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  config_hash     text,                            -- SHA-256 of last published config
  published_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ─── Knowledge Base Sources ───────────────────────────────────────────────────
CREATE TABLE kb_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        uuid REFERENCES agents(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text CHECK (type IN ('intake','scrape','upload','url','text')) NOT NULL,
  status          text CHECK (status IN ('queued','processing','indexed','error')) DEFAULT 'queued',
  chunk_count     int DEFAULT 0,
  size_bytes      bigint DEFAULT 0,
  storage_path    text,                            -- Supabase Storage path (uploads only)
  source_url      text,                            -- for type='url'
  error_message   text,
  indexed_at      timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- ─── KB Chunks (pgvector) ─────────────────────────────────────────────────────
CREATE TABLE kb_chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       uuid REFERENCES kb_sources(id) ON DELETE CASCADE,
  agent_id        uuid REFERENCES agents(id) ON DELETE CASCADE,
  content         text NOT NULL,
  embedding       vector(384),                     -- MiniLM-L6-v2 dimensions
  token_count     int,
  chunk_index     int,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX kb_chunks_embedding_idx ON kb_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX kb_chunks_agent_id_idx ON kb_chunks(agent_id);

-- ─── Exports ──────────────────────────────────────────────────────────────────
CREATE TABLE exports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        uuid REFERENCES agents(id) ON DELETE CASCADE,
  format          text CHECK (format IN ('mcp','api','widget','rawcode')) NOT NULL,
  version         int NOT NULL DEFAULT 1,
  config_hash     text NOT NULL,
  artefact_url    text,
  artefact_data   jsonb,                           -- embed snippet, curl command, etc.
  created_at      timestamptz DEFAULT now()
);

-- Keep last 5 versions per agent per format
CREATE OR REPLACE FUNCTION prune_old_exports() RETURNS trigger AS $$
BEGIN
  DELETE FROM exports
  WHERE agent_id = NEW.agent_id
    AND format = NEW.format
    AND id NOT IN (
      SELECT id FROM exports
      WHERE agent_id = NEW.agent_id AND format = NEW.format
      ORDER BY version DESC LIMIT 5
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER exports_prune_trigger
  AFTER INSERT ON exports
  FOR EACH ROW EXECUTE FUNCTION prune_old_exports();

-- ─── Conversations (test harness transcripts) ─────────────────────────────────
CREATE TABLE conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        uuid REFERENCES agents(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id),
  messages        jsonb NOT NULL DEFAULT '[]',
  is_test         boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

### 3.3 Row-Level Security Policies

```sql
-- Enable RLS on all tables
ALTER TABLE clients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_sources   ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_chunks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Helper: extract role from JWT
CREATE OR REPLACE FUNCTION auth_role() RETURNS text AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'user_role'),
    'client'
  );
$$ LANGUAGE sql STABLE;

-- Operator sees everything; client sees only their own records
CREATE POLICY "operator_all_clients" ON clients
  FOR ALL USING (auth_role() = 'operator');

CREATE POLICY "client_own_record" ON clients
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "operator_all_agents" ON agents
  FOR ALL USING (auth_role() = 'operator');

CREATE POLICY "client_own_agents" ON agents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM clients c WHERE c.id = agents.client_id AND c.user_id = auth.uid())
  );

-- KB sources: same pattern
CREATE POLICY "operator_all_kb" ON kb_sources FOR ALL USING (auth_role() = 'operator');
CREATE POLICY "client_upload_own_kb" ON kb_sources
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents a JOIN clients c ON c.id = a.client_id
      WHERE a.id = kb_sources.agent_id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY "client_read_own_kb" ON kb_sources
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agents a JOIN clients c ON c.id = a.client_id
      WHERE a.id = kb_sources.agent_id AND c.user_id = auth.uid()
    )
  );

-- KB chunks: service role only (no direct client access)
CREATE POLICY "service_role_chunks" ON kb_chunks
  FOR ALL USING (auth.role() = 'service_role');

-- Exports: operator all; client read own
CREATE POLICY "operator_all_exports" ON exports FOR ALL USING (auth_role() = 'operator');
CREATE POLICY "client_read_own_exports" ON exports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agents a JOIN clients c ON c.id = a.client_id
      WHERE a.id = exports.agent_id AND c.user_id = auth.uid()
    )
  );

-- Conversations: owner read/write
CREATE POLICY "own_conversations" ON conversations
  FOR ALL USING (user_id = auth.uid() OR auth_role() = 'operator');
```

### 3.4 Auth Setup — Role Claims

In Supabase Dashboard → Authentication → Hooks, create a **Custom Access Token** hook to inject `user_role` into the JWT:

```sql
-- Custom access token hook function
CREATE OR REPLACE FUNCTION custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  role text;
BEGIN
  SELECT raw_user_meta_data ->> 'user_role'
  INTO role
  FROM auth.users
  WHERE id = (event ->> 'user_id')::uuid;

  RETURN jsonb_set(
    event,
    '{claims,user_role}',
    to_jsonb(COALESCE(role, 'client'))
  );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION custom_access_token_hook TO supabase_auth_admin;
```

To assign operator role to a user (run as service role):
```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'),
  '{user_role}',
  '"operator"'
)
WHERE email = 'kevin@roboai.agency';
```

---

## 4. Shared TypeScript Types

Create `src/lib/types.ts`:

```typescript
export type UserRole = "operator" | "client";

export type AgentType = "chatbot" | "voice" | "agent";
export type AgentStatus = "draft" | "testing" | "live" | "archived";

export type TemplateId = "TPL-01" | "TPL-02" | "TPL-03" | "TPL-04" | "TPL-05" | "TPL-06";

export type KbSourceType = "intake" | "scrape" | "upload" | "url" | "text";
export type KbSourceStatus = "queued" | "processing" | "indexed" | "error";

export type ExportFormat = "mcp" | "api" | "widget" | "rawcode";

export type AgentTone = "professional" | "friendly" | "formal" | "casual" | "empathetic";
export type AgentLanguage = "en" | "es" | "bilingual";
export type FallbackBehaviour = "escalate" | "apologise" | "redirect";

export type AgentConfig = {
  name: string;
  language: AgentLanguage;
  tone: AgentTone;
  fallback: FallbackBehaviour;
  system_prompt: string;
  rag_active: boolean;
  lead_capture: boolean;
  human_escalation: boolean;
  conversation_memory: boolean;
  bilingual_detect: boolean;
  model: string;                   // operator-only
  max_tokens: number;              // operator-only
  temperature: number;             // operator-only
};

export type FlowNode = {
  id: string;
  type: "start" | "message" | "listen" | "intent_router" | "rag_lookup" |
        "condition" | "tool_call" | "escalate" | "end";
  label: string;
  order: number;
  properties: Record<string, unknown>;
};

export type FlowGraph = {
  nodes: FlowNode[];
  edges: Array<{ from: string; to: string; label?: string }>;
};

export type Agent = {
  id: string;
  client_id: string;
  name: string;
  type: AgentType;
  template_id: TemplateId;
  status: AgentStatus;
  config: AgentConfig;
  flow_graph: FlowGraph;
  config_hash: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KbSource = {
  id: string;
  agent_id: string;
  name: string;
  type: KbSourceType;
  status: KbSourceStatus;
  chunk_count: number;
  size_bytes: number;
  storage_path: string | null;
  source_url: string | null;
  error_message: string | null;
  indexed_at: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  company: string | null;
  intake_profile_id: string | null;
  status: "prospect" | "active" | "churned";
  created_at: string;
};

export type ExportArtefact = {
  id: string;
  agent_id: string;
  format: ExportFormat;
  version: number;
  config_hash: string;
  artefact_url: string | null;
  artefact_data: Record<string, unknown>;
  created_at: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  rag_chunks?: Array<{ content: string; source: string }>;
  latency_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
};
```

---

## 5. Middleware & Auth Guard

Create `src/middleware.ts`:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // RBAC: guard operator-only paths
  const OPERATOR_PATHS = ["/clients", "/pipeline"];
  const role = user.user_metadata?.user_role ?? "client";
  if (OPERATOR_PATHS.some((p) => pathname.startsWith(p)) && role !== "operator") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhook).*)"],
};
```

Create `src/lib/supabase/server.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

// Service role client — server-side only, never expose to browser
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

Create `src/lib/supabase/client.ts`:

```typescript
"use client";
import { createBrowserClient } from "@supabase/ssr";

export function getBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

---

## 6. Dashboard Shell

### 6.1 Root Layout (`src/app/layout.tsx`)

```typescript
import { Syne, DM_Sans } from "next/font/google";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], variable: "--font-syne", weight: ["400","600","700"] });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable}`}>
      <body className="bg-navy text-white font-body antialiased">{children}</body>
    </html>
  );
}
```

### 6.2 Dashboard Layout (`src/app/(dashboard)/layout.tsx`)

```typescript
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { getUser } from "@/lib/supabase/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();          // server-side
  const role = user?.user_metadata?.user_role ?? "client";

  return (
    <div className="flex h-screen overflow-hidden bg-navy">
      <Sidebar role={role} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

### 6.3 Sidebar (`src/components/layout/Sidebar.tsx`)

```typescript
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";
import {
  LayoutDashboard, Bot, Database, Users, GitBranch, BarChart3, Settings
} from "lucide-react";

const OPERATOR_LINKS = [
  { href: "/",            label: "Dashboard",      icon: LayoutDashboard },
  { href: "/builder",     label: "AI Builder",     icon: Bot },
  { href: "/agents",      label: "My Agents",      icon: Bot },
  { href: "/knowledge-base", label: "Knowledge Base", icon: Database },
  { href: "/clients",     label: "Clients",        icon: Users },
  { href: "/pipeline",    label: "Intake Pipeline", icon: GitBranch },
  { href: "/settings",    label: "Settings",       icon: Settings },
];

const CLIENT_LINKS = [
  { href: "/",            label: "My Dashboard",   icon: LayoutDashboard },
  { href: "/agents",      label: "My Agents",      icon: Bot },
  { href: "/knowledge-base", label: "Knowledge Base", icon: Database },
  { href: "/settings",    label: "Settings",       icon: Settings },
];

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const links = role === "operator" ? OPERATOR_LINKS : CLIENT_LINKS;

  return (
    <aside className="w-60 bg-navy-800 border-r border-white/10 flex flex-col py-6 shrink-0">
      <div className="px-5 mb-8">
        <span className="font-display text-xl font-bold text-teal">ROBO AI</span>
        <span className="ml-2 text-xs text-white/40 uppercase tracking-widest">Agency</span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active ? "bg-teal/15 text-teal" : "text-white/60 hover:text-white hover:bg-white/5"}`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 pt-4 border-t border-white/10">
        <span className="text-xs text-white/30 font-mono uppercase">{role}</span>
      </div>
    </aside>
  );
}
```

### 6.4 Stats API Route (`src/app/api/dashboard/stats/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const db = getServiceClient();

  const [agents, clients, chunks] = await Promise.all([
    db.from("agents").select("id", { count: "exact" }).eq("status", "live"),
    db.from("clients").select("id", { count: "exact" }).eq("status", "active"),
    db.from("kb_chunks").select("id", { count: "exact" }),
  ]);

  return NextResponse.json({
    active_agents: agents.count ?? 0,
    active_clients: clients.count ?? 0,
    kb_documents: chunks.count ?? 0,
    conversations_weekly: 0,     // wired to agent logs in Phase 2
  });
}
```

### 6.5 Dashboard Page (`src/app/(dashboard)/page.tsx`)

```typescript
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { getServiceClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const db = getServiceClient();
  const [{ count: agentsCount }, { count: clientsCount }, { count: chunksCount }] = await Promise.all([
    db.from("agents").select("*", { count: "exact", head: true }).eq("status", "live"),
    db.from("clients").select("*", { count: "exact", head: true }).eq("status", "active"),
    db.from("kb_chunks").select("*", { count: "exact", head: true }),
  ]);

  const { data: recentAgents } = await db
    .from("agents")
    .select("id,name,status,updated_at,clients(name)")
    .order("updated_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Active Agents"  value={agentsCount ?? 0}  />
        <StatsCard label="Active Clients" value={clientsCount ?? 0} />
        <StatsCard label="KB Documents"   value={chunksCount ?? 0}  />
        <StatsCard label="Convos (week)"  value={0}                 />
      </div>
      <ActivityFeed recentAgents={recentAgents ?? []} />
    </div>
  );
}
```

---

## 7. AI Builder Wizard

### 7.1 Wizard State Management

All wizard state is stored in `localStorage` under the key `robo_wizard_{agentId}`. Shape:

```typescript
type WizardState = {
  agentId: string;
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
  stepsCompleted: number[];
  templateId: string | null;
  kbConfirmed: boolean;
};
```

Steps 3–6 are disabled (unclickable in the step rail) until `kbConfirmed === true`.

The wizard lives under `/builder/[agentId]/step{N}/page.tsx`. On first visit to `/builder`, a new agent draft is created via `POST /api/agents` and the user is redirected to `/builder/{newAgentId}/step1`.

### 7.2 Step 1 — Choose Type (`src/app/(dashboard)/builder/[agentId]/step1/page.tsx`)

Template data — define as a constant:

```typescript
const TEMPLATES = [
  { id: "TPL-01", name: "AI Chatbot",        product: "CB-01",         icon: "💬",
    description: "Web chat · FAQs, lead capture, escalation" },
  { id: "TPL-02", name: "Voice Assistant",   product: "AVA-01",        icon: "📞",
    description: "Phone · Twilio · bilingual EN/ES" },
  { id: "TPL-03", name: "AI Agent",          product: "CA-01",         icon: "🤖",
    description: "Autonomous · tools · CRM integration" },
  { id: "TPL-04", name: "Lead Qualifier",    product: "CB-01 variant", icon: "🎯",
    description: "Structured intake · lead scoring" },
  { id: "TPL-05", name: "Booking Assistant", product: "AVA-01 variant",icon: "📅",
    description: "Calendar sync · confirmations" },
  { id: "TPL-06", name: "Custom Agent",      product: "Blank",         icon: "⚡",
    description: "Full control · no defaults" },
] as const;
```

On template selection:
1. Call `PATCH /api/agents/{agentId}` with `{ template_id, type, config: TEMPLATE_DEFAULTS[templateId] }`
2. Mark step 1 completed in localStorage
3. Redirect to `/builder/{agentId}/step2`

Default configs per template:

```typescript
const TEMPLATE_DEFAULTS: Record<string, Partial<AgentConfig>> = {
  "TPL-01": { tone: "friendly",      language: "bilingual", rag_active: true,  lead_capture: true,  human_escalation: true  },
  "TPL-02": { tone: "professional",  language: "bilingual", rag_active: true,  lead_capture: false, human_escalation: true  },
  "TPL-03": { tone: "professional",  language: "en",        rag_active: true,  lead_capture: false, human_escalation: false },
  "TPL-04": { tone: "friendly",      language: "bilingual", rag_active: false, lead_capture: true,  human_escalation: true  },
  "TPL-05": { tone: "professional",  language: "bilingual", rag_active: true,  lead_capture: true,  human_escalation: false },
  "TPL-06": { tone: "professional",  language: "en",        rag_active: true,  lead_capture: false, human_escalation: false },
};
```

### 7.3 Step 2 — Knowledge Base

**Auto-seed webhook handler (`src/app/api/webhook/kb-seed/route.ts`):**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { ingestText } from "@/lib/kb/ingester";

// n8n calls this after BA-001/BA-002 completes
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    agent_id: string;
    intake_json?: Record<string, unknown>;
    scrape_json?: Record<string, unknown>;
  };

  const db = getServiceClient();

  if (body.intake_json) {
    const { data: source } = await db.from("kb_sources").insert({
      agent_id: body.agent_id,
      name: "BA-001 Intake Profile",
      type: "intake",
      status: "processing",
      size_bytes: JSON.stringify(body.intake_json).length,
    }).select().single();

    if (source) {
      await ingestText({
        sourceId: source.id,
        agentId: body.agent_id,
        text: JSON.stringify(body.intake_json, null, 2),
        metadata: { type: "intake" },
      });
      await db.from("kb_sources").update({ status: "indexed", indexed_at: new Date().toISOString() })
        .eq("id", source.id);
    }
  }

  // Repeat for scrape_json
  return NextResponse.json({ ok: true });
}
```

**File upload API (`src/app/api/agents/[agentId]/kb/upload/route.ts`):**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { parseFile } from "@/lib/kb/parsers";
import { ingestText } from "@/lib/kb/ingester";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest, { params }: { params: { agentId: string } }) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });

  const db = getServiceClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `kb/${params.agentId}/${Date.now()}_${file.name}`;

  // Upload to Supabase Storage
  await db.storage.from("kb-uploads").upload(storagePath, buffer, { contentType: file.type });

  // Create source record
  const { data: source } = await db.from("kb_sources").insert({
    agent_id: params.agentId,
    name: file.name,
    type: "upload",
    status: "processing",
    size_bytes: file.size,
    storage_path: storagePath,
  }).select().single();

  if (!source) return NextResponse.json({ error: "db insert failed" }, { status: 500 });

  // Parse + ingest (run async — respond immediately with 202)
  void (async () => {
    try {
      const text = await parseFile(buffer, file.name);
      await ingestText({ sourceId: source.id, agentId: params.agentId, text, metadata: { filename: file.name } });
      await db.from("kb_sources").update({
        status: "indexed",
        indexed_at: new Date().toISOString(),
      }).eq("id", source.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.from("kb_sources").update({ status: "error", error_message: msg.slice(0, 300) }).eq("id", source.id);
    }
  })();

  return NextResponse.json({ source_id: source.id, status: "processing" }, { status: 202 });
}
```

**Indexing status poll (client side):**
Poll `GET /api/agents/{agentId}/kb/sources` every 5 seconds until all sources are `indexed` or `error`. The Continue button on Step 2 enables once at least one source is `indexed`.

### 7.4 Step 3 — Flow Builder (Sprint 4 MVP: Text List)

Sprint 4 uses an ordered list of nodes (no canvas). Each node is a card with a type badge and an "Edit" drawer.

**Default flow nodes (pre-populated from template):**

```typescript
const DEFAULT_FLOW: FlowNode[] = [
  { id: "node-1", type: "start",         label: "Start",         order: 1, properties: {} },
  { id: "node-2", type: "message",       label: "Greet",         order: 2, properties: { text: "Hi! How can I help you today?" } },
  { id: "node-3", type: "intent_router", label: "Intent Router", order: 3, properties: { intents: ["faq","booking","escalate"] } },
  { id: "node-4", type: "rag_lookup",    label: "RAG Lookup",    order: 4, properties: { top_k: 3, threshold: 0.75 } },
  { id: "node-5", type: "message",       label: "Respond",       order: 5, properties: { text: "Based on our knowledge base: {{rag_result}}" } },
  { id: "node-6", type: "escalate",      label: "Escalate",      order: 6, properties: { channel: "email" } },
  { id: "node-7", type: "end",           label: "End",           order: 7, properties: {} },
];
```

Save flow via `PATCH /api/agents/{agentId}` with `{ flow_graph: { nodes, edges } }`. Auto-save triggers on any node edit with 30-second debounce.

### 7.5 Step 4 — Configure

**Configuration Editor API (`src/app/api/agents/[agentId]/route.ts`):**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

const ConfigPatchSchema = z.object({
  name:                 z.string().min(1).max(80).optional(),
  language:             z.enum(["en","es","bilingual"]).optional(),
  tone:                 z.enum(["professional","friendly","formal","casual","empathetic"]).optional(),
  fallback:             z.enum(["escalate","apologise","redirect"]).optional(),
  system_prompt:        z.string().max(4000).optional(),
  rag_active:           z.boolean().optional(),
  lead_capture:         z.boolean().optional(),
  human_escalation:     z.boolean().optional(),
  conversation_memory:  z.boolean().optional(),
  bilingual_detect:     z.boolean().optional(),
  // operator-only
  model:                z.string().optional(),
  max_tokens:           z.number().int().min(256).max(8192).optional(),
  temperature:          z.number().min(0).max(1).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { agentId: string } }) {
  const db = getServiceClient();
  const body = await req.json();
  const parsed = ConfigPatchSchema.safeParse(body.config ?? body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { data: agent } = await db.from("agents").select("config").eq("id", params.agentId).single();
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });

  const merged = { ...agent.config, ...parsed.data };
  const { data } = await db.from("agents")
    .update({ config: merged, updated_at: new Date().toISOString(), ...(body.flow_graph ? { flow_graph: body.flow_graph } : {}) })
    .eq("id", params.agentId)
    .select()
    .single();

  return NextResponse.json(data);
}
```

**Publish endpoint (`src/app/api/agents/[agentId]/publish/route.ts`):**

```typescript
import { createHash } from "crypto";

export async function POST(req: NextRequest, { params }: { params: { agentId: string } }) {
  const db = getServiceClient();
  const { data: agent } = await db.from("agents").select("*").eq("id", params.agentId).single();
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });

  const configHash = createHash("sha256")
    .update(JSON.stringify({ config: agent.config, flow_graph: agent.flow_graph }))
    .digest("hex")
    .slice(0, 12);

  await db.from("agents").update({
    config_hash: configHash,
    published_at: new Date().toISOString(),
    status: "testing",
  }).eq("id", params.agentId);

  return NextResponse.json({ config_hash: configHash });
}
```

### 7.6 Step 5 — Test Harness

**Chat API (`src/app/api/agents/[agentId]/chat/route.ts`):**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest, { params }: { params: { agentId: string } }) {
  const { messages, conversation_id } = await req.json() as {
    messages: ChatMessage[];
    conversation_id?: string;
  };

  const db = getServiceClient();
  const { data: agent } = await db.from("agents").select("config").eq("id", params.agentId).single();
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });

  const cfg = agent.config;
  const userMessage = messages.at(-1)?.content ?? "";

  // RAG lookup
  let ragChunks: Array<{ content: string; source: string }> = [];
  if (cfg.rag_active && userMessage) {
    const { embed } = await import("@/lib/ai/embed");
    const queryEmbedding = await embed(userMessage);
    const { data: chunks } = await db.rpc("match_kb_chunks", {
      query_embedding: queryEmbedding,
      agent_id_filter: params.agentId,
      match_count: 3,
      similarity_threshold: 0.65,
    });
    ragChunks = (chunks ?? []).map((c: Record<string,string>) => ({ content: c.content, source: c.source_name ?? "KB" }));
  }

  const systemPrompt = [
    cfg.system_prompt,
    ragChunks.length > 0
      ? `\n\nKNOWLEDGE BASE CONTEXT:\n${ragChunks.map((c) => c.content).join("\n\n")}`
      : "",
  ].join("");

  const t0 = Date.now();
  const completion = await anthropic.messages.create({
    model: cfg.model ?? "claude-sonnet-4-6-20251001",
    max_tokens: cfg.max_tokens ?? 1024,
    temperature: cfg.temperature ?? 0.3,
    system: systemPrompt,
    messages: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
  });

  const assistantText = completion.content[0].type === "text" ? completion.content[0].text : "";
  const latency = Date.now() - t0;

  return NextResponse.json({
    content:    assistantText,
    rag_chunks: ragChunks,
    latency_ms: latency,
    tokens_in:  completion.usage.input_tokens,
    tokens_out: completion.usage.output_tokens,
  });
}
```

**pgvector match function (add to Supabase SQL):**

```sql
CREATE OR REPLACE FUNCTION match_kb_chunks(
  query_embedding vector(384),
  agent_id_filter uuid,
  match_count int DEFAULT 3,
  similarity_threshold float DEFAULT 0.65
)
RETURNS TABLE (
  id uuid,
  content text,
  source_name text,
  similarity float
) AS $$
  SELECT
    kc.id,
    kc.content,
    ks.name AS source_name,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM kb_chunks kc
  JOIN kb_sources ks ON ks.id = kc.source_id
  WHERE kc.agent_id = agent_id_filter
    AND 1 - (kc.embedding <=> query_embedding) > similarity_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql STABLE;
```

---

## 8. Knowledge Base Ingestion Pipeline

### 8.1 Text Chunking (`src/lib/kb/chunker.ts`)

```typescript
// 512-token chunks with 50-token overlap
// Approximate: 1 token ≈ 4 chars
const CHUNK_CHARS = 2048;
const OVERLAP_CHARS = 200;

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  const clean = text.replace(/\s+/g, " ").trim();

  while (start < clean.length) {
    const end = start + CHUNK_CHARS;
    let chunk = clean.slice(start, end);

    // Break at sentence boundary
    if (end < clean.length) {
      const lastPeriod = chunk.lastIndexOf(". ");
      if (lastPeriod > CHUNK_CHARS * 0.6) chunk = chunk.slice(0, lastPeriod + 1);
    }

    if (chunk.trim().length > 50) chunks.push(chunk.trim());
    start += chunk.length - OVERLAP_CHARS;
    if (start <= 0) start = CHUNK_CHARS;
  }
  return chunks;
}
```

### 8.2 Embeddings (`src/lib/ai/embed.ts`)

```typescript
import { pipeline } from "@xenova/transformers";

let embedder: Awaited<ReturnType<typeof pipeline>> | null = null;

export async function embed(text: string): Promise<number[]> {
  if (!embedder) {
    embedder = await pipeline("feature-extraction", process.env.EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2");
  }
  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}
```

### 8.3 Ingester (`src/lib/kb/ingester.ts`)

```typescript
import { getServiceClient } from "@/lib/supabase/server";
import { chunkText } from "./chunker";
import { embed } from "@/lib/ai/embed";

export async function ingestText(input: {
  sourceId: string;
  agentId: string;
  text: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = getServiceClient();
  const chunks = chunkText(input.text);

  const rows = await Promise.all(
    chunks.map(async (content, i) => ({
      source_id:   input.sourceId,
      agent_id:    input.agentId,
      content,
      embedding:   await embed(content),
      token_count: Math.round(content.length / 4),
      chunk_index: i,
      metadata:    input.metadata ?? {},
    }))
  );

  // Batch upsert in groups of 50
  for (let i = 0; i < rows.length; i += 50) {
    await db.from("kb_chunks").insert(rows.slice(i, i + 50));
  }

  await db.from("kb_sources").update({
    chunk_count: chunks.length,
    status: "indexed",
    indexed_at: new Date().toISOString(),
  }).eq("id", input.sourceId);
}
```

### 8.4 File Parsers (`src/lib/kb/parsers.ts`)

```typescript
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export async function parseFile(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    const { text } = await pdfParse(buffer);
    return text;
  }
  if (ext === "docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  if (ext === "txt") {
    return buffer.toString("utf-8");
  }
  throw new Error(`Unsupported file type: .${ext}`);
}
```

---

## 9. Export Factory

### 9.1 MCP Export (`src/lib/export/mcp.ts`)

```typescript
import type { Client } from "@/lib/types";

export function buildMcpArtefact(client: Client, agentId: string) {
  const endpoint = `${process.env.NEXT_PUBLIC_MCP_BASE}/${client.id}/sse`;
  const claudeConfig = {
    mcpServers: {
      roboai: { command: "npx", args: ["-y", "@roboai/mcp-client", endpoint] }
    }
  };
  return {
    endpoint,
    claude_desktop_config: JSON.stringify(claudeConfig, null, 2),
    instructions: [
      "1. Open Claude Desktop → Settings → Developer",
      "2. Paste the config block into claude_desktop_config.json",
      "3. Restart Claude Desktop",
      `4. The agent '${agentId}' will appear as a connected MCP tool`,
    ],
  };
}
```

### 9.2 REST API Export (`src/lib/export/api.ts`)

```typescript
export function buildApiArtefact(agentId: string, apiKey: string) {
  const base = `${process.env.NEXT_PUBLIC_API_BASE}/agents/${agentId}`;
  return {
    base_url: base,
    api_key: apiKey,
    curl_example: `curl -X POST ${base}/chat \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hello"}]}'`,
    docs_url: `${process.env.NEXT_PUBLIC_API_BASE}/docs`,
    rate_limits: { requests_per_minute: 60, tokens_per_day: 500000 },
  };
}
```

### 9.3 Widget Export (`src/lib/export/widget.ts`)

```typescript
export function buildWidgetArtefact(agentId: string, options: {
  primaryColor: string;
  position: "bottom-right" | "bottom-left";
  greeting: string;
  avatarUrl?: string;
}) {
  const attrs = [
    `data-agent="${agentId}"`,
    `data-color="${options.primaryColor}"`,
    `data-position="${options.position}"`,
    `data-greeting="${options.greeting}"`,
    options.avatarUrl ? `data-avatar="${options.avatarUrl}"` : null,
  ].filter(Boolean).join(" ");

  const cdnUrl = process.env.NEXT_PUBLIC_WIDGET_CDN!;
  const snippet = `<script src="${cdnUrl}" ${attrs} async></script>`;

  return {
    embed_snippet: snippet,
    preview_url: `${process.env.NEXT_PUBLIC_APP_URL}/widget-preview/${agentId}`,
    customisation: options,
  };
}
```

### 9.4 Raw Code Export (`src/lib/export/rawcode.ts`)

```typescript
import JSZip from "jszip";
import type { Agent } from "@/lib/types";

export async function buildRawCodeZip(agent: Agent): Promise<Buffer> {
  const zip = new JSZip();

  zip.file("index.js", generateIndexJs(agent));
  zip.file("agent-config.json", JSON.stringify(agent.config, null, 2));
  zip.file(".env.example", ENV_EXAMPLE);
  zip.file("Dockerfile", DOCKERFILE);
  zip.file("README.md", generateReadme(agent));

  const kb = zip.folder("knowledge");
  kb?.file(".gitkeep", "# Place KB files here — run npm run ingest to index\n");

  return zip.generateAsync({ type: "nodebuffer" });
}

function generateIndexJs(agent: Agent): string {
  return `// ROBO AI Agent — ${agent.name}
// Generated by WEB-007 Export Factory
// Node.js 20 LTS · Claude claude-sonnet-4-6

const Anthropic = require("@anthropic-ai/sdk");
require("dotenv").config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = ${JSON.stringify(agent.config.system_prompt)};

async function chat(messages) {
  const response = await anthropic.messages.create({
    model: "${agent.config.model ?? "claude-sonnet-4-6-20251001"}",
    max_tokens: ${agent.config.max_tokens ?? 1024},
    system: SYSTEM_PROMPT,
    messages,
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

module.exports = { chat };
`;
}

const ENV_EXAMPLE = `ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
`;

const DOCKERFILE = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
`;

function generateReadme(agent: Agent): string {
  return `# ${agent.name} — ROBO AI Agent Package\n\n` +
    `Generated: ${new Date().toISOString()}\n\n` +
    `## Quick Start\n\`\`\`bash\nnpm install\ncp .env.example .env\n# Fill in ANTHROPIC_API_KEY\nnode index.js\n\`\`\`\n`;
}
```

### 9.5 Export API Route (`src/app/api/agents/[agentId]/export/[format]/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { buildMcpArtefact } from "@/lib/export/mcp";
import { buildApiArtefact } from "@/lib/export/api";
import { buildWidgetArtefact } from "@/lib/export/widget";
import { buildRawCodeZip } from "@/lib/export/rawcode";
import { randomUUID } from "crypto";
import type { ExportFormat } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { agentId: string; format: ExportFormat } }
) {
  const db = getServiceClient();
  const body = await req.json().catch(() => ({})) as Record<string,unknown>;

  const { data: agent } = await db.from("agents")
    .select("*, clients(id,name,email)")
    .eq("id", params.agentId)
    .single();
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!agent.config_hash) return NextResponse.json({ error: "publish first" }, { status: 409 });

  // Get next version number
  const { count } = await db.from("exports")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", params.agentId)
    .eq("format", params.format);
  const version = (count ?? 0) + 1;

  let artefactData: Record<string, unknown>;
  let responseHeaders: Record<string, string> = {};

  switch (params.format) {
    case "mcp":
      artefactData = buildMcpArtefact(agent.clients, params.agentId);
      break;
    case "api": {
      const apiKey = `rba_${randomUUID().replace(/-/g, "")}`;
      artefactData = buildApiArtefact(params.agentId, apiKey);
      break;
    }
    case "widget":
      artefactData = buildWidgetArtefact(params.agentId, {
        primaryColor: (body.primaryColor as string) ?? "#0EA5A0",
        position: (body.position as "bottom-right") ?? "bottom-right",
        greeting: (body.greeting as string) ?? "Hi! How can I help?",
      });
      break;
    case "rawcode": {
      const zipBuffer = await buildRawCodeZip(agent);
      await db.from("exports").insert({
        agent_id: params.agentId,
        format: "rawcode",
        version,
        config_hash: agent.config_hash,
        artefact_data: { filename: `roboai-agent-${params.agentId.slice(0,8)}.zip` },
      });
      return new NextResponse(zipBuffer, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="roboai-agent-${params.agentId.slice(0,8)}.zip"`,
        },
      });
    }
    default:
      return NextResponse.json({ error: "invalid format" }, { status: 400 });
  }

  await db.from("exports").insert({
    agent_id: params.agentId,
    format: params.format,
    version,
    config_hash: agent.config_hash,
    artefact_data: artefactData,
  });

  return NextResponse.json({ version, artefact: artefactData }, { headers: responseHeaders });
}
```

---

## 10. Client Management Views

### 10.1 Client Table (`src/app/(dashboard)/clients/page.tsx`)

Server component — fetches all clients with their agent count:

```typescript
import { getServiceClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ClientsPage() {
  const db = getServiceClient();
  const { data: clients } = await db
    .from("clients")
    .select("*, agents(id)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Clients</h1>
        <Link href="/clients/new" className="btn-primary">+ New Client</Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-white/40 text-left border-b border-white/10">
            <th className="pb-3 pr-6">Name</th>
            <th className="pb-3 pr-6">Company</th>
            <th className="pb-3 pr-6">Status</th>
            <th className="pb-3 pr-6">Agents</th>
            <th className="pb-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {(clients ?? []).map((c) => (
            <tr key={c.id} className="border-b border-white/5 hover:bg-white/3">
              <td className="py-3 pr-6">
                <Link href={`/clients/${c.id}`} className="text-teal hover:underline">{c.name}</Link>
              </td>
              <td className="py-3 pr-6 text-white/60">{c.company ?? "—"}</td>
              <td className="py-3 pr-6">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  c.status === "active" ? "bg-teal/20 text-teal" :
                  c.status === "churned" ? "bg-red-500/20 text-red-400" :
                  "bg-white/10 text-white/60"}`}>
                  {c.status}
                </span>
              </td>
              <td className="py-3 pr-6">{c.agents?.length ?? 0}</td>
              <td className="py-3 text-white/40">{new Date(c.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 10.2 Intake Pipeline Kanban (`src/app/(dashboard)/pipeline/page.tsx`)

Display BA-001 profiles as Kanban cards with columns: `submitted` → `scraped` → `analyzed` → `pdf_ready`.

```typescript
import { getServiceClient } from "@/lib/supabase/server";

const STAGES = [
  { key: "submitted", label: "Submitted" },
  { key: "scraped",   label: "Scraped" },
  { key: "analyzed",  label: "Analyzed" },
  { key: "pdf_ready", label: "PDF Ready" },
] as const;

export default async function PipelinePage() {
  // This reads from the BA-001 profiles table (separate Supabase project or shared)
  const db = getServiceClient();
  const { data: profiles } = await db
    .from("profiles")
    .select("profile_id,created_at,pipeline,contact->email,business->industry")
    .eq("session_status", "submitted")
    .order("created_at", { ascending: false })
    .limit(50);

  const byStage = STAGES.map(({ key, label }) => ({
    key,
    label,
    items: (profiles ?? []).filter((p) => {
      const pip = p.pipeline as Record<string, boolean>;
      if (key === "submitted") return pip.submitted && !pip.scraped;
      if (key === "scraped")   return pip.scraped && !pip.analyzed;
      if (key === "analyzed")  return pip.analyzed && !pip.pdf_ready;
      return pip.pdf_ready;
    }),
  }));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Intake Pipeline</h1>
      <div className="grid grid-cols-4 gap-4">
        {byStage.map(({ key, label, items }) => (
          <div key={key} className="bg-navy-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">{label}</h2>
              <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((p) => (
                <div key={p.profile_id} className="bg-navy rounded-lg p-3 text-xs space-y-1">
                  <div className="font-medium truncate">{String(p.email ?? "—")}</div>
                  <div className="text-white/40">{String(p.industry ?? "—")}</div>
                  <div className="text-white/30">{new Date(p.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 11. n8n Webhook Integration

n8n calls WEB-007 at two points:

| Event | Webhook | Payload |
|---|---|---|
| BA-001 submitted | `POST /api/webhook/kb-seed` | `{ agent_id, intake_json }` |
| BA-002 scrape complete | `POST /api/webhook/kb-seed` | `{ agent_id, scrape_json }` |

**Secure the webhook** with a shared secret header:

```typescript
// In /api/webhook/kb-seed/route.ts — add at top:
const SECRET = process.env.WEBHOOK_SECRET ?? "";
if (req.headers.get("x-webhook-secret") !== SECRET) {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
```

Add to `.env.local`:
```bash
WEBHOOK_SECRET=your-random-secret-32-chars
```

---

## 12. Sprint 5 — Deferred Features

These are **not built in Sprint 4**. Install the packages now (done in §2.2) but do not wire them.

### React Flow Visual Canvas (Sprint 5)

Replace `FlowNodeList.tsx` with a full React Flow canvas:
- Install: already done (`reactflow`)
- Node types map to custom React Flow node components
- Edges stored in `agent.flow_graph.edges`
- dagre auto-layout for graphs > 5 nodes
- Mini-map appears when node count > 10
- Validation: no orphaned nodes, exactly one Start, at least one End/Escalate

### Twilio Voice Harness (Sprint 5)

```typescript
// src/app/api/agents/[agentId]/voice/test-call/route.ts
import twilio from "twilio";
const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

export async function POST(req, { params }) {
  const call = await client.calls.create({
    to: process.env.OPERATOR_TEST_PHONE!,
    from: process.env.TWILIO_PHONE_NUMBER!,
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/agents/${params.agentId}/voice/twiml`,
    statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/agents/${params.agentId}/voice/status`,
  });
  return NextResponse.json({ call_sid: call.sid });
}
```

### i18n Full Pass (Sprint 5)

Strings are already wrapped in keys. Wire `next-intl` in layout and add `es.json` translations. All `t("key")` calls in place from Sprint 4 — Sprint 5 only fills the Spanish values.

---

## 13. Auth Pages

### Login (`src/app/(auth)/login/page.tsx`)

```typescript
"use client";
import { getBrowserClient } from "@/lib/supabase/client";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const supabase = getBrowserClient();

  const handleMagicLink = async () => {
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-6">
        <h1 className="font-display text-3xl font-bold text-center">
          <span className="text-teal">ROBO AI</span> Agency
        </h1>
        {!sent ? (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full h-12 rounded-xl bg-navy-800 border border-white/10 px-4 text-white"
            />
            <button
              onClick={handleMagicLink}
              className="w-full h-12 rounded-xl bg-teal font-semibold text-navy"
            >
              Send Magic Link
            </button>
          </>
        ) : (
          <p className="text-center text-white/70">Check your email for the login link.</p>
        )}
      </div>
    </div>
  );
}
```

### Callback (`src/app/(auth)/callback/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login", request.url));

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL("/", request.url));
}
```

---

## 14. Docker + Hetzner Deployment

**`Dockerfile`** (place in project root):

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Add to `next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = { output: "standalone" };
module.exports = nextConfig;
```

**`docker-compose.yml`** (on Hetzner VPS, alongside BA-002/BA-004 services):

```yaml
services:
  web007:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file: .env.production
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data

volumes:
  caddy_data:
```

**`Caddyfile`**:

```
dashboard.roboai.agency {
  reverse_proxy web007:3000
}
```

**Health check route** (`src/app/api/health/route.ts`):
```typescript
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ status: "ok", ts: new Date().toISOString() });
}
```

---

## 15. Test Cases (Sprint 4 QA Checklist)

| TC | Scenario | Expected |
|---|---|---|
| TC-01 | Magic link login — operator email | Redirect to dashboard; sidebar shows all 7 links |
| TC-02 | Magic link login — client email | Redirect to dashboard; sidebar shows 4 links only; `/clients` returns redirect |
| TC-03 | Cross-client API call: Client A GETs Client B's agent | 403 Forbidden |
| TC-04 | New agent wizard: select TPL-01 → confirm KB (upload .txt) → skip flow → configure → test → export widget | Widget embed snippet generated; export record in DB |
| TC-05 | Upload file > 10 MB | 413 response; error message shown in UI; no kb_sources record created |
| TC-06 | KB auto-seed: POST `/api/webhook/kb-seed` with intake_json | kb_sources record created as `indexed`; chunk_count > 0 |
| TC-07 | KB auto-seed with wrong secret header | 401 response |
| TC-08 | Test harness: send "What services do you offer?" with indexed KB | Response within 3s; RAG chip visible if KB invoked |
| TC-09 | Publish agent then export MCP | Export record created; version = 1; endpoint URL contains client UUID |
| TC-10 | Export Raw Code ZIP | ZIP downloads; contains `index.js`, `agent-config.json`, `README.md`, `.env.example` |
| TC-11 | Export without publishing first | 409 response: "publish first" |
| TC-12 | 6th export of same format | Oldest export pruned; max 5 remain in DB |
| TC-13 | Client edits system_prompt → test harness → does NOT publish → check export | Export artefact unchanged; test harness uses updated draft |
| TC-14 | UI language toggle EN → ES | All UI strings in Spanish (Sprint 5 full pass; Sprint 4: key exists, English fallback OK) |

---

## 16. Sprint 5 Build Order (Reference)

| Priority | Feature | Estimated days |
|---|---|---|
| 1 | React Flow canvas (replaces node list) | 3 days |
| 2 | Node property editor right rail | 1 day |
| 3 | Flow graph validation (orphan check, Start/End rules) | 0.5 day |
| 4 | Twilio voice test harness | 1.5 days |
| 5 | Analytics page (conversation count, latency charts) | 1.5 days |
| 6 | Full i18n ES translations | 1 day |
| 7 | Mobile responsive pass | 1.5 days |

---

*Reference: `WEB007_PRD_v1_0_AI_Builder_Platform.md` · ROBO AI Agency · May 2026*
*Next review: Sprint 4 kickoff · Implement sections 2–14 in order*
