import { z } from "zod";
import { loadAdminSettings, type AiSettings, type ProviderPoolEntry } from "./adminSettings";

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

type CallResult = { ok: boolean; text: string; provider: string; model: string; error?: string };

function envKeyForProvider(provider: string): string {
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY ?? "";
  if (provider === "openai") return process.env.OPENAI_API_KEY ?? "";
  if (provider === "gemini") return process.env.GEMINI_API_KEY ?? "";
  if (provider === "deepseek") return process.env.DEEPSEEK_API_KEY ?? "";
  if (provider === "moonshot") return process.env.MOONSHOT_API_KEY ?? "";
  return "";
}

function resolveApiKey(provider: string, explicitKey: string | null | undefined, cfg: AiSettings): string {
  if (explicitKey?.trim()) return explicitKey.trim();
  // Same provider as primary → reuse primary's key
  if (provider === cfg.provider && cfg.apiKey?.trim()) return cfg.apiKey.trim();
  return envKeyForProvider(provider);
}

function resolvePoolEntryApiKey(entry: ProviderPoolEntry, cfg: AiSettings): string {
  return resolveApiKey(entry.provider, entry.apiKey, cfg);
}

async function dispatchCall(
  provider: string,
  model: string,
  apiKey: string,
  baseUrl: string | null | undefined,
  messages: LlmMessage[],
  responseFormat: "json" | "text",
  cfg: AiSettings,
): Promise<CallResult> {
  if (provider === "anthropic") {
    return callAnthropicMessages({ messages, responseFormat, model, apiKey, cfg });
  }
  return callOpenAiCompatible({
    messages, responseFormat, model, apiKey, provider,
    cfg: { ...cfg, baseUrl: baseUrl ?? null },
  });
}

async function callPoolCascade(
  entries: { provider: string; model: string; apiKey: string; baseUrl?: string | null }[],
  messages: LlmMessage[],
  responseFormat: "json" | "text",
  cfg: AiSettings,
): Promise<CallResult> {
  let last: CallResult = { ok: false, text: "", provider: "pool", model: "cascade", error: "empty pool" };
  for (const e of entries) {
    last = await dispatchCall(e.provider, e.model, e.apiKey, e.baseUrl, messages, responseFormat, cfg);
    if (last.ok) return last;
  }
  return last;
}

async function callPoolRace(
  entries: { provider: string; model: string; apiKey: string; baseUrl?: string | null }[],
  messages: LlmMessage[],
  responseFormat: "json" | "text",
  cfg: AiSettings,
): Promise<CallResult> {
  const promises = entries.map((e) =>
    dispatchCall(e.provider, e.model, e.apiKey, e.baseUrl, messages, responseFormat, cfg).then((r) => {
      if (r.ok) return r;
      return Promise.reject(new Error(r.error ?? "failed"));
    }),
  );
  try {
    return await Promise.any(promises);
  } catch {
    const last = entries[entries.length - 1];
    return { ok: false, text: "", provider: last?.provider ?? "pool", model: last?.model ?? "race", error: "All pool providers failed" };
  }
}

export async function callConfiguredLlm(input: {
  messages: LlmMessage[];
  responseFormat: "json" | "text";
  modelOverride?: string;
}): Promise<CallResult> {
  const { stored } = await loadAdminSettings();
  const cfg = stored.ai;
  const requestedModel = input.modelOverride?.trim() || cfg.model;

  if (!cfg.enabled) {
    return { ok: false, text: "", provider: cfg.provider, model: requestedModel, error: "AI disabled" };
  }

  const primaryApiKey = resolveApiKey(cfg.provider, cfg.apiKey, cfg);
  if (!primaryApiKey) {
    return { ok: false, text: "", provider: cfg.provider, model: requestedModel, error: "No API key" };
  }

  const strategy = cfg.poolStrategy ?? "off";
  const poolEntries = (cfg.providerPool ?? [])
    .map((e) => ({
      provider: e.provider,
      model: e.model,
      apiKey: resolvePoolEntryApiKey(e, cfg),
      baseUrl: e.baseUrl ?? defaultBaseUrl(e.provider),
    }))
    .filter((e) => Boolean(e.apiKey));

  if (strategy !== "off" && poolEntries.length > 0) {
    const primary = { provider: cfg.provider, model: requestedModel, apiKey: primaryApiKey, baseUrl: cfg.baseUrl };
    const all = [primary, ...poolEntries];
    if (strategy === "race") return callPoolRace(all, input.messages, input.responseFormat, cfg);
    return callPoolCascade(all, input.messages, input.responseFormat, cfg);
  }

  // Single provider (no pool)
  return dispatchCall(cfg.provider, requestedModel, primaryApiKey, cfg.baseUrl, input.messages, input.responseFormat, cfg);
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
  provider: string;
  cfg: { maxOutputTokens: number; temperature: number; timeoutMs: number; baseUrl?: string | null };
}): Promise<{ ok: boolean; text: string; provider: string; model: string; error?: string }> {
  const { messages, responseFormat, model, apiKey, cfg, provider } = input;

  const baseUrl = (cfg.baseUrl ?? defaultBaseUrl(provider)).replace(/\/$/, "");
  const url = `${baseUrl}/chat/completions`;
  const perCallTimeout = cfg.timeoutMs ?? 60000;

  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const headers =
    provider === "openrouter"
      ? {
          ...baseHeaders,
          "HTTP-Referer": process.env.APP_URL ?? "http://localhost",
          "X-Title": "ROBO Intake",
        }
      : baseHeaders;

  const MAX_ATTEMPTS = 3;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), perCallTimeout);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(
          buildOpenAiBody({ model, messages, responseFormat, cfg, useResponseFormat: responseFormat === "json" })
        ),
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
        return { ok: false, text: "", provider, model, error: `HTTP 429: ${errBody.slice(0, 300)}` };
      }

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");

        // Some models (e.g. Kimi k2) only accept temperature=1 — retry with that value.
        if (res.status === 400 && errBody.toLowerCase().includes("temperature")) {
          const retryRes = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(
              buildOpenAiBody({ model, messages, responseFormat, cfg: { ...cfg, temperature: 1 }, useResponseFormat: responseFormat === "json" })
            ),
            signal: controller.signal,
          });
          if (retryRes.ok) {
            const retryJson = (await retryRes.json()) as unknown;
            const retryParsed = OpenAiResponseSchema.safeParse(retryJson);
            if (retryParsed.success) {
              return { ok: true, text: retryParsed.data.choices[0].message.content, provider, model };
            }
            return { ok: false, text: "", provider, model, error: `Unexpected response shape after temperature retry: ${JSON.stringify(retryJson).slice(0, 200)}` };
          }
          const retryErr = await retryRes.text().catch(() => "");
          return { ok: false, text: "", provider, model, error: `HTTP ${res.status}: ${errBody.slice(0, 200)} | temp_retry ${retryRes.status}: ${retryErr.slice(0, 200)}` };
        }

        // JSON response_format rejected by some models — retry without it.
        if (responseFormat === "json" && (res.status === 400 || res.status === 422)) {
          const retryRes = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(
              buildOpenAiBody({
                model,
                messages: withJsonOnlyInstruction(messages),
                responseFormat,
                cfg,
                useResponseFormat: false,
              })
            ),
            signal: controller.signal,
          });
          if (retryRes.ok) {
            const retryJson = (await retryRes.json()) as unknown;
            const retryParsed = OpenAiResponseSchema.safeParse(retryJson);
            if (retryParsed.success) {
              return { ok: true, text: retryParsed.data.choices[0].message.content, provider, model };
            }
            return { ok: false, text: "", provider, model, error: `Unexpected response shape: ${JSON.stringify(retryJson).slice(0, 200)}` };
          }
          const retryErr = await retryRes.text().catch(() => "");
          return { ok: false, text: "", provider, model, error: `HTTP ${res.status}: ${errBody.slice(0, 200)} | retry: ${retryRes.status}: ${retryErr.slice(0, 200)}` };
        }

        return { ok: false, text: "", provider, model, error: `HTTP ${res.status}: ${errBody.slice(0, 300)}` };
      }

      const json = (await res.json()) as unknown;
      const parsed = OpenAiResponseSchema.safeParse(json);
      if (!parsed.success) {
        return { ok: false, text: "", provider, model, error: `Unexpected response shape: ${JSON.stringify(json).slice(0, 200)}` };
      }
      return { ok: true, text: parsed.data.choices[0].message.content, provider, model };

    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_ATTEMPTS && !lastError.toLowerCase().includes("abort")) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      }
      return { ok: false, text: "", provider, model, error: lastError };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, text: "", provider, model, error: lastError };
}

function defaultBaseUrl(provider: string): string {
  if (provider === "openai") return "https://api.openai.com/v1";
  if (provider === "gemini") return "https://generativelanguage.googleapis.com/v1beta/openai";
  if (provider === "deepseek") return "https://api.deepseek.com/v1";
  if (provider === "moonshot") return "https://api.moonshot.cn/v1";
  return "https://openrouter.ai/api/v1";
}

function buildOpenAiBody(input: {
  model: string;
  messages: LlmMessage[];
  responseFormat: "json" | "text";
  cfg: { maxOutputTokens: number; temperature: number };
  useResponseFormat: boolean;
}) {
  return {
    model: input.model,
    messages: input.messages,
    temperature: input.cfg.temperature,
    max_tokens: input.cfg.maxOutputTokens,
    ...(input.responseFormat === "json" && input.useResponseFormat ? { response_format: { type: "json_object" } } : {}),
  };
}

function withJsonOnlyInstruction(messages: LlmMessage[]): LlmMessage[] {
  const instruction = "IMPORTANT: Your entire response must be valid JSON only. No markdown, no prose, no code fences — raw JSON object only.";
  const idx = messages.findIndex((m) => m.role === "system");
  if (idx >= 0) {
    const next = [...messages];
    next[idx] = { ...next[idx], content: `${next[idx].content}\n\n${instruction}`.trim() };
    return next;
  }
  return [{ role: "system", content: instruction }, ...messages];
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
