import { NextResponse, type NextRequest } from "next/server";
import { assertAdminAccess } from "@/lib/server/adminAuth";
import { AiSettingsSchema, loadAdminSettings, maskApiKey, saveAdminSettings, type ProviderPoolEntry } from "@/lib/server/adminSettings";

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

  const saved = await saveAdminSettings({ ai });
  return NextResponse.json({
    persisted: saved.persisted,
    ai: {
      ...saved.stored.ai,
      apiKey: saved.stored.ai.apiKey ? maskApiKey(saved.stored.ai.apiKey) : null,
    },
  });
}
