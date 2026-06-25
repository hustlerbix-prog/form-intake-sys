import { execFile } from "child_process";
import { promisify } from "util";
import { appendJsonlLog } from "./logging";
import { callConfiguredLlm } from "./llmClient";
import { loadAdminSettings } from "./adminSettings";
import { persistScrapeResult } from "./supabaseClient";
import { z } from "zod";

const execFileAsync = promisify(execFile);

// ─── Status & core types ──────────────────────────────────────────────────────

export type ScrapeStatus =
  | "success"
  | "partial"
  | "no_content"
  | "low_confidence"
  | "failed"
  | "blocked"
  | "timeout";

export type CmsType =
  | "wordpress" | "shopify" | "wix" | "squarespace" | "webflow"
  | "godaddy" | "framer" | "tiendanube" | "hubspot_cms"
  | "mercadoshops" | "custom" | "unknown";

export type FrameworkType = "nextjs" | "react" | "vue" | "angular" | "none" | "unknown";

export type TechProfile = {
  cms: CmsType;
  js_framework: FrameworkType;
  hosting: string;
  analytics: string[];
  crm_signals: string[];
  payment_processors: string[];
  chat_tools: string[];
  booking_tools: string[];
  ecommerce_signals: string[];
  latam_tools: string[];
  integration_complexity: 1 | 2 | 3 | 4 | 5;
  integration_notes: string;
  whatsapp_present: boolean;
};

// ─── 10-signal content extraction types ──────────────────────────────────────

export type ServiceItem = {
  name: string;
  category: string | null;
  description: string | null;
  pricing_hint: string | null;
};

export type OperationalTool = {
  tool: string;
  category: string;
  confidence: number;
  integration_url: string | null;
};

export type PricingSignals = {
  present: boolean;
  model: string | null;
  figures: string[];
  contact_for_pricing: boolean;
};

export type ContactInfo = {
  phone: string[];
  email: string[];
  whatsapp: string | null;
  address: string | null;
  hours: string | null;
};

export type BrandStory = {
  tagline: string | null;
  mission: string | null;
  differentiators: string[];
  founding_year: string | null;
};

export type GeoCoverage = {
  cities: string[];
  regions: string[];
  countries: string[];
  service_radius: string | null;
};

export type SocialProof = {
  testimonials_present: boolean;
  client_names: string[];
  event_types: string[];
  awards: string[];
};

// ─── ScrapeResult ─────────────────────────────────────────────────────────────

export type ScrapeResult = {
  profile_id: string;
  website_url: string;
  scraped_at: string;
  scrape_status: ScrapeStatus;
  final_url: string | null;
  status_code: number | null;
  page_title: string | null;
  meta_description: string | null;
  detected_language: string | null;
  confidence_score: number;              // 0.0–1.0 across 10 signals
  // Tech detection
  tech_stack_detected: string[];         // kept for backward compat — derived from tech_profile
  tech_profile: TechProfile;
  social_links: Record<string, string>;
  // Raw content
  content_excerpt: string | null;
  content_summary: string | null;
  content_corpus: string | null;         // full deduplicated cleaned text — knowledge base for agents
  // AI enrichment — legacy fields kept for backward compat
  ai_summary: string | null;
  ai_services_detected: string[];
  ai_industry: string | null;
  // 10-signal extraction fields (new in v1.1)
  services: ServiceItem[] | null;
  target_audience: string[] | null;
  tone_of_voice: string | null;
  pricing_signals: PricingSignals | null;
  operational_tools: OperationalTool[] | null;
  contact_info: ContactInfo | null;
  brand_story: BrandStory | null;
  geo_coverage: GeoCoverage | null;
  social_proof: SocialProof | null;
  // Internal
  raw_html_snapshot: string | null;
  error_message: string | null;
};

// ─── Tech fingerprint maps ────────────────────────────────────────────────────

const CMS_PATTERNS: Array<{ name: CmsType; patterns: string[] }> = [
  { name: "wordpress",    patterns: ["wp-content", "wp-includes", "/wp-json/", "wordpress"] },
  { name: "shopify",      patterns: ["cdn.shopify.com", "shopify.com/s/", "myshopify.com", "Shopify.theme"] },
  { name: "wix",          patterns: ["wix.com", "wixstatic.com", "wixmp.com"] },
  { name: "squarespace",  patterns: ["squarespace.com", "squarespace-cdn", "static.squarespace.com"] },
  { name: "webflow",      patterns: ["webflow.com", "webflow.io", "assets.website-files.com"] },
  { name: "godaddy",      patterns: ["data-ux=", "secureserver.net", "godaddysites.com", "img1.wsimg.com"] },
  { name: "framer",       patterns: ["framerusercontent.com", "framer.com", '"generator":"Framer"'] },
  { name: "hubspot_cms",  patterns: ["hs-scripts.com", "hubspot.com", "hs-analytics.net"] },
  { name: "tiendanube",   patterns: ["tiendanube.com", "nuvemshop.com.br", "cdn.tiendanube.com"] },
  { name: "mercadoshops", patterns: ["mercadoshops.com", "mlstatic.com"] },
];

const FRAMEWORK_PATTERNS: Array<{ name: FrameworkType; patterns: string[] }> = [
  { name: "nextjs",   patterns: ["/_next/static/", "__NEXT_DATA__", "next/dist/"] },
  { name: "react",    patterns: ["__reactfiber", "react.production.min.js", "react-dom.production"] },
  { name: "vue",      patterns: ["vue.min.js", "vue.global.js", "__vue_app__", "data-v-"] },
  { name: "angular",  patterns: ["ng-version=", "angular/core", "@angular/"] },
];

const ANALYTICS_PATTERNS: Record<string, string[]> = {
  google_analytics:     ["google-analytics.com", "gtag/js", "ga('send')", "gtag("],
  google_tag_manager:   ["googletagmanager.com"],
  meta_pixel:           ["connect.facebook.net", "fbq(", "facebook_pixel"],
  hotjar:               ["hotjar.com", "hj.q.push", "_hjSettings"],
  mixpanel:             ["mixpanel.com", "mixpanel.track"],
  segment:              ["cdn.segment.com", "analytics.page("],
  clarity:              ["clarity.ms", "clr.js"],
};

const CRM_PATTERNS: Record<string, string[]> = {
  hubspot:      ["hs-scripts.com", "hubspot.com", "hsforms.com"],
  salesforce:   ["salesforce.com", "force.com", "pardot.com"],
  mailchimp:    ["mailchimp.com", "list-manage.com", "chimpstatic.com"],
  klaviyo:      ["klaviyo.com", "klaviyo.js"],
  activecampaign: ["activecampaign.com"],
  zoho_crm:     ["zoho.com", "zohocrm.com"],
};

const PAYMENT_PATTERNS: Record<string, string[]> = {
  stripe:       ["js.stripe.com", "stripe.com/v3"],
  paypal:       ["paypal.com", "paypalobjects.com"],
  mercadopago:  ["sdk.mercadopago.com", "mercadopago.com.ar", "mercadopago.com.mx", "mp.js"],
  conekta:      ["cdn.conekta.io", "conekta.com"],
  openpay:      ["openpay.mx", "cdn.openpay"],
  square:       ["squareup.com", "square.com/dashboard"],
  wompi:        ["wompi.co"],
  culqi:        ["culqi.com"],
};

const CHAT_PATTERNS: Record<string, string[]> = {
  intercom:        ["intercom.io", "intercomcdn.com", "widget.intercom.io"],
  drift:           ["drift.com", "js.driftt.com"],
  crisp:           ["crisp.chat", "client.crisp.chat"],
  tawk:            ["tawk.to", "embed.tawk.to"],
  zendesk_chat:    ["zopim.com", "zendesk.com/embeddable"],
  freshchat:       ["freshchat.com", "wchat.freshchat.com"],
  whatsapp_widget: ["wa.me/", "api.whatsapp.com/send", "web.whatsapp.com"],
};

const BOOKING_PATTERNS: Record<string, string[]> = {
  calendly:   ["calendly.com", "assets.calendly.com"],
  cal_com:    ["cal.com/", "app.cal.com"],
  acuity:     ["acuityscheduling.com"],
  simplybook: ["simplybook.me"],
  setmore:    ["setmore.com"],
  booksy:     ["booksy.com"],
};

const ECOMMERCE_PATTERNS: Record<string, string[]> = {
  woocommerce:       ["woocommerce", "/wc-api/", "is-cart", "is-checkout"],
  shopify_checkout:  ["cdn.shopify.com", "checkout.shopify.com"],
  magento:           ["mage/", "magento", "magentocommerce"],
  wix_stores:        ["wixapps.net", "stores.wixapps.net"],
  tiendanube:        ["tiendanube.com"],
  mercadoshops:      ["mercadoshops.com"],
  hotmart:           ["hotmart.com", "hotmart.product"],
};

const SOCIAL_PATTERNS: Record<string, RegExp> = {
  twitter:   /https?:\/\/(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/i,
  linkedin:  /https?:\/\/linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+/i,
  facebook:  /https?:\/\/facebook\.com\/[a-zA-Z0-9_.]+/i,
  instagram: /https?:\/\/instagram\.com\/[a-zA-Z0-9_.]+/i,
  youtube:   /https?:\/\/youtube\.com\/(?:c\/|channel\/|@)[a-zA-Z0-9_-]+/i,
  tiktok:    /https?:\/\/tiktok\.com\/@[a-zA-Z0-9_.]+/i,
};

// Priority slugs to try after root (AC-02)
const PRIORITY_SLUGS = [
  "/about", "/services", "/pricing", "/contact",
  "/nosotros", "/servicios", "/contacto", "/precios",
  "/our-work", "/what-we-do",
];

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function scrapeWebsite(input: {
  profile_id: string;
  website_url: string;
}): Promise<ScrapeResult> {
  const startedAt = Date.now();
  const url = normalizeUrl(input.website_url);

  await appendJsonlLog({
    file: "scraper.log",
    event: "scrape_start",
    fields: { profile_id: input.profile_id, website_url: url },
  });

  // Load scraper provider setting
  const { stored: adminStored } = await loadAdminSettings();
  const scraperProvider = adminStored.scraper.provider;
  const sgaiApiKey = adminStored.scraper.sgaiApiKey ?? process.env.SGAI_API_KEY ?? null;
  const sgaiTimeoutMs = adminStored.scraper.sgaiTimeoutMs;

  const timeoutMs = Number(process.env.SCRAPE_TIMEOUT_MS ?? 25000);
  const maxChars = Number(process.env.MAX_HTML_CHARS ?? 80000);
  const useHeadless = process.env.SCRAPER_USE_HEADLESS === "true";
  const maxPages = Number(process.env.SCRAPER_MAX_PAGES ?? 6);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // ── Root page fetch ──────────────────────────────────────────────────────
    let rootHtml = "";
    let rootMarkdown: string | null = null;
    let rootFinalUrl: string | null = null;
    let rootStatusCode: number | null = null;
    let rootHeaders: Record<string, string> = {};

    if (scraperProvider === "scrapegraph" && sgaiApiKey) {
      await appendJsonlLog({ file: "scraper.log", event: "scrape_sgai_start", fields: { profile_id: input.profile_id, url } });
      const sgResult = await fetchWithScrapeGraph(url, sgaiApiKey, sgaiTimeoutMs, controller.signal);
      if (sgResult.status === "error") {
        const status: ScrapeStatus =
          sgResult.error?.toLowerCase().includes("abort") ? "timeout" :
          sgResult.error?.toLowerCase().includes("block") || sgResult.error?.toLowerCase().includes("403") ? "blocked" :
          "failed";
        const result = emptyResult(input.profile_id, url, status, sgResult.error ?? "ScrapeGraph fetch failed");
        await logDone(input.profile_id, url, startedAt, result);
        return result;
      }
      rootHtml = (sgResult.html ?? "").slice(0, maxChars);
      rootMarkdown = sgResult.markdown ?? null;
      rootFinalUrl = sgResult.finalUrl;
      rootStatusCode = sgResult.statusCode;
      rootHeaders = sgResult.responseHeaders;
    } else {
      // ── Playwright path: static fetch + optional Zyte fallback ──────────
      const rootPage = await fetchStatic(url, controller.signal);

      if (rootPage.status === "error") {
        const status: ScrapeStatus =
          rootPage.error?.toLowerCase().includes("abort") ? "timeout" :
          rootPage.error?.toLowerCase().includes("403") || rootPage.error?.toLowerCase().includes("429") ? "blocked" :
          "failed";
        const result = emptyResult(input.profile_id, url, status, rootPage.error ?? "Fetch failed");
        await logDone(input.profile_id, url, startedAt, result);
        return result;
      }

      // Detect bot-blocking on root — try Zyte fallback before giving up
      if (looksBlocked(rootPage.html ?? "", rootPage.statusCode ?? 200)) {
        await appendJsonlLog({ file: "scraper.log", event: "scrape_blocked_zyte_fallback", fields: { profile_id: input.profile_id, url } });
        const zyteResult = await fetchWithZyte(url, controller.signal);
        if (zyteResult.status !== "ok" || !zyteResult.html) {
          const result = emptyResult(input.profile_id, url, "blocked", "Bot-block or CAPTCHA detected; Zyte fallback also failed");
          result.final_url = rootPage.finalUrl;
          result.status_code = rootPage.statusCode;
          await logDone(input.profile_id, url, startedAt, result);
          return result;
        }
        rootPage.html = zyteResult.html;
        rootPage.finalUrl = zyteResult.finalUrl ?? rootPage.finalUrl;
        rootPage.statusCode = zyteResult.statusCode ?? rootPage.statusCode;
      }

      rootHtml = (rootPage.html ?? "").slice(0, maxChars);
      rootFinalUrl = rootPage.finalUrl;
      rootStatusCode = rootPage.statusCode;
      rootHeaders = rootPage.responseHeaders ?? {};
    }

    // ── Pass 2: Headless render (Playwright path only) ───────────────────────
    let bestHtml = rootHtml;
    if (scraperProvider !== "scrapegraph" && useHeadless && !passesContentThreshold(rootHtml)) {
      await appendJsonlLog({ file: "scraper.log", event: "scrape_pass2_triggered", fields: { profile_id: input.profile_id, url } });
      const headless = await fetchWithAgentBrowser(url);
      if (headless.cleanText && headless.cleanText.length > extractCleanText(rootHtml).length) {
        bestHtml = headless.html ?? rootHtml;
      }
      if (headless.renderStatus === "render_failed" || headless.renderStatus === "timeout") {
        await appendJsonlLog({ file: "scraper.log", event: "scrape_pass2_failed", fields: { profile_id: input.profile_id, url, status: headless.renderStatus } });
      }
    }

    // ── Multi-page crawl: priority slugs ────────────────────────────────────
    const rootDomain = extractDomain(url);
    // For ScrapeGraph: use markdown as clean text if available; otherwise extract from HTML
    const rootText = rootMarkdown ?? extractCleanText(bestHtml);
    const corpusPages: string[] = [rootText];
    let pagesScraped = 1;

    const internalLinks = extractInternalLinks(bestHtml, url);
    const priorityUrls = prioritisedLinks(internalLinks, rootDomain, url);

    for (const pageUrl of priorityUrls.slice(0, maxPages - 1)) {
      try {
        if (scraperProvider === "scrapegraph" && sgaiApiKey) {
          const sgPage = await fetchWithScrapeGraph(pageUrl, sgaiApiKey, sgaiTimeoutMs, controller.signal);
          if (sgPage.status === "ok") {
            const text = sgPage.markdown ?? extractCleanText((sgPage.html ?? "").slice(0, 30000));
            if (text.length > 200) { corpusPages.push(text); pagesScraped++; }
          }
        } else {
          const page = await fetchStatic(pageUrl, controller.signal);
          if (page.status === "ok" && page.html && !looksBlocked(page.html, page.statusCode ?? 200)) {
            const text = extractCleanText(page.html.slice(0, 30000));
            if (text.length > 200) { corpusPages.push(text); pagesScraped++; }
          }
        }
      } catch {
        // Continue crawl — skip failed pages
      }
    }

    // ScrapeGraph returns clean markdown — preserve structure instead of sentence-deduplicating
    // (deduplicateCorpus drops lines < 40 chars, destroying phone numbers, names, addresses)
    const charBudget = Number(process.env.SCRAPER_TOKEN_BUDGET_TOTAL ?? 20000) * 4;
    const corpus = (scraperProvider === "scrapegraph" && rootMarkdown)
      ? concatenateMarkdownPages(corpusPages, charBudget)
      : deduplicateCorpus(corpusPages, Number(process.env.SCRAPER_TOKEN_BUDGET_TOTAL ?? 20000));

    // ── Pre-extract contact info via regex from all raw HTML (before stripping) ─
    const allPagesHtml = [bestHtml];
    if (scraperProvider !== "scrapegraph") {
      for (const pageUrl of priorityUrls.slice(0, maxPages - 1)) {
        try {
          const page = await fetchStatic(pageUrl, controller.signal);
          if (page.status === "ok" && page.html) allPagesHtml.push(page.html.slice(0, 30000));
        } catch { /* skip */ }
      }
    }
    const regexContactInfo: ContactInfo = allPagesHtml.reduce<ContactInfo>((acc, html) => {
      const extracted = preExtractContactInfo(html);
      return mergeContactInfo(extracted, acc);
    }, { phone: [], email: [], whatsapp: null, address: null, hours: null });

    // ── Build structured result ──────────────────────────────────────────────
    const techProfile = buildTechProfile(bestHtml, rootHeaders);
    const socialLinks = extractSocialLinks(bestHtml);
    const pageTitle = extractTitle(bestHtml);
    const metaDescription = extractMetaDescription(bestHtml);
    const detectedLanguage = detectLanguage(bestHtml, corpus);
    const contentExcerpt = corpus.slice(0, 700) || null;
    const contentSummary = buildContentSummary({ pageTitle, metaDescription, contentExcerpt });

    let out: ScrapeResult = {
      profile_id: input.profile_id,
      website_url: url,
      scraped_at: new Date().toISOString(),
      scrape_status: "success",
      final_url: rootFinalUrl,
      status_code: rootStatusCode,
      page_title: pageTitle,
      meta_description: metaDescription,
      detected_language: detectedLanguage,
      confidence_score: 0,
      tech_stack_detected: [],              // filled after tech_profile build
      tech_profile: techProfile,
      social_links: socialLinks,
      content_excerpt: contentExcerpt,
      content_summary: contentSummary,
      content_corpus: corpus.slice(0, 60000) || null,
      ai_summary: null,
      ai_services_detected: [],
      ai_industry: null,
      services: null,
      target_audience: null,
      tone_of_voice: null,
      pricing_signals: null,
      operational_tools: null,
      contact_info: null,
      brand_story: null,
      geo_coverage: null,
      social_proof: null,
      raw_html_snapshot: bestHtml.slice(0, 50000),
      error_message: null,
    };

    // Derive legacy tech_stack_detected from tech_profile
    out.tech_stack_detected = deriveTechStackArray(techProfile);

    // Adjust status if partial (some pages failed)
    if (pagesScraped < 2 && priorityUrls.length > 0) {
      out.scrape_status = "partial";
    }

    // Handle no usable content
    if (!corpus || corpus.trim().length < 200) {
      out.scrape_status = "no_content";
      await logDone(input.profile_id, url, startedAt, out);
      return out;
    }

    // ── AI 10-signal extraction ──────────────────────────────────────────────
    out = await maybeEnrichWithAI(out, corpus);

    // Merge regex-extracted contact info with AI result (regex catches footer/header data AI never sees)
    out.contact_info = mergeContactInfo(regexContactInfo, out.contact_info);

    // ── Confidence gate (AC-05 v1.1) ────────────────────────────────────────
    // A technically successful scrape with confidence < 0.2 becomes low_confidence
    if (out.confidence_score < 0.2 && out.scrape_status === "success") {
      out.scrape_status = "low_confidence";
    }

    await logDone(input.profile_id, url, startedAt, out, { pages_scraped: pagesScraped });
    // Persist to Supabase (fire-and-forget — don't block the API response)
    persistScrapeResult(out).catch((e) =>
      console.error("[supabase] persistScrapeResult error:", e)
    );
    return out;

  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    const status: ScrapeStatus = message.toLowerCase().includes("abort") ? "timeout" : "failed";

    await appendJsonlLog({
      file: "scraper.log",
      event: "scrape_failed",
      fields: { profile_id: input.profile_id, website_url: url, ms: Date.now() - startedAt, scrape_status: status, error: message.slice(0, 200) },
    });

    return emptyResult(input.profile_id, url, status, message.slice(0, 500));
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Pass 1: Static fetch ─────────────────────────────────────────────────────

interface StaticFetchResult {
  status: "ok" | "error";
  html: string | null;
  finalUrl: string | null;
  statusCode: number | null;
  responseHeaders: Record<string, string>;
  error?: string;
}

async function fetchStatic(url: string, signal?: AbortSignal): Promise<StaticFetchResult> {
  const staticTimeout = Number(process.env.SCRAPER_STATIC_TIMEOUT ?? 10000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), staticTimeout);
  const combinedSignal = signal ?? controller.signal;

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "ROBOAIBot/1.0 (+https://roboai.agency/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: combinedSignal,
    });

    const html = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

    return { status: "ok", html, finalUrl: res.url || url, statusCode: res.status, responseHeaders: headers };
  } catch (err) {
    return { status: "error", html: null, finalUrl: null, statusCode: null, responseHeaders: {}, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Pass 2: Headless render via agent-browser ───────────────────────────────
// Enabled only when SCRAPER_USE_HEADLESS=true (VPS/local — not Vercel serverless)
// agent-browser CLI must be on PATH (npm i -g agent-browser)

interface HeadlessFetchResult {
  html: string | null;
  cleanText: string;
  renderStatus: "success" | "timeout" | "render_failed";
}

async function fetchWithAgentBrowser(url: string): Promise<HeadlessFetchResult> {
  const jsTimeout = Number(process.env.SCRAPER_JS_TIMEOUT ?? 15000);
  const sessionName = `robo-scrape-${Date.now()}`;

  try {
    // Open URL and wait for JS to settle
    await execFileAsync("agent-browser", ["--session", sessionName, "open", url], { timeout: jsTimeout });
    await execFileAsync("agent-browser", ["--session", sessionName, "wait", "--load", "networkidle"], { timeout: 8000 }).catch(() => {/* tolerate timeout on wait */});

    // Get visible body text
    const { stdout: cleanText } = await execFileAsync(
      "agent-browser",
      ["--session", sessionName, "get", "text", "body"],
      { timeout: 8000 }
    );

    // Get full rendered HTML via base64-encoded eval (avoids shell escaping issues)
    const scriptB64 = Buffer.from("document.documentElement.outerHTML").toString("base64");
    const { stdout: html } = await execFileAsync(
      "agent-browser",
      ["--session", sessionName, "eval", "-b", scriptB64],
      { timeout: 8000 }
    );

    const text = cleanText.trim();
    return {
      html: html.trim() || null,
      cleanText: text,
      renderStatus: text.length >= 300 ? "success" : "render_failed",
    };

  } catch (err) {
    const isTimeout = err instanceof Error && err.message.toLowerCase().includes("timeout");
    return { html: null, cleanText: "", renderStatus: isTimeout ? "timeout" : "render_failed" };
  } finally {
    // Best-effort session cleanup
    execFileAsync("agent-browser", ["--session", sessionName, "close"], { timeout: 5000 }).catch(() => {});
  }
}

// ─── Zyte Data API fallback ───────────────────────────────────────────────────
// Called when the static fetcher detects bot-blocking (403/CAPTCHA/Cloudflare).
// Requires ZYTE_API_KEY env var. Silently skips if not configured.
// Docs: https://docs.zyte.com/zyte-api/usage/overview.html

async function fetchWithZyte(url: string, signal?: AbortSignal): Promise<StaticFetchResult> {
  const apiKey = process.env.ZYTE_API_KEY;
  if (!apiKey) {
    return { status: "error", html: null, finalUrl: null, statusCode: null, responseHeaders: {}, error: "ZYTE_API_KEY not set" };
  }

  const auth = Buffer.from(`${apiKey}:`).toString("base64");

  try {
    const res = await fetch("https://api.zyte.com/v1/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ url, browserHtml: true }),
      signal,
    });

    if (!res.ok) {
      return { status: "error", html: null, finalUrl: null, statusCode: res.status, responseHeaders: {}, error: `Zyte API error ${res.status}` };
    }

    const data = (await res.json()) as { browserHtml?: string; url?: string };
    const html = data.browserHtml ?? "";

    if (!html) {
      return { status: "error", html: null, finalUrl: url, statusCode: 200, responseHeaders: {}, error: "Zyte returned empty browserHtml" };
    }

    return { status: "ok", html, finalUrl: data.url ?? url, statusCode: 200, responseHeaders: {} };

  } catch (err) {
    return {
      status: "error", html: null, finalUrl: null, statusCode: null, responseHeaders: {},
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── ScrapeGraph AI cloud scraper ────────────────────────────────────────────
// Replaces static fetch + Playwright + Zyte when provider = "scrapegraph".
// Requests both HTML (for tech fingerprinting) and markdown (as clean corpus).
// API: https://v2-api.scrapegraphai.com/api/scrape
// Auth: SGAI-APIKEY header

interface ScrapeGraphResult {
  status: "ok" | "error";
  html: string | null;
  markdown: string | null;
  finalUrl: string | null;
  statusCode: number | null;
  responseHeaders: Record<string, string>;
  error?: string;
}

async function fetchWithScrapeGraph(
  url: string,
  apiKey: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<ScrapeGraphResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Merge with caller's abort signal if provided
  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch("https://v2-api.scrapegraphai.com/api/scrape", {
      method: "POST",
      headers: {
        "SGAI-APIKEY": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        url,
        formats: [
          { type: "html", mode: "normal" },
          { type: "markdown", mode: "normal" },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const isBlocked = res.status === 403 || (res.status === 422 && errBody.toLowerCase().includes("block"));
      return {
        status: "error",
        html: null,
        markdown: null,
        finalUrl: null,
        statusCode: res.status,
        responseHeaders: {},
        error: isBlocked ? `blocked: HTTP ${res.status}` : `HTTP ${res.status}: ${errBody.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as Record<string, unknown>;

    // API v2 shape: { status, data: { results: { html?, markdown? }, metadata }, elapsed_ms }
    // Also handle flat shape { html?, markdown? } for forward-compat
    const inner = (data.data as Record<string, unknown> | undefined) ?? data;
    const results = (inner.results as Record<string, unknown> | undefined) ?? inner;

    if (data.status === "error") {
      const errMsg = typeof data.error === "string" ? data.error : "ScrapeGraph API error";
      return { status: "error", html: null, markdown: null, finalUrl: url, statusCode: res.status, responseHeaders: {}, error: errMsg };
    }

    const html = typeof results.html === "string" ? results.html : null;
    const markdown = typeof results.markdown === "string" ? results.markdown : null;

    if (!html && !markdown) {
      return {
        status: "error",
        html: null,
        markdown: null,
        finalUrl: url,
        statusCode: res.status,
        responseHeaders: {},
        error: `ScrapeGraph returned empty content. Response keys: ${Object.keys(data).join(",")}`,
      };
    }

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

    return { status: "ok", html, markdown, finalUrl: url, statusCode: 200, responseHeaders: headers };
  } catch (err) {
    return {
      status: "error",
      html: null,
      markdown: null,
      finalUrl: null,
      statusCode: null,
      responseHeaders: {},
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Tech profile detection ───────────────────────────────────────────────────

function buildTechProfile(html: string, headers: Record<string, string>): TechProfile {
  const lower = html.toLowerCase();

  // CMS detection
  let cms: CmsType = "unknown";
  for (const { name, patterns } of CMS_PATTERNS) {
    if (patterns.some((p) => lower.includes(p.toLowerCase()))) {
      cms = name;
      break;
    }
  }
  // Header-based CMS overrides
  if (headers["x-generator"]?.toLowerCase().includes("wordpress")) cms = "wordpress";
  if (headers["server"]?.toLowerCase().includes("squarespace")) cms = "squarespace";
  if (headers["x-wix-request-id"]) cms = "wix";
  if (headers["x-shopify-stage"] || headers["x-shopify-request-id"]) cms = "shopify";

  // JS Framework
  let js_framework: FrameworkType = "none";
  for (const { name, patterns } of FRAMEWORK_PATTERNS) {
    if (patterns.some((p) => lower.includes(p.toLowerCase()))) { js_framework = name; break; }
  }

  // Hosting from response headers
  const hosting = extractHosting(headers);

  // Tool categories
  const analytics = matchCategory(lower, ANALYTICS_PATTERNS);
  const crm_signals = matchCategory(lower, CRM_PATTERNS);
  const payment_processors = matchCategory(lower, PAYMENT_PATTERNS);
  const chat_tools = matchCategory(lower, CHAT_PATTERNS);
  const booking_tools = matchCategory(lower, BOOKING_PATTERNS);
  const ecommerce_signals = matchCategory(lower, ECOMMERCE_PATTERNS);

  // LATAM-specific tools (subset of detected lists + extra patterns)
  const LATAM_KEYWORDS = ["mercadopago", "conekta", "openpay", "tiendanube", "mercadoshops", "hotmart", "wompi", "culqi"];
  const latam_tools = [...payment_processors, ...ecommerce_signals].filter((t) => LATAM_KEYWORDS.includes(t));

  // WhatsApp (primary LATAM SMB signal)
  const whatsapp_present = /wa\.me\/|api\.whatsapp\.com\/send/i.test(html);

  // Integration complexity scoring (AC-07 / Section 5.3)
  const complexity = scoreIntegrationComplexity(cms, js_framework);
  const integration_notes = buildIntegrationNote(cms, complexity, chat_tools, payment_processors, whatsapp_present);

  return {
    cms, js_framework, hosting, analytics, crm_signals, payment_processors,
    chat_tools, booking_tools, ecommerce_signals, latam_tools,
    integration_complexity: complexity, integration_notes, whatsapp_present,
  };
}

function matchCategory(lowerHtml: string, patterns: Record<string, string[]>): string[] {
  const result: string[] = [];
  for (const [name, fingerprints] of Object.entries(patterns)) {
    if (fingerprints.some((fp) => lowerHtml.includes(fp.toLowerCase()))) {
      result.push(name);
    }
  }
  return result;
}

function extractHosting(headers: Record<string, string>): string {
  if (headers["x-vercel-id"]) return "vercel";
  if (headers["cf-ray"]) return "cloudflare";
  if (headers["x-amz-cf-id"] || headers["x-amz-request-id"]) return "aws";
  if (headers["x-netlify-id"] || headers["x-nf-request-id"]) return "netlify";
  if (headers["x-railway-response"]) return "railway";
  if (headers["server"]?.toLowerCase().includes("nginx")) return "nginx";
  if (headers["server"]?.toLowerCase().includes("apache")) return "apache";
  return "unknown";
}

function scoreIntegrationComplexity(cms: CmsType, framework: FrameworkType): 1 | 2 | 3 | 4 | 5 {
  if (["wordpress", "shopify", "wix"].includes(cms)) return 1;
  if (["webflow", "squarespace", "framer", "hubspot_cms"].includes(cms)) return 2;
  if (["godaddy", "mercadoshops"].includes(cms)) return 4;
  if (["tiendanube"].includes(cms)) return 2;
  if (["nextjs", "react", "vue", "angular"].includes(framework)) return 3;
  if (cms === "custom") return 3;
  return 3; // unknown → assume custom
}

function buildIntegrationNote(
  cms: CmsType,
  complexity: number,
  chatTools: string[],
  paymentTools: string[],
  whatsapp: boolean
): string {
  const notes: string[] = [];
  if (complexity === 1) notes.push("CB-01 chatbot deploys via script tag or plugin with minimal setup.");
  if (complexity === 4) notes.push("Limited embed options — consider standalone landing page or subdomain for CB-01.");
  if (complexity === 3) notes.push("API-first integration needed; client-side developer access required.");
  if (chatTools.length > 0) notes.push(`Existing chat tool detected (${chatTools.join(", ")}) — CB-01 would replace or complement.`);
  if (paymentTools.includes("mercadopago")) notes.push("MercadoPago detected — LATAM payment integration context confirmed.");
  if (whatsapp) notes.push("WhatsApp Business link detected — primary communication channel for this client.");
  if (cms === "wordpress") notes.push("WordPress: plugin or script tag deployment available for CB-01 and AVA-01.");
  if (cms === "shopify") notes.push("Shopify: script tag via theme settings. AVA-01 embed supported.");
  return notes.join(" ") || "Standard integration path.";
}

function deriveTechStackArray(profile: TechProfile): string[] {
  const out = new Set<string>();
  if (profile.cms !== "unknown") out.add(profile.cms);
  if (profile.js_framework !== "none" && profile.js_framework !== "unknown") out.add(profile.js_framework);
  profile.analytics.forEach((t) => out.add(t));
  profile.crm_signals.forEach((t) => out.add(t));
  profile.payment_processors.forEach((t) => out.add(t));
  profile.chat_tools.forEach((t) => out.add(t));
  profile.booking_tools.forEach((t) => out.add(t));
  profile.ecommerce_signals.forEach((t) => out.add(t));
  return Array.from(out);
}

// ─── Link extraction for multi-page crawl ─────────────────────────────────────

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const baseDomain = extractDomain(baseUrl);
  const matches = html.match(/href=["']([^"']+)["']/gi) ?? [];
  const seen = new Set<string>();
  const links: string[] = [];

  for (const match of matches) {
    const raw = match.replace(/href=["']/i, "").replace(/["']$/, "").trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) continue;

    let resolved: string;
    try {
      resolved = new URL(raw, baseUrl).href;
    } catch { continue; }

    const resolvedDomain = extractDomain(resolved);
    if (resolvedDomain !== baseDomain) continue;

    // Exclude media files and admin paths
    if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js|xml|json)(\?|$)/i.test(resolved)) continue;
    if (/\/(wp-admin|wp-login|feed|rss|sitemap|robots|admin)\//i.test(resolved)) continue;

    const normalized = resolved.split("?")[0].replace(/\/$/, "");
    if (!seen.has(normalized)) {
      seen.add(normalized);
      links.push(resolved);
    }
  }
  return links;
}

function prioritisedLinks(links: string[], domain: string, rootUrl: string): string[] {
  const rootNorm = rootUrl.replace(/\/$/, "");
  const withScore: Array<{ url: string; score: number }> = links
    .filter((l) => l.replace(/\/$/, "") !== rootNorm)
    .map((url) => {
      const path = url.toLowerCase().replace(`https://${domain}`, "").replace(`http://${domain}`, "");
      let score = 0;
      if (PRIORITY_SLUGS.some((slug) => path.startsWith(slug))) score += 10;
      if (path.split("/").length <= 2) score += 5; // prefer shallow pages
      return { url, score };
    });

  return withScore
    .sort((a, b) => b.score - a.score)
    .map((x) => x.url);
}

// ─── Regex-based contact info pre-extraction ─────────────────────────────────
// Runs on raw HTML before strip (footer/header contain phones/emails/WhatsApp)

const PHONE_PATTERNS = [
  // International with country code: +1 (555) 123-4567, +52 55 1234 5678
  /\+\d{1,3}[\s\-.]?\(?\d{1,4}\)?[\s\-.]?\d{1,4}[\s\-.]?\d{1,9}/g,
  // North American: (555) 123-4567, 555-123-4567, 555.123.4567
  /\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/g,
  // tel: href links
  /tel:([+\d\s\-().]+)/gi,
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const WHATSAPP_PATTERN = /(?:wa\.me|api\.whatsapp\.com\/send[^"'\s]*[?&]phone=)[\/?]?(\+?[\d\s\-()]+)/gi;

function preExtractContactInfo(html: string): ContactInfo {
  const phones = new Set<string>();
  const emails = new Set<string>();
  let whatsapp: string | null = null;
  const normalizePhone = (raw: string): string => raw.replace(/^tel:/i, "").replace(/[^+\d]/g, "").trim();

  // Extract emails
  const emailMatches = html.match(EMAIL_PATTERN) ?? [];
  for (const e of emailMatches) {
    const lower = e.toLowerCase();
    // Skip asset/image/font emails (false positives)
    if (/\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|css|js)$/i.test(lower)) continue;
    emails.add(lower);
  }

  // Extract phones from tel: links first (highest confidence)
  const telMatches = html.match(/href=["']tel:([^"']+)["']/gi) ?? [];
  for (const m of telMatches) {
    const num = m.replace(/href=["']tel:/i, "").replace(/["']$/, "").trim();
    const cleaned = normalizePhone(num);
    if (cleaned.length >= 7) phones.add(cleaned);
  }

  for (const pattern of PHONE_PATTERNS) {
    const matches = html.match(pattern) ?? [];
    for (const raw of matches) {
      const cleaned = normalizePhone(raw);
      if (cleaned.length >= 7) phones.add(cleaned);
    }
  }

  // Extract WhatsApp number from wa.me links
  const waMatches = html.match(/href=["'][^"']*wa\.me\/(\+?[\d]+)[^"']*["']/gi) ?? [];
  for (const m of waMatches) {
    const num = m.match(/wa\.me\/(\+?[\d]+)/i)?.[1];
    if (num) { whatsapp = `+${num.replace(/^\+/, "")}`; break; }
  }
  // Also check api.whatsapp.com send links
  if (!whatsapp) {
    const re = new RegExp(WHATSAPP_PATTERN.source, WHATSAPP_PATTERN.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const num = m[1];
      const cleaned = num ? normalizePhone(num) : "";
      if (cleaned.length >= 7) {
        whatsapp = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
        break;
      }
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  if (!whatsapp) {
    const apiWaMatch = html.match(/api\.whatsapp\.com\/send[^"'\s]*phone=([\d]+)/i);
    if (apiWaMatch) whatsapp = `+${apiWaMatch[1]}`;
  }

  // Fallback phone regex on visible text areas (not script/style)
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const phoneTexts = [
    ...(stripped.match(/\+\d{1,3}[\s\-.]?\(?\d{1,4}\)?[\s\-.]?\d{1,4}[\s\-.]?\d{1,9}/g) ?? []),
    ...(stripped.match(/\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/g) ?? []),
  ];
  for (const p of phoneTexts) {
    const clean = p.trim().replace(/\s+/g, " ");
    const digits = clean.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) phones.add(clean);
    if (phones.size >= 5) break;
  }

  return {
    phone: Array.from(phones).slice(0, 5),
    email: Array.from(emails).slice(0, 5),
    whatsapp: whatsapp ?? null,
    address: null,
    hours: null,
  };
}

function mergeContactInfo(regex: ContactInfo, ai: ContactInfo | null | undefined): ContactInfo {
  if (!ai) return regex;
  const phones = Array.from(new Set([...regex.phone, ...ai.phone])).slice(0, 5);
  const emails = Array.from(new Set([...regex.email, ...ai.email])).slice(0, 5);
  return {
    phone: phones,
    email: emails,
    whatsapp: regex.whatsapp ?? ai.whatsapp ?? null,
    address: ai.address ?? null,
    hours: ai.hours ?? null,
  };
}

// ─── AI 10-signal extraction ──────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are a business intelligence extraction agent for ROBO AI Agency.
You receive cleaned text corpus from a business website and the client's intake form context.
Extract all ten signals listed below. Return ONLY a valid JSON object. No preamble. No markdown fences.
If a signal cannot be determined, return null for that field (or empty array for array fields).
Respond in the same language as the website content when writing text fields.

OUTPUT SCHEMA:
{
  "summary": "string — 200-300 word plain-language business description (analytical, not marketing)",
  "services": [{"name":"string","category":"string|null","description":"string|null","pricing_hint":"string|null"}],
  "target_audience": ["string"],
  "tone_of_voice": "formal|conversational|technical|sales-heavy|neutral",
  "tech_stack": ["string"],
  "pricing_signals": {"present":bool,"model":"tiered|flat|per_seat|contact_for_pricing|freemium|unknown|null","figures":["string"],"contact_for_pricing":bool},
  "operational_tools": [{"tool":"string","category":"string","confidence":0.0,"integration_url":"string|null"}],
  "contact_info": {"phone":["string"],"email":["string"],"whatsapp":"string|null","address":"string|null","hours":"string|null"},
  "brand_story": {"tagline":"string|null","mission":"string|null","differentiators":["string"],"founding_year":"string|null"},
  "geo_coverage": {"cities":["string"],"regions":["string"],"countries":["string"],"service_radius":"string|null"},
  "social_proof": {"testimonials_present":bool,"client_names":["string"],"event_types":["string"],"awards":["string"]},
  "industry": "string|null",
  "detected_language": "es|en|pt|other"
}`;

const AiExtractionSchema = z.object({
  summary: z.string().min(1),
  services: z.array(z.object({
    name: z.string(),
    category: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    pricing_hint: z.string().nullable().optional(),
  })).default([]),
  target_audience: z.array(z.string()).default([]),
  tone_of_voice: z.enum(["formal", "conversational", "technical", "sales-heavy", "neutral"]).nullable().optional(),
  tech_stack: z.array(z.string()).default([]),
  pricing_signals: z.object({
    present: z.boolean(),
    model: z.string().nullable().optional(),
    figures: z.array(z.string()).default([]),
    contact_for_pricing: z.boolean(),
  }).nullable().optional(),
  operational_tools: z.array(z.object({
    tool: z.string(),
    category: z.string(),
    confidence: z.number(),
    integration_url: z.string().nullable().optional(),
  })).default([]),
  contact_info: z.object({
    phone: z.array(z.string()).default([]),
    email: z.array(z.string()).default([]),
    whatsapp: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    hours: z.string().nullable().optional(),
  }).nullable().optional(),
  brand_story: z.object({
    tagline: z.string().nullable().optional(),
    mission: z.string().nullable().optional(),
    differentiators: z.array(z.string()).default([]),
    founding_year: z.string().nullable().optional(),
  }).nullable().optional(),
  geo_coverage: z.object({
    cities: z.array(z.string()).default([]),
    regions: z.array(z.string()).default([]),
    countries: z.array(z.string()).default([]),
    service_radius: z.string().nullable().optional(),
  }).nullable().optional(),
  social_proof: z.object({
    testimonials_present: z.boolean(),
    client_names: z.array(z.string()).default([]),
    event_types: z.array(z.string()).default([]),
    awards: z.array(z.string()).default([]),
  }).nullable().optional(),
  industry: z.string().nullable().optional(),
  detected_language: z.enum(["es", "en", "pt", "other"]).nullable().optional(),
});

async function maybeEnrichWithAI(base: ScrapeResult, corpus: string): Promise<ScrapeResult> {
  await appendJsonlLog({ file: "scraper.log", event: "scrape_ai_enrichment_start", fields: { profile_id: base.profile_id, website_url: base.website_url } });

  const userContent = `INTAKE FORM CONTEXT:
${JSON.stringify({
  page_title: base.page_title,
  meta_description: base.meta_description,
  detected_language_hint: base.detected_language,
  tech_profile_cms: base.tech_profile.cms,
  social_links_detected: Object.keys(base.social_links),
  whatsapp_present: base.tech_profile.whatsapp_present,
})}

WEBSITE CORPUS (cleaned text from up to 6 pages):
${corpus.slice(0, 18000)}`;

  const makeCall = async () => {
    const llm = await callConfiguredLlm({
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      responseFormat: "json",
    });
    if (!llm.ok) throw new Error(`LLM call failed: ${llm.provider}/${llm.model} — ${llm.error ?? "unknown error"}`);
    const raw = safeParseJson(llm.text);
    return AiExtractionSchema.safeParse(raw);
  };

  let parsed: ReturnType<typeof AiExtractionSchema.safeParse> | null = null;
  try {
    parsed = await makeCall();
    if (!parsed.success) {
      await appendJsonlLog({ file: "scraper.log", event: "scrape_ai_enrichment_retry", fields: { profile_id: base.profile_id } });
      parsed = await makeCall();
    }
  } catch (err) {
    // LLM unavailable or returned error — return tech-detection-only result, don't fail the whole scrape
    const message = err instanceof Error ? err.message : String(err);
    await appendJsonlLog({
      file: "scraper.log",
      event: "scrape_ai_enrichment_skipped",
      fields: { profile_id: base.profile_id, website_url: base.website_url, reason: message.slice(0, 200) },
    });
    base.confidence_score = calculateConfidence(base);
    return base;
  }

  if (!parsed || !parsed.success) {
    await appendJsonlLog({ file: "scraper.log", event: "scrape_ai_enrichment_failed", fields: { profile_id: base.profile_id } });
    // Return with basic confidence from what tech detection gave us
    base.confidence_score = calculateConfidence(base);
    return base;
  }

  const d = parsed.data;
  const enriched: ScrapeResult = {
    ...base,
    ai_summary:            d.summary,
    ai_services_detected:  d.services.map((s) => s.name).slice(0, 10),
    ai_industry:           d.industry ?? null,
    services:              d.services.length > 0 ? d.services.map((s) => ({ name: s.name, category: s.category ?? null, description: s.description ?? null, pricing_hint: s.pricing_hint ?? null })) : null,
    target_audience:       d.target_audience.length > 0 ? d.target_audience : null,
    tone_of_voice:         d.tone_of_voice ?? null,
    pricing_signals:       d.pricing_signals ? { present: d.pricing_signals.present, model: d.pricing_signals.model ?? null, figures: d.pricing_signals.figures, contact_for_pricing: d.pricing_signals.contact_for_pricing } : null,
    operational_tools:     d.operational_tools.length > 0 ? d.operational_tools.map((t) => ({ tool: t.tool, category: t.category, confidence: t.confidence, integration_url: t.integration_url ?? null })) : null,
    contact_info:          d.contact_info ? { phone: d.contact_info.phone, email: d.contact_info.email, whatsapp: d.contact_info.whatsapp ?? null, address: d.contact_info.address ?? null, hours: d.contact_info.hours ?? null } : null,
    brand_story:           d.brand_story ? { tagline: d.brand_story.tagline ?? null, mission: d.brand_story.mission ?? null, differentiators: d.brand_story.differentiators, founding_year: d.brand_story.founding_year ?? null } : null,
    geo_coverage:          d.geo_coverage ? { cities: d.geo_coverage.cities, regions: d.geo_coverage.regions, countries: d.geo_coverage.countries, service_radius: d.geo_coverage.service_radius ?? null } : null,
    social_proof:          d.social_proof ?? null,
    detected_language:     d.detected_language ?? base.detected_language,
  };

  // Merge tech_stack from LLM with hardware-detected stack
  if (d.tech_stack.length > 0) {
    const merged = new Set([...enriched.tech_stack_detected, ...d.tech_stack.map((t) => t.toLowerCase().replace(/\s+/g, "_"))]);
    enriched.tech_stack_detected = Array.from(merged);
  }

  // Content summary update with AI summary
  if (d.summary) {
    enriched.content_summary = d.summary.slice(0, 1200);
  }

  enriched.confidence_score = calculateConfidence(enriched);

  await appendJsonlLog({
    file: "scraper.log",
    event: "scrape_ai_enrichment_ok",
    fields: { profile_id: base.profile_id, confidence_score: enriched.confidence_score, signals_populated: Math.round(enriched.confidence_score * 10) },
  });

  return enriched;
}

// ─── Confidence score (AC-07, Section 10.12) ─────────────────────────────────
// Each of 10 signals contributes 0.1 to the score

function calculateConfidence(result: ScrapeResult): number {
  let score = 0;
  if (isPopulated(result.services)) score += 0.1;
  if (isPopulated(result.target_audience)) score += 0.1;
  if (result.tone_of_voice) score += 0.1;
  if (result.tech_stack_detected.length > 0 || result.tech_profile.cms !== "unknown") score += 0.1;
  if (result.pricing_signals) score += 0.1;
  if (isPopulated(result.operational_tools)) score += 0.1;
  if (result.contact_info && (result.contact_info.phone.length > 0 || result.contact_info.email.length > 0 || result.contact_info.whatsapp)) score += 0.1;
  if (result.brand_story && (result.brand_story.tagline || result.brand_story.mission)) score += 0.1;
  if (result.geo_coverage && (result.geo_coverage.cities.length > 0 || result.geo_coverage.countries.length > 0)) score += 0.1;
  if (result.social_proof) score += 0.1;
  return parseFloat(score.toFixed(2));
}

function isPopulated(val: unknown[] | null | undefined): boolean {
  return Array.isArray(val) && val.length > 0;
}

// ─── Content quality check (AC-04) ───────────────────────────────────────────

function passesContentThreshold(html: string): boolean {
  const text = extractCleanText(html);
  if (text.length < 500) return false;

  // Count content sections: <main>, <article>, <section> with real text
  const sectionMatches = html.match(/<(main|article|section)[^>]*>([\s\S]*?)<\/\1>/gi) ?? [];
  const richSections = sectionMatches.filter((s) => {
    const innerText = s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return innerText.length > 50;
  });

  return richSections.length >= 3;
}

// ─── Text utilities ───────────────────────────────────────────────────────────

function extractCleanText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// For markdown from ScrapeGraph — preserve all lines including short ones (phone numbers, names)
function concatenateMarkdownPages(pages: string[], charBudget: number): string {
  const parts: string[] = [];
  let total = 0;
  for (const page of pages) {
    if (total >= charBudget) break;
    const chunk = page.slice(0, charBudget - total);
    parts.push(chunk);
    total += chunk.length;
  }
  return parts.join("\n\n---\n\n");
}

function deduplicateCorpus(pages: string[], tokenBudget: number): string {
  // Approximate tokens: 1 token ≈ 4 chars
  const charBudget = tokenBudget * 4;
  const seen = new Set<string>();
  const parts: string[] = [];
  let total = 0;

  for (const page of pages) {
    const sentences = page.split(/[.!?]\s+/).filter((s) => s.length > 40);
    for (const sentence of sentences) {
      const normalized = sentence.trim().toLowerCase().slice(0, 80);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        parts.push(sentence.trim());
        total += sentence.length;
        if (total >= charBudget) break;
      }
    }
    if (total >= charBudget) break;
  }

  return parts.join(". ");
}

function detectLanguage(html: string, text: string): string {
  // 1. Try <html lang="..."> attribute
  const langAttr = html.match(/<html[^>]+lang=["']([a-zA-Z-]+)["']/i)?.[1];
  if (langAttr) {
    const code = langAttr.toLowerCase().split("-")[0];
    if (["es", "en", "pt"].includes(code)) return code;
  }

  // 2. Count Spanish indicator words in the corpus
  const sample = text.toLowerCase().slice(0, 3000);
  const esWords = ["el", "la", "los", "las", "de", "del", "en", "que", "con", "por", "para", "una", "como", "más", "nuestro", "servicio", "empresa", "contacto"];
  const enWords = ["the", "and", "for", "our", "with", "from", "this", "that", "your", "we", "are", "have", "services", "about", "contact"];
  const esHits = esWords.filter((w) => sample.includes(` ${w} `)).length;
  const enHits = enWords.filter((w) => sample.includes(` ${w} `)).length;
  if (esHits > enHits + 2) return "es";
  if (enHits > esHits + 2) return "en";
  return "en"; // default
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].trim()).slice(0, 160) || null : null;
}

function extractMetaDescription(html: string): string | null {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
  return m ? decodeEntities(m[1].trim()).slice(0, 280) || null : null;
}

function extractSocialLinks(html: string): Record<string, string> {
  const urls = html.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
  const out: Record<string, string> = {};
  for (const url of urls) {
    for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
      if (!out[platform] && pattern.test(url)) out[platform] = url;
    }
  }
  return out;
}

function buildContentSummary(input: { pageTitle: string | null; metaDescription: string | null; contentExcerpt: string | null }): string | null {
  const parts: string[] = [];
  if (input.pageTitle) parts.push(`Title: ${input.pageTitle}.`);
  if (input.metaDescription) parts.push(`Meta: ${input.metaDescription}.`);
  if (input.contentExcerpt) parts.push(`Excerpt: ${input.contentExcerpt}`);
  return parts.length ? parts.join(" ").slice(0, 1200) : null;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

function looksBlocked(html: string, status: number): boolean {
  const lower = html.toLowerCase();
  if (status === 403 || status === 429) {
    return lower.includes("captcha") || lower.includes("cloudflare") || lower.includes("access denied");
  }
  const signals = ["captcha", "verify you are human", "access denied", "cloudflare ray id", "bot protection", "ddos protection"];
  return signals.some((s) => lower.includes(s));
}

function safeParseJson(text: string): unknown {
  try { return JSON.parse(text); } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
    }
    return null;
  }
}

function decodeEntities(text: string): string {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

// ─── Empty/error result builders ──────────────────────────────────────────────

function emptyResult(
  profile_id: string,
  website_url: string,
  scrape_status: ScrapeStatus,
  error_message: string
): ScrapeResult {
  return {
    profile_id,
    website_url,
    scraped_at: new Date().toISOString(),
    scrape_status,
    final_url: null,
    status_code: null,
    page_title: null,
    meta_description: null,
    detected_language: null,
    confidence_score: 0,
    tech_stack_detected: [],
    tech_profile: emptyTechProfile(),
    social_links: {},
    content_excerpt: null,
    content_summary: null,
    content_corpus: null,
    ai_summary: null,
    ai_services_detected: [],
    ai_industry: null,
    services: null,
    target_audience: null,
    tone_of_voice: null,
    pricing_signals: null,
    operational_tools: null,
    contact_info: null,
    brand_story: null,
    geo_coverage: null,
    social_proof: null,
    raw_html_snapshot: null,
    error_message: error_message.slice(0, 500),
  };
}

function emptyTechProfile(): TechProfile {
  return {
    cms: "unknown",
    js_framework: "unknown",
    hosting: "unknown",
    analytics: [],
    crm_signals: [],
    payment_processors: [],
    chat_tools: [],
    booking_tools: [],
    ecommerce_signals: [],
    latam_tools: [],
    integration_complexity: 3,
    integration_notes: "Unable to determine — website not scraped.",
    whatsapp_present: false,
  };
}

// ─── Logging helper ───────────────────────────────────────────────────────────

async function logDone(
  profile_id: string,
  website_url: string,
  startedAt: number,
  result: ScrapeResult,
  extras?: Record<string, unknown>
) {
  await appendJsonlLog({
    file: "scraper.log",
    event: "scrape_done",
    fields: {
      profile_id,
      website_url,
      ms: Date.now() - startedAt,
      scrape_status: result.scrape_status,
      confidence_score: result.confidence_score,
      tech_cms: result.tech_profile.cms,
      integration_complexity: result.tech_profile.integration_complexity,
      whatsapp_present: result.tech_profile.whatsapp_present,
      detected_language: result.detected_language,
      ...extras,
    },
  });
}
