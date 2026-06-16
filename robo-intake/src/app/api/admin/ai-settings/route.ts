import { NextResponse, type NextRequest } from "next/server";
import { assertAdminAccess } from "@/lib/server/adminAuth";
import { AiSettingsSchema, loadAdminSettings, maskApiKey, saveAdminSettings } from "@/lib/server/adminSettings";

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

  const ai = {
    ...incoming,
    apiKey: keepExistingKey ? current.stored.ai.apiKey ?? null : incoming.apiKey ?? null,
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

