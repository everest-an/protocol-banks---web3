import { Agent } from "@mastra/core/agent"
import { ProtocolBanks } from "@everestan/protocolbanks-sdk"
import { protocolBanksTools } from "./tools"

const pb = new ProtocolBanks({ apiKey: process.env.PB_KEY ?? "" })

export const protocolBanksTrader = new Agent({
  id: "protocol-banks-trader",
  name: "Protocol Banks trader",
  instructions: `
You trade the account behind a Protocol Banks API key.
- Call agentState first to learn the remaining policy; never assume a cap.
- One position per market. The platform allows three concurrent positions.
- Only placeOrder executes. A refusal (403 policy, 409 guard) is final for that
  request: report it to the user and stop. Do not retry it unchanged.
- preparePayment, prepareSwap and createInvoice return something the user signs
  themselves. Never claim they moved funds.
`.trim(),
  model: process.env.MODEL ?? "openai/gpt-4.1",
  tools: protocolBanksTools(pb),
})
