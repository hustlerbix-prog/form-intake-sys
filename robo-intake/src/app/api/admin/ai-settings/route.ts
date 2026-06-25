import { NextResponse, type NextRequest } from "next/server";
import { assertAdminAccess } from "@/lib/server/adminAuth";
import { AiSettingsSchema, ScraperSettingsSchema, loadAdminSettings, maskApiKey, saveAdminSettings, type ProviderPoolEntry } from "@/lib/server/adminSettings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    assertAdminAccess(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { stored, persisted } = await loadAdminSettings();
  return NextResponse.json({
    persisted,
    ai: {
      ...stored.ai,
      apiKey: stored.ai.apiKey ? maskApiKey(stored.ai.apiKey) : null,
      providerPool: (stored.ai.providerPool ?? []).map((e) => ({
        ...e,
        apiKey: e.apiKey ? maskApiKey(e.apiKey) : null,
      })),
    },
    scraper: {
      ...stored.scraper,
      sgaiApiKey: stored.scraper.sgaiApiKey ? maskApiKey(stored.scraper.sgaiApiKey) : null,
    },
  });
}

export async function PUT(req: NextRequest) {
  try {
    assertAdminAccess(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const current = await loadAdminSettings();
  const incoming = AiSettingsSchema.parse(body?.ai);
  const keepExistingKey = typeof body?.ai?.apiKey === "string" && body.ai.apiKey.includes("•");

  // Restore masked keys in pool entries by matching on provider+model
  const existingPoolMap = new Map(
    (current.stored.ai.providerPool ?? []).map((e) => [`${e.provider}::${e.model}`, e.apiKey ?? null])
  );
  const resolvedPool: ProviderPoolEntry[] = (incoming.providerPool ?? []).map((entry) => {
    const isMasked = typeof entry.apiKey === "string" && entry.apiKey.includes("•");
    return {
      ...entry,
      apiKey: isMasked ? (existingPoolMap.get(`${entry.provider}::${entry.model}`) ?? null) : entry.apiKey ?? null,
    };
  });

  const ai = {
    ...incoming,
    apiKey: keepExistingKey ? current.stored.ai.apiKey ?? null : incoming.apiKey ?? null,
    providerPool: resolvedPool,
  };

  // Scraper settings — restore masked sgaiApiKey if present
  const incomingScraper = ScraperSettingsSchema.parse(body?.scraper ?? current.stored.scraper);
  const keepSgaiKey = typeof body?.scraper?.sgaiApiKey === "string" && body.scraper.sgaiApiKey.includes("•");
  const scraper = {
    ...incomingScraper,
    sgaiApiKey: keepSgaiKey ? current.stored.scraper.sgaiApiKey ?? null : incomingScraper.sgaiApiKey ?? null,
  };

  const saved = await saveAdminSettings({ ai, scraper });
  return NextResponse.json({
    persisted: saved.persisted,
    ai: {
      ...saved.stored.ai,
      apiKey: saved.stored.ai.apiKey ? maskApiKey(saved.stored.ai.apiKey) : null,
    },
    scraper: {
      ...saved.stored.scraper,
      sgaiApiKey: saved.stored.scraper.sgaiApiKey ? maskApiKey(saved.stored.scraper.sgaiApiKey) : null,
    },
  });
}
