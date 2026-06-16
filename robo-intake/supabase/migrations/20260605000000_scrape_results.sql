-- Scrape results table — persists every ScrapeResult produced by scraper.ts
-- raw_html_snapshot is intentionally excluded (50 kB per row, not query-useful)

create table public.scrape_results (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            text not null unique,          -- one row per intake profile
  website_url           text not null,
  scraped_at            timestamptz not null,
  scrape_status         text not null,
  final_url             text,
  status_code           int,
  page_title            text,
  meta_description      text,
  detected_language     text,
  confidence_score      numeric,
  tech_stack_detected   text[],
  tech_profile          jsonb,
  social_links          jsonb,
  content_excerpt       text,
  content_summary       text,
  ai_summary            text,
  ai_services_detected  text[],
  ai_industry           text,
  services              jsonb,
  target_audience       text[],
  tone_of_voice         text,
  pricing_signals       jsonb,
  operational_tools     jsonb,
  contact_info          jsonb,
  brand_story           jsonb,
  geo_coverage          jsonb,
  social_proof          jsonb,
  error_message         text,
  created_at            timestamptz default now()
);

create index scrape_results_profile_id_idx  on public.scrape_results (profile_id);
create index scrape_results_website_url_idx on public.scrape_results (website_url);
create index scrape_results_status_idx      on public.scrape_results (scrape_status);
create index scrape_results_created_at_idx  on public.scrape_results (created_at desc);

alter table public.scrape_results enable row level security;

-- Service-role writes only — no public/anon access
-- Add explicit policies here if you need authenticated reads in the dashboard
