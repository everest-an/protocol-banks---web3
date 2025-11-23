"use client"

import { useState, useEffect } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Copy, Check, ArrowRight, Share2, QrCode, Terminal } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function ReceivePage() {
  const { isConnected, wallets, activeChain } = useWeb3()
  const { toast } = useToast()

  const [address, setAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [token, setToken] = useState("USDC")
  const [copied, setCopied] = useState(false)

  // Auto-fill address when wallet connects
  useEffect(() => {
    if (isConnected && wallets[activeChain]) {
      setAddress(wallets[activeChain] || "")
    }
  }, [isConnected, wallets, activeChain])

  const generateLink = () => {
    if (typeof window === "undefined") return ""
    const baseUrl = window.location.origin + "/pay"
    const params = new URLSearchParams()
    if (address) params.set("to", address)
    if (amount) params.set("amount", amount)
    if (token) params.set("token", token)
    return `${baseUrl}?${params.toString()}`
  }

  const link = generateLink()

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast({
        title: "Link Copied",
        description: "Payment link copied to clipboard",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy link to clipboard",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receive Payments</h1>
          <p className="text-muted-foreground mt-2">
            Generate secure x402 payment links to share with your customers or clients.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Configuration Card */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
            <CardDescription>Configure your payment request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="address">Recipient Address</Label>
              <div className="relative">
                <Input
                  id="address"
                  placeholder="0x..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="font-mono"
                />
                {isConnected && !address && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7"
                    onClick={() => setAddress(wallets[activeChain] || "")}
                  >
                    Use My Wallet
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Token</Label>
                <Select value={token} onValueChange={setToken}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDC">USDC (USD Coin)</SelectItem>
                    <SelectItem value="USDT">USDT (Tether)</SelectItem>
                    <SelectItem value="DAI">DAI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 border text-sm space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <Terminal className="h-4 w-4 text-primary" />
                <span>x402 Features Enabled</span>
              </div>
              <ul className="list-disc list-inside text-muted-foreground pl-1 space-y-1">
                <li>Instant URL generation</li>
                <li>EIP-3009 Gasless support (USDC)</li>
                <li>Cross-client compatibility</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Preview Card */}
        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Shareable Link
              </CardTitle>
              <CardDescription>Send this link to your payer. They can pay securely without an account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-background border rounded-lg break-all font-mono text-sm text-muted-foreground">
                {link}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button onClick={copyToClipboard} className="w-full" variant="default">
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Link
                    </>
                  )}
                </Button>

                <Button variant="outline" asChild className="w-full bg-transparent">
                  <Link href={link} target="_blank">
                    Test Link <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Integration Guide
              </CardTitle>
              <CardDescription>How to use this in your workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                1. <strong>Copy the link</strong> above and send it via email, chat, or invoice.
              </p>
              <p>
                2. The payer opens the link, connects their wallet, and <strong>approves the payment</strong>.
              </p>
              <p>
                3. For USDC payments on EVM chains, the <strong>x402 Protocol</strong> activates automatically for
                gasless authorization.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
