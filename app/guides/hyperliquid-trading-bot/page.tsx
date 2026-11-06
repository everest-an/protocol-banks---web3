import type { Metadata } from "next"
import { GuideArticle } from "@/components/guides/guide-article"

export const metadata: Metadata = {
  title: "Hyperliquid Trading Bot: Non-Custodial Agent Execution",
  description:
    "How to build a Hyperliquid trading bot with the Agent API: approveAgent trading-only rights, server-enforced caps, and audit. Bring your own strategy.",
  alternates: { canonical: "https://protocolbanks.com/guides/hyperliquid-trading-bot" },
  openGraph: {
    title: "Hyperliquid Trading Bot: Non-Custodial Agent Execution",
    description:
      "The builder's flow: agent wallet approval, scoped API key, policy caps and receipts — without custody.",
  },
}

const SECTIONS = [
  {
    heading: "Why Hyperliquid for an agent",
    paragraphs: [
      "Hyperliquid is a Layer 1 for perpetual futures with an on-chain order book and deep liquidity. For an agent, the important primitive is the agent wallet: the account owner can approve a separate wallet with trading rights only, via EIP-712 approveAgent.",
      "That means the trading bot does not need the owner's key. It can place and cancel orders, and it cannot withdraw. The funded trading budget is the maximum the agent can lose through trading.",
    ],
  },
  {
    heading: "The trading-only wallet",
    paragraphs: [
      "approveAgent separates trading from withdrawal at the wallet boundary. A prompt injection, a bug or a loop can still trade badly, but it cannot move the budget out. The owner can revoke the wallet at any time.",
      "Protocol Bank adds a second boundary in front of the wallet: the key policy. The agent's API key carries the allowed operations, per-call cap, daily cap and coin allowlist; a violation is refused before the order reaches Hyperliquid.",
    ],
  },
  {
    heading: "Build flow",
    paragraphs: [
      "Create the key and keep the read-only policy until the integration is ready. Test in the sandbox with real market data. When the strategy behaves, the owner approves the agent wallet with trading-only rights; the same endpoints go live.",
    ],
    bullets: [
      "GET /api/v1/agent/state for account, positions, activity and policy.",
      "POST /api/v1/agent/orders with coin, side, sizeUsd and a reason.",
      "The platform risk envelope applies position sizing, stop-loss/take-profit and daily breakers.",
      "An uncertain submission is reported as 409 and reconciled by client-order-id; it is never blindly retried.",
    ],
  },
  {
    heading: "Failure modes to plan for",
    paragraphs: [
      "A venue outage affects trading, not the owner's withdrawal ability. A model error is bounded by the key cap and the risk envelope. An uncertain order is an ops problem: surface it to the owner, do not retry it. A strategy that loses is still a strategy problem; the control layer does not make it profitable.",
    ],
  },
]

const FAQ = [
  {
    q: "Does a Hyperliquid agent wallet need the owner's private key?",
    a: "No. The owner approves a separate agent wallet with trading-only permissions (approveAgent). The bot uses that wallet; withdrawals still require the owner.",
  },
  {
    q: "Can a Hyperliquid bot withdraw funds?",
    a: "Not a trading-only agent wallet. It can place and cancel orders; it cannot withdraw. The owner can revoke it at any time.",
  },
  {
    q: "How do I build a Hyperliquid bot with Protocol Bank?",
    a: "Create an API key and policy, test in the sandbox, approve the trading-only Hyperliquid wallet, then call the same Agent API endpoints live. The SDK, MCP server and OpenAPI contract are available for integration.",
  },
]

export default function Page() {
  return (
    <GuideArticle
      title="Hyperliquid Trading Bot: Non-Custodial Agent Execution"
      lead="A Hyperliquid bot needs two things: a wallet that can trade and a boundary that stops it from doing anything else. approveAgent provides the first; the Agent API policy provides the second."
      sections={SECTIONS}
      faq={FAQ}
    />
  )
}
