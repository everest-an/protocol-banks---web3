import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function RiskDisclosure() {
  return (
    <div className="min-h-screen py-12 px-4 bg-background text-foreground">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Risk Disclosure</h1>
          <p className="text-muted-foreground">Last Updated: August 2026</p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Read this document carefully before enabling live automated trading. If you do not understand any of these
            risks, do not use live mode.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>1. You Can Lose Everything You Allocate</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Automated trading on perpetual futures markets can result in the loss of your entire trading-wallet
              balance. The trading wallet is the maximum you can lose, and losses there are real, irreversible losses of
              your funds. Only allocate money you can afford to lose entirely.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. The AI Is a Tool, Not a Guarantee</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              The AI agent executes a deterministic strategy — momentum and funding-carry signals with stop-losses and
              position caps. It is not intelligent in any human sense, it cannot anticipate black-swan events, and its
              past performance does not predict future results. Strategies that performed well historically can lose
              money going forward.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Market Risks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <span className="font-medium">Volatility:</span> crypto markets can move violently in minutes, triggering
                stop-losses far worse than the configured -2.5% under gaps or illiquidity.
              </li>
              <li>
                <span className="font-medium">Liquidation:</span> leveraged positions can be liquidated by the exchange
                regardless of our stop-loss logic if prices gap through them.
              </li>
              <li>
                <span className="font-medium">Slippage:</span> actual fills can be worse than the signaled price,
                especially in fast markets.
              </li>
              <li>
                <span className="font-medium">Funding costs:</span> holding positions incurs funding fees that can erode
                returns.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Technology Risks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <span className="font-medium">Software bugs:</span> our code, Hyperliquid&apos;s systems, or the RPC/data
                providers we rely on can malfunction, causing missed stops or erroneous orders.
              </li>
              <li>
                <span className="font-medium">Exchange outages:</span> Hyperliquid downtime can prevent the agent from
                managing positions, including closing them.
              </li>
              <li>
                <span className="font-medium">Data issues:</span> delayed or incorrect market data can produce bad
                signals.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Security & Custody</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="list-disc pl-6 space-y-1.5">
              <li>The agent wallet can trade but never withdraw — however, losses through trading are still real.</li>
              <li>The agent&apos;s signing key is encrypted at rest on our servers. A security breach of our
                infrastructure could in the worst case allow unauthorized trading (but not withdrawals) until you revoke
                the agent.</li>
              <li>You are responsible for the security of your own wallet and keys.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6. Regulatory</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Protocol Banks does not hold any financial-services license and does not provide investment advice,
              portfolio management, or custodial services. You are solely responsible for ensuring that using automated
              trading is legal in your jurisdiction.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7. Acceptance</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              By enabling live trading you acknowledge that you have read, understood, and accepted this Risk Disclosure
              and the{" "}
              <Link href="/terms" className="underline">
                Terms of Service
              </Link>
              . If you disagree with any part, remain in paper mode.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
