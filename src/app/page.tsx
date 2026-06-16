import Link from "next/link";

export default function Home() {
  return (
    <>
      {/* Skip to main content — accessibility */}
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:rounded-lg focus-visible:bg-teal focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-bold focus-visible:text-navy"
      >
        Skip to main content
      </a>

      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-navy-600/50 bg-navy/90 backdrop-blur-md">
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
          aria-label="Main navigation"
        >
          <Link
            href="/"
            className="font-syne text-xl font-bold text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-navy rounded"
          >
            ROBO&nbsp;AI
          </Link>

          <div className="hidden sm:flex items-center gap-8 text-sm font-medium text-slateText">
            <Link href="#how-it-works" className="hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal rounded">
              How it works
            </Link>
            <Link href="#services" className="hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal rounded">
              Services
            </Link>
            <Link href="#why-robo" className="hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal rounded">
              Why ROBO
            </Link>
          </div>

          <Link
            href="/analyse"
            className="inline-flex items-center justify-center rounded-lg bg-teal px-5 h-10 text-sm font-bold text-navy hover:brightness-110 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
            style={{ touchAction: "manipulation" }}
          >
            Start Free Intake
          </Link>
        </nav>
      </header>

      {/* Main */}
      <main id="main">

        {/* ── Hero ── */}
        <section
          className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-20 text-center"
          aria-labelledby="hero-heading"
        >
          {/* Background glow */}
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden="true"
          >
            <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal/10 blur-3xl" />
          </div>

          <div className="relative max-w-4xl">
            <p className="mb-4 inline-block rounded-full border border-teal/30 bg-teal/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-teal">
              AI&#x2011;Powered Business Automation
            </p>

            <h1
              id="hero-heading"
              className="font-syne text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl text-balance"
            >
              Your business deserves{" "}
              <span className="text-teal">its&nbsp;own AI&nbsp;agent</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slateText">
              Answer a short conversational intake. We scrape your site, run a deep AI&nbsp;diagnosis,
              and build a custom agent — trained on your business — ready to deploy in&nbsp;minutes.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/analyse"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal px-8 h-14 text-base font-bold text-navy hover:brightness-110 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
                style={{ touchAction: "manipulation" }}
              >
                Start your free AI intake
                <ArrowRightIcon />
              </Link>
              <Link
                href="/analyse/demo"
                className="inline-flex items-center justify-center rounded-xl border border-navy-600 px-8 h-14 text-base font-semibold text-slateText hover:border-teal/40 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
                style={{ touchAction: "manipulation" }}
              >
                View demo
              </Link>
            </div>

            <p className="mt-6 text-xs text-slateText/60">
              No credit card required &middot; Results in&nbsp;under&nbsp;30&nbsp;minutes
            </p>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2" aria-hidden="true">
            <div className="flex flex-col items-center gap-2 text-slateText/40">
              <span className="text-xs tracking-widest uppercase">Scroll</span>
              <svg width="16" height="24" viewBox="0 0 16 24" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="14" height="22" rx="7" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="8" cy="8" r="2" fill="currentColor" className="animate-bounce" style={{ animationDuration: "1.5s" }}/>
              </svg>
            </div>
          </div>
        </section>

        {/* ── Stats strip ── */}
        <div className="border-y border-navy-600/50 bg-navy-800/50 py-8" aria-label="Agency statistics">
          <dl className="mx-auto grid max-w-4xl grid-cols-2 gap-y-8 px-6 text-center sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <dt className="text-xs font-semibold uppercase tracking-widest text-slateText/60">{s.label}</dt>
                <dd className="mt-1 font-syne text-3xl font-bold tabular-nums text-teal">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── How it works ── */}
        <section
          id="how-it-works"
          className="mx-auto max-w-6xl px-6 py-24"
          aria-labelledby="how-heading"
        >
          <div className="text-center mb-16">
            <h2 id="how-heading" className="font-syne text-3xl font-bold text-white sm:text-4xl">
              From intake to AI agent in&nbsp;4&nbsp;steps
            </h2>
            <p className="mt-4 text-slateText max-w-xl mx-auto">
              Our automated pipeline does the heavy lifting — you just answer a few questions.
            </p>
          </div>

          <ol className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4" aria-label="Pipeline steps">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative flex flex-col gap-4">
                {/* Connector line (desktop) */}
                {i < STEPS.length - 1 && (
                  <div
                    className="hidden lg:block absolute top-8 left-[calc(100%+16px)] w-[calc(100%-32px)] border-t border-dashed border-navy-600"
                    aria-hidden="true"
                  />
                )}
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-teal/30 bg-teal/10 font-syne text-sm font-bold text-teal tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="text-teal" aria-hidden="true">{step.icon}</div>
                </div>
                <h3 className="font-syne text-lg font-bold text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-slateText">{step.description}</p>
              </li>
            ))}
          </ol>

          <div className="mt-14 text-center">
            <Link
              href="/analyse"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal px-8 h-13 py-3 text-base font-bold text-navy hover:brightness-110 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
              style={{ touchAction: "manipulation" }}
            >
              Begin the intake now
              <ArrowRightIcon />
            </Link>
          </div>
        </section>

        {/* ── Services ── */}
        <section
          id="services"
          className="bg-navy-800/30 border-y border-navy-600/50 py-24"
          aria-labelledby="services-heading"
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center mb-16">
              <h2 id="services-heading" className="font-syne text-3xl font-bold text-white sm:text-4xl">
                Everything you need to go from idea to&nbsp;deployed&nbsp;agent
              </h2>
              <p className="mt-4 text-slateText max-w-xl mx-auto">
                ROBO&nbsp;AI handles the full stack — intelligence gathering, model training, deployment, and payments.
              </p>
            </div>

            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {SERVICES.map((svc) => (
                <li
                  key={svc.title}
                  className="flex flex-col gap-4 rounded-2xl border border-navy-600 bg-navy p-7 hover:border-teal/30 transition"
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal/10 text-teal"
                    aria-hidden="true"
                  >
                    {svc.icon}
                  </div>
                  <h3 className="font-syne text-lg font-bold text-white">{svc.title}</h3>
                  <p className="text-sm leading-relaxed text-slateText flex-1">{svc.description}</p>
                  {svc.href && (
                    <Link
                      href={svc.href}
                      className="text-sm font-semibold text-teal hover:text-teal-light transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal rounded inline-flex items-center gap-1"
                      aria-label={`${svc.ctaLabel} — ${svc.title}`}
                    >
                      {svc.ctaLabel} <ArrowRightIcon size={14} />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Why ROBO AI ── */}
        <section
          id="why-robo"
          className="mx-auto max-w-6xl px-6 py-24"
          aria-labelledby="why-heading"
        >
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 id="why-heading" className="font-syne text-3xl font-bold text-white sm:text-4xl text-balance">
                Not just another&nbsp;AI tool. Your own AI&nbsp;workforce.
              </h2>
              <p className="mt-6 text-slateText leading-relaxed">
                Most AI tools are generic. ROBO&nbsp;AI starts by deeply understanding your business —
                your industry, your bottlenecks, your existing stack — then builds an agent that actually
                knows how to help you, not just any business.
              </p>
              <ul className="mt-8 space-y-4" role="list">
                {WHY_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slateText">
                    <CheckIcon />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/analyse"
                className="mt-10 inline-flex items-center justify-center gap-2 rounded-xl bg-teal px-8 h-13 py-3 text-base font-bold text-navy hover:brightness-110 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
                style={{ touchAction: "manipulation" }}
              >
                Get my free AI analysis
                <ArrowRightIcon />
              </Link>
            </div>

            {/* Feature highlights panel */}
            <div className="grid grid-cols-2 gap-4" role="list" aria-label="Feature highlights">
              {HIGHLIGHTS.map((h) => (
                <div
                  key={h.label}
                  role="listitem"
                  className="flex flex-col gap-2 rounded-2xl border border-navy-600 bg-navy-800/50 p-6"
                >
                  <div className="text-teal" aria-hidden="true">{h.icon}</div>
                  <p className="font-syne text-sm font-bold text-white">{h.label}</p>
                  <p className="text-xs text-slateText leading-relaxed">{h.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section
          className="relative overflow-hidden border-t border-navy-600/50 py-24 text-center"
          aria-labelledby="cta-heading"
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute left-1/2 top-0 h-[400px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal/8 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-2xl px-6">
            <h2 id="cta-heading" className="font-syne text-3xl font-bold text-white sm:text-4xl text-balance">
              Ready to automate your business?
            </h2>
            <p className="mt-4 text-slateText leading-relaxed">
              Start with the free intake — no card required. Get your custom AI&nbsp;diagnosis and
              see exactly which parts of your business we can automate.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/analyse"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal px-8 h-14 text-base font-bold text-navy hover:brightness-110 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
                style={{ touchAction: "manipulation" }}
              >
                Start free AI intake
                <ArrowRightIcon />
              </Link>
              <Link
                href="/analyse/demo"
                className="inline-flex items-center justify-center rounded-xl border border-navy-600 px-8 h-14 text-base font-semibold text-slateText hover:border-teal/40 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
                style={{ touchAction: "manipulation" }}
              >
                View sandbox demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-navy-600/50 py-10" role="contentinfo">
        <div className="mx-auto max-w-6xl px-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs text-slateText/60">
          <p>
            &copy; {new Date().getFullYear()} <span translate="no">ROBO AI Agency</span>. All rights reserved.
          </p>
          <nav aria-label="Footer navigation" className="flex gap-6">
            <Link href="/analyse" className="hover:text-slateText transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal rounded">
              Start intake
            </Link>
            <Link href="/admin/settings" className="hover:text-slateText transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal rounded">
              Admin
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}

/* ── Icons ── */
function ArrowRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="mt-0.5 shrink-0 text-teal">
      <circle cx="9" cy="9" r="9" fill="currentColor" fillOpacity="0.15" />
      <path d="M5.5 9l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Data ── */
const STATS = [
  { label: "Intake questions", value: "12" },
  { label: "Pipeline stages", value: "4" },
  { label: "Delivery time", value: "<30m" },
  { label: "Export formats", value: "4" },
];

const STEPS = [
  {
    title: "Complete the intake",
    description:
      "Answer 8–12 conversational questions about your business, bottlenecks, and goals. Takes under 5 minutes.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M3 5h14M3 10h9M3 15h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "We scrape your site",
    description:
      "Our AI scraper pulls real intelligence from your website — products, tone, services — so the analysis is grounded in fact.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.75" />
        <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "AI diagnosis report",
    description:
      "The Master Analyzer synthesizes your answers + scrape into a custom PDF report: inefficiency score, ROI estimates, automation roadmap.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="2" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.75" />
        <path d="M7 7h6M7 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Build & deploy your agent",
    description:
      "Use the AI Builder to configure your agent, test it live, then publish — export as MCP server, REST API, embeddable widget, or raw code.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const SERVICES = [
  {
    title: "Business Intake Intelligence",
    description:
      "A 12-question conversational form powered by Claude. AI-selected question order adapts to your answers. Produces a structured JSON profile and downloadable PDF report.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M4 6h14M4 11h10M4 16h7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
    href: "/analyse",
    ctaLabel: "Start intake",
  },
  {
    title: "AI Agent Builder",
    description:
      "Configure your agent's persona, knowledge base, and integrations through a guided 6-step wizard. Live test harness included before you commit to a plan.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
        <rect x="12" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
        <rect x="3" y="12" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
        <rect x="12" y="12" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    ),
    href: null,
    ctaLabel: null,
  },
  {
    title: "Flexible Payment & Deployment",
    description:
      "One-shot, subscription pool, usage-based, or pay-as-you-go. Stripe, MercadoPago (LATAM), and Braintree supported. Publish as MCP, REST API, widget, or code.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="2" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.75" />
        <path d="M2 10h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
    href: null,
    ctaLabel: null,
  },
];

const WHY_ITEMS = [
  "Diagnosis grounded in your actual website — not generic templates",
  "Bilingual (English & Spanish) — AI adapts to your language automatically",
  "PDF report with inefficiency score, ROI estimates, and automation roadmap",
  "Agent trained on your knowledge base and tested before payment",
  "4 export formats: MCP server, REST API, embeddable widget, raw code",
  "GDPR compliant — data erasure on request, 30-day raw data purge",
];

const HIGHLIGHTS = [
  {
    label: "Powered by Claude",
    description: "Every question, analysis, and agent is driven by Anthropic's Claude — the most capable model for business reasoning.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.75" />
        <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Under 30 minutes",
    description: "Form to PDF in under 30 minutes. Agent builder adds another hour at most.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.75" />
        <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "No engineering required",
    description: "From intake to deployed agent with zero code written by you. We generate, configure, and publish.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 13l3-3-3-3M9 15h7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "LATAM-ready",
    description: "MercadoPago integration for Argentina, Brazil, Chile, Colombia, Mexico, Peru, and Venezuela.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.75" />
        <path d="M3 10c0 0 3-4 7-4s7 4 7 4-3 4-7 4-7-4-7-4z" stroke="currentColor" strokeWidth="1.25" />
      </svg>
    ),
  },
];
