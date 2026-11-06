import type { Metadata } from "next"
import { GuideArticle } from "@/components/guides/guide-article"

export const metadata: Metadata = {
  title: "Is AI Trading Safe? Trading-Only Permissions for Agents",
  description:
    "The real threat model for AI trading: model errors, prompt injection, key leaks and venue risk — and the controls that bound them. No strategy is risk-free.",
  alternates: { canonical: "https://protocolbanks.com/guides/is-ai-trading-safe" },
  openGraph: {
    title: "Is AI Trading Safe? Trading-Only Permissions for Agents",
    description:
      "What can go wrong, what the wallet boundary stops, and what the server policy enforces before an order.",
  },
}

const SECTIONS = [
  {
    heading: "“Safe” is not a yes/no",
    paragraphs: [
      "An AI trading agent has a model, a strategy, a credential and a wallet. Each can fail. The useful question is not “is it safe?” but “what is the worst case, and who can cause it?”",
      "The worst case has two parts: the model can trade badly, and a compromised credential can try to move funds. A trading-only wallet and a server-enforced policy bound both, but neither removes market loss.",
    ],
  },
  {
    heading: "The threat model",
    paragraphs: [
      "Assume the model will be wrong sometimes. Assume a prompt injection can try to call the API directly. Assume a key can leak. Assume the venue can have an outage. The controls must still hold.",
    ],
    bullets: [
      "Model error: a bad order is capped by the key policy and the position/risk envelope.",
      "Prompt injection: the agent cannot widen its own key or policy; a refusal is final.",
      "Key leak: an attacker still cannot withdraw; the owner revokes the key and the agent wallet.",
      "Venue outage: trading is unavailable, but the owner's withdrawal path is unaffected.",
      "Strategy loss: bounded by the trading budget; not by a promise of returns.",
    ],
  },
  {
    heading: "What the controls actually do",
    paragraphs: [
      "The trading-only agent wallet separates trading from withdrawal at the wallet boundary. The key policy enforces allowed operations, per-call and daily caps and a coin allowlist before the venue. The platform risk envelope adds position sizing, leverage, stop-loss and daily breakers. The audit records calls, fills and refusals.",
      "None of this makes a bad strategy good. It makes the bad case bounded and visible, which is what an owner needs before letting an agent run unattended.",
    ],
  },
  {
    heading: "Builder checklist",
    paragraphs: [
      "Before giving an agent a trading account, verify the following with evidence, not a sales page.",
    ],
    bullets: [
      "The agent wallet is trading-only and revocable.",
      "The key policy is enforced server-side and cannot be widened by the model.",
      "The refusal path is testable in the sandbox (403 / 409).",
      "Every call has a receipt; the owner can export it.",
      "The budget is one the owner accepts losing.",
    ],
  },
]

const FAQ = [
  {
    q: "Can an AI trading bot steal my funds?",
    a: "With a trading-only agent wallet, it cannot withdraw. It can trade badly; that is a market risk. The owner can revoke the wallet and the key.",
  },
  {
    q: "Does a stop-loss make AI trading safe?",
    a: "No. A stop-loss bounds a position, but gaps, slippage and venue risk remain. Treat the whole budget as at risk.",
  },
  {
    q: "What should I check before going live?",
    a: "Trading-only wallet, server-enforced policy, allowlist, audit receipts, revocation, and a sandbox test of the refusal path. Then start with a budget you can lose.",
  },
]

export default function Page() {
  return (
    <GuideArticle
      title="Is AI Trading Safe? Trading-Only Permissions, Explained"
      lead="The honest answer is a threat model, not a slogan. A trading-only wallet and a server-enforced policy bound the worst case; they do not make market loss impossible."
      sections={SECTIONS}
      faq={FAQ}
    />
  )
}
