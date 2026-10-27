/**
 * elizaOS plugin for the Protocol Banks Agent API (v1.x interface).
 *
 * The provider injects the account and the key's remaining policy into the
 * agent's context; the actions read state and place orders. Order arguments
 * must arrive as structured `message.content` fields (`coin`, `side`,
 * `sizeUsd`) — this plugin deliberately does not parse amounts out of prose.
 *
 *   PB_KEY=pb_… elizaos dev
 */
import type { Action, IAgentRuntime, Memory, Plugin, Provider, State } from "@elizaos/core"
import { ProtocolBanks } from "@everestan/protocolbanks-sdk"

function client(): ProtocolBanks {
  const apiKey = process.env.PB_KEY
  if (!apiKey) throw new Error("PB_KEY is not set")
  return new ProtocolBanks({ apiKey })
}

const POLICY_NOTE =
  "The server enforces the key's policy; a 403 (policy) or 409 (guard) is final. Do not retry it unchanged."

const stateProvider: Provider = {
  name: "PROTOCOL_BANKS_STATE",
  description: "Trading account, open positions and the API key's remaining policy from Protocol Banks.",
  dynamic: true,
  get: async () => {
    try {
      const state = await client().agent.state()
      return {
        text: `Protocol Banks account: mode=${state.mode}, equity=$${state.account?.totalEquity ?? "?"}, positions=${state.positions?.length ?? 0}, policy=${JSON.stringify(state.policy ?? {})}. ${POLICY_NOTE}`,
        data: {
          mode: state.mode,
          equity: state.account?.totalEquity,
          positions: state.positions ?? [],
          policy: state.policy,
        },
      }
    } catch (error) {
      return { text: `Protocol Banks is not configured: ${error instanceof Error ? error.message : String(error)}` }
    }
  },
}

const stateAction: Action = {
  name: "PROTOCOL_BANKS_STATE",
  description: "Read the Protocol Banks account: mode, equity, open positions and the key's remaining policy.",
  similes: ["TRADING_STATE", "CHECK_TRADING_AGENT"],
  examples: [],
  validate: async () => Boolean(process.env.PB_KEY),
  handler: async () => {
    const state = await client().agent.state()
    if (state.status !== 200) {
      return { success: false, text: `Refused (${state.status}): ${state.error ?? "no message"}` }
    }
    return {
      success: true,
      text: `mode=${state.mode} equity=$${state.account?.totalEquity} positions=${state.positions?.length ?? 0} policy=${JSON.stringify(state.policy ?? {})}`,
    }
  },
}

const orderAction: Action = {
  name: "PROTOCOL_BANKS_ORDER",
  description: `Place one perpetual order through the Protocol Banks agent wallet (trading-only, cannot withdraw). ${POLICY_NOTE}`,
  similes: ["PLACE_TRADE", "OPEN_POSITION"],
  examples: [],
  validate: async () => Boolean(process.env.PB_KEY),
  handler: async (_runtime: IAgentRuntime, message: Memory, _state?: State) => {
    // Structured fields only: the host (or the model) must supply them.
    const content = (message.content ?? {}) as Record<string, unknown>
    const coin = typeof content.coin === "string" ? content.coin : ""
    const side = content.side === "long" || content.side === "short" ? content.side : null
    const sizeUsd = typeof content.sizeUsd === "number" ? content.sizeUsd : Number.NaN

    if (!coin || !side || !Number.isFinite(sizeUsd) || sizeUsd <= 0) {
      return {
        success: false,
        text: `Missing structured arguments. Provide content { coin: "BTC", side: "long"|"short", sizeUsd: number } — amounts are never parsed from prose.`,
      }
    }

    const result = await client().agent.order({
      coin,
      side,
      sizeUsd,
      reason: typeof content.reason === "string" ? content.reason : undefined,
    })

    if (!result.ok) {
      return { success: false, text: `Refused (${result.status}): ${result.error ?? "no message"}` }
    }
    return {
      success: true,
      text: `Filled ${result.fill?.coin} ${result.fill?.side} at $${result.fill?.avgPx} (notional $${result.fill?.notional}); remaining today $${result.remainingTodayUsd}.`,
    }
  },
}

export const protocolBanksPlugin: Plugin = {
  name: "protocol-banks",
  description:
    "Execution + policy for agents: trade through a trading-only wallet with a server-enforced cap, and read the account it belongs to.",
  providers: [stateProvider],
  actions: [stateAction, orderAction],
}

export default protocolBanksPlugin
