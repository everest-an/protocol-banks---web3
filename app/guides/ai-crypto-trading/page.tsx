import type { Metadata } from "next"
import { GuideArticle } from "@/components/guides/guide-article"

export const metadata: Metadata = {
  title: "AI Crypto Trading: A Builder's Guide to Agent Controls (2026)",
  description:
    "How AI agent trading works for builders: scoped keys, server-enforced caps, trading-only wallets and audit. Build with the Agent API; the cockpit is a demo.",
  alternates: { canonical: "https://protocolbanks.com/guides/ai-crypto-trading" },
  openGraph: {
    title: "AI Crypto Trading: A Builder's Guide to Agent Controls",
    description:
      "The builder's stack for agent trading: one key per agent, policy caps, a trading-only wallet, and receipts. Bring your own strategy.",
  },
}

const SECTIONS = [
  {
    heading: "What “AI crypto trading” actually is",
    paragraphs: [
      "An AI agent does not hold an edge by itself. It reads market data, forms a decision and calls an execution interface. The hard part is not the model call; it is giving the agent a wallet and an API key without letting a hallucination, a prompt injection or a loop drain the account.",
      "That is why agent trading is a stack, not a prompt: the owner wallet, a trading-only agent wallet, a scoped API key, a server-enforced policy and an audit trail. The model decides; the execution layer decides what the model is allowed to do.",
    ],
  },
  {
    heading: "The builder's stack",
    paragraphs: [
      "Protocol Bank gives each agent its own credential. The owner sets the operations (read / trade / pay / swap), a per-call cap, a daily cap and a coin allowlist. A policy violation is refused before the order reaches the venue.",
    ],
    bullets: [
      "Trading-only Hyperliquid agent wallet: it can place and cancel orders, and cannot withdraw.",
      "A key policy the agent cannot widen; the owner edits it in Settings → API Keys.",
      "Paper and live share the same endpoints, so the integration test is the production path.",
      "Every call, fill and refusal is recorded; a receipt closes the loop.",
    ],
  },
  {
    heading: "How to build with it",
    paragraphs: [
      "Create a key, keep the starting read-only policy, and call GET /api/v1/agent/state in the sandbox. Place one order below the cap, then raise the policy only when the integration behaves. When the owner approves the Hyperliquid agent wallet, the same code moves to live; the wallet is still trading-only.",
      "Bring your own strategy. The platform does not sell alpha, a fund or a return; it enforces the limits around whatever signal the agent produces.",
    ],
  },
  {
    heading: "What this guide does not claim",
    paragraphs: [
      "No strategy guarantees profit. Automated trading can lose the entire trading budget, and a backtest is not a promise. The value of the control layer is that the loss is bounded by the budget and the policy the owner chose — not that the strategy wins.",
    ],
  },
]

const FAQ = [
  {
    q: "Can an AI trading agent withdraw my crypto?",
    a: "Not with a trading-only agent wallet. On Hyperliquid the owner approves a wallet with trading rights only (approveAgent); it can place and cancel orders and cannot withdraw. The owner can revoke it.",
  },
  {
    q: "Do I have to give the agent my private key?",
    a: "No. The agent gets an API key scoped to the account and a policy; execution uses the trading-only agent wallet. The platform never holds the owner's keys.",
  },
  {
    q: "How do I test an AI trading agent safely?",
    a: "Start in the sandbox: real market data, simulated money, the same endpoints. Test the policy and the refusal path, then approve the agent wallet and go live with a budget you can lose.",
  },
]

export default function Page() {
  return (
    <GuideArticle
      title="AI Crypto Trading: What Builders Need to Know"
      lead="The model decides. The execution layer decides what the model is allowed to do. Here is the builder's stack for giving an AI agent a trading account without giving it the ability to drain it."
      sections={SECTIONS}
      faq={FAQ}
    />
  )
}
