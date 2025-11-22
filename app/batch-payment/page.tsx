"use client"

import { useRouter } from "next/navigation"

import { useState, useEffect } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, Plus, Send, Loader2, Wallet, Bitcoin, Info } from "lucide-react" // Added Wallet, Bitcoin, and Info to lucide-react import
import { useToast } from "@/hooks/use-toast"
import { sendToken, getTokenAddress, signERC3009Authorization } from "@/lib/web3"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { getSupabase } from "@/lib/supabase"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert" // Import Alert components

interface PaymentRecipient {
  id: string
  address: string
  amount: string
  vendorName?: string
  vendorId?: string
  token: "USDT" | "USDC" | "DAI" | "CUSTOM" // Added token field to recipient
  customTokenAddress?: string // Added custom address to recipient
}

interface Vendor {
  id: string
  wallet_address: string
  name: string
}

const VALIDATORS = {
  EVM: (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address),
  SOLANA: (address: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address),
  BITCOIN: (address: string) => /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/.test(address),
}

export default function BatchPaymentPage() {
  const { wallets, activeChain, setActiveChain, isConnected, usdtBalance, usdcBalance, daiBalance, chainId } = useWeb3()
  const { toast } = useToast()
  const router = useRouter()

  const isDemoMode = !isConnected

  const currentWallet = wallets[activeChain]

  const [recipients, setRecipients] = useState<PaymentRecipient[]>(() => {
    if (!isConnected) {
      return [
        {
          id: "1",
          address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
          amount: "402",
          vendorName: "Cloud Services Inc",
          vendorId: "demo-1",
          token: "USDT",
        },
        {
          id: "2",
          address: "0x123f681646d4a755815f9cb19e1acc8565a0c2ac",
          amount: "3009",
          vendorName: "Global Consultants",
          vendorId: "demo-2",
          token: "USDC",
        },
      ]
    }
    return [{ id: "1", address: "", amount: "", vendorName: "", vendorId: "", token: "USDT" }]
  })

  const [defaultToken, setDefaultToken] = useState<"USDT" | "USDC" | "DAI">("USDT")
  const [vendors, setVendors] = useState<Vendor[]>(() => {
    if (!isConnected) {
      return [
        { id: "demo-1", name: "Cloud Services Inc", wallet_address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" },
        { id: "demo-2", name: "Global Consultants", wallet_address: "0x123f681646d4a755815f9cb19e1acc8565a0c2ac" },
        { id: "demo-3", name: "Office Supplies Co", wallet_address: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7" },
      ]
    }
    return []
  })

  const [loadingVendors, setLoadingVendors] = useState(true)
  const [selectedToken, setSelectedToken] = useState<"USDT" | "USDC" | "DAI" | "CUSTOM">("USDT")
  const [useX402, setUseX402] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (isConnected && currentWallet) {
      loadVendors()
    } else {
      setLoadingVendors(false)
    }
  }, [isConnected, currentWallet])

  const loadVendors = async () => {
    try {
      const supabase = getSupabase()

      if (!supabase) {
        console.warn("[v0] Supabase client not initialized")
        setLoadingVendors(false)
        return
      }

      const { data, error } = await supabase.from("vendors").select("*").eq("created_by", currentWallet).order("name")

      if (error) throw error
      setVendors(data || [])
    } catch (error) {
      console.error("[v0] Failed to load vendors:", error)
    } finally {
      setLoadingVendors(false)
    }
  }

  const addRecipient = () => {
    setRecipients([
      ...recipients,
      {
        id: Date.now().toString(),
        address: "",
        amount: "",
        vendorName: "",
        vendorId: "",
        token: defaultToken,
      },
    ])
  }

  const removeRecipient = (id: string) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((r) => r.id !== id))
    }
  }

  const updateRecipient = (id: string, field: keyof PaymentRecipient, value: string) => {
    setRecipients(
      recipients.map((r) => {
        if (r.id === id) {
          if (field === "vendorId") {
            const vendor = vendors.find((v) => v.id === value)
            return {
              ...r,
              vendorId: value,
              vendorName: vendor?.name || "",
              address: vendor?.wallet_address || r.address,
            }
          }
          if (field === "token") {
            setSelectedToken(value as any) // Update selectedToken when token changes
            if (value !== "CUSTOM") {
              return { ...r, token: value as any, customTokenAddress: "" }
            }
          }
          return { ...r, [field]: value }
        }
        return r
      }),
    )
  }

  const getTotalAmounts = () => {
    const totals = {
      USDT: 0,
      USDC: 0,
      DAI: 0,
      CUSTOM: 0,
    }

    recipients.forEach((r) => {
      const amount = Number.parseFloat(r.amount) || 0
      if (r.token === "CUSTOM") totals.CUSTOM += amount
      else if (r.token in totals) totals[r.token] += amount
    })

    return totals
  }

  const processBatchPayment = async () => {
    if (isDemoMode) {
      setIsProcessing(true)
      await new Promise((resolve) => setTimeout(resolve, 1500))
      toast({
        title: "Demo Payment Successful",
        description: "This is a simulation. No real funds were moved.",
      })
      setIsProcessing(false)
      return
    }

    if (!isConnected || !currentWallet) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      })
      return
    }

    if (activeChain !== "EVM") {
      toast({
        title: "Not Supported",
        description: "Batch payments are currently only supported for Ethereum/EVM networks.",
        variant: "destructive",
      })
      return
    }

    const invalidRecipients = recipients.filter((r) => {
      if (!r.address || !VALIDATORS[activeChain as keyof typeof VALIDATORS](r.address)) return true
      if (r.token === "CUSTOM" && !r.customTokenAddress) return true
      return false
    })

    if (invalidRecipients.length > 0) {
      toast({
        title: "Invalid Recipients",
        description: "Please check addresses and token selections",
        variant: "destructive",
      })
      return
    }

    const totals = getTotalAmounts()
    if (totals.USDT > Number(usdtBalance)) {
      toast({
        title: "Insufficient USDT",
        description: `Need ${totals.USDT}, have ${usdtBalance}`,
        variant: "destructive",
      })
      return
    }
    if (totals.USDC > Number(usdcBalance)) {
      toast({
        title: "Insufficient USDC",
        description: `Need ${totals.USDC}, have ${usdcBalance}`,
        variant: "destructive",
      })
      return
    }
    if (totals.DAI > Number(daiBalance)) {
      toast({
        title: "Insufficient DAI",
        description: `Need ${totals.DAI}, have ${daiBalance}`,
        variant: "destructive",
      })
      return
    }

    try {
      setIsProcessing(true)
      const supabase = getSupabase()

      if (!supabase) {
        toast({
          title: "Configuration Error",
          description: "Supabase is not configured correctly. Please check environment variables.",
          variant: "destructive",
        })
        setIsProcessing(false)
        return
      }

      const { data: batchData, error: batchError } = await supabase
        .from("batch_payments")
        .insert({
          wallet_address: currentWallet,
          total_recipients: recipients.length,
          total_amount_usd: totals.USDT + totals.USDC + totals.DAI,
          status: "processing",
          batch_name: `Batch ${new Date().toLocaleDateString()}`,
        })
        .select()
        .single()

      if (batchError) throw batchError

      for (const recipient of recipients) {
        if (!recipient.address || !Number(recipient.amount)) continue

        try {
          let txHash = ""

          let tokenAddress = ""
          if (recipient.token === "CUSTOM") {
            tokenAddress = recipient.customTokenAddress || ""
          } else {
            const addr = getTokenAddress(chainId, recipient.token)
            if (!addr) throw new Error(`Token address not found for ${recipient.token}`)
            tokenAddress = addr
          }

          if (useX402 && recipient.token === "USDC") {
            const auth = await signERC3009Authorization(
              tokenAddress,
              wallets.EVM!,
              recipient.address,
              recipient.amount,
              chainId,
            )
            console.log("[v0] x402 Authorization Signed:", auth)
            await new Promise((resolve) => setTimeout(resolve, 1000))
            txHash = "0x" + auth.nonce.slice(2) // Mock hash for signed auth
          } else {
            txHash = await sendToken(tokenAddress, recipient.address, recipient.amount)
          }

          const { data: paymentData, error: paymentError } = await supabase
            .from("payments")
            .insert({
              tx_hash: txHash,
              from_address: currentWallet,
              to_address: recipient.address,
              vendor_id: recipient.vendorId || null,
              token_symbol: recipient.token,
              token_address: tokenAddress,
              amount: recipient.amount,
              amount_usd: Number.parseFloat(recipient.amount),
              status: "completed",
            })
            .select()
            .single()

          await supabase.from("batch_payment_items").insert({
            batch_id: batchData.id,
            payment_id: paymentData.id,
          })
        } catch (error) {
          console.error("[v0] Payment failed for", recipient.address, error)
          throw error
        }
      }

      await supabase
        .from("batch_payments")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", batchData.id)

      toast({
        title: "Batch payment successful",
        description: `Successfully sent ${selectedToken} to ${recipients.length} recipients`,
      })

      setRecipients([{ id: "1", address: "", amount: "", vendorName: "", vendorId: "", token: "USDT" }])

      setTimeout(() => router.push("/analytics"), 2000)
    } catch (error: any) {
      toast({
        title: "Payment failed",
        description: error.message || "Failed to process batch payment",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="container py-8 px-4 space-y-6">
      {isDemoMode && (
        <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-500 mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Demo Mode Active</AlertTitle>
          <AlertDescription>
            You are viewing the batch payment interface in demo mode. Connect your wallet to perform real transactions.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Batch Payment</h1>
          <p className="text-muted-foreground mt-1">Send crypto to multiple recipients at once</p>
        </div>
        <div className="flex items-center space-x-2 bg-card p-3 rounded-lg border shrink-0">
          <Switch id="x402-mode" checked={useX402} onCheckedChange={setUseX402} />
          <div className="flex flex-col">
            <Label htmlFor="x402-mode" className="font-semibold cursor-pointer whitespace-nowrap">
              x402 Protocol
            </Label>
            <span className="text-xs text-muted-foreground whitespace-nowrap">Enable Gasless Auth</span>
          </div>
          {useX402 && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 whitespace-nowrap">
              Active
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <Button
          variant={activeChain === "EVM" ? "default" : "outline"}
          onClick={() => setActiveChain("EVM")}
          className={activeChain === "EVM" ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          <Wallet className="mr-2 h-4 w-4" />
          Ethereum
        </Button>
        <Button
          variant={activeChain === "SOLANA" ? "default" : "outline"}
          onClick={() => setActiveChain("SOLANA")}
          className={activeChain === "SOLANA" ? "bg-purple-600 hover:bg-purple-700" : ""}
        >
          <div className="mr-2 h-3 w-3 rounded-full bg-current" />
          Solana
        </Button>
        <Button
          variant={activeChain === "BITCOIN" ? "default" : "outline"}
          onClick={() => setActiveChain("BITCOIN")}
          className={activeChain === "BITCOIN" ? "bg-orange-600 hover:bg-orange-700" : ""}
        >
          <Bitcoin className="mr-2 h-4 w-4" />
          Bitcoin
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Recipients</CardTitle>
            <CardDescription className="text-muted-foreground">
              Add wallet addresses and amounts for batch payment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 text-sm mb-4 bg-muted/30 p-3 rounded-md overflow-x-auto">
              <div className="flex flex-col">
                <span className="text-muted-foreground">USDT Balance</span>
                <span className="font-mono font-bold">{isDemoMode ? "10,000.00" : Number(usdtBalance).toFixed(2)}</span>
              </div>
              <div className="w-px bg-border mx-2"></div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">USDC Balance</span>
                <span className="font-mono font-bold">{isDemoMode ? "15,500.00" : Number(usdcBalance).toFixed(2)}</span>
              </div>
              <div className="w-px bg-border mx-2"></div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">DAI Balance</span>
                <span className="font-mono font-bold">{isDemoMode ? "5,000.00" : Number(daiBalance).toFixed(2)}</span>
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                    <TableHead className="text-foreground whitespace-nowrap min-w-[150px]">Wallet Tag</TableHead>
                    <TableHead className="text-foreground whitespace-nowrap min-w-[200px]">Wallet Address</TableHead>
                    <TableHead className="text-foreground whitespace-nowrap min-w-[100px]">Token</TableHead>
                    <TableHead className="text-foreground whitespace-nowrap min-w-[120px]">Amount</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((recipient) => (
                    <TableRow key={recipient.id} className="border-border">
                      <TableCell>
                        <Select
                          value={recipient.vendorId}
                          onValueChange={(v) => updateRecipient(recipient.id, "vendorId", v)}
                        >
                          <SelectTrigger className="bg-background border-border text-foreground">
                            <SelectValue placeholder="Select tag" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            {vendors.map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="0x..."
                          value={recipient.address}
                          onChange={(e) => updateRecipient(recipient.id, "address", e.target.value)}
                          className="bg-background border-border text-foreground font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            value={recipient.token}
                            onValueChange={(v) => updateRecipient(recipient.id, "token", v)}
                          >
                            <SelectTrigger className="bg-background border-border text-foreground w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              <SelectItem value="USDT">USDT</SelectItem>
                              <SelectItem value="USDC">USDC</SelectItem>
                              <SelectItem value="DAI">DAI</SelectItem>
                              <SelectItem value="CUSTOM">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                          {useX402 && recipient.token === "USDC" && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1 border-blue-200 text-blue-600">
                              3009
                            </Badge>
                          )}
                        </div>
                        {recipient.token === "CUSTOM" && (
                          <Input
                            placeholder="Token Addr"
                            className="mt-2 h-8 text-xs font-mono"
                            value={recipient.customTokenAddress || ""}
                            onChange={(e) => updateRecipient(recipient.id, "customTokenAddress", e.target.value)}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={recipient.amount}
                          onChange={(e) => updateRecipient(recipient.id, "amount", e.target.value)}
                          className="bg-background border-border text-foreground font-mono"
                          step="0.01"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRecipient(recipient.id)}
                          disabled={recipients.length === 1}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button onClick={addRecipient} variant="outline" className="w-full border-border bg-transparent">
              <Plus className="mr-2 h-4 w-4" />
              Add Recipient
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipients</span>
                <span className="font-bold text-foreground">{recipients.filter((r) => r.address).length}</span>
              </div>
              <div className="border-t border-border pt-4 space-y-2">
                {(() => {
                  const totals = getTotalAmounts()
                  return (
                    <>
                      {totals.USDT > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total USDT</span>
                          <span className="font-mono font-bold">{totals.USDT.toFixed(2)}</span>
                        </div>
                      )}
                      {totals.USDC > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total USDC</span>
                          <span className="font-mono font-bold">{totals.USDC.toFixed(2)}</span>
                        </div>
                      )}
                      {totals.DAI > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total DAI</span>
                          <span className="font-mono font-bold">{totals.DAI.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={processBatchPayment}
            disabled={recipients.filter((r) => r.address && Number.parseFloat(r.amount) > 0).length === 0}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" />
                Send Batch Payment
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
