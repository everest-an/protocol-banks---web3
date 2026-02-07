"use client"

import { useState, useEffect } from "react"
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { TronResources } from "@/components/tron/tron-resources"
import { connectTron } from "@/lib/web3"
import {
  getTronNetwork,
  getTRC20Balance,
  sendTRC20,
  sendTRX,
  getTronTransaction,
  waitForTronConfirmation,
} from "@/lib/services/tron-payment"
import { getTokenAddress, getSupportedTokens } from "@/lib/networks"
import {
  Wallet,
  Send,
  ExternalLink,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react"

export default function TronDemoPage() {
  const [address, setAddress] = useState<string>("")
  const [network, setNetwork] = useState<"tron" | "tron-nile" | null>(null)
  const [balances, setBalances] = useState<Record<string, { balance: string; decimals: number }>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Transfer form
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [selectedToken, setSelectedToken] = useState("USDT")
  const [transferring, setTransferring] = useState(false)
  const [lastTxHash, setLastTxHash] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Connect wallet
  const handleConnect = async () => {
    try {
      setLoading(true)
      setError(null)
      const addr = await connectTron()
      setAddress(addr)

      // Detect network
      const net = await getTronNetwork()
      setNetwork(net)

      // Load balances
      await loadBalances(addr, net)

      setSuccess(`Connected to ${net === "tron-nile" ? "Nile Testnet" : "Mainnet"}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect")
    } finally {
      setLoading(false)
    }
  }

  // Load token balances
  const loadBalances = async (addr: string, net: "tron" | "tron-nile") => {
    try {
      const tokens = getSupportedTokens(net)
      const balanceData: Record<string, { balance: string; decimals: number }> = {}

      for (const token of tokens) {
        try {
          const { balance, decimals } = await getTRC20Balance(token.address, addr)
          balanceData[token.symbol] = { balance, decimals }
        } catch (err) {
          console.error(`Failed to load ${token.symbol} balance:`, err)
        }
      }

      setBalances(balanceData)
    } catch (err) {
      console.error("Failed to load balances:", err)
    }
  }

  // Handle transfer
  const handleTransfer = async () => {
    if (!address || !network || !recipient || !amount) {
      setError("Please fill in all fields")
      return
    }

    try {
      setTransferring(true)
      setError(null)
      setSuccess(null)
      setLastTxHash(null)

      // Get token address
      const tokenAddress = getTokenAddress(network, selectedToken)
      if (!tokenAddress) {
        throw new Error(`Token ${selectedToken} not found on ${network}`)
      }

      // Get decimals
      const decimals = balances[selectedToken]?.decimals || 6

      // Send transfer
      console.log("Sending transfer:", { tokenAddress, recipient, amount, decimals })
      const txHash = await sendTRC20(tokenAddress, recipient, amount, decimals)

      setLastTxHash(txHash)
      setSuccess(`Transfer sent! Transaction: ${txHash}`)

      // Wait for confirmation (optional)
      setTimeout(async () => {
        try {
          const confirmed = await waitForTronConfirmation(txHash, 10, 3000)
          if (confirmed) {
            setSuccess(`Transfer confirmed! Transaction: ${txHash}`)
            // Reload balances
            await loadBalances(address, network)
          }
        } catch (err) {
          console.error("Confirmation check failed:", err)
        }
      }, 3000)

      // Clear form
      setRecipient("")
      setAmount("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed")
    } finally {
      setTransferring(false)
    }
  }

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Format balance
  const formatBalance = (symbol: string) => {
    const data = balances[symbol]
    if (!data) return "0"
    const balance = Number(data.balance) / Math.pow(10, data.decimals)
    return balance.toFixed(data.decimals)
  }

  return (
    <div className="container mx-auto max-w-6xl py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">TRON Payment Demo</h1>
        <p className="text-muted-foreground">Test TRON TRC20 payments on Nile Testnet</p>
      </div>

      {/* Quick Links */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="text-sm font-medium">Quick Links</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("https://nileex.io/join/getJoinPage", "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Nile Faucet (Get Test TRX)
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open("https://nile.tronscan.org", "_blank")}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Nile Explorer
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open("https://nile.trongrid.io", "_blank")}>
            <ExternalLink className="h-4 w-4 mr-2" />
            TronGrid API
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("https://docs.tronscan.org/api-endpoints", "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            TronScan API
          </Button>
        </GlassCardContent>
      </GlassCard>

      {/* Connection Status */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet Connection
          </GlassCardTitle>
          <GlassCardDescription>Connect your TronLink wallet to get started</GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          {!address ? (
            <Button onClick={handleConnect} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect TronLink
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Connected Address</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs">{address}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(address)}
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <Badge variant={network === "tron-nile" ? "default" : "secondary"}>
                  {network === "tron-nile" ? "Nile Testnet" : "Mainnet"}
                </Badge>
              </div>

              {/* Balances */}
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {getSupportedTokens(network!).map((token) => (
                  <GlassCard key={token.symbol}>
                    <GlassCardHeader className="pb-3">
                      <GlassCardTitle className="text-sm font-medium">{token.symbol}</GlassCardTitle>
                    </GlassCardHeader>
                    <GlassCardContent>
                      <div className="text-2xl font-bold">{formatBalance(token.symbol)}</div>
                      <p className="text-xs text-muted-foreground mt-1">Available Balance</p>
                    </GlassCardContent>
                  </GlassCard>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={() => loadBalances(address, network!)}>
                <Loader2 className="mr-2 h-4 w-4" />
                Refresh Balances
              </Button>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Resources */}
      {address && <TronResources address={address} />}

      {/* Transfer Form */}
      {address && (
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send TRC20 Transfer
            </GlassCardTitle>
            <GlassCardDescription>Test sending TRC20 tokens on Nile testnet</GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Token</Label>
              <select
                id="token"
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {getSupportedTokens(network!).map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol} (Balance: {formatBalance(token.symbol)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient Address</Label>
              <Input
                id="recipient"
                placeholder="T..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={transferring}
              />
              <p className="text-xs text-muted-foreground">
                Must be a valid TRON address starting with 'T' (34 characters)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.000001"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={transferring}
              />
            </div>

            <Button onClick={handleTransfer} disabled={transferring || !recipient || !amount} className="w-full">
              {transferring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Transfer
                </>
              )}
            </Button>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Status Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{success}</p>
            {lastTxHash && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://nile.tronscan.org/#/transaction/${lastTxHash}`, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on TronScan
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Instructions */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="text-sm font-medium">Getting Started</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-3 text-sm">
          <div className="space-y-2">
            <p className="font-medium">1. Install TronLink</p>
            <p className="text-muted-foreground">
              Download TronLink extension from{" "}
              <a
                href="https://www.tronlink.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                tronlink.org
              </a>
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="font-medium">2. Switch to Nile Testnet</p>
            <p className="text-muted-foreground">
              In TronLink: Settings → Node Management → Select "Nile Testnet"
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="font-medium">3. Get Test TRX</p>
            <p className="text-muted-foreground">
              Visit the{" "}
              <a
                href="https://nileex.io/join/getJoinPage"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Nile Faucet
              </a>{" "}
              and request test TRX for your wallet
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="font-medium">4. Connect Wallet</p>
            <p className="text-muted-foreground">Click "Connect TronLink" button above to connect your wallet</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="font-medium">5. Test Transfer</p>
            <p className="text-muted-foreground">
              Enter a recipient address and amount, then click "Send Transfer" to test TRC20 payments
            </p>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Technical Info */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="text-sm font-medium">Network Configuration</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-2 text-xs font-mono">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-muted-foreground">Network:</span>
            <span>{network === "tron-nile" ? "Nile Testnet" : network || "Not connected"}</span>

            <span className="text-muted-foreground">RPC URL:</span>
            <span>https://nile.trongrid.io</span>

            <span className="text-muted-foreground">Explorer:</span>
            <span>https://nile.tronscan.org</span>

            <span className="text-muted-foreground">API:</span>
            <span>https://nileapi.tronscan.org</span>

            {network === "tron-nile" && (
              <>
                <span className="text-muted-foreground">Test USDT:</span>
                <span>{getTokenAddress("tron-nile", "USDT")}</span>
              </>
            )}
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  )
}
