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
import { sendToken } from "@/lib/web3"
import { getSupabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

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
  const { wallet, isConnected, usdtBalance, usdcBalance } = useWeb3()
  const { toast } = useToast()
  const router = useRouter()

  const [recipients, setRecipients] = useState<PaymentRecipient[]>([
    { id: "1", address: "", amount: "", vendorName: "", vendorId: "" },
  ])
  const [selectedToken, setSelectedToken] = useState<"USDT" | "USDC">("USDT")
  const [isProcessing, setIsProcessing] = useState(false)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loadingVendors, setLoadingVendors] = useState(true)

  useEffect(() => {
    if (isConnected && wallet) {
      loadVendors()
    }
  }, [isConnected, wallet])

  const loadVendors = async () => {
    try {
      const supabase = getSupabase()

      if (!supabase) {
        console.warn("[v0] Supabase client not initialized")
        setLoadingVendors(false)
        return
      }

      const { data, error } = await supabase.from("vendors").select("*").eq("created_by", wallet).order("name")

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

  const processBatchPayment = async () => {
    if (!isConnected || !wallet) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
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
    const currentBalance = Number.parseFloat(selectedToken === "USDT" ? usdtBalance : usdcBalance)

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
    // const tokenAddress = TOKEN_ADDRESSES[selectedToken]

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

      // Create batch payment record
      const { data: batchData, error: batchError } = await supabase
        .from("batch_payments")
        .insert({
          wallet_address: wallet,
          total_recipients: validRecipients.length,
          total_amount_usd: total,
          status: "processing",
          batch_name: `Batch ${new Date().toLocaleDateString()}`,
        })
        .select()
        .single()

      if (batchError) throw batchError

      // Process each payment
      for (const recipient of validRecipients) {
        try {
          const txHash = await sendToken(selectedToken, recipient.address, recipient.amount)

          // Save payment record
          const { data: paymentData, error: paymentError } = await supabase
            .from("payments")
            .insert({
              tx_hash: txHash,
              from_address: wallet,
              to_address: recipient.address,
              vendor_id: recipient.vendorId || null,
              token_symbol: selectedToken,
              // or we could look it up if needed. For now, storing a placeholder or looking it up via helper if critical.
              // Ideally we should store the chain ID too.
              token_address: "0x...", // Simplified for now as address depends on chain
              amount: recipient.amount,
              amount_usd: Number.parseFloat(recipient.amount),
              status: "completed",
            })
            .select()
            .single()

          if (paymentError) throw paymentError

          // Link payment to batch
          await supabase.from("batch_payment_items").insert({
            batch_id: batchData.id,
            payment_id: paymentData.id,
          })
        } catch (error) {
          console.error("[v0] Payment failed for", recipient.address, error)
          throw error
        }
      }

      // Update batch status
      await supabase
        .from("batch_payments")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", batchData.id)

      toast({
        title: "Batch payment successful",
        description: `Successfully sent ${selectedToken} to ${validRecipients.length} recipients`,
      })

      // Reset form
      setRecipients([{ id: "1", address: "", amount: "", vendorName: "", vendorId: "" }])

      // Redirect to analytics after 2 seconds
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

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Recipients</CardTitle>
            <CardDescription className="text-muted-foreground">
              Add wallet addresses and amounts for batch payment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-foreground">Token</Label>
                <Select value={selectedToken} onValueChange={(v: any) => setSelectedToken(v)}>
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="USDT">USDT</SelectItem>
                    <SelectItem value="USDC">USDC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-muted-foreground">Available Balance</Label>
                <div className="text-2xl font-bold text-foreground font-mono mt-2">
                  {selectedToken === "USDT"
                    ? Number.parseFloat(usdtBalance).toFixed(2)
                    : Number.parseFloat(usdcBalance).toFixed(2)}
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
