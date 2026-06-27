# Debug Session: scrapegraph-empty

Status: OPEN

## Symptom
- Scrape call runs, but ScrapeGraphAI-derived data is not captured.
- Result ends with `scrape_status: "failed"` and `error_message: "ScrapeGraph returned empty content"`.

## Scope
- Investigate runtime path from website scrape trigger to scrape result normalization.
- Do not modify business logic before evidence collection.

## Initial Hypotheses
- H1: The ScrapeGraphAI HTTP/API call returns a success status but an empty or differently shaped payload, and the parser treats it as failure.
- H2: The scraper falls back to the wrong extraction field names, so valid content exists but is never mapped into `final_url`, `page_title`, or summary fields.
- H3: The integration is gated by env/config and the code path marked as “ScrapeGraph” is actually executing a fallback branch that returns an empty placeholder result.
- H4: The target site responds with bot protection or unusual markup, and the current ScrapeGraph request options produce no extracted content for that domain.
- H5: A post-processing validation step rejects partially valid ScrapeGraph output because one required field is missing, collapsing the whole scrape to `failed`.

## Evidence To Collect
- Where the ScrapeGraph call is made
- Raw response shape before normalization
- Branch that sets `error_message: "ScrapeGraph returned empty content"`
- Any env/config requirements controlling the ScrapeGraph path

## Evidence Collected
- Existing scraper logs show the failing profile enters `scrape_sgai_start` and exits `scrape_done` as `failed`, while the same target site succeeds on the non-ScrapeGraph path as `low_confidence`.
- Local one-off reproduction against `https://santocoraje.com/` on the Playwright path returns `low_confidence` with a valid `final_url`, which rules out site-wide blocking as the primary cause.
- The current ScrapeGraph docs for the Scrape service describe responses shaped like `{ format, content: [...] }`, while the current parser expected nested `data.results.html` / `data.results.markdown`.

## Hypothesis Status
- H1 Confirmed: the parser was too strict for the current response shape.
- H2 Confirmed: valid content can exist under `format + content[]` and was ignored.
- H3 Rejected: the failing runs do enter the ScrapeGraph branch (`scrape_sgai_start` present in logs).
- H4 Rejected as primary cause: the same website scrapes successfully outside the ScrapeGraph path.
- H5 Rejected: failure happens before post-processing confidence logic.

## Fix Applied
- Added debug logging around the ScrapeGraph HTTP response and normalized payload keys.
- Updated `fetchWithScrapeGraph()` to normalize both legacy nested payloads and current `format/content[]` payloads before deciding the scrape is empty.

## Verification
- `npm run typecheck` passes after the normalization change.
- Waiting on a production/user-side ScrapeGraph-enabled rerun to capture post-fix logs and confirm resolution.
