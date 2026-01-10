import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield } from "lucide-react"

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Privacy Policy</h1>
          <p className="text-muted-foreground">Last Updated: January 2025</p>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Protocol Banks is committed to protecting your privacy as a non-custodial platform.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>1. Data Collection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              As a non-custodial platform, we do not collect or store your government-issued ID, bank details, or
              private keys.
            </p>
            <p>We may collect minimal technical information such as:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Wallet addresses (public blockchain data)</li>
              <li>Transaction hashes (public blockchain data)</li>
              <li>Browser type and IP address (for security and analytics)</li>
              <li>Usage patterns and preferences (to improve our service)</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Third-Party Disclosure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              When you use the Transak widget, any personal data provided (such as KYC documents) is collected directly
              by Transak under their own Privacy Policy. Protocol Banks does not receive this sensitive data.
            </p>
            <p>
              Third-party services integrated with Protocol Banks operate under their own privacy policies. We recommend
              reviewing their policies before using their services.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Blockchain Transparency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Please be aware that all transactions on the blockchain are public and permanent. Once a transaction is
              confirmed on-chain, it cannot be deleted or hidden.
            </p>
            <p>
              Your wallet address and transaction history are visible to anyone on the blockchain. This is an inherent
              characteristic of blockchain technology, not a privacy breach by Protocol Banks.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Data Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              We implement industry-standard security measures to protect any data we do collect. However, no method of
              transmission over the internet is 100% secure.
            </p>
            <p>Key security measures include:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>End-to-end encryption for sensitive communications</li>
              <li>Regular security audits and penetration testing</li>
              <li>Rate limiting and DDoS protection</li>
              <li>Multi-layer attack detection systems</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Cookies and Tracking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>We use minimal cookies and local storage to provide core functionality such as:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Maintaining your session</li>
              <li>Remembering your preferences</li>
              <li>Analyzing usage patterns (anonymized)</li>
            </ul>
            <p>You can disable cookies in your browser settings, but this may affect functionality.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6. Your Rights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Access the personal data we hold about you</li>
              <li>Request correction or deletion of your data</li>
              <li>Object to processing of your data</li>
              <li>Request data portability</li>
            </ul>
            <p>
              To exercise these rights, please contact us at{" "}
              <a href="mailto:everest9812@gmail.com" className="text-blue-500 hover:underline">
                everest9812@gmail.com
              </a>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7. Children's Privacy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Protocol Banks is not intended for users under the age of 18. We do not knowingly collect personal
              information from children.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>8. Changes to Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              We may update this privacy policy from time to time. We will notify users of any material changes by
              posting the new policy on this page and updating the "Last Updated" date.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>9. Contact Us</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>If you have questions about this privacy policy, please contact us:</p>
            <ul className="space-y-2">
              <li>
                Email:{" "}
                <a href="mailto:everest9812@gmail.com" className="text-blue-500 hover:underline">
                  everest9812@gmail.com
                </a>
              </li>
              <li>
                GitHub:{" "}
                <a
                  href="https://github.com/everest-an/protocol-banks---web3"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  github.com/everest-an/protocol-banks---web3
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
