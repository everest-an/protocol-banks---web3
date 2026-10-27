# @everestan/protocolbanks-sdk

Agent execution, payments and invoicing for Protocol Banks.

```bash
npm install @everestan/protocolbanks-sdk
```

## Agent API

One API key, one policy the server enforces (operations, per-call cap, daily
cap, coin allowlist). `order` executes through the account's Hyperliquid agent
wallet (trading-only rights); `pay`, `swap` and `invoice` return something the
agent signs itself — the platform holds no keys.

```ts
import { ProtocolBanks } from "@everestan/protocolbanks-sdk"

const pb = new ProtocolBanks({ apiKey: process.env.PB_KEY! })

const state = await pb.agent.state() // mode, equity, positions, policy
const order = await pb.agent.order({ coin: "BTC", side: "long", sizeUsd: 20 })

// Refusals are returned with the HTTP status — they are not exceptions.
if (!order.ok) console.log(order.status, order.error) // 403 policy · 409 guard
```

```ts
await pb.agent.pay({ to: "0x…", amountUsd: 25, token: "USDC", chain: "base" })
await pb.agent.swap({ from: { symbol: "USDC", blockchain: "base" }, to: { symbol: "ETH", blockchain: "base" }, amount: "25", amountUsd: 25 })
const invoice = await pb.agent.invoice({ to: "0x…", amount: 25, description: "agent work" })
await pb.agent.invoiceStatus(invoice.invoice!.invoiceId, "sig-from-paymentLink")
```

- Reference: https://github.com/everest-an/protocol-banks---web3/blob/main/docs/AGENT_API.md
- Contract: https://protocolbanks.com/api/agent.openapi.json
- Tool manifest: `@everestan/protocolbanks-agent-tools`

## Payments

`pb.paymentLinks`, `pb.invoices`, `pb.checkout`, `pb.webhooks` and
`pb.embed()` cover the payment surfaces. See the docs above for the contracts.

## License

GPL-3.0-only.
