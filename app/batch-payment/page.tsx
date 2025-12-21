"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Trash2,
  Plus,
  Send,
  Loader2,
  Info,
  LinkIcon,
  Receipt,
  Save,
  FolderOpen,
  CreditCard,
  Building2,
  Pause,
  Play,
  X,
  Calendar,
  Clock,
  Shield,
  Settings,
  ChevronRight,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  sendToken,
  getTokenAddress,
  signERC3009Authorization,
  executeERC3009Transfer,
  switchNetwork,
  CHAIN_IDS,
  CCTP_DOMAINS,
  CCTP_TOKEN_MESSENGER_ADDRESSES,
  executeCCTPTransfer,
} from "@/lib/web3"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { getSupabase } from "@/lib/supabase"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  validateAndChecksumAddress,
  validateAmount,
  sanitizeTextInput,
  checkRateLimit,
  RATE_LIMITS,
  createTransactionIntegrityHash,
  generateSecureNonce,
  SECURITY_CONFIG,
  createAuditLog,
  type AuditAction,
} from "@/lib/security"
import { FeePreview } from "@/components/fee-preview"
import { recordFee, calculateFee } from "@/lib/protocol-fees"
import { Switch } from "@/components/ui/switch"

interface Subscription {
  id: string
  serviceName: string
  serviceIcon?: string
  amount: string
  token: "USDT" | "USDC" | "DAI"
  frequency: "weekly" | "monthly" | "yearly"
  nextPayment: Date
  status: "active" | "paused" | "cancelled"
  walletAddress: string
  totalPaid: string
  startDate: Date
  category: "streaming" | "saas" | "membership" | "utility" | "other"
}

interface AutoPayment {
  id: string
  vendorName: string
  vendorId: string
  amount: string
  token: "USDT" | "USDC" | "DAI"
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly"
  nextPayment: Date
  status: "active" | "paused"
  maxAmount: string
  walletAddress: string
}

interface PaymentRecipient {
  id: string
  address: string
  amount: string
  vendorName?: string
  vendorId?: string
  token: "USDT" | "USDC" | "DAI" | "CUSTOM"
  customTokenAddress?: string
  destinationChainId?: number
  isAutoPayment?: boolean
  autoPaymentFrequency?: "weekly" | "biweekly" | "monthly" | "quarterly"
}

interface Vendor {
  id: string
  wallet_address: string
  name: string
}

const VALIDATORS = {
  EVM: (address: string) => {
    const result = validateAndChecksumAddress(address)
    return result.valid
  },
  SOLANA: (address: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address),
  BITCOIN: (address: string) => /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address),
}

const DEMO_SUBSCRIPTIONS: Subscription[] = [
  {
    id: "sub-1",
    serviceName: "Netflix",
    amount: "15.99",
    token: "USDC",
    frequency: "monthly",
    nextPayment: new Date(Date.now() + 86400000 * 5),
    status: "active",
    walletAddress: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    totalPaid: "191.88",
    startDate: new Date(Date.now() - 86400000 * 365),
    category: "streaming",
  },
  {
    id: "sub-2",
    serviceName: "Spotify Premium",
    amount: "9.99",
    token: "USDC",
    frequency: "monthly",
    nextPayment: new Date(Date.now() + 86400000 * 12),
    status: "active",
    walletAddress: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
    totalPaid: "119.88",
    startDate: new Date(Date.now() - 86400000 * 400),
    category: "streaming",
  },
  {
    id: "sub-3",
    serviceName: "ChatGPT Plus",
    amount: "20.00",
    token: "USDC",
    frequency: "monthly",
    nextPayment: new Date(Date.now() + 86400000 * 18),
    status: "active",
    walletAddress: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0",
    totalPaid: "160.00",
    startDate: new Date(Date.now() - 86400000 * 240),
    category: "saas",
  },
  {
    id: "sub-4",
    serviceName: "GitHub Pro",
    amount: "4.00",
    token: "USDC",
    frequency: "monthly",
    nextPayment: new Date(Date.now() + 86400000 * 3),
    status: "paused",
    walletAddress: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30",
    totalPaid: "48.00",
    startDate: new Date(Date.now() - 86400000 * 365),
    category: "saas",
  },
  {
    id: "sub-5",
    serviceName: "AWS Services",
    amount: "127.45",
    token: "USDT",
    frequency: "monthly",
    nextPayment: new Date(Date.now() + 86400000 * 8),
    status: "active",
    walletAddress: "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E",
    totalPaid: "1529.40",
    startDate: new Date(Date.now() - 86400000 * 365),
    category: "utility",
  },
  {
    id: "sub-6",
    serviceName: "Gym Membership",
    amount: "49.99",
    token: "USDC",
    frequency: "monthly",
    nextPayment: new Date(Date.now() + 86400000 * 22),
    status: "active",
    walletAddress: "0xcd3B766CCDd6AE721141F452C550Ca635964ce71",
    totalPaid: "299.94",
    startDate: new Date(Date.now() - 86400000 * 180),
    category: "membership",
  },
]

const DEMO_AUTO_PAYMENTS: AutoPayment[] = [
  {
    id: "auto-1",
    vendorName: "Cloud Services Inc",
    vendorId: "demo-1",
    amount: "2500.00",
    token: "USDC",
    frequency: "monthly",
    nextPayment: new Date(Date.now() + 86400000 * 7),
    status: "active",
    maxAmount: "3000.00",
    walletAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  },
  {
    id: "auto-2",
    vendorName: "Office Supplies Co",
    vendorId: "demo-3",
    amount: "450.00",
    token: "USDT",
    frequency: "biweekly",
    nextPayment: new Date(Date.now() + 86400000 * 3),
    status: "active",
    maxAmount: "600.00",
    walletAddress: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
  },
  {
    id: "auto-3",
    vendorName: "Security Consultants",
    vendorId: "demo-4",
    amount: "5000.00",
    token: "USDC",
    frequency: "quarterly",
    nextPayment: new Date(Date.now() + 86400000 * 45),
    status: "paused",
    maxAmount: "6000.00",
    walletAddress: "0x123f681646d4a755815f9cb19e1acc8565a0c2ac",
  },
]

export default function BatchPaymentPage() {
  const { wallets, activeChain, setActiveChain, isConnected, usdtBalance, usdcBalance, daiBalance, chainId } = useWeb3()
  const { toast } = useToast()
  const router = useRouter()

  const isDemoMode = !isConnected
  const currentWallet = wallets[activeChain]

  const [mode, setMode] = useState<"personal" | "enterprise">("personal")
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(DEMO_SUBSCRIPTIONS)
  const [autoPayments, setAutoPayments] = useState<AutoPayment[]>(DEMO_AUTO_PAYMENTS)
  const [showAddSubscription, setShowAddSubscription] = useState(false)

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
          destinationChainId: CHAIN_IDS.MAINNET,
        },
        {
          id: "2",
          address: "0x123f681646d4a755815f9cb19e1acc8565a0c2ac",
          amount: "3009",
          vendorName: "Global Consultants",
          vendorId: "demo-2",
          token: "USDC",
          destinationChainId: CHAIN_IDS.BASE,
        },
      ]
    }
    return [
      {
        id: "1",
        address: "",
        amount: "",
        vendorName: "",
        vendorId: "",
        token: "USDT",
        destinationChainId: CHAIN_IDS.MAINNET, // Default to Mainnet
      },
    ]
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
  const [isProcessing, setIsProcessing] = useState(false)

  const [billUrl, setBillUrl] = useState("")
  const [billData, setBillData] = useState<{
    to: string
    amount: string
    token: string
    vendorName?: string
    dueDate?: string
  } | null>(null)
  const [isLoadingBill, setIsLoadingBill] = useState(false)

  const [selectedNetwork, setSelectedNetwork] = useState<number>(CHAIN_IDS.MAINNET)

  const [securityWarnings, setSecurityWarnings] = useState<string[]>([])
  const [integrityHashes, setIntegrityHashes] = useState<Map<string, string>>(new Map())
  const [feePreview, setFeePreview] = useState<any>(null) // State for fee preview

  const [hasDraft, setHasDraft] = useState(false)

  // Check for saved draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem("batch-payment-draft")
    if (savedDraft) {
      setHasDraft(true)
    }
  }, [])

  useEffect(() => {
    if (isConnected && currentWallet) {
      loadVendors()
    } else {
      setLoadingVendors(false)
    }
  }, [isConnected, currentWallet])

  useEffect(() => {
    if (isConnected) {
      setRecipients([
        {
          id: "1",
          address: "",
          amount: "",
          vendorName: "",
          vendorId: "",
          token: "USDT",
          destinationChainId: selectedNetwork, // Use selected network as default
        },
      ])
    }
  }, [isConnected, selectedNetwork]) // Added selectedNetwork dependency

  useEffect(() => {
    if (isConnected && activeChain === "EVM") {
      setSelectedNetwork(chainId)
    }
  }, [isConnected, activeChain, chainId])

  // Calculate fee preview whenever recipients or selected network change
  useEffect(() => {
    const calculatedFeePreview = calculateFee(
      recipients.filter((r) => Number(r.amount) > 0),
      selectedNetwork,
      "standard", // TODO: Detect user tier
    )
    setFeePreview(calculatedFeePreview)
  }, [recipients, selectedNetwork])

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

  const toggleSubscriptionStatus = (id: string) => {
    setSubscriptions((subs) =>
      subs.map((sub) => {
        if (sub.id === id) {
          const newStatus = sub.status === "active" ? "paused" : "active"
          toast({
            title: newStatus === "active" ? "Subscription Resumed" : "Subscription Paused",
            description: `${sub.serviceName} has been ${newStatus === "active" ? "resumed" : "paused"}.`,
          })
          return { ...sub, status: newStatus }
        }
        return sub
      }),
    )
  }

  const cancelSubscription = (id: string) => {
    const sub = subscriptions.find((s) => s.id === id)
    if (sub) {
      setSubscriptions((subs) => subs.map((s) => (s.id === id ? { ...s, status: "cancelled" as const } : s)))
      toast({
        title: "Subscription Cancelled",
        description: `${sub.serviceName} has been cancelled. No future payments will be made.`,
      })
    }
  }

  const toggleAutoPaymentStatus = (id: string) => {
    setAutoPayments((payments) =>
      payments.map((payment) => {
        if (payment.id === id) {
          const newStatus = payment.status === "active" ? "paused" : "active"
          toast({
            title: newStatus === "active" ? "Auto-Payment Resumed" : "Auto-Payment Paused",
            description: `${payment.vendorName} auto-payment has been ${newStatus === "active" ? "resumed" : "paused"}.`,
          })
          return { ...payment, status: newStatus }
        }
        return payment
      }),
    )
  }

  const getSubscriptionStats = () => {
    const active = subscriptions.filter((s) => s.status === "active")
    const monthlyTotal = active.reduce((sum, s) => {
      const amount = Number.parseFloat(s.amount)
      if (s.frequency === "weekly") return sum + amount * 4
      if (s.frequency === "yearly") return sum + amount / 12
      return sum + amount
    }, 0)
    return {
      activeCount: active.length,
      pausedCount: subscriptions.filter((s) => s.status === "paused").length,
      monthlyTotal,
      nextPayment: active.sort((a, b) => a.nextPayment.getTime() - b.nextPayment.getTime())[0],
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
        destinationChainId: selectedNetwork, // Use selected network
      },
    ])
  }

  const removeRecipient = (id: string) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((r) => r.id !== id))
    }
  }

  const updateRecipient = (id: string, field: keyof PaymentRecipient, value: any) => {
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

  const fetchBill = async () => {
    if (!billUrl) return
    if (!billUrl.startsWith("http://") && !billUrl.startsWith("https://")) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL starting with http:// or https://",
        variant: "destructive",
      })
      return
    }
    setIsLoadingBill(true)
    try {
      // Mock HTTP fetch - in production this would be: await fetch(billUrl).then(res => res.json())
      await new Promise((resolve) => setTimeout(resolve, 1000))

      let parsedAmount = "150.00"
      let parsedTo = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" // Valid dummy address
      let parsedToken = "USDC"

      try {
        const urlObj = new URL(billUrl)
        const params = new URLSearchParams(urlObj.search)
        if (params.get("amount")) parsedAmount = params.get("amount")!
        if (params.get("to")) parsedTo = params.get("to")!
        if (params.get("token")) parsedToken = params.get("token")!
      } catch (e) {
        // Ignore parsing errors, use defaults
      }

      setBillData({
        to: parsedTo,
        amount: parsedAmount,
        token: parsedToken,
        vendorName: "Cloud Host Provider LLC",
        dueDate: new Date(Date.now() + 86400000 * 7).toLocaleDateString(),
      })
      toast({
        title: "Bill Loaded",
        description: "Payment details parsed successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch bill details.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingBill(false)
    }
  }

  const handleBillPayment = async () => {
    if (!billData || !isConnected || !currentWallet) return
    setIsProcessing(true)
    try {
      const supabase = getSupabase()

      // 1. Sign Authorization (EIP-3009)
      toast({
        title: "Signing Authorization",
        description: `Authorizing payment of ${billData.amount} ${billData.token} to ${billData.vendorName}`,
      })

      const tokenAddress = getTokenAddress(selectedNetwork, billData.token as any) || ""
      const auth = await signERC3009Authorization(
        tokenAddress,
        currentWallet,
        billData.to,
        billData.amount,
        selectedNetwork,
      )

      // 2. Submit Signature (HTTP POST)
      // In a real x402 flow, we would POST this 'auth' object to the Biller's API
      // For this demo, we simulate the submission or execute it on-chain if we want to close the loop

      // console.log("[v0] Submitting x402 Signature:", auth)

      // Verify if we should execute on-chain for demo purposes or just "Send" the sig
      // The prompt says "HTTP + Signature Authorization". Usually this means the CLIENT just sends the sig.
      // We will simulate the HTTP POST success.
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Optional: Record in Supabase as "Authorized"
      if (supabase) {
        await supabase.from("payments").insert({
          from_address: currentWallet,
          to_address: billData.to,
          amount: billData.amount,
          token_symbol: billData.token,
          status: "authorized_offchain", // Special status
          tx_hash: "offchain_sig_" + auth.nonce, // Mock hash
        })
      }

      toast({
        title: "Payment Authorized",
        description: "Signature sent to biller successfully. No gas paid.",
      })

      setBillData(null)
      setBillUrl("")
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const validateRecipientSecurity = useCallback(
    (
      recipient: PaymentRecipient,
    ): {
      valid: boolean
      errors: string[]
      warnings: string[]
      checksummedAddress?: string
    } => {
      const errors: string[] = []
      const warnings: string[] = []

      // 1. Validate address with checksum
      if (recipient.address) {
        const addressResult = validateAndChecksumAddress(recipient.address)
        if (!addressResult.valid) {
          errors.push(addressResult.error || "Invalid address")
        } else if (addressResult.checksummed !== recipient.address) {
          warnings.push(`Address will be checksummed: ${addressResult.checksummed}`)
        }
      }

      // 2. Validate amount
      if (recipient.amount) {
        const amountResult = validateAmount(recipient.amount, {
          minAmount: "0.000001",
          maxAmount: String(SECURITY_CONFIG.MAX_SINGLE_PAYMENT_USD),
          maxDecimals: 18,
        })
        if (!amountResult.valid) {
          errors.push(amountResult.error || "Invalid amount")
        }
      }

      // 3. Sanitize vendor name
      if (recipient.vendorName) {
        const nameResult = sanitizeTextInput(recipient.vendorName)
        if (nameResult.warnings.length > 0) {
          warnings.push(...nameResult.warnings)
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        checksummedAddress: validateAndChecksumAddress(recipient.address).checksummed || undefined,
      }
    },
    [],
  )

  const saveDraft = () => {
    const draft = {
      recipients,
      selectedNetwork,
      timestamp: new Date().toISOString(),
    }
    localStorage.setItem("batch-payment-draft", JSON.stringify(draft))
    setHasDraft(true)
    toast({
      title: "Draft Saved",
      description: "Your batch payment has been saved. You can continue later.",
    })
  }

  const loadDraft = () => {
    const savedDraft = localStorage.getItem("batch-payment-draft")
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft)
        setRecipients(draft.recipients)
        if (draft.selectedNetwork) {
          setSelectedNetwork(draft.selectedNetwork)
        }
        toast({
          title: "Draft Loaded",
          description: "Your saved batch payment has been restored.",
        })
      } catch (e) {
        toast({
          title: "Error",
          description: "Failed to load draft.",
          variant: "destructive",
        })
      }
    }
  }

  const clearDraft = () => {
    localStorage.removeItem("batch-payment-draft")
    setHasDraft(false)
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
      // Clear draft after successful payment
      clearDraft()
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

    const rateLimitResult = checkRateLimit({
      ...RATE_LIMITS.BATCH_PAYMENT,
      identifier: currentWallet,
    })

    if (!rateLimitResult.allowed) {
      toast({
        title: "Rate Limit Exceeded",
        description: rateLimitResult.error || "Please wait before submitting another batch.",
        variant: "destructive",
      })

      // Log security alert
      const alertLog = createAuditLog({
        action: "RATE_LIMIT_EXCEEDED" as AuditAction,
        actor: currentWallet,
        details: {
          action_type: "BATCH_PAYMENT",
          reset_at: rateLimitResult.resetAt,
        },
      })
      console.warn("[Security] Rate limit exceeded:", alertLog)
      return
    }

    const securityIssues: string[] = []
    const validatedRecipients: PaymentRecipient[] = []

    for (const recipient of recipients) {
      const validation = validateRecipientSecurity(recipient)

      if (!validation.valid) {
        securityIssues.push(`${recipient.vendorName || recipient.address}: ${validation.errors.join(", ")}`)
      } else {
        // Use checksummed address
        validatedRecipients.push({
          ...recipient,
          address: validation.checksummedAddress || recipient.address,
        })
      }

      if (validation.warnings.length > 0) {
        setSecurityWarnings((prev) => [...prev, ...validation.warnings])
      }
    }

    if (securityIssues.length > 0) {
      toast({
        title: "Security Validation Failed",
        description: securityIssues.slice(0, 3).join("; ") + (securityIssues.length > 3 ? "..." : ""),
        variant: "destructive",
      })
      return
    }

    const totals = getTotalAmounts()
    const totalBatchAmount = totals.USDT + totals.USDC + totals.DAI

    if (totalBatchAmount > SECURITY_CONFIG.MAX_BATCH_TOTAL_USD) {
      toast({
        title: "Batch Amount Exceeds Limit",
        description: `Maximum batch total is $${SECURITY_CONFIG.MAX_BATCH_TOTAL_USD.toLocaleString()}`,
        variant: "destructive",
      })
      return
    }

    if (recipients.length > SECURITY_CONFIG.MAX_BATCH_RECIPIENTS) {
      toast({
        title: "Too Many Recipients",
        description: `Maximum ${SECURITY_CONFIG.MAX_BATCH_RECIPIENTS} recipients per batch`,
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

    if (activeChain === "EVM" && chainId !== selectedNetwork) {
      try {
        toast({
          title: "Switching Network",
          description: "Please confirm the network switch in your wallet.",
        })
        await switchNetwork(selectedNetwork)
        // Wait a moment for the chainId to update in context/provider
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error: any) {
        toast({
          title: "Network Switch Failed",
          description: "Could not switch to the selected network. Please switch manually.",
          variant: "destructive",
        })
        return
      }
    }

    const invalidRecipients = validatedRecipients.filter((r) => {
      if (!r.address || !VALIDATORS[activeChain as keyof typeof VALIDATORS](r.address)) return true
      if (r.token === "CUSTOM" && !r.customTokenAddress) return true
      // Basic check for destination chain ID if it's a cross-chain operation
      if (r.destinationChainId !== undefined && r.destinationChainId !== selectedNetwork && activeChain === "EVM") {
        // Further validation would be needed here, e.g., checking if the token supports cross-chain on that destination
      }
      return false
    })

    if (invalidRecipients.length > 0) {
      toast({
        title: "Invalid Recipients",
        description: "Please check addresses, token selections, and chain IDs.",
        variant: "destructive",
      })
      return
    }

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

      const batchNonce = generateSecureNonce()
      const batchTimestamp = Date.now()

      const { data: batchData, error: batchError } = await supabase
        .from("batch_payments")
        .insert({
          wallet_address: currentWallet,
          total_recipients: validatedRecipients.length,
          total_amount_usd: totalBatchAmount,
          status: "processing",
          batch_name: `Batch ${new Date().toLocaleDateString()}`,
        })
        .select()
        .single()

      if (batchError) throw batchError

      const batchAuditLog = createAuditLog({
        action: "BATCH_CREATED" as AuditAction,
        actor: currentWallet,
        target: batchData.id,
        details: {
          total_recipients: validatedRecipients.length,
          total_amount_usd: totalBatchAmount,
          nonce: batchNonce,
        },
      })
      console.log("[Audit]", batchAuditLog)

      for (const recipient of validatedRecipients) {
        if (!recipient.address || !Number(recipient.amount)) continue

        try {
          const txNonce = generateSecureNonce()
          const tokenAddress = getTokenAddress(selectedNetwork, recipient.token) || ""

          const integrityHash = createTransactionIntegrityHash({
            from: currentWallet,
            to: recipient.address,
            amount: recipient.amount,
            tokenAddress,
            chainId: selectedNetwork,
            timestamp: batchTimestamp,
            nonce: txNonce,
          })

          // Store hash for verification
          setIntegrityHashes((prev) => new Map(prev).set(recipient.id, integrityHash))

          let txHash = ""
          const isCrossChain =
            recipient.destinationChainId && recipient.destinationChainId !== selectedNetwork && activeChain === "EVM"

          if (isCrossChain) {
            if (recipient.token !== "USDC") {
              throw new Error("Cross-chain transfers are currently only supported for USDC via CCTP")
            }

            const cctpTokenAddress = getTokenAddress(selectedNetwork, "USDC")
            if (!cctpTokenAddress) throw new Error("USDC address not found on source chain")

            const messengerAddress =
              CCTP_TOKEN_MESSENGER_ADDRESSES[selectedNetwork as keyof typeof CCTP_TOKEN_MESSENGER_ADDRESSES]
            if (!messengerAddress) throw new Error("CCTP TokenMessenger not found on source chain")

            const destinationDomain = CCTP_DOMAINS[recipient.destinationChainId as keyof typeof CCTP_DOMAINS]
            if (destinationDomain === undefined) throw new Error("Destination chain not supported by CCTP")

            // We need a signer, executeCCTPTransfer uses browser provider internally if we updated it,
            // or we pass the signer. Let's look at executeCCTPTransfer signature in lib/web3.ts
            // It expects `signer: ethers.Signer`.
            // We need to get the signer here.
            const { ethers } = await import("ethers")
            const provider = new ethers.BrowserProvider(window.ethereum)
            const signer = await provider.getSigner()

            txHash = await executeCCTPTransfer(
              cctpTokenAddress,
              messengerAddress,
              recipient.amount,
              destinationDomain,
              recipient.address,
              signer,
            )
          } else {
            // Existing Intrachain Logic
            let transferTokenAddress = ""
            if (recipient.token === "CUSTOM") {
              transferTokenAddress = recipient.customTokenAddress || ""
            } else {
              const addr = getTokenAddress(selectedNetwork, recipient.token)
              if (!addr) throw new Error(`Token address not found for ${recipient.token}`)
              transferTokenAddress = addr
            }

            if (recipient.token === "USDC" && activeChain === "EVM") {
              const auth = await signERC3009Authorization(
                transferTokenAddress,
                wallets.EVM!,
                recipient.address,
                recipient.amount,
                selectedNetwork,
              )

              // For Standard Batch, we assume immediate execution (Self-Relay or Direct Execution)
              // If we want "Gasless" strictly, we'd send this to a relayer.
              // But to ensure "Real Usage" where funds move, we execute it.
              // The benefit here is using the modern standard.
              txHash = await executeERC3009Transfer(
                transferTokenAddress,
                wallets.EVM!,
                recipient.address,
                recipient.amount,
                auth,
              )
            } else {
              txHash = await sendToken(transferTokenAddress, recipient.address, recipient.amount)
            }
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
              notes: `Integrity: ${integrityHash.substring(0, 16)}...`,
            })
            .select()
            .single()

          if (paymentError) throw paymentError

          try {
            await recordFee({
              paymentId: paymentData.id,
              batchId: batchData.id,
              amount: Number(recipient.amount),
              fromAddress: currentWallet,
              tokenSymbol: recipient.token,
              chainId: selectedNetwork,
              tier: "standard", // TODO: Detect user tier
              collectionMethod: "deferred",
            })
          } catch (feeError) {
            console.warn("[v0] Fee recording failed:", feeError)
            // Don't fail the payment if fee recording fails
          }

          const paymentAuditLog = createAuditLog({
            action: "PAYMENT_COMPLETED" as AuditAction,
            actor: currentWallet,
            target: paymentData.id,
            details: {
              tx_hash: txHash,
              to_address: recipient.address,
              amount: recipient.amount,
              token: recipient.token,
              integrity_hash: integrityHash,
              is_cross_chain: isCrossChain,
            },
          })
          console.log("[Audit]", paymentAuditLog)

          await supabase.from("batch_payment_items").insert({
            batch_id: batchData.id,
            payment_id: paymentData.id,
          })
        } catch (error: any) {
          console.error("[v0] Payment failed for", recipient.address, error)

          const failedAuditLog = createAuditLog({
            action: "PAYMENT_FAILED" as AuditAction,
            actor: currentWallet,
            details: {
              to_address: recipient.address,
              amount: recipient.amount,
              token: recipient.token,
              error: error.message,
            },
          })
          console.error("[Audit]", failedAuditLog)

          throw error
        }
      }

      await supabase
        .from("batch_payments")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", batchData.id)

      const completionLog = createAuditLog({
        action: "BATCH_COMPLETED" as AuditAction,
        actor: currentWallet,
        target: batchData.id,
        details: {
          total_recipients: validatedRecipients.length,
          total_amount_usd: totalBatchAmount,
        },
      })
      console.log("[Audit]", completionLog)

      toast({
        title: "Batch payment successful",
        description: `Successfully sent to ${validatedRecipients.length} recipients`,
      })

      setRecipients([
        {
          id: "1",
          address: "",
          amount: "",
          vendorName: "",
          vendorId: "",
          token: "USDT",
          destinationChainId: selectedNetwork,
        },
      ])

      // Clear draft after successful payment
      clearDraft()

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

  const stats = getSubscriptionStats()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Payments</h1>
            <p className="text-muted-foreground mt-1">Manage your payments and subscriptions</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Mode Toggle */}
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
              <Button
                variant={mode === "personal" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMode("personal")}
                className="gap-2"
              >
                <CreditCard className="h-4 w-4" />
                Personal
              </Button>
              <Button
                variant={mode === "enterprise" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMode("enterprise")}
                className="gap-2"
              >
                <Building2 className="h-4 w-4" />
                Enterprise
              </Button>
            </div>

            {activeChain === "EVM" && mode === "enterprise" && (
              <Select value={selectedNetwork.toString()} onValueChange={(val) => setSelectedNetwork(Number(val))}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Network" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CHAIN_IDS.MAINNET.toString()}>Ethereum</SelectItem>
                  <SelectItem value={CHAIN_IDS.BASE.toString()}>Base</SelectItem>
                  <SelectItem value={CHAIN_IDS.SEPOLIA.toString()}>Sepolia</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {mode === "personal" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">Active Subscriptions</div>
                  <div className="text-2xl font-bold text-foreground">{stats.activeCount}</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">Paused</div>
                  <div className="text-2xl font-bold text-amber-500">{stats.pausedCount}</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">Monthly Total</div>
                  <div className="text-2xl font-bold text-foreground">${stats.monthlyTotal.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">Next Payment</div>
                  <div className="text-lg font-bold text-foreground">
                    {stats.nextPayment ? new Date(stats.nextPayment.nextPayment).toLocaleDateString() : "N/A"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Security Alert */}
            <Alert className="bg-emerald-500/10 border-emerald-500/20">
              <Shield className="h-4 w-4 text-emerald-500" />
              <AlertTitle className="text-emerald-500">Payment Protection Enabled</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                All subscriptions require your approval. You can pause or cancel any payment at any time. Unauthorized
                transactions are automatically blocked.
              </AlertDescription>
            </Alert>

            {/* Subscriptions List */}
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>My Subscriptions</CardTitle>
                  <CardDescription>Manage your recurring payments and subscriptions</CardDescription>
                </div>
                <Button onClick={() => setShowAddSubscription(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Subscription
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {subscriptions
                    .filter((s) => s.status !== "cancelled")
                    .map((sub) => (
                      <div
                        key={sub.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          sub.status === "paused" ? "bg-amber-500/5 border-amber-500/20" : "bg-muted/30 border-border"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                              sub.category === "streaming"
                                ? "bg-purple-500/20 text-purple-500"
                                : sub.category === "saas"
                                  ? "bg-blue-500/20 text-blue-500"
                                  : sub.category === "membership"
                                    ? "bg-emerald-500/20 text-emerald-500"
                                    : sub.category === "utility"
                                      ? "bg-orange-500/20 text-orange-500"
                                      : "bg-zinc-500/20 text-zinc-500"
                            }`}
                          >
                            {sub.serviceName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{sub.serviceName}</span>
                              {sub.status === "paused" && (
                                <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                                  Paused
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ${sub.amount} {sub.token} / {sub.frequency}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Next: {new Date(sub.nextPayment).toLocaleDateString()} · Total paid: ${sub.totalPaid}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleSubscriptionStatus(sub.id)}
                            title={sub.status === "active" ? "Pause" : "Resume"}
                          >
                            {sub.status === "active" ? (
                              <Pause className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Play className="h-4 w-4 text-emerald-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => cancelSubscription(sub.id)}
                            title="Cancel subscription"
                            className="hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Settings className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Payments */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Payments
                </CardTitle>
                <CardDescription>Payments scheduled for the next 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {subscriptions
                    .filter((s) => s.status === "active")
                    .sort((a, b) => new Date(a.nextPayment).getTime() - new Date(b.nextPayment).getTime())
                    .slice(0, 5)
                    .map((sub) => {
                      const daysUntil = Math.ceil((new Date(sub.nextPayment).getTime() - Date.now()) / 86400000)
                      return (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-2 h-2 rounded-full ${daysUntil <= 3 ? "bg-amber-500" : "bg-emerald-500"}`}
                            />
                            <span className="text-foreground">{sub.serviceName}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground text-sm">
                              {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
                            </span>
                            <span className="font-mono font-medium">${sub.amount}</span>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {mode === "enterprise" && (
          <Tabs defaultValue="batch" className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:w-[500px] mb-6">
              <TabsTrigger value="batch">Batch Payment</TabsTrigger>
              <TabsTrigger value="auto">Auto-Payments</TabsTrigger>
              <TabsTrigger value="x402">x402 Bill Pay</TabsTrigger>
            </TabsList>

            <TabsContent value="batch" className="space-y-6">
              <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500">
                <Info className="h-4 w-4" />
                <AlertTitle>x402 Batch Ready</AlertTitle>
                <AlertDescription>
                  Gasless payments (EIP-3009) are automatically enabled for USDC transactions.
                </AlertDescription>
              </Alert>

              {hasDraft && (
                <Alert className="bg-yellow-500/10 border-yellow-500/20">
                  <FolderOpen className="h-4 w-4 text-yellow-500" />
                  <AlertTitle className="text-yellow-500">Saved Draft Available</AlertTitle>
                  <AlertDescription className="flex items-center justify-between">
                    <span className="text-muted-foreground">You have a saved batch payment draft.</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={loadDraft}>
                        Load Draft
                      </Button>
                      <Button size="sm" variant="ghost" onClick={clearDraft}>
                        Discard
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8 space-y-6">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>Recipients</CardTitle>
                      <CardDescription>Add wallet addresses and amounts for batch payment</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-4 text-sm mb-4 bg-muted/30 p-3 rounded-md overflow-x-auto">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">USDT</span>
                          <span className="font-mono font-bold">
                            {isDemoMode ? "10,000.00" : Number(usdtBalance).toFixed(2)}
                          </span>
                        </div>
                        <div className="w-px bg-border mx-2" />
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">USDC</span>
                          <span className="font-mono font-bold">
                            {isDemoMode ? "15,500.00" : Number(usdcBalance).toFixed(2)}
                          </span>
                        </div>
                        <div className="w-px bg-border mx-2" />
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">DAI</span>
                          <span className="font-mono font-bold">
                            {isDemoMode ? "5,000.00" : Number(daiBalance).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-secondary/50">
                              <TableHead className="min-w-[150px]">Wallet Tag</TableHead>
                              <TableHead className="min-w-[200px]">Address</TableHead>
                              <TableHead className="min-w-[100px]">Token</TableHead>
                              <TableHead className="w-[100px]">Chain</TableHead>
                              <TableHead className="min-w-[120px]">Amount</TableHead>
                              <TableHead className="w-[80px]">Auto</TableHead>
                              <TableHead className="w-[50px]" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {recipients.map((recipient) => (
                              <TableRow key={recipient.id}>
                                <TableCell>
                                  <Select
                                    value={recipient.vendorId}
                                    onValueChange={(v) => updateRecipient(recipient.id, "vendorId", v)}
                                  >
                                    <SelectTrigger className="bg-background">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
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
                                    className="font-mono"
                                  />
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
                                  <Select
                                    value={recipient.destinationChainId?.toString() || selectedNetwork.toString()}
                                    onValueChange={(val) =>
                                      updateRecipient(recipient.id, "destinationChainId", Number(val))
                                    }
                                  >
                                    <SelectTrigger className="w-[100px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={CHAIN_IDS.MAINNET.toString()}>ETH</SelectItem>
                                      <SelectItem value={CHAIN_IDS.BASE.toString()}>Base</SelectItem>
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
                                  <Switch
                                    checked={recipient.isAutoPayment || false}
                                    onCheckedChange={(checked) =>
                                      updateRecipient(recipient.id, "isAutoPayment", checked)
                                    }
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

                      <Button onClick={addRecipient} variant="outline" className="w-full bg-transparent">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Recipient
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <Card className="lg:col-span-4 h-fit sticky top-24 bg-card border-border">
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
                          <div className="text-2xl font-bold text-primary font-mono">${grandTotal.toFixed(2)}</div>
                        </div>
                      ) : null
                    })()}

                    {feePreview && <FeePreview data={feePreview} />}

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
                  Set up recurring payments to vendors. All auto-payments require initial approval and can be paused at
                  any time.
                </AlertDescription>
              </Alert>

              <Card className="bg-card border-border">
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
                    {autoPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          payment.status === "paused"
                            ? "bg-amber-500/5 border-amber-500/20"
                            : "bg-muted/30 border-border"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{payment.vendorName}</span>
                              {payment.status === "paused" && (
                                <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                                  Paused
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ${payment.amount} {payment.token} / {payment.frequency}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Next: {new Date(payment.nextPayment).toLocaleDateString()} · Max: ${payment.maxAmount}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => toggleAutoPaymentStatus(payment.id)}>
                            {payment.status === "active" ? (
                              <Pause className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Play className="h-4 w-4 text-emerald-500" />
                            )}
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Settings className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="x402" className="space-y-6">
              <Card className="border-blue-500/20 bg-blue-950/5">
                <CardHeader className="text-center pb-8 border-b border-border/50">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-blue-500/10 rounded-full">
                      <Receipt className="w-10 h-10 text-blue-500" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl">x402 Bill Payment</CardTitle>
                  <CardDescription className="text-base max-w-md mx-auto mt-2">
                    Paste your payment request URL to authorize gasless payments.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 p-8">
                  <div className="space-y-4">
                    <Label className="text-lg font-medium">Bill URL / Payment Request</Label>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          placeholder="Paste your x402 bill link here..."
                          className="pl-12 h-14 text-lg"
                          value={billUrl}
                          onChange={(e) => setBillUrl(e.target.value)}
                        />
                      </div>
                      <Button onClick={fetchBill} disabled={isLoadingBill || !billUrl} className="h-14 px-8">
                        {isLoadingBill ? <Loader2 className="w-5 h-5 animate-spin" /> : "Load Bill"}
                      </Button>
                    </div>
                  </div>

                  {billData && (
                    <div className="rounded-lg border bg-card p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{billData.vendorName}</h3>
                          <p className="text-sm text-muted-foreground">Due: {billData.dueDate}</p>
                        </div>
                        <Badge variant="outline" className="text-lg py-1 px-3">
                          {billData.amount} {billData.token}
                        </Badge>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-md text-sm font-mono break-all">
                        <span className="text-muted-foreground">To: </span>
                        {billData.to}
                      </div>
                      <Button className="w-full" onClick={handleBillPayment} disabled={isProcessing}>
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Authorizing...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Sign & Pay (Gasless)
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
