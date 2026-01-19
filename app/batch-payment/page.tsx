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
import { ethers } from "ethers"
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
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Shield,
  Users,
} from "lucide-react"
import { createClient } from "@/lib/supabase-client"
import type { Vendor, PaymentRecipient, AutoPayment } from "@/types"
import { validatePaymentData, processBatchPayment as executeBatchPayment } from "@/lib/services/payment-service"
import { validateVendorData } from "@/lib/services/vendor-service"
import { parsePaymentFile, generateSampleCSV, generateSampleExcel, type ParseResult } from "@/lib/excel-parser"
import { multisigService, type MultisigWallet } from "@/lib/multisig"

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

  const [importResultOpen, setImportResultOpen] = useState(false)
  const [importResult, setImportResult] = useState<ParseResult | null>(null)

  const [multisigWallets, setMultisigWallets] = useState<MultisigWallet[]>([])
  const [selectedMultisig, setSelectedMultisig] = useState<string | null>(null)
  const [useMultisig, setUseMultisig] = useState(false)

  const [batchHistory, setBatchHistory] = useState<
    Array<{
      id: string
      batch_name?: string | null
      status: string
      total_amount: number | null
      total_fee: number | null
      item_count: number | null
      successful_count: number | null
      failed_count: number | null
      created_at: string
    }>
  >([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Auto payment states
  const [autoPayments, setAutoPayments] = useState<AutoPayment[]>([])

  const [x402Link, setX402Link] = useState("")
  const [x402Processing, setX402Processing] = useState(false)

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
  const displayVendors = isDemoMode ? demoVendors : vendors
  const displayAutoPayments = isDemoMode ? demoAutoPayments : autoPayments

  // Filter vendors by search query
  const filteredVendors = displayVendors.filter(
    (v) =>
      (v.name?.toLowerCase() || "").includes(vendorSearchQuery.toLowerCase()) ||
      (v.wallet_address?.toLowerCase() || "").includes(vendorSearchQuery.toLowerCase()) ||
      (v.category?.toLowerCase() || "").includes(vendorSearchQuery.toLowerCase()),
  )

  // Load vendors from database
  const loadVendors = useCallback(async () => {
    if (isDemoMode) return
    if (!currentWallet) {
      setVendors([])
      return
    }

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

  const loadMultisigWallets = useCallback(async () => {
    if (isDemoMode || !currentWallet) return

    try {
      const wallets = await multisigService.getWallets(currentWallet)
      setMultisigWallets(wallets)
    } catch (err) {
      console.error("[v0] Error loading multisig wallets:", err)
    }
  }, [isDemoMode, currentWallet])

  useEffect(() => {
    loadMultisigWallets()
  }, [loadMultisigWallets])

  useEffect(() => {
    const loadHistory = async () => {
      if (!isConnected || !currentWallet) {
        setBatchHistory([])
        return
      }

      if (isDemoMode) {
        setBatchHistory([
          {
            id: "demo-batch-1",
            batch_name: "Demo Payroll",
            status: "completed",
            total_amount: 42000,
            total_fee: 52,
            item_count: 8,
            successful_count: 8,
            failed_count: 0,
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          },
          {
            id: "demo-batch-2",
            batch_name: "Demo Vendors",
            status: "processing",
            total_amount: 12500,
            total_fee: 18,
            item_count: 5,
            successful_count: 3,
            failed_count: 0,
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
          },
        ])
        return
      }

      setHistoryLoading(true)
      try {
        const response = await fetch("/api/batch-payment/history?limit=10")
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load history")
        }
        setBatchHistory(data.batches || [])
      } catch (error) {
        console.error("[Batch] Failed to load history", error)
        setBatchHistory([])
      } finally {
        setHistoryLoading(false)
      }
    }

    loadHistory()
  }, [isConnected, currentWallet, isDemoMode])

  const parseX402Link = (link: string) => {
    const trimmed = link.trim()
    if (!trimmed) {
      throw new Error("Payment link is required")
    }

    const normalized = trimmed.replace(/^x402:\/\//, "https://")
    const url = new URL(normalized)

    const tokenAddress = url.searchParams.get("token") || url.searchParams.get("tokenAddress")
    const chainIdValue = url.searchParams.get("chainId") || url.searchParams.get("chain")
    const toAddress = url.searchParams.get("to") || url.searchParams.get("toAddress")
    const amount = url.searchParams.get("amount")
    const validityDurationValue = url.searchParams.get("validity") || url.searchParams.get("validityDuration")

    if (!tokenAddress || !chainIdValue || !toAddress || !amount) {
      throw new Error("Missing token, chainId, to, or amount in link")
    }

    const chainId = Number.parseInt(chainIdValue, 10)
    if (Number.isNaN(chainId)) {
      throw new Error("Invalid chainId in link")
    }

    const validityDuration = validityDurationValue ? Number.parseInt(validityDurationValue, 10) : undefined

    return { tokenAddress, chainId, toAddress, amount, validityDuration }
  }

  const handleX402Payment = async () => {
    if (!wallets.EVM || !isConnected) {
      toast({ title: "Wallet required", description: "Connect an EVM wallet to continue" })
      return
    }

    setX402Processing(true)
    try {
      const { tokenAddress, chainId, toAddress, amount, validityDuration } = parseX402Link(x402Link)

      const genResponse = await fetch("/api/x402/generate-authorization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenAddress, chainId, toAddress, amount, validityDuration }),
      })

      const genData = await genResponse.json()
      if (!genResponse.ok) {
        throw new Error(genData?.error || "Failed to generate authorization")
      }

      if (!window.ethereum) {
        throw new Error("Wallet provider not available")
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const signature = await signer.signTypedData(genData.domain, genData.types, genData.message)

      const submitResponse = await fetch("/api/x402/submit-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorizationId: genData.authorizationId,
          domain: genData.domain,
          message: genData.message,
          signature,
        }),
      })

      const submitData = await submitResponse.json()
      if (!submitResponse.ok) {
        throw new Error(submitData?.error || "Failed to submit signature")
      }

      const relayerResponse = await fetch("/api/x402/submit-to-relayer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorizationId: genData.authorizationId }),
      })

      const relayerData = await relayerResponse.json()
      if (!relayerResponse.ok) {
        throw new Error(relayerData?.error || "Failed to submit to relayer")
      }

      toast({ title: "Payment submitted", description: "x402 payment sent to relayer" })
      setX402Link("")
    } catch (error) {
      console.error("[x402] Payment failed", error)
      toast({
        title: "Payment failed",
        description: error instanceof Error ? error.message : "Unable to process payment",
      })
    } finally {
      setX402Processing(false)
    }
  }

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

  const handleImportFile = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".csv,.xlsx,.xls"
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return

      setIsProcessing(true)
      try {
        const result = await parsePaymentFile(file)
        setImportResult(result)
        setImportResultOpen(true)

        if (result.success && result.recipients.length > 0) {
          // Convert to PaymentRecipient format
          const newRecipients: PaymentRecipient[] = result.recipients.map((r, i) => ({
            id: Date.now().toString() + i,
            address: r.address,
            amount: r.amount,
            vendorName: r.vendorName || "",
            vendorId: r.vendorId || "",
            token: r.token || "USDT",
          }))
          setRecipients(newRecipients)
        }
      } catch (err: any) {
        toast({
          title: "Import failed",
          description: err.message || "Failed to parse file",
          variant: "destructive",
        })
      } finally {
        setIsProcessing(false)
      }
    }
    input.click()
  }, [toast])

  const handleDownloadTemplate = useCallback(
    (format: "csv" | "xlsx") => {
      if (format === "csv") {
        const csv = generateSampleCSV()
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = "batch-payment-template.csv"
        link.click()
      } else {
        const blob = generateSampleExcel()
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = "batch-payment-template.xlsx"
        link.click()
      }

      toast({
        title: "Template Downloaded",
        description: `Sample ${format.toUpperCase()} template downloaded`,
      })
    },
    [toast],
  )

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

  const processBatchPayment = async () => {
    if (!currentWallet) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      })
      return
    }

    const validRecipients = recipients.filter((r) => r.address && r.amount)
    if (validRecipients.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one valid recipient",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    try {
      if (useMultisig && selectedMultisig) {
        // Create multi-sig transaction proposal instead of direct payment
        const totalAmount = validRecipients.reduce((sum, r) => sum + Number.parseFloat(r.amount), 0)

        await multisigService.createTransaction({
          multisigId: selectedMultisig,
          toAddress: validRecipients[0].address, // For batch, use contract address
          value: totalAmount.toString(),
          description: `Batch payment to ${validRecipients.length} recipients`,
          tokenSymbol: validRecipients[0].token,
          amountUsd: totalAmount,
          createdBy: currentWallet,
        })

        toast({
          title: "Transaction Proposed",
          description: `Batch payment submitted for multi-sig approval (${multisigWallets.find((w) => w.id === selectedMultisig)?.threshold} signatures required)`,
        })
      } else {
        // Direct payment (existing logic)
        // Use validation service
        try {
          validatePaymentData(validRecipients)
        } catch (error: any) {
          toast({ title: "Validation Error", description: error.message, variant: "destructive" })
          return
        }

        // Use service layer for batch payment execution
        const result = await executeBatchPayment(recipients, currentWallet, isDemoMode)

        toast({
          title: "Batch Payment Complete",
          description: `Successfully paid ${result.successCount} recipients (${result.totalPaid} USDT)`,
        })
      }

      // Reset form
      setRecipients([{ id: "1", address: "", amount: "", vendorName: "", vendorId: "", token: "USDT" }])
    } catch (err: any) {
      console.error("[v0] Batch payment failed:", err)
      toast({
        title: "Payment failed",
        description: err.message || "Failed to process batch payment",
        variant: "destructive",
      })
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
          {multisigWallets.length > 0 && (
            <Card className="border-cyan-500/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-cyan-400" />
                  <CardTitle className="text-base">Multi-sig Protection</CardTitle>
                </div>
                <CardDescription>Enable multi-signature approval for this batch payment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useMultisig}
                      onChange={(e) => setUseMultisig(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-sm">Require multi-sig approval</span>
                  </label>

                  {useMultisig && (
                    <Select value={selectedMultisig || ""} onValueChange={setSelectedMultisig}>
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Select multi-sig wallet" />
                      </SelectTrigger>
                      <SelectContent>
                        {multisigWallets.map((wallet) => (
                          <SelectItem key={wallet.id} value={wallet.id}>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>{wallet.name}</span>
                              <Badge variant="outline" className="ml-2">
                                {wallet.threshold}/{wallet.signers?.length || 0}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid lg:grid-cols-12 gap-6">
            {/* Recipients Card */}
            <Card className="lg:col-span-8 bg-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recipients</CardTitle>
                  <CardDescription>Add payment recipients from your contacts or import from file</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openTagDialog()}>
                    <Tag className="h-4 w-4 mr-2" />
                    New Tag
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FileUp className="h-4 w-4 mr-2" />
                        Import
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleImportFile}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Import CSV/Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadTemplate("csv")}>
                        <Download className="h-4 w-4 mr-2" />
                        Download CSV Template
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadTemplate("xlsx")}>
                        <Download className="h-4 w-4 mr-2" />
                        Download Excel Template
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
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
          <div className="flex justify-end gap-4">
            <Button
              onClick={processBatchPayment}
              disabled={isProcessing || recipients.filter((r) => r.address && r.amount).length === 0}
              className="bg-cyan-500 hover:bg-cyan-600"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : useMultisig ? (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Submit for Approval
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Process Batch Payment
                </>
              )}
            </Button>
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
                <Input
                  placeholder="x402://pay?..."
                  className="font-mono"
                  value={x402Link}
                  onChange={(e) => setX402Link(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={handleX402Payment} disabled={x402Processing}>
                {x402Processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {x402Processing ? "Processing..." : "Process Payment"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="bg-card mt-6">
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Recent outgoing transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading history...</div>
          ) : batchHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No batch payments yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Success / Failed</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchHistory.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">
                      {batch.batch_name || batch.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {batch.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{batch.item_count ?? 0}</TableCell>
                    <TableCell className="text-right font-mono">
                      {(batch.successful_count ?? 0).toString()} / {(batch.failed_count ?? 0).toString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {batch.total_amount != null ? batch.total_amount.toFixed(2) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {batch.total_fee != null ? batch.total_fee.toFixed(2) : "-"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(batch.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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

      <Dialog open={importResultOpen} onOpenChange={setImportResultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importResult?.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              Import {importResult?.success ? "Successful" : "Failed"}
            </DialogTitle>
            <DialogDescription>
              {importResult?.success
                ? `Successfully imported ${importResult.recipients.length} recipients`
                : "Failed to import file"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Detected Fields */}
            {importResult?.detectedFields && importResult.detectedFields.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Detected Fields</h4>
                <div className="flex flex-wrap gap-2">
                  {importResult.detectedFields.map((field, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {importResult?.warnings && importResult.warnings.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-yellow-500">Warnings</h4>
                <ul className="text-sm text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                  {importResult.warnings.map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Errors */}
            {importResult?.errors && importResult.errors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-red-500">Errors</h4>
                <ul className="text-sm text-red-400 space-y-1">
                  {importResult.errors.map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportResultOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
