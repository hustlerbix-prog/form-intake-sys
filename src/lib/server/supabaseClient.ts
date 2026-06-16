import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ScrapeResult } from "./scraper";

function getAdminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Persists a ScrapeResult to the scrape_results table.
// Silently skips if SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.
// Upserts on profile_id so re-scrapes update the existing row.
export async function persistScrapeResult(result: ScrapeResult): Promise<void> {
  const client = getAdminClient();
  if (!client) return;

  // Omit the 50 kB HTML snapshot — not useful to store
  const { raw_html_snapshot, ...row } = result;
  void raw_html_snapshot;

  const { error } = await client
    .from("scrape_results")
    .upsert(row, { onConflict: "profile_id" });

  if (error) {
    console.error("[supabase] persistScrapeResult failed:", error.message);
  }
}
