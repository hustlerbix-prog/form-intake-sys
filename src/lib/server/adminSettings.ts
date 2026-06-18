import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { z } from "zod";

export const AiProviderSchema = z.enum(["anthropic", "openrouter"]);
export type AiProvider = z.infer<typeof AiProviderSchema>;

export const AiSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  provider: AiProviderSchema.default("anthropic"),
  model: z.string().min(1).default("claude-haiku-4-5-20251001"),
  baseUrl: z.string().url().optional().nullable(),
  maxOutputTokens: z.number().int().min(1).max(8192).default(4096),
  temperature: z.number().min(0).max(2).default(0.2),
  timeoutMs: z.number().int().min(1000).max(120000).default(60000),
  apiKey: z.string().optional().nullable(),
});

export type AiSettings = z.infer<typeof AiSettingsSchema>;

type Stored = { ai: AiSettings };

const DEFAULTS: Stored = {
  ai: AiSettingsSchema.parse({
    enabled: true,
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    baseUrl: null,
    maxOutputTokens: 4096,
    temperature: 0.2,
    timeoutMs: 60000,
    apiKey: null,
  }),
};

function dataPath(): string {
  // On Vercel only /tmp is writable; settings written there are per-instance and ephemeral.
  // Use SETTINGS_ENCRYPTION_KEY + env-var-based config when possible on stateless runtimes.
  const dir = process.env.VERCEL ? "/tmp/robo-data" : `${process.cwd()}/.data`;
  return `${dir}/admin_settings.enc`;
}

function normalizeKey(): Buffer | null {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  try {
    const buf = Buffer.from(raw, "base64");
    if (buf.length === 32) return buf;
  } catch {
    void 0;
  }
  return createHash("sha256").update(raw).digest();
}

function encryptJson(json: unknown, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(json), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("ROBO1"), iv, tag, ciphertext]);
}

function decryptJson(payload: Buffer, key: Buffer): unknown {
  const magic = payload.subarray(0, 5).toString("utf8");
  if (magic != "ROBO1") throw new Error("invalid format");
  const iv = payload.subarray(5, 17);
  const tag = payload.subarray(17, 33);
  const ciphertext = payload.subarray(33);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  return JSON.parse(plaintext);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getCache(): { stored: Stored } {
  const g = globalThis as unknown as { __roboAdminSettings?: { stored: Stored } };
  if (!g.__roboAdminSettings) {
    g.__roboAdminSettings = { stored: DEFAULTS };
  }
  return g.__roboAdminSettings;
}

export async function loadAdminSettings(): Promise<{ stored: Stored; persisted: boolean }> {
  const cache = getCache();
  const key = normalizeKey();
  if (!key) return { stored: cache.stored, persisted: false };

  try {
    const buf = await readFile(dataPath());
    const parsed = decryptJson(buf, key);
    const parsedObj = isRecord(parsed) ? parsed : null;
    const stored: Stored = {
      ai: AiSettingsSchema.parse(parsedObj && "ai" in parsedObj ? parsedObj.ai : DEFAULTS.ai),
    };
    cache.stored = stored;
    return { stored, persisted: true };
  } catch {
    cache.stored = DEFAULTS;
    return { stored: cache.stored, persisted: false };
  }
}

export async function saveAdminSettings(input: Stored): Promise<{ stored: Stored; persisted: boolean }> {
  const cache = getCache();
  const stored: Stored = { ai: AiSettingsSchema.parse(input.ai) };
  cache.stored = stored;

  const key = normalizeKey();
  if (!key) return { stored, persisted: false };

  const dir = process.env.VERCEL ? "/tmp/robo-data" : `${process.cwd()}/.data`;
  await mkdir(dir, { recursive: true });
  await writeFile(dataPath(), encryptJson(stored, key));
  return { stored, persisted: true };
}

export function maskApiKey(apiKey: string | null | undefined): string | null {
  if (!apiKey) return null;
  const tail = apiKey.slice(-6);
  return `•••••${tail}`;
}

