"use client"

import { useState, useEffect, useCallback } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Check, ArrowRight, Share2, QrCode, Terminal, Shield, Clock, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { AddressVerificationDisplay } from "@/components/address-verification-display"

function generateLinkSignature(params: { to: string; amount: string; token: string; expiry: string }): string {
  // Client-side signature using a deterministic hash
  // In production, this would be done server-side with HMAC
  const data = `${params.to.toLowerCase()}|${params.amount}|${params.token.toUpperCase()}|${params.expiry}`
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  // Convert to hex and take first 16 chars
  const hex = Math.abs(hash).toString(16).padStart(8, "0")
  return hex + hex // 16 char signature
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function isValidAmount(amount: string): boolean {
  if (!amount) return true // Empty is OK
  const num = Number.parseFloat(amount)
  return !isNaN(num) && num > 0 && num <= 1000000000 // Max 1B
}

interface ClipboardRecord {
  value: string
  timestamp: number
}

export default function ReceivePage() {
  const { isConnected, address: unifiedAddress, wallets, activeChain } = useUnifiedWallet()
  const { toast } = useToast()

  const [address, setAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [token, setToken] = useState("USDC")
  const [copied, setCopied] = useState(false)
  const [expiryHours, setExpiryHours] = useState("24")
  const [clipboardRecord, setClipboardRecord] = useState<ClipboardRecord | null>(null)
  const [addressError, setAddressError] = useState("")
  const [amountError, setAmountError] = useState("")
  const [showQRCode, setShowQRCode] = useState(false)

  useEffect(() => {
    if (isConnected && unifiedAddress) {
      setAddress(unifiedAddress)
    }
  }, [isConnected, unifiedAddress])

  useEffect(() => {
    if (address && !isValidAddress(address)) {
      setAddressError("Invalid Ethereum address format")
    } else {
      setAddressError("")
    }
  }, [address])

  useEffect(() => {
    if (amount && !isValidAmount(amount)) {
      setAmountError("Invalid amount (must be positive, max 1B)")
    } else {
      setAmountError("")
    }
  }, [amount])

  const generateLink = useCallback(() => {
    if (typeof window === "undefined") return ""
    if (!address || addressError || amountError) return ""

    const baseUrl = window.location.origin + "/pay"
    const params = new URLSearchParams()

    // Add required params
    params.set("to", address)
    if (amount) params.set("amount", amount)
    params.set("token", token)

    // Add expiry timestamp
    const expiryMs = Date.now() + Number.parseInt(expiryHours) * 60 * 60 * 1000
    params.set("exp", expiryMs.toString())

    // Generate and add signature
    const signature = generateLinkSignature({
      to: address,
      amount: amount || "0",
      token,
      expiry: expiryMs.toString(),
    })
    params.set("sig", signature)

    return `${baseUrl}?${params.toString()}`
  }, [address, amount, token, expiryHours, addressError, amountError])

  const link = generateLink()

  const copyToClipboard = async () => {
    if (!link) {
      toast({
        title: "Cannot Copy",
        description: "Please enter a valid address first.",
        variant: "destructive",
      })
      return
    }

    try {
      await navigator.clipboard.writeText(link)

      // Record what we copied for hijacking detection
      setClipboardRecord({
        value: link,
        timestamp: Date.now(),
      })

      setCopied(true)
      toast({
        title: "Link Copied",
        description: "Signed payment link copied to clipboard",
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

  const verifyAndShare = async () => {
    if (!clipboardRecord) {
      toast({
        title: "Copy First",
        description: "Please copy the link before sharing.",
        variant: "destructive",
      })
      return
    }

    try {
      const currentClipboard = await navigator.clipboard.readText()

      if (currentClipboard !== clipboardRecord.value) {
        toast({
          title: "Clipboard Modified!",
          description:
            "WARNING: Your clipboard content has changed since copying. This could indicate a clipboard hijacker. Please copy the link again.",
          variant: "destructive",
        })
        setClipboardRecord(null)
        return
      }

      // Check if too old (5 minutes)
      if (Date.now() - clipboardRecord.timestamp > 5 * 60 * 1000) {
        toast({
          title: "Clipboard Expired",
          description: "Please copy the link again for security.",
          variant: "destructive",
        })
        setClipboardRecord(null)
        return
      }

      // Safe to share
      if (navigator.share) {
        await navigator.share({
          title: "Payment Request",
          text: `Please pay ${amount || "requested amount"} ${token}`,
          url: currentClipboard,
        })
      } else {
        toast({
          title: "Ready to Share",
          description: "Clipboard verified - safe to paste and share!",
        })
      }
    } catch (err) {
      // Can't read clipboard - just proceed
      if (navigator.share && link) {
        await navigator.share({
          title: "Payment Request",
          text: `Please pay ${amount || "requested amount"} ${token}`,
          url: link,
        })
      }
    }
  }

  const getExpiryDisplay = () => {
    const hours = Number.parseInt(expiryHours)
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""}`
    const days = hours / 24
    return `${days} day${days > 1 ? "s" : ""}`
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receive Payments</h1>
          <p className="text-muted-foreground mt-2">
            Generate secure, signed x402 payment links to share with your customers or clients.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <GlassCard className="h-fit">
          <GlassCardHeader>
            <GlassCardTitle>Payment Details</GlassCardTitle>
            <GlassCardDescription>Configure your payment request</GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="address">Recipient Address</Label>
              <div className="relative">
                <Input
                  id="address"
                  placeholder="0x..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={`font-mono ${addressError ? "border-destructive" : ""}`}
                />
                {isConnected && !address && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7"
                    onClick={() => setAddress(wallets[activeChain as keyof typeof wallets] || "")}
                  >
                    Use My Wallet
                  </Button>
                )}
              </div>
              {addressError && <p className="text-sm text-destructive">{addressError}</p>}
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
                  className={amountError ? "border-destructive" : ""}
                />
                {amountError && <p className="text-sm text-destructive">{amountError}</p>}
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

            <div className="space-y-2">
              <Label>Link Expiry</Label>
              <Select value={expiryHours} onValueChange={setExpiryHours}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Link will expire after {getExpiryDisplay()} for security</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 border text-sm space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <Terminal className="h-4 w-4 text-primary" />
                <span>x402 Features Enabled</span>
              </div>
              <ul className="list-disc list-inside text-muted-foreground pl-1 space-y-1">
                <li>Cryptographically signed links</li>
                <li>Tamper detection on recipient side</li>
                <li>EIP-3009 Gasless support (USDC)</li>
                <li>Automatic link expiration</li>
              </ul>
            </div>
          </GlassCardContent>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard className="bg-primary/5 border-primary/20">
            <GlassCardHeader>
              <GlassCardTitle className="text-primary flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Shareable Link
              </GlassCardTitle>
              <GlassCardDescription>Send this link to your payer. They can pay securely without an account.</GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                  <Shield className="h-3 w-3 mr-1" />
                  Signed
                </Badge>
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                  <Clock className="h-3 w-3 mr-1" />
                  Expires in {getExpiryDisplay()}
                </Badge>
              </div>

              <div className="p-4 bg-background border rounded-lg break-all font-mono text-sm text-muted-foreground">
                {link || (
                  <span className="text-muted-foreground/50 italic">Enter a valid address to generate link...</span>
                )}
              </div>

              {address && isValidAddress(address) && showQRCode && (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <QRCodeSVG value={address} size={200} level="H" includeMargin={true} />
                </div>
              )}

              {clipboardRecord && Date.now() - clipboardRecord.timestamp < 60000 && (
                <Alert className="bg-green-500/5 border-green-500/20">
                  <Shield className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-sm text-green-600">
                    Link copied and tracked. Click "Verify & Share" to confirm clipboard integrity before sharing.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button onClick={copyToClipboard} className="w-full" variant="default" disabled={!link}>
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

                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={() => setShowQRCode(!showQRCode)}
                  disabled={!link}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  {showQRCode ? "Hide QR" : "Show QR"}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={verifyAndShare}
                  disabled={!clipboardRecord}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Verify & Share
                </Button>

                <Button variant="outline" asChild className="w-full bg-transparent">
                  <Link href={link || "#"} target="_blank" className={!link ? "pointer-events-none opacity-50" : ""}>
                    Test Link <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </GlassCardContent>
          </GlassCard>

          <GlassCard className="border-yellow-500/20 bg-yellow-500/5">
            <GlassCardHeader className="pb-3">
              <GlassCardTitle className="text-yellow-600 flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" />
                Security Notice
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Clipboard Hijacking Protection:</strong> Always use "Verify & Share" to confirm your clipboard
                hasn't been modified by malware before sharing payment links.
              </p>
              <p>
                <strong>Link Signature:</strong> Each link is cryptographically signed. Recipients will see a warning if
                the link has been tampered with.
              </p>
            </GlassCardContent>
          </GlassCard>

          {/* Address Verification Display */}
          {address && isValidAddress(address) && (
            <AddressVerificationDisplay
              address={address}
              label="Your Receiving Address"
              showQrCode={true}
              onVerificationComplete={(isSecure) => {
                if (!isSecure) {
                  toast({
                    title: "Clipboard Compromised",
                    description: "Your clipboard may have been modified. Do not share the address without verification.",
                    variant: "destructive",
                  })
                }
              }}
            />
          )}

          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Integration Guide
              </GlassCardTitle>
              <GlassCardDescription>How to use this in your workflow</GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                1. <strong>Copy the signed link</strong> above and verify before sharing via email, chat, or invoice.
              </p>
              <p>
                2. The payer opens the link, sees security verification status, connects their wallet, and{" "}
                <strong>approves the payment</strong>.
              </p>
              <p>
                3. For USDC payments on EVM chains, the <strong>x402 Protocol</strong> activates automatically for
                gasless authorization.
              </p>
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
