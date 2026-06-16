import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { z } from "zod";

export const PoolPackageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tokensPm: z.number().int().nonnegative(),
  minutesPm: z.number().int().nonnegative(),
  priceMonthly: z.number().nonnegative(),
  priceAnnual: z.number().nonnegative(),
  active: z.boolean().default(true),
});

export const ProductPriceSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  oneShotPrice: z.number().nonnegative(),
  currency: z.string().length(3).default("USD"),
  active: z.boolean().default(true),
});

export const PaymentSettingsSchema = z.object({
  bypassEnabled: z.boolean().default(false),
  enabledProcessors: z
    .array(z.enum(["stripe", "mercadopago", "paypal"]))
    .default(["stripe"]),
  latamCountries: z
    .array(z.string().length(2))
    .default(["AR", "BR", "CL", "CO", "MX", "PE", "VE"]),
  lowBalanceAlertPct: z.number().min(1).max(100).default(20),
  autoTopUpIncrement: z.number().nonnegative().default(25),
  annualDiscountPct: z.number().min(0).max(100).default(16),
  poolPackages: z.array(PoolPackageSchema).default([
    {
      id: "starter",
      name: "Starter",
      tokensPm: 500_000,
      minutesPm: 500,
      priceMonthly: 99,
      priceAnnual: 995,
      active: true,
    },
    {
      id: "growth",
      name: "Growth",
      tokensPm: 2_000_000,
      minutesPm: 2000,
      priceMonthly: 299,
      priceAnnual: 2990,
      active: true,
    },
    {
      id: "scale",
      name: "Scale",
      tokensPm: 10_000_000,
      minutesPm: 10_000,
      priceMonthly: 799,
      priceAnnual: 7990,
      active: true,
    },
  ]),
  productPricing: z.array(ProductPriceSchema).default([
    { productId: "CB-01", name: "AI Chatbot", oneShotPrice: 499, currency: "USD", active: true },
    { productId: "AVA-01", name: "Voice Secretary", oneShotPrice: 799, currency: "USD", active: true },
    { productId: "CA-01", name: "Company Analyzer", oneShotPrice: 299, currency: "USD", active: true },
    { productId: "IS-001", name: "Implementation Service", oneShotPrice: 1499, currency: "USD", active: true },
    { productId: "CS-001", name: "Consultancy Package", oneShotPrice: 999, currency: "USD", active: true },
  ]),
});

export type PaymentSettings = z.infer<typeof PaymentSettingsSchema>;
export type PoolPackage = z.infer<typeof PoolPackageSchema>;
export type ProductPrice = z.infer<typeof ProductPriceSchema>;

type Stored = { payment: PaymentSettings };

const DEFAULTS: Stored = {
  payment: PaymentSettingsSchema.parse({}),
};

function dataPath(): string {
  return `${process.cwd()}/.data/payment_settings.enc`;
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
  return Buffer.concat([Buffer.from("RPAY1"), iv, tag, ciphertext]);
}

function decryptJson(payload: Buffer, key: Buffer): unknown {
  const magic = payload.subarray(0, 5).toString("utf8");
  if (magic !== "RPAY1") throw new Error("invalid format");
  const iv = payload.subarray(5, 17);
  const tag = payload.subarray(17, 33);
  const ciphertext = payload.subarray(33);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getCache(): { stored: Stored } {
  const g = globalThis as unknown as { __roboPaymentSettings?: { stored: Stored } };
  if (!g.__roboPaymentSettings) g.__roboPaymentSettings = { stored: DEFAULTS };
  return g.__roboPaymentSettings;
}

export async function getPaymentSettings(): Promise<Stored> {
  const cache = getCache();
  const key = normalizeKey();
  if (!key) return cache.stored;

  try {
    const buf = await readFile(dataPath());
    const parsed = decryptJson(buf, key);
    const stored: Stored = {
      payment: PaymentSettingsSchema.parse(
        isRecord(parsed) && "payment" in parsed ? parsed.payment : {}
      ),
    };
    cache.stored = stored;
    return stored;
  } catch {
    return cache.stored;
  }
}

export async function savePaymentSettings(
  input: Partial<PaymentSettings>
): Promise<{ stored: Stored; persisted: boolean }> {
  const cache = getCache();
  const current = await getPaymentSettings();
  const merged = PaymentSettingsSchema.parse({ ...current.payment, ...input });
  const stored: Stored = { payment: merged };
  cache.stored = stored;

  const key = normalizeKey();
  if (!key) return { stored, persisted: false };

  await mkdir(`${process.cwd()}/.data`, { recursive: true });
  await writeFile(dataPath(), encryptJson(stored, key));
  return { stored, persisted: true };
}

// Check if bypass is enabled: env var takes priority over stored config
export async function isBypassEnabled(): Promise<boolean> {
  if (process.env.PAYMENT_BYPASS_ENABLED === "true") return true;
  if (process.env.PAYMENT_BYPASS_ENABLED === "false") return false;
  const { payment } = await getPaymentSettings();
  return payment.bypassEnabled;
}
