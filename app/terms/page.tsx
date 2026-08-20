import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function TermsOfService() {
  return (
    <div className="min-h-screen py-12 px-4 bg-background text-foreground">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Terms of Service</h1>
          <p className="text-muted-foreground">Last Updated: August 2026</p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please read these terms carefully before using Protocol Banks services, especially the automated
            trading sections. By using the AI trading feature you accept the{" "}
            <Link href="/risk-disclosure" className="underline">
              Risk Disclosure
            </Link>
            .
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>1. Non-Custodial Nature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Protocol Banks is a software interface. We do not provide custodial services, and we never have access to
              your private keys or funds. All transactions are executed on-chain or on Hyperliquid via user-authorized
              permissions.
            </p>
            <p>
              You are solely responsible for maintaining the security of your wallet and private keys. Protocol Banks
              cannot recover lost funds or reverse transactions.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Automated Trading Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              The AI trading feature executes trades automatically on Hyperliquid based on algorithmic signals, after you
              explicitly approve a trading-only agent wallet and fund a trading budget.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The agent wallet has trading permissions only — it can never withdraw your funds.</li>
              <li>You can revoke the agent&apos;s permissions at any time, on Hyperliquid or in the app.</li>
              <li>The trading wallet balance is the maximum amount the agent can trade with — and your maximum loss.</li>
              <li>Paper mode uses simulated funds; live mode uses real funds at your own risk.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. No Investment Advice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Protocol Banks is not a licensed investment adviser, broker, or asset manager. Nothing on this platform —
              including AI signals, strategy descriptions, or performance data — constitutes investment advice or a
              solicitation to trade.
            </p>
            <p>
              The AI agent is an automation tool, not a guarantee of profit. You are solely responsible for every trade
              executed with your funds, and for deciding whether automated trading is appropriate for you.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Trading Risk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Automated trading on perpetual markets is highly risky. You can lose your entire trading-wallet balance,
              including from market movements, liquidation, exchange outages, or software errors. Read the full{" "}
              <Link href="/risk-disclosure" className="underline">
                Risk Disclosure
              </Link>{" "}
              before enabling live mode.
            </p>
            <p>Past performance of the strategies does not indicate future results.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Third-Party Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Trading execution occurs on Hyperliquid, and fiat-to-crypto services are provided by third parties such as
              Transak. Protocol Banks is not responsible for issues arising from third-party platforms, including but not
              limited to exchange downtime, liquidations, or compliance procedures.
            </p>
            <p>
              When using third-party services through our platform, you are subject to their respective terms and
              conditions. Protocol Banks acts solely as an interface provider.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6. Geographic Restrictions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Our services are not available to residents of the United Kingdom, certain US states, and other sanctioned
              jurisdictions. Users are responsible for complying with their local laws.
            </p>
            <p>
              By using Protocol Banks, you represent and warrant that you are not located in, under the control of, or a
              national or resident of any restricted territory.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7. Service Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Protocol Banks makes no guarantees regarding service uptime or availability. We reserve the right to
              modify, suspend, or discontinue any part of our services at any time without prior notice.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>8. Limitation of Liability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              To the maximum extent permitted by law, Protocol Banks shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages resulting from your use of our services, including without
              limitation trading losses incurred through the automated trading feature.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>9. Changes to Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              We reserve the right to modify these terms at any time. Continued use of Protocol Banks after any such
              changes constitutes your acceptance of the new terms.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
