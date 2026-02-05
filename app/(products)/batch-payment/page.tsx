"use client"

import { useState, useEffect, useCallback } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
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
import { createClient } from "@/lib/supabase-client"
import { PurposeTagSelector } from "@/components/purpose-tag-selector"
import { PaymentGroupSelector } from "@/components/payment-group-selector"
import type { Vendor, PaymentRecipient, AutoPayment, VendorCategory } from "@/types"
import { validatePaymentData, processBatchPayment as executeBatchPayment } from "@/lib/services/payment-service"
import { validateVendorData } from "@/lib/services/vendor-service"
import { parsePaymentFile, generateSampleCSV, generateSampleExcel, type ParseResult } from "@/lib/excel-parser"
import { multisigService, type MultisigWallet } from "@/lib/multisig"
import { publicBatchTransferService } from "@/lib/services/public-batch-transfer-service"
import { createWalletClient, createPublicClient, http, custom } from "viem"
import { arbitrum } from "viem/chains"

export default function BatchPaymentPage() {
  const { wallets, address: unifiedAddress, sendToken, signERC3009Authorization, isConnected } = useUnifiedWallet()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  const supabase = createClient() // Initialize Supabase client here

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

  const [activeTab, setActiveTab] = useState<"batch" | "auto" | "x402">("batch")
  const [showBatchForm, setShowBatchForm] = useState(false)
  const [batchPurpose, setBatchPurpose] = useState("")
  const [batchGroupId, setBatchGroupId] = useState<string | undefined>()
  const [batchMemo, setBatchMemo] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const activeChain = "EVM"
  const currentWallet = unifiedAddress || wallets[activeChain]

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

  // Auto payment states
  const [autoPayments, setAutoPayments] = useState<AutoPayment[]>([])

  // Payment history states
  const [paymentHistory, setPaymentHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

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

  // Load payment history
  const loadPaymentHistory = useCallback(async () => {
    if (!currentWallet) {
      console.log('[PaymentHistory] No wallet connected')
      setPaymentHistory([])
      return
    }

    console.log('[PaymentHistory] Loading payment history for:', currentWallet)
    setHistoryLoading(true)
    try {
      if (!supabase) {
        console.error('[PaymentHistory] Supabase client not available')
        return
      }

      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          vendor:vendors(name)
        `)
        .or(`from_address.eq.${currentWallet},to_address.eq.${currentWallet}`)
        .order("timestamp", { ascending: false })
        .limit(20)

      if (error) {
        console.error('[PaymentHistory] Error loading payments:', error)
        throw error
      }

      console.log('[PaymentHistory] Loaded payments:', data)
      setPaymentHistory(data || [])
    } catch (err) {
      console.error("[PaymentHistory] Failed to load payment history:", err)
      setPaymentHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [currentWallet, supabase])

  useEffect(() => {
    loadPaymentHistory()
  }, [loadPaymentHistory])

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

      // Provide helpful error message based on error type
      let errorMessage = err.message || "Failed to save wallet tag"

      if (err.code === "42501" || err.message?.includes("row-level security")) {
        errorMessage = "Database permission error. Please configure Supabase RLS policies for the vendors table."
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
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

  // 旧的逐笔转账功能（保留）
  const processIndividualPayments = async () => {
    if (!currentWallet) {
      toast({
        title: "错误",
        description: "请先连接钱包",
        variant: "destructive",
      })
      return
    }

    const validRecipients = recipients.filter((r) => r.address && r.amount)
    if (validRecipients.length === 0) {
      toast({
        title: "错误",
        description: "请至少添加一个有效的收款地址",
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
          toAddress: validRecipients[0].address,
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
        // 逐笔转账（旧方式）
        let successCount = 0
        let failCount = 0

        for (const recipient of validRecipients) {
          try {
            // 使用 sendToken 发送单笔转账
            const txHash = await sendToken(recipient.address, recipient.amount, recipient.token || 'USDT')
            successCount++

            // 保存支付记录到数据库
            if (supabase && txHash) {
              try {
                const paymentData = {
                  tx_hash: txHash,
                  from_address: currentWallet.toLowerCase(),
                  to_address: recipient.address.toLowerCase(),
                  vendor_id: recipient.vendorId || null,
                  token_symbol: recipient.token || 'USDT',
                  token_address: '0x0000000000000000000000000000000000000000', // 占位符
                  amount: recipient.amount,
                  amount_usd: parseFloat(recipient.amount), // 简化处理，假设稳定币
                  status: 'completed',
                  timestamp: new Date().toISOString(),
                  notes: recipient.vendorName ? `Payment to ${recipient.vendorName}` : undefined,
                }

                console.log('[IndividualPayment] Attempting to save payment:', paymentData)

                const { data: insertedData, error: dbError } = await supabase
                  .from('payments')
                  .insert(paymentData)
                  .select()

                if (dbError) {
                  console.error('[IndividualPayment] Failed to save payment record:', {
                    error: dbError,
                    code: dbError.code,
                    message: dbError.message,
                    details: dbError.details,
                    hint: dbError.hint,
                  })

                  // 显示用户友好的错误信息
                  if (dbError.code === '42501') {
                    toast({
                      title: "数据库权限错误",
                      description: "无法保存支付记录。请检查 Supabase RLS 策略配置。",
                      variant: "destructive",
                    })
                  }
                } else {
                  console.log('[IndividualPayment] Payment record saved successfully:', insertedData)
                  // 重新加载支付历史
                  await loadPaymentHistory()
                }
              } catch (dbErr: any) {
                console.error('[IndividualPayment] Database exception:', {
                  error: dbErr,
                  message: dbErr.message,
                  stack: dbErr.stack,
                })
              }
            }

            toast({
              title: "转账成功",
              description: `向 ${recipient.vendorName || recipient.address.slice(0, 10)} 发送 ${recipient.amount} ${recipient.token}`,
            })
          } catch (err: any) {
            failCount++
            console.error(`[IndividualPayment] Failed to send to ${recipient.address}:`, err)

            toast({
              title: "转账失败",
              description: `向 ${recipient.address.slice(0, 10)}... 转账失败: ${err.message}`,
              variant: "destructive",
            })
          }
        }

        toast({
          title: "转账完成",
          description: `成功: ${successCount} 笔，失败: ${failCount} 笔`,
        })

        if (successCount > 0) {
          // 重置表单
          setRecipients([{ id: "1", address: "", amount: "", vendorName: "", vendorId: "", token: "USDT" }])
        }
      }
    } catch (err: any) {
      console.error("[IndividualPayment] Error:", err)
      toast({
        title: "转账失败",
        description: err.message || "转账失败，请重试",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // 新的批量转账功能（一次签名）
  const processBatchPayment = async () => {
    if (!currentWallet) {
      toast({
        title: "错误",
        description: "请先连接钱包",
        variant: "destructive",
      })
      return
    }

    const validRecipients = recipients.filter((r) => r.address && r.amount)
    if (validRecipients.length === 0) {
      toast({
        title: "错误",
        description: "请至少添加一个有效的收款地址",
        variant: "destructive",
      })
      return
    }

    // 使用新的批量转账功能（一次签名）
    setIsBatchTransferProcessing(true)

    try {
      // 保存收款人数量（在表单重置前）
      const recipientCount = validRecipients.length

      // 重置状态
      setBatchTransferStep('idle')
      setBatchTxHash(undefined)
      setBatchErrorMessage(undefined)
      setBatchTotalRecipients(recipientCount)
      setBatchProgressOpen(true)

      const tokenSymbol = validRecipients[0]?.token || 'USDT'

      console.log('[BatchPayment] Starting batch transfer...')
      console.log('  Recipients:', recipientCount)
      console.log('  Token:', tokenSymbol)
      console.log('  From:', currentWallet)

      toast({
        title: "准备批量转账",
        description: `准备向 ${recipientCount} 个地址发送 ${tokenSymbol}`,
      })

      // 检查 ethereum provider
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('请安装 MetaMask 或其他 Web3 钱包')
      }

      // 创建 viem 客户端
      const publicClient = createPublicClient({
        chain: arbitrum,
        transport: http()
      })

      const walletClient = createWalletClient({
        chain: arbitrum,
        transport: custom(window.ethereum)
      })

      // 准备批量转账数据
      const batchRecipients = validRecipients.map(r => ({
        address: r.address as `0x${string}`,
        amount: r.amount,
      }))

      // 步骤1：授权
      setBatchTransferStep('approving')
      setIsApproving(true)

      console.log('[BatchPayment] Executing batch transfer...')

      // 执行批量转账
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

        // 保存批量转账记录到数据库
        if (supabase && result.txHash) {
          try {
            console.log('[BatchPayment] Saving batch payment records to database...')
            console.log('[BatchPayment] Transaction hash:', result.txHash)
            console.log('[BatchPayment] Number of recipients:', validRecipients.length)

            // 为每个收款人创建一条支付记录
            // 由于 tx_hash 有 UNIQUE 约束，我们为每条记录添加唯一后缀
            const paymentRecords = validRecipients.map((recipient, index) => ({
              tx_hash: `${result.txHash}-${index}`, // 添加索引后缀使其唯一
              from_address: currentWallet.toLowerCase(),
              to_address: recipient.address.toLowerCase(),
              vendor_id: recipient.vendorId || null,
              token_symbol: tokenSymbol,
              token_address: '0x0000000000000000000000000000000000000000', // 占位符
              amount: recipient.amount,
              amount_usd: parseFloat(recipient.amount),
              status: 'completed',
              timestamp: new Date().toISOString(),
              notes: recipient.vendorName
                ? `Batch payment to ${recipient.vendorName} (tx: ${result.txHash})`
                : `Batch payment ${index + 1}/${recipientCount} (tx: ${result.txHash})`,
            }))

            console.log('[BatchPayment] Payment records to insert:', JSON.stringify(paymentRecords, null, 2))

            // 逐条插入，避免批量插入可能的问题
            let successCount = 0
            let failCount = 0

            for (let i = 0; i < paymentRecords.length; i++) {
              const record = paymentRecords[i]
              console.log(`[BatchPayment] Inserting record ${i + 1}/${paymentRecords.length}...`)

              const { data: insertedData, error: dbError } = await supabase
                .from('payments')
                .insert(record)
                .select()

              if (dbError) {
                failCount++
                console.error(`[BatchPayment] Failed to save payment record ${i + 1}:`, {
                  error: dbError,
                  code: dbError.code,
                  message: dbError.message,
                  details: dbError.details,
                  hint: dbError.hint,
                  record: record,
                })
              } else {
                successCount++
                console.log(`[BatchPayment] Payment record ${i + 1} saved successfully:`, insertedData)
              }
            }

            console.log(`[BatchPayment] Batch save completed: ${successCount} success, ${failCount} failed`)

            if (failCount > 0) {
              toast({
                title: "部分记录保存失败",
                description: `批量转账成功，但 ${failCount}/${paymentRecords.length} 条记录保存失败`,
                variant: "default",
              })
            } else {
              console.log('[BatchPayment] All payment records saved successfully')
              // 重新加载支付历史
              await loadPaymentHistory()
            }

          } catch (dbErr: any) {
            console.error('[BatchPayment] Database exception:', {
              error: dbErr,
              message: dbErr.message,
              stack: dbErr.stack,
            })
          }
        }

        // 等待一下再显示成功
        setTimeout(() => {
          setBatchTransferStep('success')
        }, 1500)

        toast({
          title: "批量转账成功！",
          description: `成功向 ${recipientCount} 个地址发送代币`,
        })

        // 重置表单
        setRecipients([{ id: "1", address: "", amount: "", vendorName: "", vendorId: "", token: "USDT" }])
      } else {
        setBatchTransferStep('error')
        setBatchErrorMessage(result.errorMessage || '批量转账失败')

        toast({
          title: "转账失败",
          description: result.errorMessage || "批量转账失败，请重试",
          variant: "destructive",
        })
      }
    } catch (err: any) {
      console.error("[BatchPayment] Error:", err)
      setIsApproving(false)
      setBatchTransferStep('error')
      setBatchErrorMessage(err.message || '批量转账失败')

      toast({
        title: "转账失败",
        description: err.message || "批量转账失败，请重试",
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
    <main className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Mode Toggle - REMOVED */}

      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Payments</h1>
          <p className="text-muted-foreground">Manage batch payments and auto-payments for your business</p>
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
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Batch Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Purpose</Label>
                    <PurposeTagSelector value={batchPurpose} onChange={setBatchPurpose} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                </CardContent>
              </Card>

          {/* Async Batch Job Monitor */}
          {(isAsyncUploading || asyncJobStatus) && (
            <Card className="border-blue-500/20 bg-blue-500/5 mb-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {(isAsyncUploading || asyncJobStatus?.status === 'queued' || asyncJobStatus?.status === 'parsing' ||  asyncJobStatus?.status === 'processing') ? (
                            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                        ) : asyncJobStatus?.status === 'completed' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                            <FileSpreadsheet className="h-5 w-5 text-blue-500" />
                        )}
                        <CardTitle className="text-base">Batch Job: {asyncJobId?.slice(0, 8)}...</CardTitle>
                    </div>
                    <Badge variant={asyncJobStatus?.status === 'PENDING_APPROVAL' ? "default" : "outline"}>
                        {isAsyncUploading ? 'UPLOADING' : asyncJobStatus?.status?.toUpperCase()}
                    </Badge>
                </div>
                <CardDescription>
                   {isAsyncUploading ? 'Uploading file to secure storage...' : 'Processing large batch file asynchronously'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="space-y-4">
                    {asyncJobStatus && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-background/50 p-4 rounded-lg border">
                            <div>
                                <div className="text-muted-foreground text-xs">Total Records</div>
                                <div className="font-mono text-lg">{asyncJobStatus.totalLines}</div>
                            </div>
                            <div>
                                <div className="text-muted-foreground text-xs">Valid</div>
                                <div className="font-mono text-lg text-green-600">{asyncJobStatus.parsedCount}</div>
                            </div>
                            <div>
                                <div className="text-muted-foreground text-xs">Invalid</div>
                                <div className="font-mono text-lg text-red-500">{asyncJobStatus.invalidCount}</div>
                            </div>
                             <div>
                                <div className="text-muted-foreground text-xs">Status</div>
                                <div className="font-medium">{asyncJobStatus.status}</div>
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
              </CardContent>
            </Card>
          )}

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
                                          {(vendor.name || vendor.company_name || 'V').charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium truncate">{vendor.name || vendor.company_name}</div>
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

                <Button className="w-full" size="lg" onClick={processIndividualPayments} disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      转账中...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      转账
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
          <div className="flex justify-end gap-4">
            <Button
              onClick={processBatchPayment}
              disabled={isBatchTransferProcessing || isApproving || recipients.filter((r) => r.address && r.amount).length === 0}
              className="bg-cyan-500 hover:bg-cyan-600"
            >
              {isApproving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  授权中...
                </>
              ) : isBatchTransferProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : useMultisig ? (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  提交审批
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  执行批量转账
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
                          Next: {payment.nextPayment?.toLocaleDateString() || 'Not scheduled'}
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
