import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

export default function TermsOfService() {
  return (
    <div className="min-h-screen py-12 px-4 bg-background text-foreground">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Terms of Service</h1>
          <p className="text-muted-foreground">Last Updated: January 2025</p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Please read these terms carefully before using Protocol Banks services.</AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>1. Non-Custodial Nature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Protocol Banks is a software interface. We do not provide custodial services, and we never have access to
              your private keys or funds. All transactions are executed on-chain via user-authorized smart contracts.
            </p>
            <p>
              You are solely responsible for maintaining the security of your wallet and private keys. Protocol Banks
              cannot recover lost funds or reverse transactions.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Third-Party Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Fiat-to-crypto services are provided exclusively by Transak. Protocol Banks is not responsible for any
              issues arising from Transak's KYC process, fund settlement, or compliance procedures.
            </p>
            <p>
              When using third-party services through our platform, you are subject to their respective terms and
              conditions. Protocol Banks acts solely as an interface provider.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Geographic Restrictions</CardTitle>
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
            <CardTitle>4. Risk Warning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Cryptocurrency investments are highly volatile and carry significant risk. Protocol Banks is not a
              financial advisor. You should conduct your own research and consult with qualified professionals before
              making any financial decisions.
            </p>
            <p>
              Past performance is not indicative of future results. You may lose some or all of your investment. Never
              invest more than you can afford to lose.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Service Availability</CardTitle>
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
            <CardTitle>6. Limitation of Liability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              To the maximum extent permitted by law, Protocol Banks shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages resulting from your use of our services.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7. Changes to Terms</CardTitle>
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
