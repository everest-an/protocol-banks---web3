"use client"

import { useState, useEffect, useCallback } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Send,
  Plus,
  Trash2,
  FileUp,
  Save,
  Loader2,
  Clock,
  LinkIcon,
  Building2,
  Pause,
  Play,
  Settings,
  Tag,
  ChevronDown,
  Bookmark,
  Download,
} from "lucide-react"
import { createClient } from "@/lib/supabase-client" // Added for clarity, assuming this is the correct way to import
import type { Vendor, PaymentRecipient, AutoPayment } from "@/types"
import { validatePaymentData, processBatchPayment as executeBatchPayment } from "@/lib/services/payment-service"
import { validateVendorData } from "@/lib/services/vendor-service"

export default function BatchPaymentPage() {
  const { wallets, sendToken, signERC3009Authorization, isConnected } = useWeb3()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  const supabase = createClient() // Initialize Supabase client here
  const [activeTab, setActiveTab] = useState<"batch" | "auto" | "x402">("batch")
  const [isProcessing, setIsProcessing] = useState(false)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const activeChain = "EVM"
  const currentWallet = wallets[activeChain]

  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [tagFormData, setTagFormData] = useState({
    name: "",
    wallet_address: "",
    category: "",
    tier: "vendor",
    chain: "Ethereum",
    notes: "",
  })
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null)
  const [vendorSearchQuery, setVendorSearchQuery] = useState("")

  // Auto payment states
  const [autoPayments, setAutoPayments] = useState<AutoPayment[]>([])

  // Batch payment states
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([
    { id: "1", address: "", amount: "", vendorName: "", vendorId: "", token: "USDT" },
  ])

  // Demo data
  const demoVendors: Vendor[] = [
    {
      id: "v1",
      name: "Acme Corp",
      wallet_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f7DCFF",
      category: "Technology",
      type: "Partner",
      chain: "Ethereum",
    },
    {
      id: "v2",
      name: "Global Supplies Inc",
      wallet_address: "0x8B3392483BA26D65E331dB86D4F430E9B3814E5e",
      category: "Manufacturing",
      type: "Vendor",
      chain: "Polygon",
    },
    {
      id: "v3",
      name: "Tech Solutions Ltd",
      wallet_address: "0x1234567890123456789012345678901234567890",
      category: "Software",
      type: "Partner",
      chain: "Ethereum",
    },
    {
      id: "v4",
      name: "APAC Division",
      wallet_address: "0x9876543210987654321098765432109876543210",
      category: "Internal",
      type: "Subsidiary",
      chain: "Arbitrum",
    },
    {
      id: "v5",
      name: "Marketing Agency Pro",
      wallet_address: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
      category: "Marketing",
      type: "Vendor",
      chain: "Base",
    },
    {
      id: "v6",
      name: "Cloud Services Co",
      wallet_address: "0xDEF0123456789ABCDEF0123456789ABCDEF01234",
      category: "Infrastructure",
      type: "Vendor",
      chain: "Ethereum",
    },
    {
      id: "v7",
      name: "Legal Partners LLP",
      wallet_address: "0x1111222233334444555566667777888899990000",
      category: "Legal",
      type: "Partner",
      chain: "Ethereum",
    },
    {
      id: "v8",
      name: "EMEA Operations",
      wallet_address: "0x2222333344445555666677778888999900001111",
      category: "Internal",
      type: "Subsidiary",
      chain: "Polygon",
    },
  ]

  const demoAutoPayments: AutoPayment[] = [
    {
      id: "ap1",
      vendorId: "v1",
      vendorName: "Acme Corp",
      walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f7DCFF",
      amount: "5000",
      token: "USDT",
      frequency: "monthly",
      status: "active",
      nextPayment: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      maxAmount: "6000",
    },
    {
      id: "ap2",
      vendorId: "v6",
      vendorName: "Cloud Services Co",
      walletAddress: "0xDEF0123456789ABCDEF0123456789ABCDEF01234",
      amount: "2500",
      token: "USDC",
      frequency: "monthly",
      status: "active",
      nextPayment: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
    {
      id: "ap3",
      vendorId: "v4",
      vendorName: "APAC Division",
      walletAddress: "0x9876543210987654321098765432109876543210",
      amount: "15000",
      token: "USDT",
      frequency: "monthly",
      status: "paused",
      nextPayment: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    },
  ]

  // Use demo or real data
  const displayVendors = isDemoMode || !currentWallet ? demoVendors : vendors
  const displayAutoPayments = isDemoMode || !currentWallet ? demoAutoPayments : autoPayments

  // Filter vendors by search query
  const filteredVendors = displayVendors.filter(
    (v) =>
      (v.name?.toLowerCase() || "").includes(vendorSearchQuery.toLowerCase()) ||
      (v.wallet_address?.toLowerCase() || "").includes(vendorSearchQuery.toLowerCase()) ||
      (v.category?.toLowerCase() || "").includes(vendorSearchQuery.toLowerCase()),
  )

  // Load vendors from database
  const loadVendors = useCallback(async () => {
    if (!currentWallet || isDemoMode) return

    try {
      if (!supabase) return

      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("created_by", currentWallet)
        .order("created_at", { ascending: false })

      if (error) throw error
      setVendors(data || [])
    } catch (err) {
      console.error("[v0] Failed to load vendors:", err)
    }
  }, [currentWallet, isDemoMode, supabase])

  useEffect(() => {
    loadVendors()
  }, [loadVendors])

  const openTagDialog = (recipientId?: string, address?: string) => {
    setEditingRecipientId(recipientId || null)
    setTagFormData({
      name: "",
      wallet_address: address || "",
      category: "",
      tier: "vendor",
      chain: "Ethereum",
      notes: "",
    })
    setTagDialogOpen(true)
  }

  const handleImportCSV = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".csv,.xlsx,.xls"
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const lines = text.split("\n")
        const headers = lines[0].split(",").map((h) => h.trim())

        // Validate headers
        const requiredHeaders = ["address", "amount", "token"]
        const hasRequiredHeaders = requiredHeaders.every((h) => headers.includes(h))

        if (!hasRequiredHeaders) {
          toast({
            title: "Invalid CSV",
            description: `CSV must contain columns: ${requiredHeaders.join(", ")}`,
            variant: "destructive",
          })
          return
        }

        const newRecipients: PaymentRecipient[] = []
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue

          const values = line.split(",").map((v) => v.trim())
          const row: any = {}
          headers.forEach((header, index) => {
            row[header] = values[index] || ""
          })

          if (row.address && row.amount) {
            newRecipients.push({
              id: Date.now().toString() + i,
              address: row.address,
              amount: row.amount,
              vendorName: row.vendorName || row.name || "",
              vendorId: row.vendorId || "",
              token: row.token || "USDT",
            })
          }
        }

        if (newRecipients.length > 0) {
          setRecipients(newRecipients)
          toast({
            title: "Success",
            description: `Imported ${newRecipients.length} recipients from CSV`,
          })
        } else {
          toast({
            title: "No data",
            description: "No valid recipients found in CSV file",
            variant: "destructive",
          })
        }
      } catch (err: any) {
        console.error("[v0] Error importing CSV:", err)
        toast({
          title: "Import failed",
          description: err.message || "Failed to parse CSV file",
          variant: "destructive",
        })
      }
    }
    input.click()
  }, [toast])

  const handleExportCSV = useCallback(() => {
    // Create CSV content
    const headers = ["address", "amount", "token", "vendorName", "vendorId"]
    const rows = recipients.map((r) => [r.address, r.amount, r.token, r.vendorName || "", r.vendorId || ""].join(","))

    const csv = [headers.join(","), ...rows].join("\n")

    // Download file
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `batch-payment-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Exported",
      description: `Exported ${recipients.length} recipients to CSV`,
    })
  }, [recipients, toast])

  const saveWalletTag = async () => {
    try {
      // Use validation service
      const addressValidation = validateVendorData({
        wallet_address: tagFormData.wallet_address,
        name: tagFormData.name,
        category: tagFormData.category,
      })

      // ... rest of existing save logic
    } catch (error: any) {
      toast({ title: "Validation Error", description: error.message, variant: "destructive" })
      return
    }

    if (!tagFormData.name || !tagFormData.wallet_address) {
      toast({
        title: "Missing Information",
        description: "Please enter company name and wallet address.",
        variant: "destructive",
      })
      return
    }

    const addressValidation = validateVendorData(tagFormData.wallet_address)
    if (!addressValidation.isValid) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid wallet address.",
        variant: "destructive",
      })
      return
    }

    if (isDemoMode) {
      // In demo mode, just add to local state
      const newVendor: Vendor = {
        id: `demo-${Date.now()}`,
        name: tagFormData.name,
        wallet_address: addressValidation.checksumAddress || tagFormData.wallet_address,
        category: tagFormData.category,
        type: tagFormData.tier,
        chain: tagFormData.chain,
      }
      setVendors((prev) => [...prev, newVendor])

      // If editing a recipient, update it with the new vendor
      if (editingRecipientId) {
        updateRecipient(editingRecipientId, "vendorId", newVendor.id)
        updateRecipient(editingRecipientId, "vendorName", newVendor.name)
        updateRecipient(editingRecipientId, "address", newVendor.wallet_address)
      }

      toast({ title: "Success", description: "Wallet tagged successfully (Demo Mode)" })
      setTagDialogOpen(false)
      return
    }

    if (!currentWallet) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to save tags.",
        variant: "destructive",
      })
      return
    }

    try {
      if (!supabase) throw new Error("Database not available")

      const { data, error } = await supabase
        .from("vendors")
        .insert({
          name: tagFormData.name,
          wallet_address: addressValidation.checksumAddress || tagFormData.wallet_address,
          category: tagFormData.category,
          tier: tagFormData.tier,
          notes: tagFormData.notes,
          created_by: currentWallet,
        })
        .select()
        .single()

      if (error) throw error

      // Refresh vendors list
      await loadVendors()

      // If editing a recipient, update it
      if (editingRecipientId && data) {
        updateRecipient(editingRecipientId, "vendorId", data.id)
        updateRecipient(editingRecipientId, "vendorName", data.name)
        updateRecipient(editingRecipientId, "address", data.wallet_address)
      }

      toast({ title: "Success", description: "Wallet tagged successfully" })
      setTagDialogOpen(false)
    } catch (err: any) {
      console.error("[v0] Failed to save wallet tag:", err)
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  // Select vendor and auto-fill address
  const selectVendorForRecipient = (recipientId: string, vendorId: string) => {
    const vendor = displayVendors.find((v) => v.id === vendorId)
    if (vendor) {
      updateRecipient(recipientId, "vendorId", vendor.id)
      updateRecipient(recipientId, "vendorName", vendor.name)
      updateRecipient(recipientId, "address", vendor.wallet_address)
    }
  }

  // Batch payment functions
  const addRecipient = () => {
    setRecipients([
      ...recipients,
      { id: Date.now().toString(), address: "", amount: "", vendorName: "", vendorId: "", token: "USDT" },
    ])
  }

  const removeRecipient = (id: string) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((r) => r.id !== id))
    }
  }

  const updateRecipient = (id: string, field: keyof PaymentRecipient, value: any) => {
    setRecipients(recipients.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const getTotalAmounts = () => {
    return recipients.reduce(
      (acc, r) => {
        const amount = Number.parseFloat(r.amount) || 0
        // Ensure token exists in accumulator before adding
        if (acc[r.token] !== undefined) {
          acc[r.token] = (acc[r.token] || 0) + amount
        }
        return acc
      },
      { USDT: 0, USDC: 0, DAI: 0 } as Record<string, number>,
    )
  }

  const saveDraft = () => {
    localStorage.setItem("batchPaymentDraft", JSON.stringify(recipients))
    toast({ title: "Draft Saved", description: "Your payment draft has been saved locally." })
  }

  // Process batch payment
  const processBatchPayment = async () => {
    console.log("[v0] Starting batch payment process...")
    console.log("[v0] Current wallet:", currentWallet)
    console.log("[v0] Recipients:", recipients.length)

    if (!currentWallet) {
      toast({ title: "Wallet Required", description: "Please connect your wallet first.", variant: "destructive" })
      return
    }

    // Use validation service
    try {
      const validRecipients = recipients.filter((r) => r.address && r.amount)
      validatePaymentData(validRecipients)
    } catch (error: any) {
      toast({ title: "Validation Error", description: error.message, variant: "destructive" })
      return
    }

    setIsProcessing(true)

    try {
      // Use service layer for batch payment execution
      const result = await executeBatchPayment(recipients, currentWallet, isDemoMode)

      toast({
        title: "Batch Payment Complete",
        description: `Successfully paid ${result.successCount} recipients (${result.totalPaid} USDT)`,
      })

      // Clear recipients on success
      setRecipients([{ id: "1", address: "", amount: "", vendorName: "", vendorId: "", token: "USDT" }])
    } catch (error: any) {
      console.error("[v0] Batch payment failed:", error)
      toast({ title: "Payment Failed", description: error.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const toggleAutoPaymentStatus = (id: string) => {
    setAutoPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: p.status === "active" ? "paused" : "active" } : p)),
    )
  }

  return (
    <main className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Mode Toggle - REMOVED */}

      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Payments</h1>
          <p className="text-muted-foreground">Manage batch payments and auto-payments for your business</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="batch">Batch Payment</TabsTrigger>
          <TabsTrigger value="auto">Auto Payments</TabsTrigger>
          <TabsTrigger value="x402">x402 Bill Pay</TabsTrigger>
        </TabsList>

        {/* Personal Mode - Subscription Management - REMOVED */}

        <TabsContent value="batch" className="space-y-6">
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Recipients Card */}
            <Card className="lg:col-span-8 bg-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recipients</CardTitle>
                  <CardDescription>Add payment recipients from your contacts or enter new addresses</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openTagDialog()}>
                    <Tag className="h-4 w-4 mr-2" />
                    New Tag
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleImportCSV}>
                    <FileUp className="h-4 w-4 mr-2" />
                    Import CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Vendor / Contact</TableHead>
                        <TableHead className="w-[280px]">Address</TableHead>
                        <TableHead className="w-[100px]">Token</TableHead>
                        <TableHead className="w-[120px]">Amount</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipients.map((recipient) => (
                        <TableRow key={recipient.id}>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between bg-transparent">
                                  {recipient.vendorName || "Select contact..."}
                                  <ChevronDown className="h-4 w-4 ml-2" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-[280px]" align="start">
                                <div className="p-2">
                                  <Input
                                    placeholder="Search contacts..."
                                    value={vendorSearchQuery}
                                    onChange={(e) => setVendorSearchQuery(e.target.value)}
                                    className="mb-2"
                                  />
                                </div>
                                <div className="max-h-[200px] overflow-y-auto">
                                  {filteredVendors.map((vendor) => (
                                    <DropdownMenuItem
                                      key={vendor.id}
                                      onClick={() => selectVendorForRecipient(recipient.id, vendor.id)}
                                    >
                                      <div className="flex items-center gap-2 w-full">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                                          {vendor.name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium truncate">{vendor.name}</div>
                                          <div className="text-xs text-muted-foreground font-mono truncate">
                                            {vendor.wallet_address.slice(0, 10)}...
                                          </div>
                                        </div>
                                        <Badge variant="outline" className="text-xs shrink-0">
                                          {vendor.type || vendor.category || "Vendor"}
                                        </Badge>
                                      </div>
                                    </DropdownMenuItem>
                                  ))}
                                </div>
                                <div className="border-t p-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start"
                                    onClick={() => openTagDialog(recipient.id)}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add new contact
                                  </Button>
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Input
                                placeholder="0x..."
                                value={recipient.address}
                                onChange={(e) => updateRecipient(recipient.id, "address", e.target.value)}
                                className="font-mono"
                              />
                              {recipient.address && !recipient.vendorId && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openTagDialog(recipient.id, recipient.address)}
                                  title="Tag this address"
                                >
                                  <Tag className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={recipient.token}
                              onValueChange={(v) => updateRecipient(recipient.id, "token", v)}
                            >
                              <SelectTrigger className="w-[90px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USDT">USDT</SelectItem>
                                <SelectItem value="USDC">USDC</SelectItem>
                                <SelectItem value="DAI">DAI</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={recipient.amount}
                              onChange={(e) => updateRecipient(recipient.id, "amount", e.target.value)}
                              className="font-mono"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRecipient(recipient.id)}
                              disabled={recipients.length === 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Button onClick={addRecipient} variant="outline" className="w-full mt-4 bg-transparent">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Recipient
                </Button>
              </CardContent>
            </Card>

            {/* Summary Card */}
            <Card className="lg:col-span-4 h-fit sticky top-24 bg-card">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipients</span>
                  <span className="font-bold">{recipients.filter((r) => r.address).length}</span>
                </div>
                {(() => {
                  const totals = getTotalAmounts()
                  const grandTotal = totals.USDT + totals.USDC + totals.DAI
                  return grandTotal > 0 ? (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                      <div className="text-xs text-muted-foreground mb-1">Total</div>
                      <div className="text-2xl font-bold text-primary font-mono">${(grandTotal || 0).toFixed(2)}</div>
                    </div>
                  ) : null
                })()}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={saveDraft} className="flex-1 bg-transparent">
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </div>

                <Button className="w-full" size="lg" onClick={processBatchPayment} disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Payment
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="auto" className="space-y-6">
          <Alert className="bg-blue-500/10 border-blue-500/20">
            <Clock className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-500">Automated Payments</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Set up recurring payments to vendors. All auto-payments can be paused at any time.
            </AlertDescription>
          </Alert>

          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Scheduled Auto-Payments</CardTitle>
                <CardDescription>Manage recurring vendor payments</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Auto-Payment
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {displayAutoPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      payment.status === "paused" ? "bg-amber-500/5 border-amber-500/20" : "bg-muted/30 border-border"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {payment.vendorName}
                          <Badge variant={payment.status === "active" ? "default" : "secondary"}>
                            {payment.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ${payment.amount} {payment.token} / {payment.frequency}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Next: {payment.nextPayment.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => toggleAutoPaymentStatus(payment.id)}>
                        {payment.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="x402" className="space-y-6">
          <Alert className="bg-purple-500/10 border-purple-500/20">
            <LinkIcon className="h-4 w-4 text-purple-500" />
            <AlertTitle className="text-purple-500">x402 Protocol</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Pay bills via payment links. Scan QR codes or paste x402 links to pay instantly.
            </AlertDescription>
          </Alert>

          <Card className="bg-card">
            <CardHeader>
              <CardTitle>Pay via Link</CardTitle>
              <CardDescription>Enter an x402 payment link or scan QR code</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Payment Link</Label>
                <Input placeholder="x402://pay?..." className="font-mono" />
              </div>
              <Button className="w-full">
                <Send className="h-4 w-4 mr-2" />
                Process Payment
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment History Section - Placeholder */}
      <Card className="bg-card mt-6">
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Recent outgoing transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Payment history is not yet implemented.</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Tag Wallet Address
            </DialogTitle>
            <DialogDescription>
              Save this wallet with business metadata for easier identification in future payments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Wallet Address</Label>
              <Input
                placeholder="0x..."
                className="font-mono"
                value={tagFormData.wallet_address}
                onChange={(e) => setTagFormData({ ...tagFormData, wallet_address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Company / Entity Name</Label>
              <Input
                placeholder="e.g. Acme Corp"
                value={tagFormData.name}
                onChange={(e) => setTagFormData({ ...tagFormData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={tagFormData.category}
                  onValueChange={(v) => setTagFormData({ ...tagFormData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Legal">Legal</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Internal">Internal</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={tagFormData.tier} onValueChange={(v) => setTagFormData({ ...tagFormData, tier: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                    <SelectItem value="subsidiary">Subsidiary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Chain</Label>
              <Select value={tagFormData.chain} onValueChange={(v) => setTagFormData({ ...tagFormData, chain: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ethereum">Ethereum</SelectItem>
                  <SelectItem value="Polygon">Polygon</SelectItem>
                  <SelectItem value="Arbitrum">Arbitrum</SelectItem>
                  <SelectItem value="Base">Base</SelectItem>
                  <SelectItem value="Optimism">Optimism</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Additional details..."
                value={tagFormData.notes}
                onChange={(e) => setTagFormData({ ...tagFormData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveWalletTag}>
              <Bookmark className="h-4 w-4 mr-2" />
              Save Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
