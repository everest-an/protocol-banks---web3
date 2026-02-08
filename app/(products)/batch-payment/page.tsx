"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useBatchPayment } from "@/hooks/use-batch-payment"
import { useAsyncBatchPayment } from "@/hooks/use-async-batch-payment"
import { BatchStatusTracker } from "@/components/batch-status-tracker"
import { BatchTransferProgress, type BatchTransferStep } from "@/components/batch-transfer-progress"
import { PaymentActivity } from "@/components/payment-activity"
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
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Shield,
  Users,
} from "lucide-react"
import { authHeaders } from "@/lib/authenticated-fetch"
import { PurposeTagSelector } from "@/components/purpose-tag-selector"
import { PaymentGroupSelector } from "@/components/payment-group-selector"
import type { Vendor, PaymentRecipient, AutoPayment, VendorCategory } from "@/types"
import { validatePaymentData, processBatchPayment as executeBatchPayment } from "@/lib/services/payment-service"
import { validateVendorData } from "@/lib/services/vendor-service"
import { parsePaymentFile, generateSampleCSV, generateSampleExcel, type ParseResult } from "@/lib/excel-parser"
import { getInjectedEthereum } from "@/lib/web3"
import { multisigService, type MultisigWallet } from "@/lib/multisig"
import { publicBatchTransferService } from "@/lib/services/public-batch-transfer-service"
import { createWalletClient, createPublicClient, http, custom } from "viem"
import { arbitrum } from "viem/chains"
import { getVendorDisplayName, getVendorInitials } from "@/lib/utils"
import { CHAIN_IDS } from "@/lib/web3"

export default function BatchPaymentPage() {
  const {
    wallets,
    address: unifiedAddress,
    sendToken,
    signERC3009Authorization,
    isConnected,
    chainId,
    switchNetwork,
    connectWallet,
    activeChain,
    setActiveChain,
    isConnecting,
  } = useUnifiedWallet()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()

  // Use the batch payment hook for API integration
  const {
    uploadFile,
    validateBatch,
    submitBatch,
    batchStatus,
    loading: batchLoading,
    error: batchError,
  } = useBatchPayment()

  // New Async Batch Payment Hook
  const {
    uploadFile: uploadAsyncFile,
    executeBatch: executeAsyncBatch,
    jobId: asyncJobId,
    jobStatus: asyncJobStatus,
    isUploading: isAsyncUploading,
    isPolling: isAsyncPolling
  } = useAsyncBatchPayment()

  if (chainId === CHAIN_IDS.HASHKEY) {
    return (
      <div className="container max-w-7xl pt-8 pb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Batch Payments</h1>
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unsupported Network</AlertTitle>
          <AlertDescription className="mt-2">
            Corporate batch transfers are not available on HashKey Chain due to network constraints.
            <br />
            Please use <strong>Base</strong> or <strong>Arbitrum</strong> for bulk corporate settlements.
            <br className="mb-4"/>
            HashKey Chain is currently optimized for RWA and large fiat withdrawals only using pbUSD.
          </AlertDescription>
        </Alert>
        <div className="flex gap-4">
          <Button onClick={() => switchNetwork(CHAIN_IDS.BASE)} variant="default">
            Switch to Base
          </Button>
          <Button onClick={() => switchNetwork(CHAIN_IDS.ARBITRUM)} variant="outline">
            Switch to Arbitrum
          </Button>
        </div>
      </div>
    )
  }

  const [activeTab, setActiveTab] = useState<"batch" | "auto" | "x402">("batch")
  const [showBatchForm, setShowBatchForm] = useState(false)
  const [batchPurpose, setBatchPurpose] = useState("")
  const [batchGroupId, setBatchGroupId] = useState<string | undefined>()
  const [batchMemo, setBatchMemo] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isChainSwitching, setIsChainSwitching] = useState(false)
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  // Track network mode: EVM, TRON (mainnet), or TRON_NILE (testnet)
  const [selectedPaymentChain, setSelectedPaymentChain] = useState<"EVM" | "TRON" | "TRON_NILE">(
    activeChain === "TRON" ? "TRON" : "EVM"
  )
  const isTronNetwork = selectedPaymentChain === "TRON" || selectedPaymentChain === "TRON_NILE"
  const isTestnet = selectedPaymentChain === "TRON_NILE"
  const currentWallet =
    (isTronNetwork ? wallets.TRON : wallets.EVM) ||
    unifiedAddress ||
    wallets.EVM ||
    wallets.TRON ||
    null
  const supportsMultisig = selectedPaymentChain === "EVM"
  const supportsBatchTransfers = selectedPaymentChain === "EVM"
  const manualChainOverrideRef = useRef(false)

  const handlePaymentChainChange = useCallback(
    async (value: string, options?: { source?: "user" | "auto" }) => {
      if (options?.source === "user") {
        manualChainOverrideRef.current = true
      }

      // Determine if target is a TRON network (mainnet or testnet)
      const isTronTarget = value === "TRON" || value === "TRON_NILE"
      const targetChainType = isTronTarget ? "TRON" : "EVM"
      
      // Check if we're switching between same type
      const currentIsTron = selectedPaymentChain === "TRON" || selectedPaymentChain === "TRON_NILE"
      if (isTronTarget === currentIsTron && value === selectedPaymentChain) return

      setIsChainSwitching(true)
      try {
        if (isTronTarget) {
          if (!wallets.TRON) {
            await connectWallet("TRON")
          }
        } else if (!wallets.EVM) {
          await connectWallet("EVM")
        }

        // Set both the payment chain state and active chain
        setSelectedPaymentChain(value as "EVM" | "TRON" | "TRON_NILE")
        setActiveChain(targetChainType)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Wallet connection was interrupted."
        toast({
          title: "Unable to switch chain",
          description: message,
          variant: "destructive",
        })
      } finally {
        setIsChainSwitching(false)
      }
    },
    [connectWallet, selectedPaymentChain, setActiveChain, toast, wallets]
  )

  // Batch transfer progress state
  const [batchProgressOpen, setBatchProgressOpen] = useState(false)
  const [batchTransferStep, setBatchTransferStep] = useState<BatchTransferStep>('idle')
  const [batchTxHash, setBatchTxHash] = useState<string | undefined>(undefined)
  const [batchErrorMessage, setBatchErrorMessage] = useState<string | undefined>(undefined)
  const [batchTotalRecipients, setBatchTotalRecipients] = useState(0)
  const [isBatchTransferProcessing, setIsBatchTransferProcessing] = useState(false)
  const [isApproving, setIsApproving] = useState(false)

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

  useEffect(() => {
    if (!supportsMultisig && useMultisig) {
      setUseMultisig(false)
      setSelectedMultisig(null)
    }
  }, [supportsMultisig, useMultisig])

  useEffect(() => {
    if (hasTronRecipients && useMultisig) {
      setUseMultisig(false)
      setSelectedMultisig(null)
    }
  }, [hasTronRecipients, useMultisig])

  // Auto payment states
  const [autoPayments, setAutoPayments] = useState<AutoPayment[]>([])

  // Payment history states
  const [paymentHistory, setPaymentHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Batch payment states
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([
    { id: "1", address: "", amount: "", vendorName: "", vendorId: "", token: "USDT", chain: selectedPaymentChain },
  ])
  const hasTronRecipients = recipients.some((recipient) => (recipient.chain || selectedPaymentChain) === "TRON")

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
    {
      id: "v9",
      name: "Asia Pacific Supplier",
      wallet_address: "TSupplier123456789012345678901234",
      category: "Manufacturing",
      type: "Vendor",
      chain: "Tron",
    },
    {
      id: "v10",
      name: "Binance OTC Desk",
      wallet_address: "TBinanceOTC98765432109876543210",
      category: "Exchange",
      type: "Partner",
      chain: "Tron",
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

  const demoPaymentHistory = [
    {
      id: "p1",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      from_address: currentWallet || "0x1234567890123456789012345678901234567890",
      to_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f7DCFF",
      amount: "5000",
      amount_usd: 5000,
      status: "completed",
      token_symbol: "USDT",
      tx_hash: "0xabc123def456...",
      notes: "Monthly vendor payment",
      vendor: { name: "Acme Corp" },
    },
    {
      id: "p2",
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      from_address: currentWallet || "0x1234567890123456789012345678901234567890",
      to_address: "0x8B3392483BA26D65E331dB86D4F430E9B3814E5e",
      amount: "3200",
      amount_usd: 3200,
      status: "completed",
      token_symbol: "USDC",
      tx_hash: "0xdef789ghi012...",
      notes: "Supply purchase",
      vendor: { name: "Global Supplies Inc" },
    },
    {
      id: "p3",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      from_address: currentWallet || "0x1234567890123456789012345678901234567890",
      to_address: "0xDEF0123456789ABCDEF0123456789ABCDEF01234",
      amount: "2500",
      amount_usd: 2500,
      status: "completed",
      token_symbol: "USDT",
      tx_hash: "0xghi345jkl678...",
      notes: "Cloud hosting fees",
      vendor: { name: "Cloud Services Co" },
    },
    {
      id: "p4",
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      from_address: currentWallet || "0x1234567890123456789012345678901234567890",
      to_address: "0x1111222233334444555566667777888899990000",
      amount: "8500",
      amount_usd: 8500,
      status: "completed",
      token_symbol: "USDC",
      tx_hash: "0xjkl901mno234...",
      notes: "Legal consultation",
      vendor: { name: "Legal Partners LLP" },
    },
    {
      id: "p5",
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      from_address: currentWallet || "0x1234567890123456789012345678901234567890",
      to_address: "0x9876543210987654321098765432109876543210",
      amount: "15000",
      amount_usd: 15000,
      status: "completed",
      token_symbol: "USDT",
      tx_hash: "0xmno567pqr890...",
      notes: "Quarterly transfer to APAC",
      vendor: { name: "APAC Division" },
    },
    {
      id: "p6",
      timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      from_address: currentWallet || "TMyTronWallet123456789012345678901234",
      to_address: "TSupplier123456789012345678901234",
      amount: "8000",
      amount_usd: 8000,
      status: "completed",
      token_symbol: "USDT",
      tx_hash: "0xtron123abc456...",
      notes: "Tron network supplier payment",
      vendor: { name: "Asia Pacific Supplier" },
    },
  ]

  // Use demo or real data
  const displayVendors = isDemoMode ? demoVendors : vendors
  const displayAutoPayments = isDemoMode ? demoAutoPayments : autoPayments
  const displayPaymentHistory = isDemoMode ? demoPaymentHistory : paymentHistory

  // Filter vendors by search query
  const filteredVendors = displayVendors.filter(
    (v) =>
      (v.name?.toLowerCase() || "").includes(vendorSearchQuery.toLowerCase()) ||
      (v.wallet_address?.toLowerCase() || "").includes(vendorSearchQuery.toLowerCase()) ||
      (v.category?.toLowerCase() || "").includes(vendorSearchQuery.toLowerCase()),
  )

  // Load vendors from database via API
  const loadVendors = useCallback(async () => {
    if (isDemoMode) return
    if (!currentWallet) {
      setVendors([])
      return
    }

    try {
      const res = await fetch(`/api/vendors?owner=${currentWallet}`, {
        headers: authHeaders(currentWallet),
      })
      if (!res.ok) throw new Error("Failed to fetch vendors")
      const data = await res.json()
      setVendors(data.vendors || [])
    } catch (err) {
      console.error("[v0] Failed to load vendors:", err)
    }
  }, [currentWallet, isDemoMode])

  useEffect(() => {
    loadVendors()
  }, [loadVendors])

  // Load payment history via API
  const loadPaymentHistory = useCallback(async () => {
    if (!currentWallet) {
      setPaymentHistory([])
      return
    }

    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/payments?address=${currentWallet}&limit=20`, {
        headers: authHeaders(currentWallet),
      })
      if (!res.ok) throw new Error("Failed to fetch payment history")
      const data = await res.json()
      setPaymentHistory(data.payments || data || [])
    } catch (err) {
      console.error("[PaymentHistory] Failed to load payment history:", err)
      setPaymentHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [currentWallet])

  useEffect(() => {
    loadPaymentHistory()
  }, [loadPaymentHistory])

  const loadMultisigWallets = useCallback(async () => {
    if (isDemoMode || !currentWallet || !supportsMultisig) {
      setMultisigWallets([])
      setSelectedMultisig(null)
      return
    }

    try {
      const wallets = await multisigService.getWallets(currentWallet)
      setMultisigWallets(wallets)
    } catch (err) {
      console.error("[v0] Error loading multisig wallets:", err)
    }
  }, [currentWallet, isDemoMode, supportsMultisig])

  useEffect(() => {
    loadMultisigWallets()
  }, [loadMultisigWallets])

  useEffect(() => {
    if (!wallets.EVM && !wallets.TRON) {
      manualChainOverrideRef.current = false
    }
  }, [wallets.EVM, wallets.TRON])

  useEffect(() => {
    if (isChainSwitching || isConnecting) {
      return
    }

    const tronAvailable = Boolean(wallets.TRON)
    const evmAvailable = Boolean(wallets.EVM)

    if (manualChainOverrideRef.current) {
      const overrideStillValid =
        (isTronNetwork && tronAvailable) ||
        (selectedPaymentChain === "EVM" && evmAvailable)

      if (overrideStillValid) {
        return
      }

      manualChainOverrideRef.current = false
    }

    if (tronAvailable && !isTronNetwork) {
      handlePaymentChainChange("TRON", { source: "auto" })
    } else if (!tronAvailable && evmAvailable && selectedPaymentChain !== "EVM") {
      handlePaymentChainChange("EVM", { source: "auto" })
    }
  }, [handlePaymentChainChange, isChainSwitching, isConnecting, isTronNetwork, selectedPaymentChain, wallets.EVM, wallets.TRON])

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

      // V2 Async Architecture: Upload to server directly
      await uploadAsyncFile(file)
      
      // Legacy Client-side logic commented out in favor of Async Pipeline
      /*
      setIsProcessing(true)
      try {
        const result = await parsePaymentFile(file)
        setImportResult(result)
        setImportResultOpen(true)

        if (result.success && result.recipients.length > 0) {
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
      */
    }
    input.click()
  }, [uploadAsyncFile, toast])

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
        category: (tagFormData.category as VendorCategory) || 'other',
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

      toast({ title: "Success", description: "Wallet tagged successfully (Test Mode)" })
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
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(currentWallet),
        },
        body: JSON.stringify({
          name: tagFormData.name,
          wallet_address: addressValidation.checksumAddress || tagFormData.wallet_address,
          category: tagFormData.category,
          tier: tagFormData.tier,
          notes: tagFormData.notes,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Failed to save wallet tag")
      }

      const data = await res.json()
      const vendor = data.vendor || data

      // Refresh vendors list
      await loadVendors()

      // If editing a recipient, update it
      if (editingRecipientId && vendor) {
        updateRecipient(editingRecipientId, "vendorId", vendor.id)
        updateRecipient(editingRecipientId, "vendorName", vendor.name)
        updateRecipient(editingRecipientId, "address", vendor.wallet_address)
      }

      toast({ title: "Success", description: "Wallet tagged successfully" })
      setTagDialogOpen(false)
    } catch (err: any) {
      console.error("[v0] Failed to save wallet tag:", err)

      const errorMessage = err.message || "Failed to save wallet tag"

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    }
  }

  // Select vendor and auto-fill address
  const normalizeVendorChain = (chainLabel?: string | null): "EVM" | "TRON" => {
    if (!chainLabel) return "EVM"
    const normalized = chainLabel.toLowerCase()
    if (normalized.includes("tron")) {
      return "TRON"
    }
    return "EVM"
  }

  const selectVendorForRecipient = (recipientId: string, vendorId: string) => {
    const vendor = displayVendors.find((v) => v.id === vendorId)
    if (vendor) {
      const vendorChain = normalizeVendorChain(vendor.chain)
      setRecipients((prev) =>
        prev.map((recipient) => {
          if (recipient.id !== recipientId) return recipient
          const nextToken = vendorChain === "TRON" ? "USDT" : recipient.token || "USDT"
          return {
            ...recipient,
            vendorId: vendor.id,
            vendorName: getVendorDisplayName(vendor),
            address: vendor.wallet_address,
            chain: vendorChain,
            token: nextToken,
          }
        }),
      )
    }
  }

  // Batch payment functions
  const addRecipient = () => {
    setRecipients([
      ...recipients,
      {
        id: Date.now().toString(),
        address: "",
        amount: "",
        vendorName: "",
        vendorId: "",
        token: "USDT",
        chain: selectedPaymentChain,
      },
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

  const handleRecipientChainChange = (id: string, chain: "EVM" | "TRON") => {
    setRecipients((prev) =>
      prev.map((recipient) => {
        if (recipient.id !== id) return recipient
        const nextToken = chain === "TRON" ? "USDT" : recipient.token || "USDT"
        return {
          ...recipient,
          chain,
          token: chain === "TRON" ? "USDT" : nextToken,
        }
      }),
    )
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

  // Legacy single-transfer fallback flow
  const processIndividualPayments = async () => {
    if (!wallets.EVM && !wallets.TRON) {
      toast({
        title: "Error",
        description: "Please connect an EVM or Tron wallet first.",
        variant: "destructive",
      })
      return
    }

    const validRecipients = recipients.filter((r) => r.address && r.amount)
    if (validRecipients.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one valid recipient.",
        variant: "destructive",
      })
      return
    }

    const tronRecipients = validRecipients.filter((r) => (r.chain || selectedPaymentChain) === "TRON")
    const evmRecipients = validRecipients.filter((r) => (r.chain || selectedPaymentChain) !== "TRON")

    const tronTokenMismatch = tronRecipients.find((r) => (r.token || "USDT").toUpperCase() !== "USDT")
    if (tronTokenMismatch) {
      toast({
        title: "Tron only supports USDT",
        description: "Switch all Tron recipients to USDT before sending, or update their chain.",
        variant: "destructive",
      })
      return
    }

    if (tronRecipients.length > 0 && !wallets.TRON) {
      toast({
        title: "Tron wallet required",
        description: "Connect TronLink before sending payments to Tron recipients.",
        variant: "destructive",
      })
      return
    }

    if (evmRecipients.length > 0 && !wallets.EVM) {
      toast({
        title: "EVM wallet required",
        description: "Connect an EVM wallet (e.g., MetaMask) before sending EVM payments.",
        variant: "destructive",
      })
      return
    }

    const deriveEvmChainSlug = (id: number): string => {
      switch (id) {
        case CHAIN_IDS.BASE:
          return "base"
        case CHAIN_IDS.ARBITRUM:
          return "arbitrum"
        case CHAIN_IDS.SEPOLIA:
          return "sepolia"
        case CHAIN_IDS.MAINNET:
          return "ethereum"
        case CHAIN_IDS.HASHKEY:
          return "hashkey"
        case CHAIN_IDS.BSC:
          return "bsc"
        default:
          return "evm"
      }
    }

    setIsProcessing(true)

    const initialChain = selectedPaymentChain
    const hadManualOverride = manualChainOverrideRef.current
    let runtimeChain = selectedPaymentChain
    let successCount = 0
    let failCount = 0
    let shouldRefreshHistory = false

    try {
      if (supportsMultisig && useMultisig && selectedMultisig) {
        const totalAmount = validRecipients.reduce((sum, r) => sum + Number.parseFloat(r.amount), 0)

        await multisigService.createTransaction({
          multisigId: selectedMultisig,
          toAddress: validRecipients[0].address,
          value: totalAmount.toString(),
          description: `Batch payment to ${validRecipients.length} recipients`,
          tokenSymbol: validRecipients[0].token,
          amountUsd: totalAmount,
          createdBy: currentWallet || wallets.EVM || wallets.TRON || "",
        })

        toast({
          title: "Transaction Proposed",
          description: `Batch payment submitted for multi-sig approval (${multisigWallets.find((w) => w.id === selectedMultisig)?.threshold} signatures required)`,
        })
        return
      }

      for (const recipient of validRecipients) {
        const targetChain: "EVM" | "TRON" = (recipient.chain || selectedPaymentChain) === "TRON" ? "TRON" : "EVM"

        if (runtimeChain !== targetChain) {
          await handlePaymentChainChange(targetChain, { source: "auto" })
          runtimeChain = targetChain
        }

        const fromAddress = targetChain === "TRON" ? wallets.TRON : wallets.EVM
        if (!fromAddress) {
          throw new Error(targetChain === "TRON" ? "Tron wallet not connected" : "EVM wallet not connected")
        }

        try {
          const tokenSymbol = (recipient.token || "USDT").toUpperCase()
          const txHash = await sendToken(recipient.address, recipient.amount, tokenSymbol)
          successCount++

          if (txHash) {
            const canonicalFrom = targetChain === "TRON" ? fromAddress : fromAddress.toLowerCase()
            const canonicalTo = targetChain === "TRON" ? recipient.address : recipient.address.toLowerCase()
            const chainSlug = targetChain === "TRON" ? "tron" : deriveEvmChainSlug(chainId)

            const paymentData = {
              tx_hash: txHash,
              from_address: canonicalFrom,
              to_address: canonicalTo,
              vendor_id: recipient.vendorId || null,
              token: tokenSymbol,
              token_symbol: tokenSymbol,
              token_address: '0x0000000000000000000000000000000000000000',
              amount: recipient.amount,
              amount_usd: Number.parseFloat(recipient.amount),
              status: 'completed',
              type: 'sent' as const,
              network_type: targetChain,
              chain: chainSlug,
              chain_id: targetChain === "EVM" ? chainId : undefined,
              timestamp: new Date().toISOString(),
              notes: recipient.vendorName ? `Payment to ${recipient.vendorName}` : undefined,
            }

            const saveRes = await fetch('/api/payments', {
              method: 'POST',
              headers: authHeaders(canonicalFrom, { 'Content-Type': 'application/json' }),
              body: JSON.stringify(paymentData),
            })

            if (!saveRes.ok) {
              console.error('[IndividualPayment] Failed to save payment record:', await saveRes.text())
            } else {
              shouldRefreshHistory = true
            }
          }

          toast({
            title: "Transfer Successful",
            description: `Sent ${recipient.amount} ${tokenSymbol} to ${recipient.vendorName || recipient.address.slice(0, 10)}${recipient.vendorName ? "" : "..."}`,
          })
        } catch (err: any) {
          failCount++
          console.error(`[IndividualPayment] Failed to send to ${recipient.address}:`, err)

          toast({
            title: "Transfer Failed",
            description: `Failed to send to ${recipient.address.slice(0, 10)}...: ${err.message}`,
            variant: "destructive",
          })
        }
      }

      toast({
        title: "Transfer Complete",
        description: `Success: ${successCount}, Failed: ${failCount}`,
      })

      if (successCount > 0) {
        setRecipients([
          {
            id: "1",
            address: "",
            amount: "",
            vendorName: "",
            vendorId: "",
            token: "USDT",
            chain: selectedPaymentChain,
          },
        ])
      }

      if (shouldRefreshHistory) {
        await loadPaymentHistory()
      }
    } catch (err: any) {
      console.error("[IndividualPayment] Error:", err)
      toast({
        title: "Transfer Failed",
        description: err.message || "Transfer failed, please try again.",
        variant: "destructive",
      })
    } finally {
      if (runtimeChain !== initialChain) {
        await handlePaymentChainChange(initialChain, { source: hadManualOverride ? "user" : "auto" })
      }
      setIsProcessing(false)
    }
  }

  // Enhanced batch transfer flow (single signature)
  const processBatchPayment = async () => {
    if (!currentWallet) {
      toast({
        title: "Error",
        description: "Please connect your wallet first.",
        variant: "destructive",
      })
      return
    }

    const validRecipients = recipients.filter((r) => r.address && r.amount)
    if (validRecipients.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one valid recipient.",
        variant: "destructive",
      })
      return
    }

    if (!supportsBatchTransfers) {
      toast({
        title: "Batch transfers require EVM",
        description: "Switch to an EVM chain to send a batched transaction, or use sequential transfers instead.",
        variant: "destructive",
      })
      return
    }

    if (hasTronRecipients) {
      toast({
        title: "Tron recipients detected",
        description: "Remove Tron recipients or switch them to EVM before running an on-chain batch transaction.",
        variant: "destructive",
      })
      return
    }

    // Proceed with new batch transfer experience (single signature)
    setIsBatchTransferProcessing(true)

    try {
      // Capture recipient count before any reset
      const recipientCount = validRecipients.length

      // Reset state
      setBatchTransferStep('idle')
      setBatchTxHash(undefined)
      setBatchErrorMessage(undefined)
      setBatchTotalRecipients(recipientCount)
      setBatchProgressOpen(true)

      const tokenSymbol = validRecipients[0]?.token || 'USDT'

      toast({
        title: "Preparing Batch Transfer",
        description: `Preparing to send ${tokenSymbol} to ${recipientCount} addresses`,
      })

      // Ensure injected provider is present
      const ethereum = getInjectedEthereum() as any
      if (!ethereum) {
        throw new Error('Please install MetaMask or another Web3 wallet.')
      }

      // Create viem clients
      const publicClient = createPublicClient({
        chain: arbitrum,
        transport: http()
      })

      const walletClient = createWalletClient({
        chain: arbitrum,
        transport: custom(ethereum)
      })

      // Prepare batched payload
      const batchRecipients = validRecipients.map(r => ({
        address: r.address as `0x${string}`,
        amount: r.amount,
      }))

      // Step 1: Approve spend
      setBatchTransferStep('approving')
      setIsApproving(true)

      // Execute batch transfer
      const result = await publicBatchTransferService.batchTransfer(
        walletClient,
        publicClient,
        batchRecipients,
        tokenSymbol,
        42161 // Arbitrum chain ID
      )

      setIsApproving(false)

      if (result.success && result.txHash) {
        setBatchTransferStep('transferring')
        setBatchTxHash(result.txHash)

        // Persist batch entries through API
        if (result.txHash) {
          try {
            const paymentRecords = validRecipients.map((recipient, index) => ({
              tx_hash: `${result.txHash}-${index}`,
              from_address: currentWallet.toLowerCase(),
              to_address: recipient.address.toLowerCase(),
              vendor_id: recipient.vendorId || null,
              token_symbol: tokenSymbol,
              token_address: '0x0000000000000000000000000000000000000000',
              amount: recipient.amount,
              amount_usd: parseFloat(recipient.amount),
              status: 'completed',
              timestamp: new Date().toISOString(),
              notes: recipient.vendorName
                ? `Batch payment to ${recipient.vendorName} (tx: ${result.txHash})`
                : `Batch payment ${index + 1}/${recipientCount} (tx: ${result.txHash})`,
            }))

            let successCount = 0
            let failCount = 0

            for (let i = 0; i < paymentRecords.length; i++) {
              try {
                const saveRes = await fetch('/api/payments', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders(currentWallet),
                  },
                  body: JSON.stringify(paymentRecords[i]),
                })
                if (saveRes.ok) {
                  successCount++
                } else {
                  failCount++
                  console.error(`[BatchPayment] Failed to save payment record ${i + 1}:`, await saveRes.text())
                }
              } catch (saveErr) {
                failCount++
                console.error(`[BatchPayment] Failed to save payment record ${i + 1}:`, saveErr)
              }
            }

            if (failCount > 0) {
              toast({
                title: "Partial Save Failure",
                description: `Batch transfer succeeded, but ${failCount}/${paymentRecords.length} records failed to persist`,
                variant: "default",
              })
            } else {
              await loadPaymentHistory()
            }

          } catch (dbErr: any) {
            console.error('[BatchPayment] Database exception:', {
              error: dbErr,
              message: dbErr.message,
            })
          }
        }

        // Delay success state for smoother UX
        setTimeout(() => {
          setBatchTransferStep('success')
        }, 1500)

        toast({
          title: "Batch Transfer Successful!",
          description: `Successfully sent tokens to ${recipientCount} addresses`,
        })

        // Reset form
        setRecipients([
          {
            id: "1",
            address: "",
            amount: "",
            vendorName: "",
            vendorId: "",
            token: "USDT",
            chain: selectedPaymentChain,
          },
        ])
      } else {
        setBatchTransferStep('error')
        setBatchErrorMessage(result.errorMessage || 'Batch transfer failed')

        toast({
          title: "Transfer Failed",
          description: result.errorMessage || "Batch transfer failed, please try again.",
          variant: "destructive",
        })
      }
    } catch (err: any) {
      console.error("[BatchPayment] Error:", err)
      setIsApproving(false)
      setBatchTransferStep('error')
      setBatchErrorMessage(err.message || 'Batch transfer failed')

      toast({
        title: "Transfer Failed",
        description: err.message || "Batch transfer failed, please try again.",
        variant: "destructive",
      })
    } finally {
      setIsBatchTransferProcessing(false)
    }
  }

  const toggleAutoPaymentStatus = (id: string) => {
    setAutoPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: p.status === "active" ? "paused" : "active" } : p)),
    )
  }

  return (
    <main className="container mx-auto py-4 sm:py-6 px-3 sm:px-4 max-w-7xl pb-24 md:pb-6">
      {/* Mode Toggle - REMOVED */}

      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Business Payments</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage batch payments and auto-payments</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "batch" | "auto" | "x402")} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="batch">Batch Payment</TabsTrigger>
          <TabsTrigger value="auto">Auto Payments</TabsTrigger>
          <TabsTrigger value="x402">x402 Bill Pay</TabsTrigger>
        </TabsList>

        {/* Personal Mode - Subscription Management - REMOVED */}

        <TabsContent value="batch" className="space-y-6">

          {!showBatchForm ? (
            <>
              {/* History-first: show batch history + create button */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Batch Payments</h2>
                  <p className="text-sm text-muted-foreground">Create and manage batch payments</p>
                </div>
                <Button onClick={() => setShowBatchForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Batch Payment
                </Button>
              </div>
              <PaymentActivity
                payments={paymentHistory}
                walletAddress={currentWallet}
                loading={historyLoading}
                showAll
                title="Batch Payment History"
                description="Recent batch payment activity"
              />
            </>
          ) : (
            <>
              {/* Back button to return to history */}
              <Button variant="ghost" size="sm" onClick={() => setShowBatchForm(false)} className="mb-2">
                ← Back to History
              </Button>

              {/* Purpose, Group, Memo for the batch */}
              <GlassCard className="border-border">
                <GlassCardHeader className="pb-3">
                  <GlassCardTitle className="text-base">Batch Details</GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Purpose</Label>
                    <PurposeTagSelector value={batchPurpose} onChange={setBatchPurpose} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label>Payment Group (optional)</Label>
                      <PaymentGroupSelector
                        ownerAddress={currentWallet || ""}
                        value={batchGroupId}
                        onChange={setBatchGroupId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Memo / Note</Label>
                      <Textarea
                        placeholder="Batch payment note..."
                        value={batchMemo}
                        onChange={(e) => setBatchMemo(e.target.value)}
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                  </div>
                </GlassCardContent>
              </GlassCard>

              <GlassCard className="border-border">
                <GlassCardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <GlassCardTitle className="text-base">Settlement Network</GlassCardTitle>
                      <GlassCardDescription>Select Tron for TRC20 payouts or stay on EVM to use batch transfers.</GlassCardDescription>
                    </div>
                    <Badge variant={selectedPaymentChain === "TRON_NILE" ? "secondary" : "outline"}>
                      {selectedPaymentChain === "TRON" ? "Tron" : selectedPaymentChain === "TRON_NILE" ? "Tron (Test)" : "EVM"}
                    </Badge>
                  </div>
                </GlassCardHeader>
                <GlassCardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Choose network</Label>
                    <Select
                      value={selectedPaymentChain}
                      onValueChange={(value) => handlePaymentChainChange(value, { source: "user" })}
                      disabled={isChainSwitching || isConnecting}
                    >
                      <SelectTrigger className="sm:w-[260px]">
                        <SelectValue placeholder="Select settlement network" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EVM">EVM (Base, Arbitrum)</SelectItem>
                        <SelectItem value="TRON">Tron Mainnet (TRC20)</SelectItem>
                        <SelectItem value="TRON_NILE">
                          <span className="flex items-center gap-2">
                            Tron Nile <span className="text-xs text-amber-500 font-medium">(Testnet)</span>
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {(isChainSwitching || isConnecting) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Preparing wallet connection...
                      </div>
                    )}
                  </div>
                  {(!supportsBatchTransfers || hasTronRecipients) && (
                    <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-sm">Manual transfer mode</AlertTitle>
                      <AlertDescription className="text-xs sm:text-sm">
                        {isTronNetwork
                          ? isTestnet
                            ? "Tron Nile (Testnet) payouts run sequentially per recipient. To execute an on-chain batch transaction, switch back to an EVM network."
                            : "Tron payouts run sequentially per recipient. To execute an on-chain batch transaction, switch back to an EVM network."
                          : "Recipients assigned to Tron run sequentially even when the settlement network is EVM. Remove or switch them to enable on-chain batch execution."}
                      </AlertDescription>
                    </Alert>
                  )}
                </GlassCardContent>
              </GlassCard>

          {/* Async Batch Job Monitor */}
          {(isAsyncUploading || asyncJobStatus) && (
            <GlassCard className="border-blue-500/20 bg-blue-500/5 mb-6">
              <GlassCardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {(isAsyncUploading || asyncJobStatus?.status === 'queued' || asyncJobStatus?.status === 'parsing' ||  asyncJobStatus?.status === 'processing') ? (
                            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                        ) : asyncJobStatus?.status === 'completed' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                            <FileSpreadsheet className="h-5 w-5 text-blue-500" />
                        )}
                        <GlassCardTitle className="text-base">Batch Job: {asyncJobId?.slice(0, 8)}...</GlassCardTitle>
                    </div>
                    <Badge variant={asyncJobStatus?.status === 'PENDING_APPROVAL' ? "default" : "outline"}>
                        {isAsyncUploading ? 'UPLOADING' : asyncJobStatus?.status?.toUpperCase()}
                    </Badge>
                </div>
                <GlassCardDescription>
                   {isAsyncUploading ? 'Uploading file to secure storage...' : 'Processing large batch file asynchronously'}
                </GlassCardDescription>
              </GlassCardHeader>
              <GlassCardContent>
                 <div className="space-y-4">
                    {asyncJobStatus && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-sm bg-background/50 p-3 sm:p-4 rounded-lg border">
                            <div>
                                <div className="text-muted-foreground text-xs">Total Records</div>
                                <div className="font-mono text-base sm:text-lg">{asyncJobStatus.totalLines}</div>
                            </div>
                            <div>
                                <div className="text-muted-foreground text-xs">Valid</div>
                                <div className="font-mono text-base sm:text-lg text-green-600">{asyncJobStatus.parsedCount}</div>
                            </div>
                            <div>
                                <div className="text-muted-foreground text-xs">Invalid</div>
                                <div className="font-mono text-base sm:text-lg text-red-500">{asyncJobStatus.invalidCount}</div>
                            </div>
                             <div>
                                <div className="text-muted-foreground text-xs">Status</div>
                                <div className="font-medium text-sm">{asyncJobStatus.status}</div>
                            </div>
                        </div>
                    )}
                    
                    {asyncJobStatus?.status === 'PENDING_APPROVAL' && (
                        <div className="flex flex-col gap-2 pt-2 border-t mt-2">
                             <div className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                Please review the parsed counts above. Proceeding will initiate blockchain transactions.
                             </div>
                            <Button onClick={executeAsyncBatch} className="w-full sm:w-auto mt-2">
                                <Play className="h-4 w-4 mr-2" />
                                Approve & Execute Payment
                            </Button>
                        </div>
                    )}

                    {asyncJobStatus?.error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{asyncJobStatus.error}</AlertDescription>
                        </Alert>
                    )}
                 </div>
              </GlassCardContent>
            </GlassCard>
          )}

          {multisigWallets.length > 0 && supportsMultisig && !hasTronRecipients && (
            <GlassCard className="border-cyan-500/20">
              <GlassCardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-cyan-400" />
                  <GlassCardTitle className="text-base">Multi-sig Protection</GlassCardTitle>
                </div>
                <GlassCardDescription>Enable multi-signature approval for this batch payment</GlassCardDescription>
              </GlassCardHeader>
              <GlassCardContent>
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
              </GlassCardContent>
            </GlassCard>
          )}

          <div className="grid lg:grid-cols-12 gap-6">
            {/* Recipients Card */}
            <GlassCard className="lg:col-span-8 bg-card">
              <GlassCardHeader className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div>
                  <GlassCardTitle>Recipients</GlassCardTitle>
                  <GlassCardDescription className="hidden sm:block">Add payment recipients from your contacts or import from file</GlassCardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => openTagDialog()}>
                    <Tag className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">New Tag</span>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FileUp className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Import</span>
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
                    <Download className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </div>
              </GlassCardHeader>
              <GlassCardContent>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Vendor / Contact</TableHead>
                        <TableHead className="w-[280px]">Address</TableHead>
                        <TableHead className="w-[140px]">Chain</TableHead>
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
                                <Button 
                                  variant="outline" 
                                  className={`w-full justify-between bg-transparent ${recipient.vendorName ? 'text-foreground' : 'text-muted-foreground'}`}
                                >
                                  <span className="truncate">
                                    {recipient.vendorName || "Select contact..."}
                                  </span>
                                  <ChevronDown className="h-4 w-4 ml-2 shrink-0" />
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
                                          {getVendorInitials(vendor).charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium truncate">{getVendorDisplayName(vendor)}</div>
                                          <div className="text-xs text-muted-foreground font-mono truncate">
                                            {vendor.wallet_address.slice(0, 10)}...
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <Badge variant="outline" className="text-xs">
                                            {vendor.type || vendor.category || "Vendor"}
                                          </Badge>
                                          <Badge variant="secondary" className="text-xs">
                                            {normalizeVendorChain(vendor.chain) === "TRON" ? "Tron" : (vendor.chain || "EVM")}
                                          </Badge>
                                        </div>
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
                              value={(recipient.chain || selectedPaymentChain) as "EVM" | "TRON"}
                              onValueChange={(value) => handleRecipientChainChange(recipient.id, value as "EVM" | "TRON")}
                            >
                              <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Select chain" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="EVM">
                                  {wallets.EVM ? "EVM" : "EVM (connect wallet)"}
                                </SelectItem>
                                <SelectItem value="TRON">
                                  {wallets.TRON ? "Tron" : "Tron (connect Tron)"}
                                </SelectItem>
                              </SelectContent>
                            </Select>
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
                                <SelectItem
                                  value="USDC"
                                  disabled={(recipient.chain || selectedPaymentChain) === "TRON"}
                                >
                                  USDC
                                </SelectItem>
                                <SelectItem
                                  value="DAI"
                                  disabled={(recipient.chain || selectedPaymentChain) === "TRON"}
                                >
                                  DAI
                                </SelectItem>
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
              </GlassCardContent>
            </GlassCard>

            {/* Summary Card */}
            <GlassCard className="lg:col-span-4 h-fit sticky top-24 bg-card">
              <GlassCardHeader>
                <GlassCardTitle>Summary</GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent className="space-y-4">
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

                <Button className="w-full" size="lg" onClick={processIndividualPayments} disabled={isProcessing || isChainSwitching}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Payment
                    </>
                  )}
                </Button>
              </GlassCardContent>
            </GlassCard>
          </div>
          <div className="flex justify-end gap-4">
            <Button
              onClick={processBatchPayment}
              disabled={
                isBatchTransferProcessing ||
                isApproving ||
                recipients.filter((r) => r.address && r.amount).length === 0 ||
                !supportsBatchTransfers ||
                hasTronRecipients
              }
              className="bg-cyan-500 hover:bg-cyan-600"
            >
              {isApproving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Authorizing...
                </>
              ) : isBatchTransferProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : !supportsBatchTransfers ? (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Switch to EVM for Batch
                </>
              ) : hasTronRecipients ? (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Remove Tron Recipients
                </>
              ) : useMultisig ? (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Submit for Approval
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Execute Batch Transfer
                </>
              )}
            </Button>
          </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="auto" className="space-y-6">
          <Alert className="bg-blue-500/10 border-blue-500/20">
            <Clock className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-500">Automated Payments</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Set up recurring payments to vendors. All auto-payments can be paused at any time.
            </AlertDescription>
          </Alert>

          <GlassCard className="bg-card">
            <GlassCardHeader className="flex flex-row items-center justify-between">
              <div>
                <GlassCardTitle>Scheduled Auto-Payments</GlassCardTitle>
                <GlassCardDescription>Manage recurring vendor payments</GlassCardDescription>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Auto-Payment
              </Button>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="space-y-3">
                {displayAutoPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className={`flex items-center justify-between p-3 sm:p-4 rounded-lg border gap-2 ${
                      payment.status === "paused" ? "bg-amber-500/5 border-amber-500/20" : "bg-muted/30 border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium flex items-center gap-2 flex-wrap text-sm sm:text-base">
                          <span className="truncate">{payment.vendorName}</span>
                          <Badge variant={payment.status === "active" ? "default" : "secondary"} className="text-xs">
                            {payment.status}
                          </Badge>
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground">
                          ${payment.amount} {payment.token} / {payment.frequency}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Next: {payment.nextPayment?.toLocaleDateString() || 'Not scheduled'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => toggleAutoPaymentStatus(payment.id)}>
                        {payment.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hidden sm:flex">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCardContent>
          </GlassCard>
        </TabsContent>

        <TabsContent value="x402" className="space-y-6">
          <Alert className="bg-purple-500/10 border-purple-500/20">
            <LinkIcon className="h-4 w-4 text-purple-500" />
            <AlertTitle className="text-purple-500">x402 Protocol</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Pay bills via payment links. Scan QR codes or paste x402 links to pay instantly.
            </AlertDescription>
          </Alert>

          <GlassCard className="bg-card">
            <GlassCardHeader>
              <GlassCardTitle>Pay via Link</GlassCardTitle>
              <GlassCardDescription>Enter an x402 payment link or scan QR code</GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Payment Link</Label>
                <Input placeholder="x402://pay?..." className="font-mono" />
              </div>
              <Button className="w-full">
                <Send className="h-4 w-4 mr-2" />
                Process Payment
              </Button>
            </GlassCardContent>
          </GlassCard>
        </TabsContent>
      </Tabs>

      {/* Payment History Section */}
      <div className="mt-6">
        <PaymentActivity
          payments={displayPaymentHistory}
          walletAddress={currentWallet ?? undefined}
          loading={historyLoading && !isDemoMode}
          title="Payment History"
          description="Recent outgoing transactions"
        />
      </div>

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
                  <SelectItem value="Tron">Tron</SelectItem>
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

      {/* Batch Transfer Progress Dialog */}
      <BatchTransferProgress
        open={batchProgressOpen}
        onOpenChange={setBatchProgressOpen}
        step={batchTransferStep}
        totalRecipients={batchTotalRecipients}
        txHash={batchTxHash}
        errorMessage={batchErrorMessage}
        chainId={42161}
      />
    </main>
  )
}
