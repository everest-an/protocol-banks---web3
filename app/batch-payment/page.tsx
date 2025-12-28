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
  DialogTrigger,
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
  CreditCard,
  Pause,
  Play,
  Settings,
  Shield,
  Zap,
  Ban,
  DollarSign,
  Tag,
  ChevronDown,
  Bookmark,
  Users,
} from "lucide-react"
import { createClient as getSupabase } from "@/lib/supabase-client"
import { validateAndChecksumAddress } from "@/lib/web3"

export default function BatchPaymentPage() {
  // ... existing state declarations ...
  const { wallets, sendToken, signERC3009Authorization, isConnected } = useWeb3()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  const [mode, setMode] = useState<"personal" | "business">("personal")
  const [activeTab, setActiveTab] = useState("batch")
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

  // Subscription states
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [newSubscription, setNewSubscription] = useState({
    serviceName: "",
    walletAddress: "",
    amount: "",
    token: "USDT" as const,
    frequency: "monthly" as const,
    category: "other" as const,
    maxAmount: "",
  })
  const [showAddSubscription, setShowAddSubscription] = useState(false)

  // Auto payment states
  const [autoPayments, setAutoPayments] = useState<AutoPayment[]>([])

  // Batch payment states
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([
    { id: "1", address: "", amount: "", vendorName: "", vendorId: "", token: "USDT" },
  ])

  // ... existing code for interfaces ...

  // Demo data
  const demoSubscriptions: Subscription[] = [
    {
      id: "demo-1",
      serviceName: "Netflix",
      amount: "15.99",
      token: "USDT",
      frequency: "monthly",
      nextPayment: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: "active",
      walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f7DCFF",
      totalPaid: "191.88",
      startDate: new Date("2024-01-15"),
      category: "streaming",
    },
    {
      id: "demo-2",
      serviceName: "Spotify Premium",
      amount: "9.99",
      token: "USDC",
      frequency: "monthly",
      nextPayment: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
      status: "active",
      walletAddress: "0x8B3392483BA26D65E331dB86D4F430E9B3814E5e",
      totalPaid: "119.88",
      startDate: new Date("2024-02-01"),
      category: "streaming",
    },
    {
      id: "demo-3",
      serviceName: "GitHub Pro",
      amount: "4.00",
      token: "USDC",
      frequency: "monthly",
      nextPayment: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      status: "active",
      walletAddress: "0x1234567890123456789012345678901234567890",
      totalPaid: "48.00",
      startDate: new Date("2024-01-01"),
      category: "saas",
    },
    {
      id: "demo-4",
      serviceName: "AWS",
      amount: "125.00",
      token: "USDT",
      frequency: "monthly",
      nextPayment: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      status: "paused",
      walletAddress: "0x9876543210987654321098765432109876543210",
      totalPaid: "750.00",
      startDate: new Date("2023-10-01"),
      category: "saas",
    },
    {
      id: "demo-5",
      serviceName: "Gym Membership",
      amount: "49.99",
      token: "USDT",
      frequency: "monthly",
      nextPayment: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      status: "active",
      walletAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
      totalPaid: "599.88",
      startDate: new Date("2023-06-01"),
      category: "membership",
    },
    {
      id: "demo-6",
      serviceName: "OpenAI API",
      amount: "20.00",
      token: "USDC",
      frequency: "monthly",
      nextPayment: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: "active",
      walletAddress: "0xDEF0123456789ABCDEF0123456789ABCDEF01234",
      totalPaid: "80.00",
      startDate: new Date("2024-05-01"),
      category: "saas",
    },
  ]

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
  const displaySubscriptions = isDemoMode || !currentWallet ? demoSubscriptions : subscriptions
  const displayVendors = isDemoMode || !currentWallet ? demoVendors : vendors
  const displayAutoPayments = isDemoMode || !currentWallet ? demoAutoPayments : autoPayments

  // Filter vendors by search query
  const filteredVendors = displayVendors.filter(
    (v) =>
      v.name.toLowerCase().includes(vendorSearchQuery.toLowerCase()) ||
      v.wallet_address.toLowerCase().includes(vendorSearchQuery.toLowerCase()) ||
      v.category?.toLowerCase().includes(vendorSearchQuery.toLowerCase()),
  )

  // ... existing code for stats calculation ...

  const stats = {
    active: displaySubscriptions.filter((s) => s.status === "active").length,
    paused: displaySubscriptions.filter((s) => s.status === "paused").length,
    monthlyTotal: displaySubscriptions
      .filter((s) => s.status === "active")
      .reduce((sum, s) => {
        const amount = Number.parseFloat(s.amount) || 0 // Use parseFloat and handle potential NaN
        if (s.frequency === "weekly") return sum + amount * 4
        if (s.frequency === "yearly") return sum + amount / 12
        return sum + amount
      }, 0),
    nextPayment: displaySubscriptions
      .filter((s) => s.status === "active")
      .sort((a, b) => a.nextPayment.getTime() - b.nextPayment.getTime())[0],
  }

  // Load vendors from database
  const loadVendors = useCallback(async () => {
    if (!currentWallet || isDemoMode) return

    try {
      const supabase = getSupabase()
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
  }, [currentWallet, isDemoMode])

  // Load subscriptions from database
  const loadSubscriptions = useCallback(async () => {
    if (!currentWallet || isDemoMode) return

    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("owner_address", currentWallet)
        .order("created_at", { ascending: false })

      if (error) throw error

      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        serviceName: row.service_name,
        amount: row.amount,
        token: row.token,
        frequency: row.frequency,
        nextPayment: new Date(row.next_payment_date),
        status: row.status,
        walletAddress: row.wallet_address,
        totalPaid: row.total_paid || "0",
        startDate: new Date(row.created_at),
        category: row.category || "other",
        maxAmount: row.max_amount,
      }))
      setSubscriptions(mapped)
    } catch (err) {
      console.error("[v0] Failed to load subscriptions:", err)
    }
  }, [currentWallet, isDemoMode])

  useEffect(() => {
    loadVendors()
    loadSubscriptions()
  }, [loadVendors, loadSubscriptions])

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

  const saveWalletTag = async () => {
    if (!tagFormData.name || !tagFormData.wallet_address) {
      toast({
        title: "Missing Information",
        description: "Please enter company name and wallet address.",
        variant: "destructive",
      })
      return
    }

    const addressValidation = validateAndChecksumAddress(tagFormData.wallet_address)
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
      const supabase = getSupabase()
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

  // ... existing code for subscription functions ...

  const toggleSubscriptionStatus = async (id: string) => {
    if (isDemoMode) {
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: s.status === "active" ? "paused" : "active" } : s)),
      )
      // Also update demoSubscriptions display if it's being used
      const sub = displaySubscriptions.find((s) => s.id === id)
      if (sub) {
        toast({
          title: sub.status === "active" ? "Subscription Paused" : "Subscription Resumed",
          description: `${sub.serviceName} has been ${sub.status === "active" ? "paused" : "resumed"}.`,
        })
      }
      return
    }

    if (!currentWallet) return

    try {
      const supabase = getSupabase()
      if (!supabase) return

      const sub = subscriptions.find((s) => s.id === id)
      if (!sub) return

      const newStatus = sub.status === "active" ? "paused" : "active"
      const { error } = await supabase.from("subscriptions").update({ status: newStatus }).eq("id", id)

      if (error) throw error

      setSubscriptions((prev) => prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)))
      toast({
        title: newStatus === "active" ? "Subscription Resumed" : "Subscription Paused",
        description: `${sub.serviceName} has been ${newStatus === "active" ? "resumed" : "paused"}.`,
      })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const cancelSubscription = async (id: string) => {
    if (isDemoMode) {
      setSubscriptions((prev) => prev.map((s) => (s.id === id ? { ...s, status: "cancelled" } : s)))
      toast({ title: "Subscription Cancelled", description: "The subscription has been cancelled." })
      return
    }

    if (!currentWallet) return

    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { error } = await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", id)

      if (error) throw error

      setSubscriptions((prev) => prev.map((s) => (s.id === id ? { ...s, status: "cancelled" } : s)))
      toast({ title: "Subscription Cancelled", description: "The subscription has been cancelled." })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  // Payment execution
  const executeSubscriptionPayment = async (subscription: Subscription) => {
    if (isDemoMode) {
      toast({
        title: "Demo Mode",
        description: "Payment simulation - In production this would execute a real transaction.",
      })
      return
    }

    if (!currentWallet) {
      toast({ title: "Error", description: "Please connect your wallet", variant: "destructive" })
      return
    }

    try {
      setIsProcessing(true)
      // Dummy sendToken call for demo
      await sendToken(subscription.walletAddress, subscription.amount, subscription.token)
      toast({ title: "Payment Sent", description: `Paid $${subscription.amount} to ${subscription.serviceName}` })
      // In a real scenario, you'd update the subscription's nextPayment date and totalPaid here
    } catch (err: any) {
      toast({ title: "Payment Failed", description: err.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  // Add subscription
  const addSubscription = async () => {
    if (!newSubscription.serviceName || !newSubscription.walletAddress || !newSubscription.amount) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    const addressValidation = validateAndChecksumAddress(newSubscription.walletAddress)
    if (!addressValidation.isValid) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid wallet address.",
        variant: "destructive",
      })
      return
    }

    const nextDate = new Date()
    if (newSubscription.frequency === "weekly") nextDate.setDate(nextDate.getDate() + 7)
    else if (newSubscription.frequency === "monthly") nextDate.setMonth(nextDate.getMonth() + 1)
    else if (newSubscription.frequency === "yearly") nextDate.setFullYear(nextDate.getFullYear() + 1)

    const subData: Subscription = {
      id: `sub-${Date.now()}`,
      serviceName: newSubscription.serviceName,
      walletAddress: addressValidation.checksumAddress || newSubscription.walletAddress,
      amount: newSubscription.amount,
      token: newSubscription.token,
      frequency: newSubscription.frequency,
      category: newSubscription.category,
      status: "active",
      nextPayment: nextDate,
      startDate: new Date(),
      totalPaid: "0",
      maxAmount: newSubscription.maxAmount || undefined,
    }

    if (isDemoMode) {
      setSubscriptions((prev) => [...prev, subData])
      toast({ title: "Subscription Added", description: `${subData.serviceName} has been added (Demo Mode)` })
      setShowAddSubscription(false)
      setNewSubscription({
        serviceName: "",
        walletAddress: "",
        amount: "",
        token: "USDT",
        frequency: "monthly",
        category: "other",
        maxAmount: "",
      })
      return
    }

    if (!currentWallet) {
      toast({ title: "Error", description: "Please connect wallet", variant: "destructive" })
      return
    }

    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error("Database not available")

      const { error } = await supabase.from("subscriptions").insert({
        owner_address: currentWallet,
        service_name: subData.serviceName,
        wallet_address: subData.walletAddress,
        amount: subData.amount,
        token: subData.token,
        frequency: subData.frequency,
        category: subData.category,
        status: subData.status,
        next_payment_date: subData.nextPayment.toISOString(),
        max_amount: subData.maxAmount,
        // startDate and totalPaid are not directly stored here but can be inferred or added if needed
      })

      if (error) throw error

      await loadSubscriptions() // Reload to get updated data including potentially new IDs
      toast({ title: "Subscription Added", description: `${subData.serviceName} has been added.` })
      setShowAddSubscription(false)
      setNewSubscription({
        serviceName: "",
        walletAddress: "",
        amount: "",
        token: "USDT",
        frequency: "monthly",
        category: "other",
        maxAmount: "",
      })
    } catch (err: any) {
      console.error("[v0] Error adding subscription:", err)
      toast({ title: "Error", description: err.message, variant: "destructive" })
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
    console.log("[v0] processBatchPayment called")
    console.log("[v0] currentWallet:", currentWallet)
    console.log("[v0] isDemoMode:", isDemoMode)
    console.log("[v0] recipients:", recipients)

    const validRecipients = recipients.filter((r) => r.address && Number.parseFloat(r.amount) > 0)
    if (validRecipients.length === 0) {
      toast({
        title: "No Valid Recipients",
        description: "Please add at least one recipient with a valid address and amount.",
        variant: "destructive",
      })
      return
    }

    if (isDemoMode) {
      toast({
        title: "Demo Mode",
        description: `Simulating batch payment of ${validRecipients.length} transactions. In production, this would execute real payments.`,
      })
      return
    }

    if (!currentWallet) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to execute payments.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    let successCount = 0
    let failCount = 0

    for (const recipient of validRecipients) {
      try {
        console.log("[v0] Processing payment to:", recipient.address, recipient.amount, recipient.token)
        // Use the actual sendToken function from useWeb3
        await sendToken(recipient.address, recipient.amount, recipient.token)
        successCount++

        // Save to database
        const supabase = getSupabase()
        if (supabase) {
          await supabase.from("payments").insert({
            from_address: currentWallet,
            to_address: recipient.address,
            amount: recipient.amount,
            token: recipient.token,
            vendor_id: recipient.vendorId || null,
            status: "completed",
          })
        }
      } catch (err: any) {
        console.error("[v0] Payment failed:", err)
        failCount++
      }
    }

    setIsProcessing(false)

    if (successCount > 0) {
      toast({
        title: "Payments Complete",
        description: `${successCount} payment(s) succeeded${failCount > 0 ? `, ${failCount} failed` : ""}.`,
      })
      // Clear recipients after successful batch payment
      setRecipients([{ id: "1", address: "", amount: "", vendorName: "", vendorId: "", token: "USDT" }])
      // Optionally clear draft here if desired
      // localStorage.removeItem("batchPaymentDraft");
    } else {
      toast({
        title: "All Payments Failed",
        description: "Please check your wallet balance and try again.",
        variant: "destructive",
      })
    }
  }

  const toggleAutoPaymentStatus = (id: string) => {
    setAutoPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: p.status === "active" ? "paused" : "active" } : p)),
    )
  }

  return (
    <main className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-muted-foreground text-sm">Manage subscriptions and batch payments</p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild className="bg-transparent">
            <a href="/vendors">
              <Users className="h-4 w-4 mr-2" />
              Contacts
            </a>
          </Button>
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <Button variant={mode === "personal" ? "default" : "ghost"} size="sm" onClick={() => setMode("personal")}>
              <CreditCard className="h-4 w-4 mr-2" />
              Personal
            </Button>
            <Button variant={mode === "business" ? "default" : "ghost"} size="sm" onClick={() => setMode("business")}>
              <Building2 className="h-4 w-4 mr-2" />
              Business
            </Button>
          </div>
        </div>
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

      {mode === "personal" ? (
        /* Personal Mode - Subscription Management */
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Active</div>
                <div className="text-2xl font-bold text-emerald-500">{stats.active}</div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Paused</div>
                <div className="text-2xl font-bold text-amber-500">{stats.paused}</div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Monthly Total</div>
                <div className="text-2xl font-bold">${stats.monthlyTotal.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Next Payment</div>
                <div className="text-lg font-bold">
                  {stats.nextPayment ? stats.nextPayment.nextPayment.toLocaleDateString() : "N/A"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Subscriptions List */}
          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>My Subscriptions</CardTitle>
                <CardDescription>Manage your recurring payments</CardDescription>
              </div>
              <Dialog open={showAddSubscription} onOpenChange={setShowAddSubscription}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Subscription
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Subscription</DialogTitle>
                    <DialogDescription>Set up a new recurring payment.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Service Name</Label>
                      <Input
                        placeholder="e.g. Netflix, Spotify"
                        value={newSubscription.serviceName}
                        onChange={(e) => setNewSubscription({ ...newSubscription, serviceName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Wallet Address</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="0x..."
                          className="font-mono flex-1"
                          value={newSubscription.walletAddress}
                          onChange={(e) => setNewSubscription({ ...newSubscription, walletAddress: e.target.value })}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                              <Users className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64">
                            {/* Displaying only a few vendors for brevity */}
                            {displayVendors.slice(0, 5).map((v) => (
                              <DropdownMenuItem
                                key={v.id}
                                onClick={() =>
                                  setNewSubscription({ ...newSubscription, walletAddress: v.wallet_address })
                                }
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{v.name}</span>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {v.wallet_address.slice(0, 10)}...
                                  </span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={newSubscription.amount}
                          onChange={(e) => setNewSubscription({ ...newSubscription, amount: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Token</Label>
                        <Select
                          value={newSubscription.token}
                          onValueChange={(v: any) => setNewSubscription({ ...newSubscription, token: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USDT">USDT</SelectItem>
                            <SelectItem value="USDC">USDC</SelectItem>
                            <SelectItem value="DAI">DAI</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Frequency</Label>
                        <Select
                          value={newSubscription.frequency}
                          onValueChange={(v: any) => setNewSubscription({ ...newSubscription, frequency: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={newSubscription.category}
                          onValueChange={(v: any) => setNewSubscription({ ...newSubscription, category: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="streaming">Streaming</SelectItem>
                            <SelectItem value="saas">SaaS</SelectItem>
                            <SelectItem value="membership">Membership</SelectItem>
                            <SelectItem value="utility">Utility</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Max Amount (Protection)</Label>
                      <Input
                        type="number"
                        placeholder="Optional - max allowed per transaction"
                        value={newSubscription.maxAmount}
                        onChange={(e) => setNewSubscription({ ...newSubscription, maxAmount: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Set a maximum amount to protect against unexpected charges.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddSubscription(false)}>
                      Cancel
                    </Button>
                    <Button onClick={addSubscription}>Add Subscription</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {displaySubscriptions
                  .filter((s) => s.status !== "cancelled")
                  .map((sub) => (
                    <div
                      key={sub.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        sub.status === "paused"
                          ? "bg-amber-500/5 border-amber-500/20"
                          : sub.status === "cancelled"
                            ? "bg-red-500/5 border-red-500/20 opacity-50"
                            : "bg-muted/30 border-border"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            sub.category === "streaming"
                              ? "bg-purple-500/10"
                              : sub.category === "saas"
                                ? "bg-blue-500/10"
                                : sub.category === "membership"
                                  ? "bg-emerald-500/10"
                                  : "bg-muted"
                          }`}
                        >
                          {sub.category === "streaming" ? (
                            <Play className="h-5 w-5 text-purple-500" />
                          ) : sub.category === "saas" ? (
                            <Zap className="h-5 w-5 text-blue-500" />
                          ) : (
                            <CreditCard className="h-5 w-5 text-emerald-500" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {sub.serviceName}
                            <Badge
                              variant={
                                sub.status === "active"
                                  ? "default"
                                  : sub.status === "paused"
                                    ? "secondary"
                                    : "destructive"
                              }
                              className="text-xs"
                            >
                              {sub.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ${sub.amount} {sub.token} / {sub.frequency}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {sub.walletAddress.slice(0, 10)}...{sub.walletAddress.slice(-8)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <div className="text-muted-foreground">Next</div>
                          <div>{sub.nextPayment.toLocaleDateString()}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => executeSubscriptionPayment(sub)}
                            disabled={sub.status !== "active" || isProcessing}
                            title="Pay Now"
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleSubscriptionStatus(sub.id)}
                            disabled={sub.status === "cancelled"}
                            title={sub.status === "active" ? "Pause" : "Resume"}
                          >
                            {sub.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelSubscription(sub.id)}
                            disabled={sub.status === "cancelled"}
                            title="Cancel"
                            className="text-destructive hover:text-destructive"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                {displaySubscriptions.filter((s) => s.status !== "cancelled").length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No active subscriptions</p>
                    <p className="text-sm">Add a subscription to get started</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Protection Alert */}
          <Alert className="bg-emerald-500/10 border-emerald-500/20">
            <Shield className="h-4 w-4 text-emerald-500" />
            <AlertTitle className="text-emerald-500">Payment Protection Active</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              All subscriptions require your approval before payment. Set maximum amounts to prevent unauthorized
              charges.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        /* Business Mode - Batch Payments */
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="batch">Batch Payment</TabsTrigger>
            <TabsTrigger value="auto">Auto-Payments</TabsTrigger>
            <TabsTrigger value="x402">x402 Bill Pay</TabsTrigger>
          </TabsList>

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
                    <Button variant="outline" size="sm">
                      <FileUp className="h-4 w-4 mr-2" />
                      Import CSV
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
                        <div className="text-2xl font-bold text-primary font-mono">${grandTotal.toFixed(2)}</div>
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
      )}
    </main>
  )
}

// Type definitions
interface Subscription {
  id: string
  serviceName: string
  amount: string
  token: "USDT" | "USDC" | "DAI"
  frequency: "weekly" | "monthly" | "yearly"
  nextPayment: Date
  status: "active" | "paused" | "cancelled"
  walletAddress: string
  totalPaid: string
  startDate: Date
  category: "streaming" | "saas" | "membership" | "utility" | "other"
  chainId?: number
  maxAmount?: string
}

interface AutoPayment {
  id: string
  vendorId: string
  vendorName: string
  walletAddress: string
  amount: string
  token: "USDT" | "USDC" | "DAI"
  frequency: "weekly" | "monthly" | "yearly"
  status: "active" | "paused"
  maxAmount?: string
  nextPayment: Date
  lastPayment?: Date
}

interface PaymentRecipient {
  id: string
  address: string
  amount: string
  vendorName: string
  vendorId: string
  token: "USDT" | "USDC" | "DAI" | "CUSTOM"
  customTokenAddress?: string
  destinationChainId?: number
  isAutoPayment?: boolean
}

interface Vendor {
  id: string
  name: string
  wallet_address: string
  category?: string
  email?: string
  type?: string
  chain?: string
}
