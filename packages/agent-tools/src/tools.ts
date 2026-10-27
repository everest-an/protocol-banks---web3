/**
 * Framework-agnostic tool manifest for the Protocol Banks Agent API.
 *
 * The server enforces the policy, so these descriptions are written for a model:
 * say what the tool does, what the refund path is, and never suggest retrying a
 * refusal. Each tool returns the API envelope (never throws on 403/409) so the
 * model sees the refusal and stops.
 *
 * Adapt once:
 *   - Vercel AI SDK / LangChain: wrap each definition in your framework's tool().
 *   - OpenAI / Anthropic: pass `toOpenAIFunctions()` / `toAnthropicTools()`.
 *   - MCP hosts: use the hosted MCP server instead (/mcp).
 */
import type { ProtocolBanks } from "@everestan/protocolbanks-sdk"

export interface AgentToolSchema {
  type: "object"
  properties: Record<string, unknown>
  required?: string[]
  additionalProperties?: boolean
}

export interface AgentToolDefinition {
  name: string
  description: string
  /** JSON Schema — accepted by OpenAI functions, Anthropic tools, AI SDK and LangChain. */
  parameters: AgentToolSchema
  execute: (args: Record<string, unknown>) => Promise<unknown>
}

const POLICY_NOTE =
  "The server enforces the key's policy (allowedOps, per-call cap, daily cap, coin allowlist). A 403 is a policy refusal and a 409 is a platform guard refusal; both are final for the request — do not retry unchanged."

export function agentTools(pb: ProtocolBanks): AgentToolDefinition[] {
  return [
    {
      name: "agent_state",
      description:
        "Read the trading account behind the API key: mode (paper or live), equity, open positions, recent activity, and the key's policy with what it still allows today (spentTodayUsd). Call this before trading to learn the caps.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      execute: () => pb.agent.state(),
    },
    {
      name: "place_order",
      description:
        `Open one perpetual position on Hyperliquid. This is the only tool that moves money: it executes through the account's agent wallet, which has trading-only rights and can never withdraw. ${POLICY_NOTE} A sizeUsd above the platform position cap is clamped; one above the key's per-call cap is refused.`,
      parameters: {
        type: "object",
        properties: {
          coin: { type: "string", description: 'Market symbol, e.g. "BTC". Case-insensitive.' },
          side: { type: "string", enum: ["long", "short"] },
          sizeUsd: { type: "number", exclusiveMinimum: 0, description: "Order notional in USD." },
          reason: { type: "string", description: "Signal label stored with the fill (max 120 chars)." },
        },
        required: ["coin", "side", "sizeUsd"],
        additionalProperties: false,
      },
      execute: (args) => pb.agent.order(args as never),
    },
    {
      name: "prepare_payment",
      description:
        `Validate a payment (EVM or Solana destination, token, amount) against the key's policy and return an intent the agent signs and submits itself. The platform holds no keys and never moves the funds. ${POLICY_NOTE}`,
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "EVM address (0x + 40 hex) or base58 Solana address.",
          },
          amountUsd: { type: "number", exclusiveMinimum: 0 },
          token: { type: "string", description: 'Token symbol, default "USDC".' },
          chain: { type: "string", description: 'Chain name, default "base".' },
          memo: { type: "string", description: "Optional memo (max 140 chars)." },
        },
        required: ["to", "amountUsd"],
        additionalProperties: false,
      },
      execute: (args) => pb.agent.pay(args as never),
    },
    {
      name: "prepare_swap",
      description:
        `Quote a swap against the key's policy and return the route plus the transaction the agent must sign. A quote is not metered (nothing is spent) and the platform never executes it. ${POLICY_NOTE}`,
      parameters: {
        type: "object",
        properties: {
          from: {
            type: "object",
            description: 'Source asset, e.g. { "symbol": "USDC", "blockchain": "base" }',
            properties: {
              symbol: { type: "string" },
              blockchain: { type: "string" },
              address: { type: ["string", "null"] },
            },
            required: ["symbol", "blockchain"],
          },
          to: {
            type: "object",
            description: 'Destination asset, e.g. { "symbol": "ETH", "blockchain": "base" }',
            properties: {
              symbol: { type: "string" },
              blockchain: { type: "string" },
              address: { type: ["string", "null"] },
            },
            required: ["symbol", "blockchain"],
          },
          amount: { type: "string", description: "Amount in token units, as a string." },
          amountUsd: { type: "number", exclusiveMinimum: 0, description: "USD value of the swap." },
          slippage: { type: "number", minimum: 0.1, maximum: 5, description: "Percent; clamped to 0.1–5." },
        },
        required: ["from", "to", "amount", "amountUsd"],
        additionalProperties: false,
      },
      execute: (args) => pb.agent.swap(args as never),
    },
    {
      name: "create_invoice",
      description:
        `Create a pending invoice for work performed and return a paymentLink to hand the payer. Moves no money and is not metered; the amount is still checked against the key's policy because an invoice is a payment request. ${POLICY_NOTE}`,
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Payee address: EVM (0x…), TRON (T…) or Solana (base58)." },
          amount: { type: "number", exclusiveMinimum: 0 },
          token: { type: "string", description: 'Token symbol, default "USDC".' },
          chain: { type: "string", description: "Defaults to TRON for a TRON payee, otherwise Ethereum." },
          description: { type: "string", description: "What is being billed (max 200 chars)." },
          expiresInHours: { type: "number", minimum: 1, maximum: 720, description: "Default 24." },
        },
        required: ["to", "amount"],
        additionalProperties: false,
      },
      execute: (args) => pb.agent.invoice(args as never),
    },
  ]
}

/** OpenAI Chat Completions / Responses function-calling format. */
export function toOpenAIFunctions(tools: AgentToolDefinition[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }))
}

/** Anthropic Messages API tool format. */
export function toAnthropicTools(tools: AgentToolDefinition[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }))
}
