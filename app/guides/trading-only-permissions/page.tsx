import type { Metadata } from "next"
import { GuideArticle } from "@/components/guides/guide-article"

export const metadata: Metadata = {
  title: "Trading-Only Permissions: Safety Bedrock for Agent Wallets",
  description:
    "approveAgent separates trading rights from withdrawal rights. Why that wallet boundary matters for AI agents, and how builders use it with a server-enforced policy.",
  alternates: { canonical: "https://protocolbanks.com/guides/trading-only-permissions" },
  openGraph: {
    title: "Trading-Only Permissions: Safety Bedrock for Agent Wallets",
    description:
      "The architecture that makes an agent's worst case the budget you approve: trading rights at the venue, no withdrawal path.",
  },
}

const SECTIONS = [
  {
    heading: "Two rights, two places",
    paragraphs: [
      "Trading and withdrawal are different rights. A trading-only agent wallet can place and cancel orders; it cannot move the budget out. The separation happens at the wallet boundary, not in the prompt.",
      "This matters because prompts can be injected, models can hallucinate and code can loop. A policy in front of the API bounds what the agent may ask; the wallet boundary bounds what the agent can do even if the API is bypassed.",
    ],
  },
  {
    heading: "How approveAgent works",
    paragraphs: [
      "On Hyperliquid, the account owner signs an EIP-712 approveAgent authorization for a separate agent wallet. The wallet receives trading rights only. The owner's key stays with the owner; the agent key does not need it.",
      "The owner can revoke the agent wallet at any time. If the agent key leaks, an attacker can trade within the policy and the budget, but cannot withdraw.",
    ],
  },
  {
    heading: "What a trading-only wallet does not solve",
    paragraphs: [
      "It does not stop a bad strategy, an over-sized order or a loop. That is what the key policy and the platform risk envelope are for: allowed operations, per-call cap, daily cap, coin allowlist, position sizing, stop-loss and daily breakers.",
      "It also does not remove venue or market risk. The budget is still at risk of trading loss; trading-only only removes the withdrawal path.",
    ],
  },
  {
    heading: "Builder checklist",
    paragraphs: [
      "Use the wallet boundary and the policy boundary together. Test both in the sandbox before funding a live account.",
    ],
    bullets: [
      "Trading-only agent wallet approved by the owner, revocable.",
      "Key policy enforced server-side, not in the model prompt.",
      "A 403/409 refusal is surfaced, not retried unchanged.",
      "The owner's key never enters the agent runtime.",
    ],
  },
]

const FAQ = [
  {
    q: "What does trading-only mean?",
    a: "The agent wallet can place and cancel orders but cannot withdraw. The owner approves it on Hyperliquid with EIP-712 approveAgent and can revoke it.",
  },
  {
    q: "Is a trading-only wallet the same as a policy cap?",
    a: "No. The wallet boundary blocks withdrawal at the venue; the key policy blocks operations, sizes and coins before the API. Use both.",
  },
  {
    q: "Can the owner revoke the agent?",
    a: "Yes. Revoking the agent wallet removes its trading rights; disabling the API key removes the agent's access to the control plane.",
  },
]

export default function Page() {
  return (
    <GuideArticle
      title="Trading-Only Permissions: The Safety Bedrock"
      lead="Separate trading from withdrawal at the wallet, then separate allowed operations from everything else at the policy. That is the architecture an AI agent's budget should sit behind."
      sections={SECTIONS}
      faq={FAQ}
    />
  )
}
