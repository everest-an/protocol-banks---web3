"use client"

import { useState, useEffect } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Send, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { sendToken, getTokenAddress, getTokenBalance } from "@/lib/web3"
import { getSupabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Wallet, Bitcoin } from "lucide-react"

interface PaymentRecipient {
  id: string
  address: string
  amount: string
  vendorName?: string
  vendorId?: string
}

interface Vendor {
  id: string
  wallet_address: string
  name: string
}

export default function BatchPaymentPage() {
  const { wallets, activeChain, setActiveChain, isConnected, usdtBalance, usdcBalance, daiBalance, chainId } = useWeb3()
  const { toast } = useToast()
  const router = useRouter()

  const currentWallet = wallets[activeChain]

  const [recipients, setRecipients] = useState<PaymentRecipient[]>([
    { id: "1", address: "", amount: "", vendorName: "", vendorId: "" },
  ])
  const [selectedToken, setSelectedToken] = useState<"USDT" | "USDC" | "DAI" | "CUSTOM">("USDT")
  const [customTokenAddress, setCustomTokenAddress] = useState("")
  const [customTokenBalance, setCustomTokenBalance] = useState("0")
  const [isProcessing, setIsProcessing] = useState(false)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loadingVendors, setLoadingVendors] = useState(true)

  useEffect(() => {
    if (isConnected && currentWallet) {
      loadVendors()
    }
  }, [isConnected, currentWallet])

  useEffect(() => {
    const fetchCustomBalance = async () => {
      if (selectedToken === "CUSTOM" && customTokenAddress && currentWallet && customTokenAddress.length === 42) {
        try {
          const balance = await getTokenBalance(currentWallet, customTokenAddress)
          setCustomTokenBalance(balance)
        } catch (e) {
          console.error("Failed to fetch custom token balance", e)
          setCustomTokenBalance("0")
        }
      }
    }
    fetchCustomBalance()
  }, [selectedToken, customTokenAddress, currentWallet])

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
    setRecipients([...recipients, { id: Date.now().toString(), address: "", amount: "", vendorName: "", vendorId: "" }])
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
          return { ...r, [field]: value }
        }
        return r
      }),
    )
  }

  const getTotalAmount = () => {
    return recipients.reduce((sum, r) => sum + (Number.parseFloat(r.amount) || 0), 0).toFixed(2)
  }

  const getCurrentBalance = () => {
    if (activeChain !== "EVM") return 0

    switch (selectedToken) {
      case "USDT":
        return Number.parseFloat(usdtBalance)
      case "USDC":
        return Number.parseFloat(usdcBalance)
      case "DAI":
        return Number.parseFloat(daiBalance)
      case "CUSTOM":
        return Number.parseFloat(customTokenBalance)
      default:
        return 0
    }
  }

  const processBatchPayment = async () => {
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

    if (selectedToken === "CUSTOM" && !customTokenAddress) {
      toast({
        title: "Invalid Token",
        description: "Please enter a valid token address",
        variant: "destructive",
      })
      return
    }

    const validRecipients = recipients.filter((r) => r.address && Number.parseFloat(r.amount) > 0)

    if (validRecipients.length === 0) {
      toast({
        title: "No valid recipients",
        description: "Please add at least one recipient with a valid address and amount",
        variant: "destructive",
      })
      return
    }

    const total = Number.parseFloat(getTotalAmount())
    const currentBalance = getCurrentBalance()

    if (total > currentBalance) {
      toast({
        title: "Insufficient balance",
        description: `You need ${total} ${selectedToken} but only have ${currentBalance.toFixed(2)}`,
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    const supabase = getSupabase()

    try {
      if (!supabase) {
        toast({
          title: "Configuration Error",
          description: "Supabase is not configured correctly. Please check environment variables.",
          variant: "destructive",
        })
        setIsProcessing(false)
        return
      }

      let tokenAddress = ""
      if (selectedToken === "CUSTOM") {
        tokenAddress = customTokenAddress
      } else {
        const addr = getTokenAddress(chainId, selectedToken)
        if (!addr) throw new Error(`Token address not found for ${selectedToken}`)
        tokenAddress = addr
      }

      const { data: batchData, error: batchError } = await supabase
        .from("batch_payments")
        .insert({
          wallet_address: currentWallet,
          total_recipients: validRecipients.length,
          total_amount_usd: total,
          status: "processing",
          batch_name: `Batch ${new Date().toLocaleDateString()}`,
        })
        .select()
        .single()

      if (batchError) throw batchError

      for (const recipient of validRecipients) {
        try {
          const txHash = await sendToken(tokenAddress, recipient.address, recipient.amount)

          const { data: paymentData, error: paymentError } = await supabase
            .from("payments")
            .insert({
              tx_hash: txHash,
              from_address: currentWallet,
              to_address: recipient.address,
              vendor_id: recipient.vendorId || null,
              token_symbol: selectedToken === "CUSTOM" ? "CUSTOM" : selectedToken,
              token_address: tokenAddress,
              amount: recipient.amount,
              amount_usd: Number.parseFloat(recipient.amount),
              status: "completed",
            })
            .select()
            .single()

          if (paymentError) throw paymentError

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
        description: `Successfully sent ${selectedToken} to ${validRecipients.length} recipients`,
      })

      setRecipients([{ id: "1", address: "", amount: "", vendorName: "", vendorId: "" }])

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

  if (!isConnected) {
    return (
      <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <Card className="max-w-md w-full bg-card border-border">
          <CardHeader className="text-center">
            <CardTitle className="text-foreground">Connect Wallet</CardTitle>
            <CardDescription className="text-muted-foreground">
              Please connect your wallet to create batch payments
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-8 px-4 space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-foreground">Batch Payment</h1>
        <p className="text-muted-foreground">Send crypto to multiple recipients at once</p>
      </div>

      <div className="flex gap-4 mb-6">
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
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[150px]">
                <Label className="text-foreground">Token</Label>
                <Select value={selectedToken} onValueChange={(v: any) => setSelectedToken(v)}>
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="USDT">USDT</SelectItem>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="DAI">DAI</SelectItem>
                    <SelectItem value="CUSTOM">Custom Token</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedToken === "CUSTOM" && (
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-foreground">Token Address</Label>
                  <Input
                    placeholder="0x..."
                    value={customTokenAddress}
                    onChange={(e) => setCustomTokenAddress(e.target.value)}
                    className="bg-background border-border text-foreground font-mono"
                  />
                </div>
              )}
              <div className="flex-1 min-w-[150px]">
                <Label className="text-muted-foreground">Available Balance</Label>
                <div className="text-2xl font-bold text-foreground font-mono mt-2">
                  {getCurrentBalance().toFixed(2)}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                    <TableHead className="text-foreground whitespace-nowrap min-w-[150px]">Wallet Tag</TableHead>
                    <TableHead className="text-foreground whitespace-nowrap min-w-[200px]">Wallet Address</TableHead>
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Token</span>
                <Badge variant="secondary">{selectedToken}</Badge>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-foreground font-medium">Total Amount</span>
                  <span className="text-2xl font-bold text-foreground font-mono">{getTotalAmount()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={processBatchPayment}
            disabled={
              isProcessing || recipients.filter((r) => r.address && Number.parseFloat(r.amount) > 0).length === 0
            }
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
