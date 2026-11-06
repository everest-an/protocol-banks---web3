import type { Metadata } from "next"
import { GuideArticle } from "@/components/guides/guide-article"

export const metadata: Metadata = {
  title: "What is Hyperliquid? The Venue Behind Agent Trading",
  description:
    "Hyperliquid explained for agent builders: a Layer 1 for perpetual futures, on-chain order book, agent wallets with trading-only permissions and why it is the first execution adapter.",
  alternates: { canonical: "https://protocolbanks.com/guides/what-is-hyperliquid" },
  openGraph: {
    title: "What is Hyperliquid? The Venue Behind Agent Trading",
    description:
      "Perpetual futures, an on-chain order book and agent wallets — the venue an AI trading agent can use without custody.",
  },
}

const SECTIONS = [
  {
    heading: "The short version",
    paragraphs: [
      "Hyperliquid is a Layer 1 blockchain built for perpetual futures. Orders live in an on-chain order book; the venue handles matching, funding and settlement. For an agent, the key feature is the agent wallet: an owner-approved wallet with trading rights only.",
      "It is the first execution adapter in Protocol Bank because the trading-only primitive matches the product: an agent can trade a budget without a withdrawal path.",
    ],
  },
  {
    heading: "What an agent can do there",
    paragraphs: [
      "Through the Agent API, an agent reads account state and places one order per market. The platform risk envelope applies position sizing, leverage, stop-loss/take-profit and daily breakers before the order reaches Hyperliquid.",
      "The agent does not need the owner's private key. The owner approves the agent wallet separately and can revoke it.",
    ],
  },
  {
    heading: "Risks to understand",
    paragraphs: [
      "Perpetual futures are leveraged. Funding, liquidation, slippage and gaps can lose the budget; a stop-loss is not a guarantee. A venue outage can make trading unavailable, although the owner's withdrawal path remains independent.",
      "Hyperliquid is one venue. The control layer is designed to add adapters later, but today the trading path is Hyperliquid-specific.",
    ],
  },
  {
    heading: "How to start",
    paragraphs: [
      "Create an Agent API key, keep the read-only policy, and use the sandbox against real Hyperliquid market data. When the integration is ready, approve the trading-only wallet and go live with a small budget.",
    ],
  },
]

const FAQ = [
  {
    q: "Is Hyperliquid a DEX?",
    a: "It is a Layer 1 for perpetual futures with an on-chain order book. Trades settle on Hyperliquid, and the owner keeps custody of the account.",
  },
  {
    q: "Can an agent withdraw from Hyperliquid?",
    a: "Not with a trading-only agent wallet. The wallet can place and cancel orders; withdrawals require the owner's own signature.",
  },
  {
    q: "Does Protocol Bank support other venues?",
    a: "Hyperliquid is the first trading adapter. The control layer is designed for more venues, but the current trading path is Hyperliquid.",
  },
]

export default function Page() {
  return (
    <GuideArticle
      title="What is Hyperliquid? The Venue Behind Agent Trading"
      lead="A performant perp venue with agent wallets. This is what an AI trading agent actually connects to, and why the trading-only boundary is the reason it is the first adapter."
      sections={SECTIONS}
      faq={FAQ}
    />
  )
}
