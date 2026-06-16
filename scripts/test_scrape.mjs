const base = process.env.APP_URL || "http://localhost:3001";

async function post(path, body) {
  const r = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(path + " " + r.status + ": " + JSON.stringify(j));
  return j;
}

async function get(path) {
  const r = await fetch(base + path);
  const j = await r.json();
  if (!r.ok) throw new Error(path + " " + r.status + ": " + JSON.stringify(j));
  return j;
}

const session = await post("/api/session", { language: "en" });
const profileId = session.profile_id;

await post("/api/answer", {
  profile_id: profileId,
  field: "website_url",
  value: "https://example.com",
  question_id: "Q-15",
});

await post("/api/submit-profile", {
  profile_id: profileId,
  language: "en",
  contact: { email: "test@example.com", first_name: "Test", consent_marketing: false },
});

for (let i = 0; i < 120; i++) {
  const st = await get("/api/pipeline-status?profile_id=" + encodeURIComponent(profileId));
  if (st.pdf_ready) break;
  await new Promise((r) => setTimeout(r, 500));
}

const r = await fetch(base + "/api/download/json?profile_id=" + encodeURIComponent(profileId));
const submission = await r.json();
console.log({
  profileId,
  website_scrape: submission.website_scrape && {
    status: submission.website_scrape.scrape_status,
    title: submission.website_scrape.page_title,
    meta: submission.website_scrape.meta_description,
    summaryLen: (submission.website_scrape.content_summary || "").length,
    excerptLen: (submission.website_scrape.content_excerpt || "").length,
    aiSummaryLen: (submission.website_scrape.ai_summary || "").length,
    aiServices: (submission.website_scrape.ai_services_detected || []).length,
    tech: (submission.website_scrape.tech_stack_detected || []).length,
    social: Object.keys(submission.website_scrape.social_links || {}).length,
  },
});
