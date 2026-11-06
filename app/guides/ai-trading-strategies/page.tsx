import type { Metadata } from "next"
import { GuideArticle } from "@/components/guides/guide-article"

export const metadata: Metadata = {
  title: "AI Trading Strategies: For Agent Builders",
  description:
    "Momentum, funding carry and mean reversion are strategies the builder supplies. The control plane enforces the limits and audit; we do not sell returns.",
  alternates: { canonical: "https://protocolbanks.com/guides/ai-trading-strategies" },
  openGraph: {
    title: "AI Trading Strategies: For Agent Builders",
    description:
      "What an agent can execute, what it cannot enforce, and why the policy layer matters more than another signal.",
  },
}

const SECTIONS = [
  {
    heading: "Strategies are yours, not the platform's",
    paragraphs: [
      "Protocol Bank does not sell a strategy, a fund or a return. The builder supplies the signal; the Agent API supplies the account, the policy and the execution. That separation matters: the model can be wrong without being able to widen its own limits.",
      "Common agent strategies include momentum (a direction score over recent price action), funding carry (the sign and size of the perpetual funding rate), and mean reversion (a move away from a reference). Each is a hypothesis, not a guarantee.",
    ],
  },
  {
    heading: "What the execution layer can enforce",
    paragraphs: [
      "A strategy can ask for anything; the server decides. Before an order reaches Hyperliquid, the key policy checks the operation, per-call cap, daily cap and coin allowlist. The platform risk envelope then checks position sizing, leverage, stop-loss, and the daily loss breakers.",
    ],
    bullets: [
      "A size above the key cap is a 403; the policy is not negotiable by the model.",
      "A position or breaker refusal is a 409; the request is final.",
      "One position per market, with stop-loss and take-profit attached to every position.",
      "The daily cap is summed from metered calls, not from what the model claims.",
    ],
  },
  {
    heading: "How to test a strategy as a builder",
    paragraphs: [
      "Run the strategy in the sandbox first: real market data, simulated money, the same endpoints. Watch not only PnL but the refusals, the sizing after a cap clamp, and the behaviour when a breaker trips. Then go live with a budget whose loss you accept.",
      "A backtest is not a promise. If a strategy loses in backtest, do not market its returns; use the control layer to bound the risk and keep looking for a signal that survives.",
    ],
  },
  {
    heading: "The builder's takeaway",
    paragraphs: [
      "Spend your research time on the signal. Spend your integration time on the policy, the refusal paths and the audit. The latter is what lets an agent run unattended without the owner watching every call.",
    ],
  },
]

const FAQ = [
  {
    q: "Does Protocol Bank provide a profitable trading strategy?",
    a: "No. We provide the execution and policy layer. The strategy is the builder's; no strategy guarantees profit, and a backtest is not a promise.",
  },
  {
    q: "Can the agent change its own strategy limits?",
    a: "No. allowedOps, maxNotionalUsd, dailyCapUsd and allowedCoins live on the key and are enforced server-side. The agent cannot widen them; the owner edits them in Settings.",
  },
  {
    q: "What happens when a strategy exceeds a limit?",
    a: "The request is refused before it reaches the venue: 403 for the key policy, 409 for the platform risk envelope. The refusal is final for that request.",
  },
]

export default function Page() {
  return (
    <GuideArticle
      title="AI Trading Strategies: What an Agent Can Execute"
      lead="A strategy is a hypothesis the builder supplies. The control layer decides whether the agent may act on it. This guide separates the two so a bad signal cannot become an unbounded loss."
      sections={SECTIONS}
      faq={FAQ}
    />
  )
}
