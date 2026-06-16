# BA-002 — Website Scraper Build Instructions
**ROBO AI Agency · Business Analyser Bundle · v1.0**
> Standalone Node.js/TypeScript scraper service. A coder IDE should execute these instructions top-to-bottom to build and deploy.

---

## 0. What This Service Does

BA-002 is called by n8n after a client submits the BA-001 intake form. It receives a `profile_id` and `website_url`, scrapes the client's website with Playwright, enriches the raw content with Claude (industry detection, service extraction, 300-word summary), and writes a complete row to the Supabase `scrape_results` table. n8n polls that table and fires the Master Analyzer (BA-001 MA) once the row exists.

**This is NOT a serverless function.** Playwright requires a full Chromium binary — deploy as a long-running Docker container on Hetzner VPS.

---

## 1. Architecture Overview

```
n8n  ──POST /scrape──▶  BA-002 Express Server (Hetzner)
                              │
                              ├─ Playwright (headless Chromium)
                              │     └─ fetches website_url
                              │
                              ├─ HTML parser (extracts signals)
                              │
                              ├─ Anthropic API (claude-sonnet-4-20250514)
                              │     └─ generates summary + detects industry/services
                              │
                              └─ Supabase (service role)
                                    └─ INSERT scrape_results row
```

**Flow:**
1. n8n POSTs `{ profile_id, website_url, secret }` to `POST /scrape`
2. Server validates secret, returns `202 Accepted` immediately
3. Scrape + AI analysis runs async (background job)
4. On completion, writes `scrape_results` row
5. n8n polls `scrape_results` every 30 s until row appears

---

## 2. Project Scaffold

### 2.1 Create Project

```bash
mkdir ba-002-scraper && cd ba-002-scraper
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

# Scraper
npm install playwright
npx playwright install chromium --with-deps

# AI
npm install @anthropic-ai/sdk

# Database
npm install @supabase/supabase-js

# Utilities
npm install uuid zod dotenv
npm install @types/uuid --save-dev
```

### 2.3 Environment Variables

Create `.env`:
```bash
# Server
PORT=3001
SCRAPER_SECRET=your_shared_secret_matching_n8n_and_ba001

# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your_key_here

# Owner alert
OWNER_ALERT_EMAIL=gerardo@roboai.agency
RESEND_API_KEY=re_your_key_here
RESEND_FROM_EMAIL=alerts@roboai.agency

# Limits
SCRAPE_TIMEOUT_MS=30000
AI_TIMEOUT_MS=20000
MAX_HTML_CHARS=50000
```

### 2.4 File Structure

```
ba-002-scraper/
├── src/
│   ├── server.ts             ← Express app + /scrape endpoint
│   ├── scraper.ts            ← Playwright browser logic
│   ├── extractor.ts          ← Parse HTML signals (title, meta, tech, links)
│   ├── ai-enricher.ts        ← Anthropic call → summary + industry + services
│   ├── db.ts                 ← Supabase client + write scrape_results
│   ├── alert.ts              ← Owner alert on critical failures
│   └── types.ts              ← Shared TypeScript types
├── .env
├── .dockerignore
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 3. Types (`src/types.ts`)

```typescript
export interface ScrapeJob {
  profile_id: string
  website_url: string
}

export type ScrapeStatus = 'success' | 'failed' | 'blocked' | 'timeout'

export interface RawPageData {
  html: string                   // full HTML
  page_title: string | null
  meta_description: string | null
  raw_html_snapshot: string      // first MAX_HTML_CHARS chars
  final_url: string              // after redirects
  status_code: number | null
  error?: string
}

export interface ExtractedSignals {
  social_links: Record<string, string>   // { twitter: 'https://...', linkedin: '...' }
  tech_stack_detected: string[]          // ['WordPress', 'Shopify', 'Google Analytics', ...]
  candidate_services: string[]           // raw text chunks likely to be services/products
}

export interface AIEnrichment {
  content_summary: string                // 300-word plain-language summary
  detected_industry: string | null       // AI-inferred industry
  services_detected: string[]            // cleaned services list
}

export interface ScrapeResult {
  profile_id: string
  scrape_status: ScrapeStatus
  page_title: string | null
  meta_description: string | null
  detected_industry: string | null
  services_detected: string[]
  tech_stack_detected: string[]
  social_links: Record<string, string>
  content_summary: string | null
  raw_html_snapshot: string | null
  error_message: string | null
}
```

---

## 4. Express Server (`src/server.ts`)

```typescript
import express, { Request, Response } from 'express'
import { z } from 'zod'
import { runScrapeJob } from './scraper'
import * as dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(express.json())

const ScrapeBody = z.object({
  profile_id: z.string().uuid(),
  website_url: z.string().url(),
  secret:      z.string(),
})

// Health check — n8n can poll this to confirm service is up
app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'ba-002-scraper' })
})

// Main scrape endpoint
app.post('/scrape', (req: Request, res: Response) => {
  let body: z.infer<typeof ScrapeBody>

  try {
    body = ScrapeBody.parse(req.body)
  } catch (err) {
    res.status(400).json({ error: 'Invalid request body' })
    return
  }

  if (body.secret !== process.env.SCRAPER_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // Respond immediately — scrape runs async
  res.status(202).json({ accepted: true, profile_id: body.profile_id })

  // Run in background, do not await
  runScrapeJob({ profile_id: body.profile_id, website_url: body.website_url })
    .catch(err => {
      console.error(`[BA-002] Unhandled error for ${body.profile_id}:`, err)
    })
})

const PORT = parseInt(process.env.PORT ?? '3001', 10)
app.listen(PORT, () => console.log(`[BA-002] Scraper listening on :${PORT}`))
```

---

## 5. Playwright Scraper (`src/scraper.ts`)

```typescript
import { chromium } from 'playwright'
import { ScrapeJob, RawPageData, ScrapeResult } from './types'
import { extractSignals } from './extractor'
import { enrichWithAI } from './ai-enricher'
import { writeScrapeResult } from './db'
import { alertOwner } from './alert'

const SCRAPE_TIMEOUT = parseInt(process.env.SCRAPE_TIMEOUT_MS ?? '30000', 10)
const MAX_HTML = parseInt(process.env.MAX_HTML_CHARS ?? '50000', 10)

export async function runScrapeJob(job: ScrapeJob): Promise<void> {
  console.log(`[BA-002] Starting scrape: ${job.profile_id} → ${job.website_url}`)

  let rawPage: RawPageData
  let scrapeStatus: ScrapeResult['scrape_status'] = 'success'

  // ── Step 1: Fetch page with Playwright ──────────────────────────────────────
  try {
    rawPage = await fetchPage(job.website_url)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    scrapeStatus = classifyError(message)
    console.warn(`[BA-002] Fetch failed (${scrapeStatus}): ${message}`)

    await writeScrapeResult({
      profile_id: job.profile_id,
      scrape_status: scrapeStatus,
      page_title: null,
      meta_description: null,
      detected_industry: null,
      services_detected: [],
      tech_stack_detected: [],
      social_links: {},
      content_summary: null,
      raw_html_snapshot: null,
      error_message: message.slice(0, 500),
    })
    return
  }

  // ── Step 2: Detect bot-blocking / empty pages ────────────────────────────────
  if (isBlocked(rawPage)) {
    await writeScrapeResult({
      profile_id: job.profile_id,
      scrape_status: 'blocked',
      page_title: rawPage.page_title,
      meta_description: rawPage.meta_description,
      detected_industry: null,
      services_detected: [],
      tech_stack_detected: [],
      social_links: {},
      content_summary: null,
      raw_html_snapshot: rawPage.raw_html_snapshot,
      error_message: 'Page appears to be bot-blocked or behind a CAPTCHA',
    })
    return
  }

  // ── Step 3: Extract static signals from HTML ─────────────────────────────────
  const signals = extractSignals(rawPage.html)

  // ── Step 4: AI enrichment ────────────────────────────────────────────────────
  let aiData = { content_summary: null as string | null, detected_industry: null as string | null, services_detected: [] as string[] }

  try {
    aiData = await enrichWithAI({
      page_title: rawPage.page_title,
      meta_description: rawPage.meta_description,
      html_snippet: rawPage.raw_html_snapshot,
      candidate_services: signals.candidate_services,
    })
  } catch (err) {
    console.warn('[BA-002] AI enrichment failed — writing partial result', err)
    // Write without AI enrichment rather than failing entirely
  }

  // ── Step 5: Write to Supabase ────────────────────────────────────────────────
  await writeScrapeResult({
    profile_id: job.profile_id,
    scrape_status: 'success',
    page_title: rawPage.page_title,
    meta_description: rawPage.meta_description,
    detected_industry: aiData.detected_industry,
    services_detected: aiData.services_detected,
    tech_stack_detected: signals.tech_stack_detected,
    social_links: signals.social_links,
    content_summary: aiData.content_summary,
    raw_html_snapshot: rawPage.raw_html_snapshot,
    error_message: null,
  })

  console.log(`[BA-002] Done: ${job.profile_id}`)
}

async function fetchPage(url: string): Promise<RawPageData> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--disable-gpu',
    ],
  })

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    })
    const page = await context.newPage()

    let statusCode: number | null = null
    page.on('response', response => {
      if (response.url() === page.url() || response.request().isNavigationRequest()) {
        statusCode = response.status()
      }
    })

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: SCRAPE_TIMEOUT,
    })

    // Wait a moment for JS-rendered content
    await page.waitForTimeout(2000)

    const html = await page.content()
    const finalUrl = page.url()

    const page_title = await page.title().catch(() => null)
    const meta_description = await page
      .$eval('meta[name="description"]', el => el.getAttribute('content'))
      .catch(() => null)

    const MAX_HTML = parseInt(process.env.MAX_HTML_CHARS ?? '50000', 10)

    return {
      html,
      page_title: page_title || null,
      meta_description,
      raw_html_snapshot: html.slice(0, MAX_HTML),
      final_url: finalUrl,
      status_code: statusCode,
    }
  } finally {
    await browser.close()
  }
}

function classifyError(message: string): ScrapeResult['scrape_status'] {
  const lower = message.toLowerCase()
  if (lower.includes('timeout') || lower.includes('timed out')) return 'timeout'
  if (lower.includes('blocked') || lower.includes('captcha') || lower.includes('403') || lower.includes('forbidden')) return 'blocked'
  return 'failed'
}

function isBlocked(page: RawPageData): boolean {
  const lower = page.html.toLowerCase()
  const blockSignals = [
    'captcha',
    'are you a human',
    'access denied',
    'cloudflare',
    'please enable cookies',
    'verify you are human',
    'ddos protection',
  ]
  const htmlLength = page.html.trim().length
  if (htmlLength < 500) return true  // essentially empty page
  return blockSignals.some(signal => lower.includes(signal))
}
```

---

## 6. HTML Signal Extractor (`src/extractor.ts`)

Extracts tech stack, social links, and candidate service text from raw HTML — no AI needed.

```typescript
import { ExtractedSignals } from './types'

// Tech stack fingerprints — detectable from HTML/script tags/meta
const TECH_FINGERPRINTS: Record<string, string[]> = {
  'WordPress':        ['wp-content', 'wp-includes', 'wordpress'],
  'Shopify':          ['cdn.shopify.com', 'shopify.com/s/'],
  'Wix':              ['wix.com', 'wixstatic.com'],
  'Squarespace':      ['squarespace.com', 'squarespace-cdn'],
  'Webflow':          ['webflow.com', 'webflow.io'],
  'HubSpot':          ['hs-scripts.com', 'hubspot.com', 'hs-analytics'],
  'Google Analytics': ['google-analytics.com', 'gtag', 'ga('],
  'Google Tag Manager':['googletagmanager.com'],
  'Intercom':         ['intercom.io', 'intercomcdn.com'],
  'Stripe':           ['js.stripe.com'],
  'WooCommerce':      ['woocommerce'],
  'Magento':          ['mage/', 'magento'],
  'React':            ['__reactfiber', 'react.development', 'react.production'],
  'Next.js':          ['_next/static', '__NEXT_DATA__'],
  'Cloudflare':       ['cloudflare', '__cf_bm'],
  'Mailchimp':        ['mailchimp.com', 'list-manage.com'],
  'Salesforce':       ['salesforce.com', 'force.com'],
  'Zendesk':          ['zendesk.com', 'zdassets.com'],
  'Freshdesk':        ['freshdesk.com'],
  'Calendly':         ['calendly.com'],
}

// Social platform URL patterns
const SOCIAL_PATTERNS: Record<string, RegExp> = {
  twitter:   /(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/,
  linkedin:  /linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+/,
  facebook:  /facebook\.com\/[a-zA-Z0-9_.]+/,
  instagram: /instagram\.com\/[a-zA-Z0-9_.]+/,
  youtube:   /youtube\.com\/(?:c\/|channel\/|@)[a-zA-Z0-9_-]+/,
  tiktok:    /tiktok\.com\/@[a-zA-Z0-9_.]+/,
}

export function extractSignals(html: string): ExtractedSignals {
  const lower = html.toLowerCase()

  // Tech stack
  const tech_stack_detected: string[] = []
  for (const [name, fingerprints] of Object.entries(TECH_FINGERPRINTS)) {
    if (fingerprints.some(fp => lower.includes(fp.toLowerCase()))) {
      tech_stack_detected.push(name)
    }
  }

  // Social links — extract full URLs from href attributes
  const social_links: Record<string, string> = {}
  const hrefMatches = html.match(/href="([^"]+)"/gi) ?? []
  for (const href of hrefMatches) {
    const url = href.replace(/href="|"/g, '')
    for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
      if (pattern.test(url) && !social_links[platform]) {
        social_links[platform] = url.startsWith('http') ? url : `https://${url}`
      }
    }
  }

  // Candidate services — extract text from service/product-like elements
  // Look for: <li>, <h2>, <h3> tags with meaningful text (10–80 chars)
  const candidate_services: string[] = []
  const tagMatches = html.match(/<(?:li|h2|h3|h4)[^>]*>([^<]{10,80})<\/(?:li|h2|h3|h4)>/gi) ?? []
  for (const match of tagMatches) {
    const text = match.replace(/<[^>]+>/g, '').trim()
    if (text.length >= 10 && text.length <= 80 && /[a-zA-Z]/.test(text)) {
      candidate_services.push(text)
    }
  }

  // Deduplicate and cap at 50 candidates to keep AI prompt manageable
  const unique = [...new Set(candidate_services)].slice(0, 50)

  return {
    social_links,
    tech_stack_detected: [...new Set(tech_stack_detected)],
    candidate_services: unique,
  }
}
```

---

## 7. AI Enricher (`src/ai-enricher.ts`)

Single Anthropic API call — returns content summary, detected industry, and cleaned services list.

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const AI_TIMEOUT = parseInt(process.env.AI_TIMEOUT_MS ?? '20000', 10)

interface EnricherInput {
  page_title:        string | null
  meta_description:  string | null
  html_snippet:      string         // first 50k chars of HTML
  candidate_services: string[]
}

interface EnricherOutput {
  content_summary:   string
  detected_industry: string | null
  services_detected: string[]
}

const SYSTEM_PROMPT = `You are a business intelligence analyst reviewing a company's website.
Given the page title, meta description, HTML content snippet, and candidate service text extracted from the page, you will:
1. Write a 300-word plain-language summary of what this business does, who it serves, and how it operates. No marketing language — analytical tone.
2. Identify the single most accurate industry classification from this list:
   retail | logistics | healthcare | construction | finance | hospitality | education | professional_services | manufacturing | technology | real_estate | food_beverage | other
3. Extract up to 10 specific services or products this business offers — clean, plain strings, not slogans.

Return ONLY valid JSON with this exact schema. No preamble. No markdown fences.
{
  "content_summary": "string — ~300 words",
  "detected_industry": "string from the list above | null if unclear",
  "services_detected": ["string", ...]
}`

export async function enrichWithAI(input: EnricherInput): Promise<EnricherOutput> {
  // Trim html_snippet to keep prompt under token limit
  const snippetForPrompt = input.html_snippet.slice(0, 15000)

  const userMessage = `PAGE TITLE: ${input.page_title ?? 'Not found'}
META DESCRIPTION: ${input.meta_description ?? 'Not found'}
CANDIDATE SERVICES (extracted from page elements): ${JSON.stringify(input.candidate_services)}
HTML SNIPPET (first 15,000 chars):
${snippetForPrompt}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT)

  try {
    const response = await client.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      },
      { signal: controller.signal }
    )
    clearTimeout(timer)

    const text = (response.content[0] as { text: string }).text
    const parsed: EnricherOutput = JSON.parse(text)

    return {
      content_summary:   parsed.content_summary   ?? '',
      detected_industry: parsed.detected_industry ?? null,
      services_detected: Array.isArray(parsed.services_detected) ? parsed.services_detected : [],
    }
  } catch (err: unknown) {
    clearTimeout(timer)
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`AI enrichment failed: ${message}`)
  }
}
```

---

## 8. Supabase Writer (`src/db.ts`)

```typescript
import { createClient } from '@supabase/supabase-js'
import { ScrapeResult } from './types'
import { alertOwner } from './alert'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function writeScrapeResult(result: ScrapeResult): Promise<void> {
  const { error } = await supabase.from('scrape_results').insert({
    profile_id:          result.profile_id,
    scraped_at:          new Date().toISOString(),
    scrape_status:       result.scrape_status,
    page_title:          result.page_title,
    meta_description:    result.meta_description,
    detected_industry:   result.detected_industry,
    services_detected:   result.services_detected.length ? result.services_detected : null,
    tech_stack_detected: result.tech_stack_detected.length ? result.tech_stack_detected : null,
    social_links:        Object.keys(result.social_links).length ? result.social_links : null,
    content_summary:     result.content_summary,
    raw_html_snapshot:   result.raw_html_snapshot,
    error_message:       result.error_message,
  })

  if (error) {
    console.error(`[BA-002] DB write failed for ${result.profile_id}:`, error.message)
    await alertOwner({
      type: 'db_write_failed',
      profile_id: result.profile_id,
      detail: error.message,
    })
    throw new Error(`DB write failed: ${error.message}`)
  }

  console.log(`[BA-002] DB write OK: ${result.profile_id} status=${result.scrape_status}`)
}
```

---

## 9. Owner Alert (`src/alert.ts`)

```typescript
interface AlertPayload {
  type: string
  profile_id: string
  detail?: string
}

export async function alertOwner(payload: AlertPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const to     = process.env.OWNER_ALERT_EMAIL
  const from   = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !to || !from) {
    console.error('[BA-002] Alert config missing — cannot send alert', payload)
    return
  }

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: `[BA-002 ALERT] ${payload.type} — ${payload.profile_id}`,
        text: `Alert type: ${payload.type}\nProfile ID: ${payload.profile_id}\nDetail: ${payload.detail ?? 'n/a'}\nTime: ${new Date().toISOString()}`,
      }),
    })
  } catch (err) {
    console.error('[BA-002] Failed to send owner alert:', err)
  }
}
```

---

## 10. `package.json` Scripts

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

## 11. Docker

### `Dockerfile`

```dockerfile
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# Install Node deps
COPY package*.json ./
RUN npm ci

# Install Playwright Chromium
RUN npx playwright install chromium --with-deps

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Non-root user (security)
RUN addgroup --system scraper && adduser --system --ingroup scraper scraper
RUN chown -R scraper:scraper /app
USER scraper

EXPOSE 3001
CMD ["node", "dist/server.js"]
```

### `.dockerignore`

```
node_modules
dist
.env
*.md
.git
```

### Build and Run Locally (testing)

```bash
docker build -t ba-002-scraper .

docker run -p 3001:3001 \
  --env-file .env \
  ba-002-scraper
```

### Test the running container

```bash
curl -X POST http://localhost:3001/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "00000000-0000-0000-0000-000000000001",
    "website_url": "https://example.com",
    "secret": "your_shared_secret"
  }'
# Expected: {"accepted":true,"profile_id":"00000000-..."}
# Then check Supabase scrape_results table for the new row
```

---

## 12. Hetzner VPS Deployment

### 12.1 Provision Server

- **Type:** CX21 (2 vCPU, 4 GB RAM) minimum — Chromium is memory-intensive
- **OS:** Ubuntu 22.04
- **Location:** closest to n8n instance to minimise webhook latency

### 12.2 Server Setup

SSH into the server then run:

```bash
# System dependencies
apt-get update && apt-get install -y \
  docker.io \
  docker-compose \
  nginx \
  certbot \
  python3-certbot-nginx \
  ufw

# Firewall
ufw allow ssh
ufw allow 80
ufw allow 443
ufw enable

# Docker service
systemctl enable docker
systemctl start docker

# Create app directory
mkdir -p /opt/ba-002-scraper
```

### 12.3 Deploy with Docker Compose

Create `/opt/ba-002-scraper/docker-compose.yml`:

```yaml
version: '3.8'
services:
  scraper:
    image: ba-002-scraper:latest
    restart: always
    env_file: .env
    ports:
      - "127.0.0.1:3001:3001"   # only bind to localhost — nginx proxies externally
    shm_size: '1gb'              # Chromium needs shared memory
    deploy:
      resources:
        limits:
          memory: 2g
```

Transfer and run:

```bash
# From local machine: build and push image, or copy files and build on server
scp -r . root@YOUR_SERVER_IP:/opt/ba-002-scraper/
ssh root@YOUR_SERVER_IP
cd /opt/ba-002-scraper
docker build -t ba-002-scraper .
docker-compose up -d
```

### 12.4 Nginx Reverse Proxy + HTTPS

Create `/etc/nginx/sites-available/ba-002`:

```nginx
server {
    listen 80;
    server_name scraper.roboai.agency;   # use your subdomain

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/ba-002 /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Add SSL (point scraper.roboai.agency DNS to this server's IP first)
certbot --nginx -d scraper.roboai.agency
```

---

## 13. n8n Workflow Nodes for BA-002

In the BA-001 post-submit n8n workflow, add these nodes after the webhook trigger:

### Node: "Trigger BA-002 Scraper"

- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://scraper.roboai.agency/scrape`
- **Body (JSON):**
  ```json
  {
    "profile_id": "{{ $json.profile_id }}",
    "website_url": "{{ $json.business.website_url }}",
    "secret": "{{ $env.SCRAPER_SECRET }}"
  }
  ```
- **Expected response:** `202 Accepted`
- **On error:** continue (scrape failure is handled by the fallback in the Analyzer)

### Node: "Wait for Scrape Result"

- **Type:** Wait → Resume on webhook
  OR use a **Loop** node:
  - **Type:** Code node in a loop
  - Logic: GET Supabase `scrape_results` where `profile_id = {{ $json.profile_id }}`
  - If row found → exit loop
  - If not found → wait 30 s → retry
  - Max iterations: 10 (5 minutes total timeout)

```javascript
// Code node — checks Supabase for scrape_results row
const profileId = $('Trigger BA-001 Webhook').first().json.profile_id;
const supabaseUrl = $env.SUPABASE_URL;
const serviceKey  = $env.SUPABASE_SERVICE_ROLE_KEY;

const response = await fetch(
  `${supabaseUrl}/rest/v1/scrape_results?profile_id=eq.${profileId}&select=scrape_id,scrape_status`,
  {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
  }
);

const rows = await response.json();
if (rows.length > 0) {
  return [{ json: { found: true, scrape_status: rows[0].scrape_status } }];
}
return [{ json: { found: false } }];
```

- **If `found: false`** → Wait 30 s → loop back
- **If `found: true`** → pass `scrape_status` downstream → trigger Analyzer

### Node: "Trigger Analyzer"

- **Type:** HTTP Request
- **Method:** POST
- **URL:** `{{ $env.APP_URL }}/api/internal/analyze`
- **Body:**
  ```json
  {
    "profile_id": "{{ $('Trigger BA-001 Webhook').first().json.profile_id }}",
    "secret": "{{ $env.N8N_WEBHOOK_SECRET }}"
  }
  ```

---

## 14. Error Handling Summary

| Scenario | Behaviour | scrape_status |
|----------|-----------|---------------|
| Page loads successfully | Full scrape + AI enrichment + DB write | `success` |
| Navigation timeout (>30 s) | Write error row, notify n8n via row presence | `timeout` |
| HTTP 403 / CAPTCHA / bot wall detected | Write blocked row | `blocked` |
| DNS failure / connection refused | Write failed row | `failed` |
| Page loads but AI enrichment fails | Write success row without AI fields (null) | `success` |
| DB write fails | Alert owner, throw — n8n sees no row, polls until timeout | — |

When Master Analyzer finds `scrape_status != 'success'`, it runs on form data only and marks `diagnosis_status = 'partial'`.

---

## 15. Concurrency & Rate Limiting

The server processes one scrape per request. Playwright launches a new browser per job. For traffic under 10 submissions/hour this is fine. If concurrent load increases:

- Add a queue: use [Bull](https://github.com/OptimalBits/bull) + Redis to limit to N concurrent Playwright instances
- Set `MAX_CONCURRENT_BROWSERS=2` env var and use a semaphore

For now, no queue needed — n8n calls the endpoint one job at a time per submission.

---

## 16. Test Cases

| Test | How to verify |
|------|--------------|
| Happy path | POST `/scrape` with a live business URL → query `scrape_results` in Supabase → all fields populated, `scrape_status='success'` |
| Blocked site | POST with a Cloudflare-protected URL → `scrape_status='blocked'` in DB |
| Timeout | POST with a URL that hangs → after 30 s, `scrape_status='timeout'` in DB |
| Invalid secret | POST with wrong secret → `401` response, no DB write |
| Missing website_url | POST without `website_url` → `400` response |
| AI enrichment timeout | Temporarily break `ANTHROPIC_API_KEY` → row written with null AI fields, status still `success` |
| DB write failure | Temporarily revoke Supabase key → owner alert email received |
| Health check | GET `/health` → `{"ok":true}` |

---

## 17. Security Checklist

- [ ] `SCRAPER_SECRET` matches the value in BA-001 `.env` and n8n environment variables
- [ ] Server only binds to `127.0.0.1:3001` — nginx proxies externally (never expose raw port to internet)
- [ ] HTTPS enforced on `scraper.roboai.agency` via certbot
- [ ] `SUPABASE_SERVICE_ROLE_KEY` not logged anywhere — verify with `grep -r "service_role" dist/`
- [ ] Playwright runs as non-root user inside container
- [ ] `shm_size: 1gb` set in docker-compose — Chromium crashes without adequate shared memory
- [ ] `/health` endpoint has no auth (n8n polling) — ensure it returns no sensitive data
- [ ] Rate limit: nginx `limit_req_zone` if public-facing scrape endpoint is a concern

---

## 18. Monitoring

Add to Hetzner / server monitoring:

```bash
# Healthcheck cron (runs every 5 min, alerts if down)
*/5 * * * * curl -sf https://scraper.roboai.agency/health || \
  curl -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"from":"alerts@roboai.agency","to":"gerardo@roboai.agency","subject":"BA-002 DOWN","text":"Scraper health check failed"}'
```

Log rotation — Docker handles this; keep default `json-file` driver with limits:

```yaml
# In docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

*BA-002 Website Scraper · Build Instructions v1.0 · ROBO AI Agency · May 2026*
*Depends on: BA-001_PDR_v1.2_Business_Intake_Form.md · BA-002 feeds into BA-001 MA (Master Analyzer)*
