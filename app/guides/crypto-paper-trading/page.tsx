import type { Metadata } from "next"
import { GuideArticle } from "@/components/guides/guide-article"

export const metadata: Metadata = {
  title: "Crypto Paper Trading: A Sandbox for Agent Builders (2026)",
  description:
    "Paper trading runs the same Agent API against real market data and simulated money. Test the policy, the refusals and the integration before going live.",
  alternates: { canonical: "https://protocolbanks.com/guides/crypto-paper-trading" },
  openGraph: {
    title: "Crypto Paper Trading: A Sandbox for Agent Builders",
    description:
      "The zero-risk path to test an agent: same endpoints, real market data, simulated fills, and a policy you can exercise before funding a live account.",
  },
}

const SECTIONS = [
  {
    heading: "What paper trading is",
    paragraphs: [
      "Paper trading uses real market data and simulated money. The agent scans, decides and “fills” without a live order. For a builder, this is the integration environment: it exercises auth, policy, order payloads, fills and the refusal path without risking a budget.",
      "Protocol Bank's sandbox is the same Agent API. Paper and live share the endpoints; the difference is the account mode and the wallet approval.",
    ],
  },
  {
    heading: "What to test before going live",
    paragraphs: [
      "Do not just watch PnL. Test the parts that only fail under stress.",
    ],
    bullets: [
      "A valid order below the cap returns a fill and remainingTodayUsd.",
      "A size above the key cap returns 403 before the venue; the agent cannot widen the policy.",
      "A second order on a held market returns 409; the refusal is final.",
      "A daily breaker trip changes the account state; resume/stop controls behave as expected.",
      "The usage log and receipt match the calls the agent made.",
    ],
  },
  {
    heading: "Going live without changing the code",
    paragraphs: [
      "When the integration behaves, the owner approves the Hyperliquid agent wallet with trading-only rights. The same endpoints now execute live. The wallet can place and cancel orders, never withdraw; the policy still caps every call.",
      "Keep the first live budget small. Paper trading is not a promise of live results: fills, funding and slippage differ, and the strategy can still lose.",
    ],
  },
  {
    heading: "Paper trading for agent platforms",
    paragraphs: [
      "For a platform, the sandbox is also the demo: each new agent can start in paper mode, show the owner the policy and the refusal path, then graduate to live when the owner approves the wallet. No separate environment to maintain.",
    ],
  },
]

const FAQ = [
  {
    q: "Is paper trading the same as live trading?",
    a: "No. It uses real market data and simulated fills; funding, slippage and live venue behaviour differ. It is the integration and policy test, not a prediction of returns.",
  },
  {
    q: "Does paper trading need a funded wallet?",
    a: "No. The sandbox account runs with simulated money. You create a key and call the same endpoints; the cockpit is a demo of that account.",
  },
  {
    q: "How do I switch an agent to live?",
    a: "The owner approves a Hyperliquid agent wallet with trading-only rights. The same Agent API calls then execute live, still under the key policy and platform risk envelope.",
  },
]

export default function Page() {
  return (
    <GuideArticle
      title="Crypto Paper Trading: A Sandbox for Agent Builders"
      lead="Use the sandbox to test the policy, the refusals and the integration — not to predict returns. The same Agent API moves to live when the owner approves the trading-only wallet."
      sections={SECTIONS}
      faq={FAQ}
    />
  )
}
