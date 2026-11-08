export interface OpenRouterMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface OpenRouterResult {
  provider: "openrouter" | "deepseek"
  content: string
  model: string
  usage: Record<string, unknown> | null
}

const MAX_MESSAGES = 20
const MAX_PROMPT_CHARS = 20_000
const MAX_TOKENS = 2_000

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
    public readonly code = "openrouter_error",
  ) {
    super(message)
    this.name = "OpenRouterError"
  }
}

export function normalizeMessages(input: unknown): OpenRouterMessage[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_MESSAGES) {
    throw new OpenRouterError(`messages must contain 1-${MAX_MESSAGES} items`, 400, "invalid_messages")
  }

  let totalChars = 0
  return input.map((item) => {
    if (!item || typeof item !== "object") {
      throw new OpenRouterError("each message must be an object", 400, "invalid_messages")
    }
    const row = item as { role?: unknown; content?: unknown }
    const role = row.role
    const content = row.content
    if (role !== "system" && role !== "user" && role !== "assistant") {
      throw new OpenRouterError("message role must be system, user or assistant", 400, "invalid_messages")
    }
    if (typeof content !== "string" || !content.trim()) {
      throw new OpenRouterError("message content must be a non-empty string", 400, "invalid_messages")
    }
    totalChars += content.length
    return { role: role as OpenRouterMessage["role"], content }
  }).map((message) => {
    if (totalChars > MAX_PROMPT_CHARS) {
      throw new OpenRouterError(`messages exceed ${MAX_PROMPT_CHARS} characters`, 400, "invalid_messages")
    }
    return message
  })
}

export function normalizeModel(input: unknown): string {
  if (input === undefined || input === null || input === "") {
    return process.env.LLM_DEFAULT_MODEL || "deepseek/deepseek-v4-flash"
  }
  if (typeof input !== "string" || input.includes("..") || !/^[a-zA-Z0-9._:/-]{1,120}$/.test(input)) {
    throw new OpenRouterError("model must be a valid OpenRouter model id", 400, "invalid_model")
  }
  return input
}

export function normalizeMaxTokens(input: unknown): number {
  if (input === undefined) return 800
  const value = Number(input)
  if (!Number.isInteger(value) || value < 1 || value > MAX_TOKENS) {
    throw new OpenRouterError(`max_tokens must be an integer between 1 and ${MAX_TOKENS}`, 400, "invalid_max_tokens")
  }
  return value
}

export function callPriceUsd(): number {
  const value = Number(process.env.AGENT_LLM_PRICE_USD || "0.01")
  return Number.isFinite(value) && value > 0 ? value : 0.01
}

export async function callDeepSeek(params: {
  messages: OpenRouterMessage[]
  maxTokens: number
  temperature?: number
}): Promise<OpenRouterResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new OpenRouterError("DeepSeek fallback is not configured", 503, "provider_not_configured")
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(`${process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.LLM_FALLBACK_MODEL || "deepseek-chat",
        messages: params.messages,
        max_tokens: params.maxTokens,
        temperature: params.temperature ?? 0.2,
      }),
    })

    const payload = await response.json().catch(() => null) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: Record<string, unknown>
      error?: { message?: string }
    } | null

    if (!response.ok) {
      throw new OpenRouterError(payload?.error?.message || `DeepSeek returned HTTP ${response.status}`, response.status === 429 ? 429 : 502, "provider_error")
    }
    const content = payload?.choices?.[0]?.message?.content
    if (typeof content !== "string" || !content) {
      throw new OpenRouterError("DeepSeek returned an empty completion", 502, "empty_completion")
    }
    return {
      provider: "deepseek",
      content,
      model: process.env.LLM_FALLBACK_MODEL || "deepseek-chat",
      usage: payload?.usage ?? null,
    }
  } catch (error) {
    if (error instanceof OpenRouterError) throw error
    if (error instanceof Error && error.name === "AbortError") throw new OpenRouterError("DeepSeek request timed out", 504, "provider_timeout")
    throw new OpenRouterError(error instanceof Error ? error.message : "DeepSeek request failed", 502, "provider_error")
  } finally {
    clearTimeout(timer)
  }
}

export async function callOpenRouter(params: {
  model: string
  messages: OpenRouterMessage[]
  maxTokens: number
  temperature?: number
}): Promise<OpenRouterResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new OpenRouterError("OpenRouter is not configured on this deployment", 503, "provider_not_configured")
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(`${process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.protocolbanks.com",
        "X-Title": "Protocol Bank Agent Commerce",
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        max_tokens: params.maxTokens,
        temperature: params.temperature ?? 0.2,
      }),
    })

    const payload = await response.json().catch(() => null) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: Record<string, unknown>
      error?: { message?: string }
    } | null

    if (!response.ok) {
      const message = payload?.error?.message || `OpenRouter returned HTTP ${response.status}`
      throw new OpenRouterError(message, response.status === 429 ? 429 : 502, "provider_error")
    }

    const content = payload?.choices?.[0]?.message?.content
    if (typeof content !== "string" || !content) {
      throw new OpenRouterError("OpenRouter returned an empty completion", 502, "empty_completion")
    }

    return { provider: "openrouter", content, model: params.model, usage: payload?.usage ?? null }
  } catch (error) {
    if (error instanceof OpenRouterError) throw error
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenRouterError("OpenRouter request timed out", 504, "provider_timeout")
    }
    throw new OpenRouterError(error instanceof Error ? error.message : "OpenRouter request failed", 502, "provider_error")
  } finally {
    clearTimeout(timer)
  }
}
