import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { CanonicalSubmissionJson } from "../server/store";

const NAVY = rgb(0.051, 0.106, 0.165);
const TEAL = rgb(0.055, 0.647, 0.627);
const WHITE = rgb(1, 1, 1);
const GRAY = rgb(0.796, 0.835, 0.886);

function sanitizePdfText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/•/g, "-")
    .replace(/[—–]/g, "-")
    .replace(/…/g, "...")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}

export async function generateIntakePdf(params: {
  submission: CanonicalSubmissionJson;
  calendarUrl?: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28;
  const H = 841.89;

  const cover = doc.addPage([W, H]);
  cover.drawRectangle({ x: 0, y: 0, width: W, height: H, color: NAVY });
  cover.drawText("ROBO AI Agency", { x: 48, y: H - 80, font: bold, size: 22, color: TEAL });
  cover.drawText("Business Intake Summary", {
    x: 48,
    y: H - 180,
    font: bold,
    size: 32,
    color: WHITE,
  });
  cover.drawText(
    sanitizePdfText(
      params.submission.contact?.first_name ? `Prepared for ${params.submission.contact.first_name}` : "Prepared for your team"
    ),
    {
    x: 48,
    y: H - 225,
    font: regular,
    size: 16,
    color: GRAY,
    }
  );
  cover.drawText(new Date(params.submission.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }), { x: 48, y: H - 255, font: regular, size: 12, color: GRAY });
  cover.drawText(sanitizePdfText(`Ref: ${params.submission.profile_id}`), { x: 48, y: 40, font: regular, size: 9, color: GRAY });

  let page = addAnswersPage({ doc, W, H, bold });
  let y = H - 120;

  const groups = groupByLayer(params.submission.questionnaire);
  for (const group of groups) {
    const title = group.layer;
    if (y < 140) {
      page = addAnswersPage({ doc, W, H, bold });
      y = H - 120;
    }
    page.drawText(sanitizePdfText(title), { x: 48, y, font: bold, size: 12, color: WHITE });
    y -= 18;

    for (const item of group.items) {
      if (y < 120) {
        page = addAnswersPage({ doc, W, H, bold });
        y = H - 120;
      }
      page.drawText(sanitizePdfText(item.question), { x: 48, y, font: bold, size: 10.5, color: TEAL });
      y -= 15;
      const answerText = Array.isArray(item.answer) ? item.answer.join(", ") : item.answer ?? "—";
      y = drawWrappedText(page, answerText, {
        x: 48,
        y,
        font: regular,
        size: 11,
        color: GRAY,
        maxWidth: W - 96,
        lineHeight: 16,
      });
      y -= 18;
    }
  }

  if (params.submission.website_scrape) {
    const s = params.submission.website_scrape;
    if (y < 160) {
      page = addAnswersPage({ doc, W, H, bold });
      y = H - 120;
    }

    page.drawText("Website Findings", { x: 48, y, font: bold, size: 12, color: WHITE });
    y -= 18;

    const rows: Array<[string, string]> = [
      ["Website", s.website_url],
      ["Scrape status", s.scrape_status],
      ["Final URL", s.final_url ?? ""],
      ["HTTP status", s.status_code ? String(s.status_code) : ""],
      ["Page title", s.page_title ?? ""],
      ["Meta description", s.meta_description ?? ""],
      ["AI industry", s.ai_industry ?? ""],
      ["AI services", (s.ai_services_detected ?? []).join(", ")],
      ["AI summary", s.ai_summary ?? ""],
      ["Tech stack", (s.tech_stack_detected ?? []).join(", ")],
      [
        "Social links",
        Object.keys(s.social_links ?? {}).length
          ? Object.entries(s.social_links)
              .map(([k, v]) => `${k}: ${v}`)
              .join("\n")
          : "",
      ],
      ["Summary", s.content_summary ?? ""],
      ["Excerpt", s.content_excerpt ?? ""],
      ["Error", s.error_message ?? ""],
    ];

    for (const [label, value] of rows) {
      if (!value) continue;
      if (y < 120) {
        page = addAnswersPage({ doc, W, H, bold });
        y = H - 120;
      }
      page.drawText(sanitizePdfText(label), { x: 48, y, font: bold, size: 10.5, color: TEAL });
      y -= 15;
      y = drawWrappedText(page, value, {
        x: 48,
        y,
        font: regular,
        size: 11,
        color: GRAY,
        maxWidth: W - 96,
        lineHeight: 16,
      });
      y -= 18;
    }
  }

  if (params.submission.full_report) {
    const r = params.submission.full_report;
    if (y < 160) {
      page = addAnswersPage({ doc, W, H, bold });
      y = H - 120;
    }

    page.drawText("Business Analysis", { x: 48, y, font: bold, size: 12, color: WHITE });
    y -= 18;

    const gaps = r.diagnosis.operational_gaps
      .map((g) => `• ${g.gap_id} (sev ${g.severity_score}/10, ${g.evidence_source}): ${g.description}`)
      .join("\n");
    const products = r.diagnosis.recommended_products
      .sort((a, b) => a.priority_rank - b.priority_rank)
      .map((p) => {
        const price = p.monthly_price_usd != null ? `$${p.monthly_price_usd}/mo` : p.one_time_price_usd != null ? `$${p.one_time_price_usd} one-time` : "";
        return `• ${p.product_name} (${p.product_id}) — ${p.tier}${price ? ` — ${price}` : ""}\n  ${p.rationale}`;
      })
      .join("\n");

    const rows: Array<[string, string]> = [
      ["Summary", r.diagnosis.business_summary],
      ["Automation readiness", `${r.diagnosis.automation_readiness_score}/100`],
      ["Top operational gaps", gaps],
      ["AI opportunities (catalog)", products],
      ["Estimated monthly value (USD)", String(r.diagnosis.estimated_monthly_value_usd)],
      ["Value reasoning", r.diagnosis.value_reasoning],
      [
        "ROI snapshot",
        [
          `Monthly value: $${r.roi.monthly_value_usd}`,
          `Monthly cost: $${r.roi.monthly_cost_usd}`,
          `One-time cost: $${r.roi.one_time_cost_usd}`,
          `Net monthly: $${r.roi.net_monthly_value_usd}`,
          r.roi.payback_months != null ? `Payback: ${r.roi.payback_months} months` : null,
          r.roi.roi_12mo_percent != null ? `12-mo ROI: ${r.roi.roi_12mo_percent}%` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      ],
      ["Before", r.before_after.before],
      ["After", r.before_after.after],
      ["Revenue support", r.before_after.revenue_support],
    ];

    for (const [label, value] of rows) {
      if (!value) continue;
      if (y < 120) {
        page = addAnswersPage({ doc, W, H, bold });
        y = H - 120;
      }
      page.drawText(sanitizePdfText(label), { x: 48, y, font: bold, size: 10.5, color: TEAL });
      y -= 15;
      y = drawWrappedText(page, value, {
        x: 48,
        y,
        font: regular,
        size: 11,
        color: GRAY,
        maxWidth: W - 96,
        lineHeight: 16,
      });
      y -= 18;
    }
  }

  if (params.calendarUrl) {
    if (y < 120) {
      page = addAnswersPage({ doc, W, H, bold });
      y = H - 120;
    }
    page.drawText("Next step: book a walkthrough", { x: 48, y: y - 8, font: bold, size: 12, color: WHITE });
    page.drawText(sanitizePdfText(params.calendarUrl), { x: 48, y: y - 26, font: regular, size: 11, color: TEAL });
  }

  for (const p of doc.getPages()) {
    p.drawText(sanitizePdfText("Confidential · ROBO AI Agency"), { x: 48, y: 28, font: regular, size: 8, color: GRAY });
  }

  return doc.save();
}

function addAnswersPage(input: { doc: PDFDocument; W: number; H: number; bold: PDFFont }): PDFPage {
  const page = input.doc.addPage([input.W, input.H]);
  page.drawRectangle({ x: 0, y: 0, width: input.W, height: input.H, color: NAVY });
  page.drawText("Your Answers", { x: 48, y: input.H - 80, font: input.bold, size: 22, color: WHITE });
  return page;
}

function groupByLayer(items: CanonicalSubmissionJson["questionnaire"]): Array<{ layer: string; items: CanonicalSubmissionJson["questionnaire"] }> {
  const out: Array<{ layer: string; items: CanonicalSubmissionJson["questionnaire"] }> = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (!last || last.layer !== item.layer) {
      out.push({ layer: item.layer, items: [item] });
    } else {
      last.items.push(item);
    }
  }
  return out;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    font: PDFFont;
    size: number;
    color: ReturnType<typeof rgb>;
    maxWidth: number;
    lineHeight: number;
  }
): number {
  const lines = sanitizePdfText(text).split("\n");
  let line = "";
  let y = opts.y;

  for (const rawLine of lines) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const width = opts.font.widthOfTextAtSize(test, opts.size);
      if (width > opts.maxWidth && line) {
        page.drawText(line, { x: opts.x, y, font: opts.font, size: opts.size, color: opts.color });
        line = word;
        y -= opts.lineHeight;
      } else {
        line = test;
      }
    }
    if (line) {
      page.drawText(line, { x: opts.x, y, font: opts.font, size: opts.size, color: opts.color });
      y -= opts.lineHeight;
    } else {
      y -= opts.lineHeight;
    }
  }

  y += opts.lineHeight;

  return y;
}
