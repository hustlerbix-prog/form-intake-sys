import { z } from "zod";
import { loadAdminSettings } from "./adminSettings";

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

export async function callConfiguredLlm(input: {
  messages: LlmMessage[];
  responseFormat: "json" | "text";
  modelOverride?: string;
}): Promise<{ ok: boolean; text: string; provider: string; model: string; error?: string }> {
  const { stored } = await loadAdminSettings();
  const cfg = stored.ai;
  const requestedModel = input.modelOverride?.trim() || cfg.model;

  if (!cfg.enabled) {
    return { ok: false, text: "", provider: cfg.provider, model: requestedModel, error: "AI disabled" };
  }

  // API key: prefer stored key, fall back to env var for the configured provider
  const apiKey =
    cfg.apiKey?.trim() ||
    (cfg.provider === "anthropic" ? (process.env.ANTHROPIC_API_KEY ?? "") : "");

  if (!apiKey) {
    return { ok: false, text: "", provider: cfg.provider, model: requestedModel, error: "No API key" };
  }

  if (cfg.provider === "anthropic") {
    return callAnthropicMessages({ messages: input.messages, responseFormat: input.responseFormat, model: requestedModel, apiKey, cfg });
  }

  return callOpenAiCompatible({ messages: input.messages, responseFormat: input.responseFormat, model: requestedModel, apiKey, cfg });
}

/* ── Anthropic Messages API ── */

async function callAnthropicMessages(input: {
  messages: LlmMessage[];
  responseFormat: "json" | "text";
  model: string;
  apiKey: string;
  cfg: { maxOutputTokens: number; temperature: number; timeoutMs: number };
}): Promise<{ ok: boolean; text: string; provider: string; model: string; error?: string }> {
  const { messages, responseFormat, model, apiKey, cfg } = input;

  // Extract system message — Anthropic puts it at top level
  const systemMsg = messages.find((m) => m.role === "system");
  const userMessages = messages.filter((m) => m.role !== "system");

  const systemText = [
    systemMsg?.content ?? "",
    responseFormat === "json"
      ? "\n\nIMPORTANT: Your entire response must be valid JSON only. No markdown, no prose, no code fences — raw JSON object only."
      : "",
  ]
    .join("")
    .trim();

  const body = {
    model,
    max_tokens: cfg.maxOutputTokens,
    temperature: cfg.temperature,
    ...(systemText ? { system: systemText } : {}),
    messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
  };

  const MAX_ATTEMPTS = 3;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.status === 529 || res.status === 529) {
        // Anthropic overload
        const wait = attempt * 5000;
        lastError = `HTTP ${res.status} (overloaded) — waiting ${wait}ms`;
        if (attempt < MAX_ATTEMPTS) { await new Promise((r) => setTimeout(r, wait)); continue; }
      }

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? 0);
        const wait = retryAfter > 0 ? retryAfter * 1000 : attempt * 3000;
        lastError = `HTTP 429 (rate limited) — waiting ${wait}ms`;
        if (attempt < MAX_ATTEMPTS) { await new Promise((r) => setTimeout(r, wait)); continue; }
        const errBody = await res.text().catch(() => "");
        return { ok: false, text: "", provider: "anthropic", model, error: `HTTP 429: ${errBody.slice(0, 300)}` };
      }

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return { ok: false, text: "", provider: "anthropic", model, error: `HTTP ${res.status}: ${errBody.slice(0, 300)}` };
      }

      const json = (await res.json()) as unknown;
      const parsed = AnthropicResponseSchema.safeParse(json);
      if (!parsed.success) {
        return { ok: false, text: "", provider: "anthropic", model, error: `Unexpected response: ${JSON.stringify(json).slice(0, 200)}` };
      }

      const textContent = parsed.data.content.find((c) => c.type === "text");
      if (!textContent) {
        return { ok: false, text: "", provider: "anthropic", model, error: "No text content in response" };
      }

      return { ok: true, text: textContent.text, provider: "anthropic", model };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_ATTEMPTS && !lastError.toLowerCase().includes("abort")) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      }
      return { ok: false, text: "", provider: "anthropic", model, error: lastError };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, text: "", provider: "anthropic", model, error: lastError };
}

/* ── OpenAI-compatible (OpenRouter, etc.) ── */

async function callOpenAiCompatible(input: {
  messages: LlmMessage[];
  responseFormat: "json" | "text";
  model: string;
  apiKey: string;
  cfg: { maxOutputTokens: number; temperature: number; timeoutMs: number; baseUrl?: string | null };
}): Promise<{ ok: boolean; text: string; provider: string; model: string; error?: string }> {
  const { messages, responseFormat, model, apiKey, cfg } = input;

  const baseUrl = (cfg.baseUrl ?? "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const url = `${baseUrl}/chat/completions`;
  const perCallTimeout = Math.min(cfg.timeoutMs ?? 60000, 60000);

  const body = {
    model,
    messages,
    temperature: cfg.temperature,
    max_tokens: cfg.maxOutputTokens,
    ...(responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": process.env.APP_URL ?? "http://localhost",
    "X-Title": "ROBO Intake",
  };

  const MAX_ATTEMPTS = 3;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), perCallTimeout);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? 0);
        const wait = retryAfter > 0 ? retryAfter * 1000 : attempt * 3000;
        lastError = `HTTP 429 (rate limited) — waiting ${wait}ms before retry ${attempt}/${MAX_ATTEMPTS}`;
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        const errBody = await res.text().catch(() => "");
        return { ok: false, text: "", provider: "openrouter", model, error: `HTTP 429: ${errBody.slice(0, 300)}` };
      }

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return { ok: false, text: "", provider: "openrouter", model, error: `HTTP ${res.status}: ${errBody.slice(0, 300)}` };
      }

      const json = (await res.json()) as unknown;
      const parsed = OpenAiResponseSchema.safeParse(json);
      if (!parsed.success) {
        return { ok: false, text: "", provider: "openrouter", model, error: `Unexpected response shape: ${JSON.stringify(json).slice(0, 200)}` };
      }
      return { ok: true, text: parsed.data.choices[0].message.content, provider: "openrouter", model };

    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_ATTEMPTS && !lastError.toLowerCase().includes("abort")) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      }
      return { ok: false, text: "", provider: "openrouter", model, error: lastError };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, text: "", provider: "openrouter", model, error: lastError };
}

/* ── Response schemas ── */

const AnthropicResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.string(),
      text: z.string(),
    })
  ).min(1),
});

const OpenAiResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string() }),
      })
    )
    .min(1),
});
