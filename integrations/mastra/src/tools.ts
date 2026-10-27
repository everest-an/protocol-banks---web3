/**
 * Mastra tools for the Protocol Banks Agent API.
 *
 * createTool's `execute(inputData, context)` receives the validated input as
 * its first argument (Mastra 1.x). The server enforces the key's policy, so a
 * refusal comes back as data, not an exception.
 */
import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { ProtocolBanks } from "@everestan/protocolbanks-sdk"

const POLICY_NOTE =
  "The server enforces the API key's policy (allowedOps, per-call cap, daily cap, coin allowlist). A 403 is a policy refusal and a 409 is a platform guard refusal; both are final for the request, so do not retry unchanged."

export function protocolBanksTools(pb: ProtocolBanks) {
  return {
    agentState: createTool({
      id: "agent_state",
      description: `Read the account behind the API key: mode, equity, open positions, activity, and the key's remaining policy. ${POLICY_NOTE}`,
      inputSchema: z.object({}),
      execute: async () => pb.agent.state(),
    }),

    placeOrder: createTool({
      id: "place_order",
      description: `Open one perpetual position on Hyperliquid. This is the only tool that moves money: it executes through the account's agent wallet, which has trading-only rights and can never withdraw. ${POLICY_NOTE} A sizeUsd above the platform position cap is clamped; one above the key's per-call cap is refused.`,
      inputSchema: z.object({
        coin: z.string().describe('Market symbol, e.g. "BTC"'),
        side: z.enum(["long", "short"]),
        sizeUsd: z.number().positive().describe("Order notional in USD"),
        reason: z.string().optional().describe("Signal label stored with the fill"),
      }),
      // The order already happened if this returns; a validation warning must
      // not make the model place it again.
      outputValidation: "warn",
      execute: async ({ coin, side, sizeUsd, reason }) => pb.agent.order({ coin, side, sizeUsd, reason }),
    }),

    preparePayment: createTool({
      id: "prepare_payment",
      description: `Validate a payment against the key's policy and return an intent the agent signs and submits itself. The platform holds no keys and never moves the funds. ${POLICY_NOTE}`,
      inputSchema: z.object({
        to: z.string().describe("EVM (0x…) or base58 Solana address"),
        amountUsd: z.number().positive(),
        token: z.string().optional().describe('Default "USDC"'),
        chain: z.string().optional().describe('Default "base"'),
        memo: z.string().optional(),
      }),
      execute: async ({ to, amountUsd, token, chain, memo }) => pb.agent.pay({ to, amountUsd, token, chain, memo }),
    }),

    prepareSwap: createTool({
      id: "prepare_swap",
      description: `Quote a swap and return the transaction the agent must sign. Quotes are not metered and the platform never executes them. ${POLICY_NOTE}`,
      inputSchema: z.object({
        from: z.object({ symbol: z.string(), blockchain: z.string(), address: z.string().nullable().optional() }),
        to: z.object({ symbol: z.string(), blockchain: z.string(), address: z.string().nullable().optional() }),
        amount: z.string().describe("Amount in token units, as a string"),
        amountUsd: z.number().positive(),
        slippage: z.number().min(0.1).max(5).optional(),
      }),
      execute: async ({ from, to, amount, amountUsd, slippage }) =>
        pb.agent.swap({ from, to, amount, amountUsd, slippage }),
    }),

    createInvoice: createTool({
      id: "create_invoice",
      description: `Create a pending invoice and return a paymentLink to hand the payer. Moves no money; the amount is still checked against the key's policy. ${POLICY_NOTE}`,
      inputSchema: z.object({
        to: z.string().describe("EVM (0x…), TRON (T…) or Solana (base58) payee"),
        amount: z.number().positive(),
        token: z.string().optional(),
        chain: z.string().optional(),
        description: z.string().optional(),
        expiresInHours: z.number().min(1).max(720).optional(),
      }),
      execute: async ({ to, amount, token, chain, description, expiresInHours }) =>
        pb.agent.invoice({ to, amount, token, chain, description, expiresInHours }),
    }),
  }
}
