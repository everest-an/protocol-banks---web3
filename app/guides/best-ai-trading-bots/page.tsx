import type { Metadata } from "next"
import { GuideArticle } from "@/components/guides/guide-article"

export const metadata: Metadata = {
  title: "Best AI Trading Bots 2026: Non-Custodial Agent Controls",
  description:
    "How to evaluate AI trading bots and agent platforms: custody, withdrawal rights, server-enforced caps, audit and venue support. No return rankings.",
  alternates: { canonical: "https://www.protocolbanks.com/guides/best-ai-trading-bots" },
  openGraph: {
    title: "Best AI Trading Bots 2026: Non-Custodial Agent Controls",
    description:
      "The evaluation framework for agent trading: who can move funds, what the server enforces, and what is actually logged.",
  },
}

const SECTIONS = [
  {
    heading: "“Best” depends on who is liable",
    paragraphs: [
      "A trading bot is not a single product. It is a model, a strategy, a wallet and an execution path. The question that matters for an agent platform is: if the model is wrong, who can move the money, and what stops it?",
      "That is why a return ranking is the wrong comparison. A high-return account with withdrawal rights is a different risk object from a lower-return account behind a trading-only wallet and a server-enforced cap.",
    ],
  },
  {
    heading: "The evaluation checklist",
    paragraphs: [
      "Use the same checklist for any bot, framework or agent platform. The answers should be in the documentation, not in a sales call.",
    ],
    bullets: [
      "Custody: does the platform hold the funds, or does the owner?",
      "Withdrawal rights: can the agent withdraw, or only trade?",
      "Policy: are ops, per-call cap, daily cap and allowlist enforced server-side?",
      "Audit: is every call, fill and refusal recorded and exportable?",
      "Venue: which markets, and what happens during a venue outage?",
      "Integration: API, SDK, MCP, or a human-only UI?",
      "Revocation: can the owner stop the agent instantly?",
    ],
  },
  {
    heading: "Where Protocol Bank fits",
    paragraphs: [
      "Protocol Bank is the control layer, not a ranked strategy. It gives each agent a scoped key and a policy, a trading-only Hyperliquid wallet and receipts. The cockpit is a demo; the Agent API is the product.",
      "If a bot cannot answer the checklist above, a higher historical return does not make it safer. If it can, the return is still the strategy's problem — not the control layer's promise.",
    ],
  },
  {
    heading: "A note on comparisons",
    paragraphs: [
      "We do not publish a “best bots” ranking, and we do not use our own strategy's PnL as proof. A list that ranks by returns is an advertisement, not due diligence. Compare the controls first, then the signal.",
    ],
  },
]

const FAQ = [
  {
    q: "What is the best AI trading bot in 2026?",
    a: "There is no single best bot. Compare custody, withdrawal rights, server-enforced caps, audit, venue support, integration and revocation. A return ranking alone is not due diligence.",
  },
  {
    q: "Is a non-custodial bot safer?",
    a: "Non-custody removes the platform's ability to move your funds, but the strategy can still lose the budget. Trading-only permissions and server caps bound the loss; they do not make trading risk-free.",
  },
  {
    q: "Does Protocol Bank rank other bots?",
    a: "No. We publish the evaluation framework and our own control layer. We do not sell or rank returns.",
  },
]

export default function Page() {
  return (
    <GuideArticle
      title="Best AI Trading Bots 2026: What Actually Matters"
      lead="Rank bots by who can move the money and what the server enforces — not by a screenshot of returns. This is the checklist an agent platform should apply before it gives an agent a wallet."
      sections={SECTIONS}
      faq={FAQ}
    />
  )
}
