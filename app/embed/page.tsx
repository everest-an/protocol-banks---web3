"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Copy, Check, Code, Eye, ExternalLink, Shield, Lock } from "lucide-react"

export default function EmbedPage() {
  const [config, setConfig] = useState({
    recipientAddress: "",
    amount: "",
    token: "USDC",
    merchantName: "",
    description: "",
    buttonLabel: "Pay Now",
    allowCustomAmount: false,
    theme: "light" as "light" | "dark",
    width: "400",
    height: "500",
  })

  const [copied, setCopied] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("configure")

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://protocol-banks.vercel.app"

  // Build embed URL
  const embedParams = new URLSearchParams()
  if (config.recipientAddress) embedParams.set("to", config.recipientAddress)
  if (config.amount) embedParams.set("amount", config.amount)
  if (config.token) embedParams.set("token", config.token)
  if (config.merchantName) embedParams.set("merchant", config.merchantName)
  if (config.description) embedParams.set("desc", config.description)
  if (config.buttonLabel !== "Pay Now") embedParams.set("label", config.buttonLabel)
  if (config.allowCustomAmount) embedParams.set("custom", "true")
  if (config.theme === "dark") embedParams.set("theme", "dark")

  const embedUrl = `${baseUrl}/embed/pay?${embedParams.toString()}`

  // Code snippets
  const iframeCode = `<iframe
  src="${embedUrl}"
  width="${config.width}"
  height="${config.height}"
  style="border: none; border-radius: 12px;"
  allow="payment"
></iframe>`

  const reactCode = `import { ProtocolBanks } from '@protocolbanks/sdk';

const pb = new ProtocolBanks({
  apiKey: 'pk_your_api_key',
});

// Mount the payment widget
const widget = pb.embed({
  container: '#payment-container',
  to: '${config.recipientAddress || "0x..."}',${config.amount ? `\n  amount: '${config.amount}',` : ""}
  token: '${config.token}',${config.merchantName ? `\n  merchantName: '${config.merchantName}',` : ""}
  theme: '${config.theme}',
  onSuccess: (result) => {
    console.log('Payment successful:', result.txHash);
  },
  onError: (error) => {
    console.error('Payment failed:', error);
  },
});

// Later: cleanup
// widget.destroy();`

  const htmlButtonCode = `<!-- Protocol Banks Payment Button -->
<a href="${baseUrl}/pay?to=${config.recipientAddress || "0x..."}&amount=${config.amount || "10"}&token=${config.token}"
   target="_blank"
   style="display:inline-flex;align-items:center;gap:8px;
          padding:12px 24px;border-radius:8px;
          background:#0066FF;color:white;
          font-family:sans-serif;font-weight:600;
          text-decoration:none;font-size:16px;">
  ${config.buttonLabel}
</a>`

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-6 px-4 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold mb-1">Payment Widgets</h1>
          <p className="text-muted-foreground">
            Embed crypto payment buttons and forms on any website
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="configure" className="gap-2">
              <Code className="h-4 w-4" />
              Configure
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="configure" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Configuration Form */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Payment Settings</CardTitle>
                    <CardDescription>Configure your payment widget</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="recipient">Recipient Address *</Label>
                      <Input
                        id="recipient"
                        placeholder="0x..."
                        value={config.recipientAddress}
                        onChange={(e) => setConfig({ ...config, recipientAddress: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input
                          id="amount"
                          placeholder="Leave empty for donation"
                          value={config.amount}
                          onChange={(e) => setConfig({ ...config, amount: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Token</Label>
                        <Select value={config.token} onValueChange={(v) => setConfig({ ...config, token: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USDC">USDC</SelectItem>
                            <SelectItem value="USDT">USDT</SelectItem>
                            <SelectItem value="DAI">DAI</SelectItem>
                            <SelectItem value="ETH">ETH</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="merchant">Merchant Name</Label>
                      <Input
                        id="merchant"
                        placeholder="Your Business Name"
                        value={config.merchantName}
                        onChange={(e) => setConfig({ ...config, merchantName: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        placeholder="Payment for..."
                        value={config.description}
                        onChange={(e) => setConfig({ ...config, description: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="label">Button Label</Label>
                      <Input
                        id="label"
                        placeholder="Pay Now"
                        value={config.buttonLabel}
                        onChange={(e) => setConfig({ ...config, buttonLabel: e.target.value })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Allow Custom Amount</Label>
                        <p className="text-xs text-muted-foreground">Let customers enter their own amount</p>
                      </div>
                      <Switch
                        checked={config.allowCustomAmount}
                        onCheckedChange={(v) => setConfig({ ...config, allowCustomAmount: v })}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Appearance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Theme</Label>
                      <Select value={config.theme} onValueChange={(v: "light" | "dark") => setConfig({ ...config, theme: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Width (px)</Label>
                        <Input
                          value={config.width}
                          onChange={(e) => setConfig({ ...config, width: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Height (px)</Label>
                        <Input
                          value={config.height}
                          onChange={(e) => setConfig({ ...config, height: e.target.value })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Code Snippets */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">HTML Iframe</CardTitle>
                      <Badge variant="secondary">Easiest</Badge>
                    </div>
                    <CardDescription>Copy and paste into your website</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono">
                        {iframeCode}
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={() => copyToClipboard(iframeCode, "iframe")}
                      >
                        {copied === "iframe" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">React / SDK</CardTitle>
                      <Badge variant="secondary">Recommended</Badge>
                    </div>
                    <CardDescription>Install @protocolbanks/sdk for full control</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="relative">
                      <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm font-mono">
                        npm install @protocolbanks/sdk
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-7 w-7"
                        onClick={() => copyToClipboard("npm install @protocolbanks/sdk", "npm")}
                      >
                        {copied === "npm" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono max-h-[300px]">
                        {reactCode}
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={() => copyToClipboard(reactCode, "react")}
                      >
                        {copied === "react" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Payment Button</CardTitle>
                      <Badge variant="outline">Simple</Badge>
                    </div>
                    <CardDescription>A styled link that opens the payment page</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono max-h-[200px]">
                        {htmlButtonCode}
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={() => copyToClipboard(htmlButtonCode, "button")}
                      >
                        {copied === "button" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Live Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Live Preview</CardTitle>
                  <CardDescription>Preview how the payment widget looks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`rounded-xl border-2 border-dashed p-4 flex items-center justify-center ${
                    config.theme === "dark" ? "bg-zinc-900" : "bg-gray-50"
                  }`}>
                    {config.recipientAddress ? (
                      <iframe
                        src={embedUrl}
                        width={Math.min(parseInt(config.width) || 400, 450)}
                        height={Math.min(parseInt(config.height) || 500, 600)}
                        style={{ border: "none", borderRadius: "12px" }}
                        title="Payment Widget Preview"
                      />
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Code className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p>Enter a recipient address to preview the widget</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Info Panel */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Integration Guide</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</div>
                        <div>
                          <p className="font-medium">Configure your widget</p>
                          <p className="text-sm text-muted-foreground">Set recipient address, amount, and appearance</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</div>
                        <div>
                          <p className="font-medium">Copy the code snippet</p>
                          <p className="text-sm text-muted-foreground">Choose iframe, SDK, or button integration</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</div>
                        <div>
                          <p className="font-medium">Add to your website</p>
                          <p className="text-sm text-muted-foreground">Paste the snippet into your HTML or React app</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">4</div>
                        <div>
                          <p className="font-medium">Set up webhooks (optional)</p>
                          <p className="text-sm text-muted-foreground">Get notified when payments are received</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">PostMessage Events</CardTitle>
                    <CardDescription>Listen for payment events from the iframe</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono">{`window.addEventListener('message', (e) => {
  if (e.data.type === 'PROTOCOL_BANKS_PAYMENT_SUCCESS') {
    console.log('Paid!', e.data.txHash);
  }
  if (e.data.type === 'PROTOCOL_BANKS_PAYMENT_ERROR') {
    console.error('Error:', e.data.error);
  }
});`}</pre>
                  </CardContent>
                </Card>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>All payments are non-custodial and secured on-chain</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
