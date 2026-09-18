import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Trading-Only Permissions: The Safety Bedrock of AI Trading",
  description:
    "How Hyperliquid's approveAgent lets an AI trade your funds without ever being able to withdraw them — the architecture that makes non-custodial AI trading safe.",
  openGraph: {
    title: "Trading-Only Permissions: Why AI Trading Doesn't Need Your Trust",
    description:
      "The key custody design that separates trading rights from withdrawal rights, so an AI agent's worst case is the budget you approve.",
  },
}

const FAQ = [
  {
    q: "What are trading-only permissions?",
    a: "On Hyperliquid, you can approve an agent wallet with approveAgent — a typed EIP-712 signature that grants the right to open and close positions, but no right to withdraw. Trading and withdrawal rights are separate, so an AI holding trading-only permissions can never move funds out.",
  },
  {
    q: "Can an AI with trading-only permissions steal my crypto?",
    a: "No. Withdrawals require your own wallet signature, which the agent never has. The agent can only trade within your account. The worst case of a misbehaving agent is losing the trading budget you allocated — never your main wallet.",
  },
  {
    q: "How do I revoke trading-only permissions?",
    a: "Revocation is on-chain and immediate: sign a revoke in your wallet and the agent loses the ability to trade instantly. There is no cooldown and no custodian in the middle.",
  },
]

export default function TradingOnlyPermissionsGuide() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            dateModified: "2026-09-18",
            inLanguage: "en",
            mainEntity: FAQ.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
      <div className="container mx-auto px-4 py-12 sm:py-16 max-w-3xl">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Protocol Bank
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold mt-4 mb-4 tracking-tight">
          Trading-Only Permissions: The Safety Bedrock of AI Trading
        </h1>
        <p className="text-muted-foreground mb-8">Last updated: September 2026 · 6 min read</p>

        <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-5 mb-8">
          <p className="text-sm font-semibold text-primary mb-1">TL;DR</p>
          <p className="text-sm text-foreground/90 leading-relaxed">
            The single question that decides whether an AI trading agent is safe is{" "}
            <strong>who holds the withdrawal right</strong>. Hyperliquid&apos;s <strong>approveAgent</strong> mechanism
            lets you grant an agent <strong>trading-only permissions</strong> via an EIP-712 signature — it can open
            and close positions but is structurally unable to withdraw. That separates the worst case from &quot;you
            lost everything&quot; to &quot;you lost the budget you approved,&quot; and it makes the whole system
            revocable on-chain in one signature. This is the architecture every AI trading product should be built on.
          </p>
        </div>

        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold mb-3">Why does custody decide everything?</h2>
            <p>
              Every &quot;AI trading bot&quot; horror story has the same root cause: the bot held <em>full custody</em>.
              When the AI — or the platform running it — can both trade and withdraw, trust becomes the product. And
              trust is exactly what crypto was built to make unnecessary.
            </p>
            <p className="mt-3">
              The alternative is permission separation: give the agent the right to trade, and keep the right to
              withdraw with you. Then the agent&apos;s power is bounded by construction, not by promises.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">What exactly does approveAgent grant?</h2>
            <p>
              Hyperliquid&apos;s agent system is a native, on-chain feature of the exchange — not an off-chain wrapper.
              Approving an agent means signing a typed message (EIP-712) from your wallet that adds the agent&apos;s
              address to your account&apos;s authorized signers, with a scope limited to order placement:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong>Can do:</strong> place and cancel orders, manage positions — the full trading surface.
              </li>
              <li>
                <strong>Cannot do:</strong> withdraw, transfer, or move funds out of the account. Those actions require
                your own wallet signature.
              </li>
              <li>
                <strong>Revocable:</strong> a single on-chain revocation removes the agent&apos;s authority instantly,
                with no cooldown.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">How does this change the worst case?</h2>
            <p>In a full-custody bot, the worst case is total loss of deposited funds. With trading-only permissions:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>The agent can only lose the funds <strong>inside the trading account</strong> — the budget you chose.</li>
              <li>Your main wallet is never touched, because the agent has no authority over it.</li>
              <li>Even a fully compromised agent key loses to you only what the risk engine already caps: per-trade
                stop-losses, position caps, and daily circuit breakers.</li>
            </ul>
            <p className="mt-3">
              Security stops being a claim and becomes a property of the account structure — which is the only kind of
              security worth selling in crypto.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">What should you demand from any AI trading product?</h2>
            <p>A four-question checklist:</p>
            <ol className="list-decimal pl-6 mt-2 space-y-2">
              <li>
                <strong>Who holds the withdrawal key?</strong> The right answer is: you, and only you.
              </li>
              <li>
                <strong>Is the trading permission scoped and revocable on-chain?</strong> Not a dashboard toggle, not a
                support ticket — an on-chain revocation you can sign yourself.
              </li>
              <li>
                <strong>Is the worst case written down?</strong> If the product can&apos;t tell you your maximum loss
                before you deposit, the answer is &quot;everything.&quot;
              </li>
              <li>
                <strong>Can you verify before risking anything?</strong> A free paper mode on real market data, with
                the same agent and risk engine as live, is the minimum bar.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">FAQ</h2>
            <div className="space-y-4">
              {FAQ.map((f) => (
                <div key={f.q} className="rounded-xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 p-5">
                  <h3 className="font-semibold mb-1.5">{f.q}</h3>
                  <p className="text-sm text-muted-foreground">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="text-sm text-muted-foreground">
            This page is educational, not financial advice. Read the{" "}
            <Link href="/risk-disclosure" className="underline">
              Risk Disclosure
            </Link>{" "}
            before live trading.
          </p>
        </div>
      </div>
    </div>
  )
}
