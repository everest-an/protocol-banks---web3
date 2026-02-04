"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Search,
  LayoutGrid,
  ListIcon,
  Download,
  Filter,
  Plus,
  Edit,
  Trash2,
  ExternalLink,
  Copy,
  Send,
  Wallet,
  TrendingUp,
  Clock,
  ChevronRight,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { NetworkGraph } from "@/components/network-graph"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { BatchVendorEditDialog } from "@/components/batch-vendor-edit-dialog"

import type { Vendor, VendorCategory, ReputationTag } from "@/types/vendor"

// Categories
const categories = ["Infrastructure", "Services", "Payroll", "Marketing", "Legal", "Software", "Logistics", "R&D"]

// Chain explorer URLs
const EXPLORER_URLS: Record<string, string> = {
  Ethereum: "https://etherscan.io/address/",
  Polygon: "https://polygonscan.com/address/",
  Arbitrum: "https://arbiscan.io/address/",
  Base: "https://basescan.org/address/",
  Optimism: "https://optimistic.etherscan.io/address/",
  BSC: "https://bscscan.com/address/",
}

// Compute reputation tag based on metrics
function computeReputationTag(vendor: Vendor): ReputationTag {
  const balance = vendor.on_chain_balance || 0
  const txCount = vendor.transaction_count || 0
  const createdAt = vendor.created_at ? new Date(vendor.created_at) : new Date()
  const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)

  if (balance >= 10000 || (vendor.totalReceived || 0) >= 100000) return "whale"
  if (txCount >= 10) return "active"
  if (daysSinceCreation < 30) return "newbie"
  if (txCount === 0) return "inactive"
  return "active"
}

// Reputation tag display config
const REPUTATION_CONFIG: Record<ReputationTag, { label: string; color: string; bg: string }> = {
  whale: { label: "Whale", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" },
  active: { label: "Active", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  newbie: { label: "New", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  inactive: { label: "Inactive", color: "text-zinc-500 dark:text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/30" },
}

// Chain badge colors
const CHAIN_COLORS: Record<string, string> = {
  Ethereum: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
  Polygon: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
  Arbitrum: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  Base: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
  Optimism: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  BSC: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
}

// Generate demo data with Web3-enhanced fields
const generateEnterpriseDemoData = (): Vendor[] => {
  const vendors: Vendor[] = []
  const chains = ["Ethereum", "Polygon", "Arbitrum", "Base", "Optimism"]
  const walletTypes = ["MetaMask", "Safe", "OKX Wallet", "Coinbase Wallet", "Rainbow"]
  const ensNames = ["treasury.eth", "ops.eth", "finance.eth", null, null, null]

  // 1. Subsidiaries (Tier 1)
  const subsidiaries = ["APAC Division", "EMEA Operations", "North America HQ", "Ventures Lab"]
  subsidiaries.forEach((name, i) => {
    const txCount = 120 + Math.floor(Math.random() * 50)
    const totalReceived = 500000 + Math.random() * 1000000
    vendors.push({
      id: `sub-${i}`,
      company_name: name,
      name,
      wallet_address: `0x${Math.random().toString(16).substr(2, 40)}`,
      ens_name: i === 0 ? "apac.protocolbank.eth" : i === 1 ? "emea.protocolbank.eth" : undefined,
      contact_email: `finance@${name.toLowerCase().replace(/\s/g, "")}.com`,
      email: `finance@${name.toLowerCase().replace(/\s/g, "")}.com`,
      notes: "Internal Transfer",
      created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      totalReceived,
      ltv: totalReceived,
      on_chain_balance: 50000 + Math.random() * 200000,
      transaction_count: txCount,
      category: "Internal",
      tier: "subsidiary",
      chain: "Ethereum",
      last_chain: chains[i % chains.length],
      last_wallet_type: "Safe",
      last_payment_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
  })

  // 2. Key Partners (Tier 2)
  const partners = ["Cloudflare", "AWS", "Google Cloud", "Salesforce", "Stripe", "Deel", "WeWork", "Slack"]
  partners.forEach((name, i) => {
    const totalReceived = 100000 + Math.random() * 300000
    vendors.push({
      id: `partner-${i}`,
      company_name: name,
      name,
      wallet_address: `0x${Math.random().toString(16).substr(2, 40)}`,
      ens_name: ensNames[i % ensNames.length] || undefined,
      contact_email: `billing@${name.toLowerCase().replace(/\s/g, "")}.com`,
      email: `billing@${name.toLowerCase().replace(/\s/g, "")}.com`,
      notes: "Annual Contract",
      created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      totalReceived,
      ltv: totalReceived,
      on_chain_balance: 10000 + Math.random() * 80000,
      transaction_count: 12 + Math.floor(Math.random() * 30),
      category: "Infrastructure",
      tier: "partner",
      parentId: `sub-${i % subsidiaries.length}`,
      chain: "Ethereum",
      last_chain: chains[i % chains.length],
      last_wallet_type: walletTypes[i % walletTypes.length],
      last_payment_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
  })

  // 3. Regular Vendors (Tier 3)
  for (let i = 0; i < 20; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)] as any
    const vendorName = `Vendor ${Math.random().toString(36).substr(2, 5).toUpperCase()} Ltd`
    const totalReceived = 5000 + Math.random() * 50000
    const txCount = 1 + Math.floor(Math.random() * 20)
    vendors.push({
      id: `vendor-${i}`,
      company_name: vendorName,
      name: vendorName,
      wallet_address: `0x${Math.random().toString(16).substr(2, 40)}`,
      contact_email: `invoices@vendor${i}.com`,
      email: `invoices@vendor${i}.com`,
      notes: `Invoice #${1000 + i}`,
      created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      totalReceived,
      ltv: totalReceived,
      on_chain_balance: Math.random() * 20000,
      transaction_count: txCount,
      category,
      tier: "vendor",
      parentId: Math.random() > 0.3 ? `partner-${i % partners.length}` : undefined,
      chain: "Ethereum",
      last_chain: chains[Math.floor(Math.random() * chains.length)],
      last_wallet_type: walletTypes[Math.floor(Math.random() * walletTypes.length)],
      last_payment_at: txCount > 0 ? new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString() : undefined,
    })
  }

  return vendors
}

const demoVendors = generateEnterpriseDemoData()

// Format relative time
function timeAgo(dateStr?: string): string {
  if (!dateStr) return "Never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export default function VendorsPage() {
  const { address: wallet, isConnected, chainId, signMessage } = useUnifiedWallet()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  const router = useRouter()

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"list" | "dashboard">("list")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedTag, setSelectedTag] = useState<ReputationTag | "all">("all")

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")

  // Dialog States
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null)

  // Batch Edit States
  const [batchEditMode, setBatchEditMode] = useState(false)
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(new Set())
  const [batchEditDialogOpen, setBatchEditDialogOpen] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    wallet_address: "",
    ens_name: "",
    email: "",
    notes: "",
    category: "",
    tier: "vendor",
    chain: "Ethereum",
  })

  const displayVendors = isDemoMode ? demoVendors : vendors

  // Compute tags for all vendors
  const vendorsWithTags = useMemo(() => {
    return displayVendors.map((v) => ({
      ...v,
      reputation_tag: v.reputation_tag || computeReputationTag(v),
    }))
  }, [displayVendors])

  // Tag counts
  const tagCounts = useMemo(() => {
    const counts = { all: vendorsWithTags.length, whale: 0, active: 0, newbie: 0, inactive: 0 }
    vendorsWithTags.forEach((v) => {
      const tag = v.reputation_tag || "active"
      counts[tag] = (counts[tag] || 0) + 1
    })
    return counts
  }, [vendorsWithTags])

  const filteredVendors = useMemo(() => {
    return vendorsWithTags.filter((v) => {
      const matchesSearch =
        (v.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        v.wallet_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.ens_name?.toLowerCase() || "").includes(searchQuery.toLowerCase())

      const matchesTag = selectedTag === "all" || v.reputation_tag === selectedTag

      return matchesSearch && matchesTag
    })
  }, [vendorsWithTags, searchQuery, selectedTag])

  // Sort by LTV descending
  const sortedVendors = useMemo(() => {
    return [...filteredVendors].sort((a, b) => (b.ltv || b.totalReceived || 0) - (a.ltv || a.totalReceived || 0))
  }, [filteredVendors])

  useEffect(() => {
    if (isConnected && wallet) {
      loadVendors()
    } else {
      setLoading(false)
    }
  }, [isConnected, wallet, isDemoMode])

  const loadVendors = async () => {
    try {
      if (!wallet) {
        setLoading(false)
        return
      }

      const res = await fetch(`/api/vendors?owner=${wallet}`)
      if (!res.ok) throw new Error("Failed to fetch vendors")
      const { vendors: vendorsData } = await res.json()

      // Enrich with payment stats from transactions API
      let allPayments: any[] = []
      try {
        const currentChainId = chainId || "1"
        const response = await fetch(`/api/transactions?address=${wallet}&chainId=${currentChainId}`)
        const data = await response.json()
        if (data.transactions) {
          allPayments = data.transactions.filter(
            (tx: any) => tx.from_address?.toLowerCase() === wallet.toLowerCase(),
          )
        }
      } catch (err) {
        console.error("Failed to fetch external transactions for vendors:", err)
      }

      const vendorsWithStats = (vendorsData || []).map((vendor: any) => {
        const vendorPayments = allPayments.filter(
          (p: any) =>
            p.vendor_id === vendor.id ||
            (p.to_address &&
              vendor.wallet_address &&
              p.to_address.toLowerCase() === vendor.wallet_address.toLowerCase()),
        )

        const totalReceived = vendorPayments.reduce((sum: number, p: any) => sum + (Number(p.amount_usd) || 0), 0)

        return {
          ...vendor,
          totalReceived,
          ltv: totalReceived || vendor.ltv || 0,
          transaction_count: vendorPayments.length || vendor.transaction_count || 0,
          category: vendor.category || categories[vendor.id.charCodeAt(0) % categories.length],
          tier: vendor.tier || "vendor",
        }
      })

      setVendors(vendorsWithStats)
    } catch (error) {
      console.error("Failed to load vendors", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentRequest = (vendor: Vendor) => {
    const url = `/batch-payment?recipient=${vendor.wallet_address}&name=${encodeURIComponent(vendor.name || vendor.company_name || "")}`
    router.push(url)
  }

  const handleEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setFormData({
      name: vendor.name || "",
      wallet_address: vendor.wallet_address,
      ens_name: vendor.ens_name || "",
      email: vendor.email || "",
      notes: vendor.notes || "",
      category: vendor.category || "",
      tier: vendor.tier || "vendor",
      chain: vendor.chain || "Ethereum",
    })
    setEditMode(true)
    setDialogOpen(true)
  }

  const handleDeleteVendor = (vendor: Vendor) => {
    setVendorToDelete(vendor)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteVendor = async () => {
    if (!vendorToDelete || !wallet) return

    try {
      const res = await fetch(`/api/vendors/${vendorToDelete.id}?owner=${wallet}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete")
      }

      toast({ title: "Success", description: "Contact deleted successfully" })
      setDeleteDialogOpen(false)
      setVendorToDelete(null)
      loadVendors()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!wallet) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to add contacts",
        variant: "destructive",
      })
      return
    }

    try {
      if (editMode && editingVendor) {
        // Detect address change — requires wallet signature
        const isAddressChange =
          formData.wallet_address.toLowerCase() !== editingVendor.wallet_address.toLowerCase()

        let addressChangeSignature: string | undefined
        let addressChangeMessage: string | undefined

        if (isAddressChange) {
          // Check cooldown on the client side for UX
          if (editingVendor.address_changed_at) {
            const cooldownMs = 24 * 60 * 60 * 1000
            const timeSince = Date.now() - new Date(editingVendor.address_changed_at).getTime()
            if (timeSince < cooldownMs) {
              const hoursLeft = Math.ceil((cooldownMs - timeSince) / (1000 * 60 * 60))
              toast({
                title: "Address Change Cooldown",
                description: `Cannot change address for ${hoursLeft} more hours`,
                variant: "destructive",
              })
              return
            }
          }

          // Request wallet signature
          addressChangeMessage =
            `Protocol Banks: Confirm address change for "${editingVendor.name}"\n` +
            `From: ${editingVendor.wallet_address}\n` +
            `To: ${formData.wallet_address}\n` +
            `Timestamp: ${Date.now()}`

          try {
            addressChangeSignature = await signMessage(addressChangeMessage)
          } catch {
            toast({
              title: "Signature Required",
              description: "You must sign the message to change a vendor address",
              variant: "destructive",
            })
            return
          }
        }

        const body: Record<string, any> = {
          owner_address: wallet,
          name: formData.name,
          wallet_address: formData.wallet_address,
          ens_name: formData.ens_name || null,
          email: formData.email,
          notes: formData.notes,
          category: formData.category,
          tier: formData.tier,
          chain: formData.chain,
        }
        if (addressChangeSignature) {
          body.address_change_signature = addressChangeSignature
          body.address_change_message = addressChangeMessage
        }

        const res = await fetch(`/api/vendors/${editingVendor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || "Failed to update")
        }
        toast({ title: "Success", description: "Contact updated successfully" })
      } else {
        const res = await fetch("/api/vendors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            wallet_address: formData.wallet_address,
            ens_name: formData.ens_name || null,
            email: formData.email,
            notes: formData.notes,
            category: formData.category,
            tier: formData.tier,
            chain: formData.chain,
            created_by: wallet,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || "Failed to create")
        }
        toast({ title: "Success", description: "Contact added successfully" })
      }

      setDialogOpen(false)
      setEditMode(false)
      setEditingVendor(null)
      setFormData({ name: "", wallet_address: "", ens_name: "", email: "", notes: "", category: "", tier: "vendor", chain: "Ethereum" })
      loadVendors()
    } catch (err: any) {
      console.error("[v0] Failed to save contact:", err)
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleBatchEditSubmit = async (updates: Array<{ id: string; name: string }>) => {
    if (!wallet) return
    try {
      const res = await fetch("/api/vendors/batch-update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates, owner_address: wallet }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Batch update failed")
      }
      const result = await res.json()
      toast({ title: "Success", description: `Updated ${result.updated} contacts` })
      setBatchEditDialogOpen(false)
      setBatchEditMode(false)
      setSelectedVendorIds(new Set())
      loadVendors()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const toggleVendorSelection = (id: string) => {
    setSelectedVendorIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setEditMode(false)
      setEditingVendor(null)
      setFormData({ name: "", wallet_address: "", ens_name: "", email: "", notes: "", category: "", tier: "vendor", chain: "Ethereum" })
    }
  }

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    toast({ title: "Copied", description: "Address copied to clipboard" })
  }

  const getExplorerUrl = (vendor: Vendor) => {
    const chain = vendor.last_chain || vendor.chain || "Ethereum"
    const base = EXPLORER_URLS[chain] || EXPLORER_URLS.Ethereum
    return `${base}${vendor.wallet_address}`
  }

  const getDebankUrl = (address: string) => `https://debank.com/profile/${address}`

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {!isConnected && (
        <div className="bg-indigo-600 text-white px-4 py-2 text-center text-sm font-medium animate-in slide-in-from-top">
          You are viewing a live demo. Connect your wallet to manage your own contacts.
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto py-3 px-3 sm:px-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap">Contacts</h1>
              <Badge variant="secondary" className="font-mono text-xs">
                {sortedVendors.length}
              </Badge>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Batch Edit Toggle */}
              {!isDemoMode && isConnected && (
                <Button
                  size="sm"
                  variant={batchEditMode ? "secondary" : "outline"}
                  className="hidden sm:flex gap-2"
                  onClick={() => {
                    setBatchEditMode(!batchEditMode)
                    if (batchEditMode) setSelectedVendorIds(new Set())
                  }}
                >
                  <Edit className="w-4 h-4" />
                  {batchEditMode ? "Cancel" : "Batch Edit"}
                </Button>
              )}
              {batchEditMode && selectedVendorIds.size > 0 && (
                <Button
                  size="sm"
                  onClick={() => setBatchEditDialogOpen(true)}
                >
                  Edit {selectedVendorIds.size} Selected
                </Button>
              )}

              {/* Add Contact */}
              <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogTrigger asChild>
                  <Button size="sm" className="hidden sm:flex gap-2">
                    <Plus className="w-4 h-4" /> Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editMode ? "Edit Contact" : "Add New Contact"}</DialogTitle>
                    <DialogDescription>
                      {editMode
                        ? "Update the wallet contact information."
                        : "Add a wallet address to your contacts for quick payments."}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddSubmit} className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="address">Wallet Address *</Label>
                      <Input
                        id="address"
                        placeholder="0x... or ENS name"
                        value={formData.wallet_address}
                        onChange={(e) => setFormData({ ...formData, wallet_address: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="ens">ENS Name</Label>
                      <Input
                        id="ens"
                        placeholder="e.g. vitalik.eth"
                        value={formData.ens_name}
                        onChange={(e) => setFormData({ ...formData, ens_name: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="name">Name / Label *</Label>
                      <Input
                        id="name"
                        placeholder="e.g. Acme Corp or John"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="chain">Primary Chain</Label>
                        <Select
                          value={formData.chain}
                          onValueChange={(val) => setFormData({ ...formData, chain: val })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(EXPLORER_URLS).map((chain) => (
                              <SelectItem key={chain} value={chain}>
                                {chain}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="tier">Type</Label>
                        <Select value={formData.tier} onValueChange={(val) => setFormData({ ...formData, tier: val })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vendor">Vendor</SelectItem>
                            <SelectItem value="partner">Partner</SelectItem>
                            <SelectItem value="subsidiary">Subsidiary</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email (optional)</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="contact@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        placeholder="Additional details..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit">{editMode ? "Update" : "Add Contact"}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Mobile FAB */}
              <div className="sm:hidden fixed bottom-24 right-4 z-40">
                <Button size="icon" className="rounded-full h-12 w-12 shadow-lg" onClick={() => setDialogOpen(true)}>
                  <Plus className="w-6 h-6" />
                </Button>
              </div>

              {/* Search */}
              <div className="relative flex-1 sm:flex-none sm:w-48 lg:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                <Input
                  placeholder="Search address, ENS, name..."
                  className="pl-8 sm:pl-9 h-9 text-sm bg-secondary/50 border-transparent focus:bg-background transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* View Toggle: List (default) ←→ Dashboard */}
              <div className="flex items-center border border-border rounded-md bg-secondary/30 p-0.5 shrink-0">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("list")}
                  title="Contact List"
                >
                  <ListIcon className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "dashboard" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("dashboard")}
                  title="Network Dashboard"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Reputation Tag Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
            <div className="flex items-center gap-2 text-xs shrink-0">
              <Filter className="w-3 h-3 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2">
              {(["all", "whale", "active", "newbie", "inactive"] as const).map((tag) => {
                const config = tag === "all" ? null : REPUTATION_CONFIG[tag]
                const count = tagCounts[tag]
                return (
                  <Button
                    key={tag}
                    variant={selectedTag === tag ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-3 text-xs whitespace-nowrap"
                    onClick={() => setSelectedTag(tag)}
                  >
                    {tag === "all" ? "All" : config!.label} ({count})
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-3 sm:p-4 md:p-6 pb-24 md:pb-6">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="space-y-4">

          {/* ===== LIST VIEW (Default) - Stripe-style vertical contact cards ===== */}
          <TabsContent value="list" className="m-0 border-none p-0 outline-none">
            {/* Summary Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Card className="bg-card/50 border-border">
                <CardContent className="py-3 px-4">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Contacts</p>
                  <p className="text-lg sm:text-xl font-mono font-semibold">{sortedVendors.length}</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border">
                <CardContent className="py-3 px-4">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Volume (LTV)</p>
                  <p className="text-lg sm:text-xl font-mono font-semibold">
                    ${sortedVendors.reduce((sum, v) => sum + (v.ltv || v.totalReceived || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border">
                <CardContent className="py-3 px-4">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">Aggregate Balance</p>
                  <p className="text-lg sm:text-xl font-mono font-semibold">
                    ${sortedVendors.reduce((sum, v) => sum + (v.on_chain_balance || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border">
                <CardContent className="py-3 px-4">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">Whales</p>
                  <p className="text-lg sm:text-xl font-mono font-semibold text-amber-500">{tagCounts.whale}</p>
                </CardContent>
              </Card>
            </div>

            {/* Contact List */}
            <div className="space-y-2">
              {sortedVendors.map((vendor) => {
                const tag = vendor.reputation_tag || "active"
                const tagConfig = REPUTATION_CONFIG[tag]
                const chainColor = CHAIN_COLORS[vendor.last_chain || vendor.chain] || CHAIN_COLORS.Ethereum
                const displayName = vendor.ens_name || vendor.name || vendor.company_name || "Unknown"
                const shortAddr = `${vendor.wallet_address.substring(0, 6)}...${vendor.wallet_address.substring(38)}`
                const hasActiveCooldown = vendor.address_changed_at &&
                  (Date.now() - new Date(vendor.address_changed_at).getTime()) < 24 * 60 * 60 * 1000

                return (
                  <Card
                    key={vendor.id}
                    className={`border-border hover:border-primary/30 transition-all cursor-pointer group ${batchEditMode && selectedVendorIds.has(vendor.id) ? "border-primary bg-primary/5" : ""}`}
                    onClick={() => {
                      if (batchEditMode) {
                        toggleVendorSelection(vendor.id)
                      } else {
                        router.push(`/vendors/${vendor.id}`)
                      }
                    }}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-4">
                        {/* Batch selection checkbox */}
                        {batchEditMode && (
                          <input
                            type="checkbox"
                            checked={selectedVendorIds.has(vendor.id)}
                            onChange={() => toggleVendorSelection(vendor.id)}
                            className="h-4 w-4 shrink-0 rounded border-border"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}

                        {/* Avatar */}
                        <Avatar className="h-10 w-10 border border-border shrink-0">
                          <AvatarImage src={`https://avatar.vercel.sh/${vendor.wallet_address}`} />
                          <AvatarFallback className="text-xs">
                            {(vendor.name || vendor.company_name || "??").substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* Identity: ENS / Address + Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate">{displayName}</span>
                            {vendor.ens_name && vendor.name && (
                              <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                                ({vendor.name})
                              </span>
                            )}
                            {/* Reputation Tag */}
                            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 shrink-0 ${tagConfig.bg} ${tagConfig.color}`}>
                              {tagConfig.label}
                            </Badge>
                            {/* Address Change Cooldown Warning */}
                            {hasActiveCooldown && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                Address recently changed
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-xs text-muted-foreground">{shortAddr}</span>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); copyAddress(vendor.wallet_address) }}
                            >
                              <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                            </button>
                          </div>
                        </div>

                        {/* Last Chain / Wallet */}
                        <div className="hidden md:flex flex-col items-center gap-1 shrink-0 w-24">
                          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${chainColor}`}>
                            {vendor.last_chain || vendor.chain}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {vendor.last_wallet_type || "Wallet"}
                          </span>
                        </div>

                        {/* On-chain Balance */}
                        <div className="hidden lg:block text-right shrink-0 w-28">
                          <p className="text-xs text-muted-foreground">Balance</p>
                          <p className="font-mono text-sm font-medium">
                            ${(vendor.on_chain_balance || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                        </div>

                        {/* LTV */}
                        <div className="text-right shrink-0 w-28">
                          <p className="text-xs text-muted-foreground">LTV</p>
                          <p className="font-mono text-sm font-medium">
                            ${(vendor.ltv || vendor.totalReceived || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                        </div>

                        {/* Last Payment */}
                        <div className="hidden sm:block text-right shrink-0 w-20">
                          <p className="text-xs text-muted-foreground">Last Tx</p>
                          <p className="text-xs font-medium flex items-center justify-end gap-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo(vendor.last_payment_at)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Send Payment"
                            onClick={(e) => { e.stopPropagation(); router.push(`/send?to=${vendor.wallet_address}`) }}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <a
                            href={getExplorerUrl(vendor)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="View on Explorer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                          <a
                            href={getDebankUrl(vendor.wallet_address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Portfolio (DeBank)">
                              <Wallet className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Edit"
                            onClick={(e) => { e.stopPropagation(); handleEditVendor(vendor) }}
                            disabled={isDemoMode || !isConnected}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete"
                            onClick={(e) => { e.stopPropagation(); handleDeleteVendor(vendor) }}
                            disabled={isDemoMode || !isConnected}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

              {sortedVendors.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Wallet className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-2">No contacts yet</p>
                  <p className="text-sm mb-4">Add wallet addresses to manage your payment contacts.</p>
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add First Contact
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== DASHBOARD VIEW - Network Graph + Stats ===== */}
          <TabsContent value="dashboard" className="m-0 border-none p-0 outline-none">
            <div className="min-h-[400px] sm:min-h-[500px] md:min-h-[600px]">
              <NetworkGraph
                vendors={filteredVendors}
                userAddress={wallet || undefined}
                onAddContact={() => setDialogOpen(true)}
                onPaymentRequest={handlePaymentRequest}
              />
            </div>

            {/* Stats Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6">
              <Card className="bg-card/50 border-border">
                <CardHeader className="pb-2 pt-3 px-3 sm:pt-4 sm:px-4">
                  <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Network Volume
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
                  <div className="text-lg sm:text-2xl font-mono font-medium">
                    ${filteredVendors.reduce((sum, v) => sum + (v.totalReceived || 0), 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border">
                <CardHeader className="pb-2 pt-3 px-3 sm:pt-4 sm:px-4">
                  <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Active Entities
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
                  <div className="text-lg sm:text-2xl font-mono font-medium">{filteredVendors.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border">
                <CardHeader className="pb-2 pt-3 px-3 sm:pt-4 sm:px-4">
                  <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Avg. Transaction
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
                  <div className="text-lg sm:text-2xl font-mono font-medium">
                    ${filteredVendors.length > 0
                      ? Math.round(
                          filteredVendors.reduce((sum, v) => sum + (v.totalReceived || 0), 0) /
                            Math.max(filteredVendors.reduce((sum, v) => sum + (v.transaction_count || 1), 0), 1),
                        ).toLocaleString()
                      : "0"}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border">
                <CardHeader className="pb-2 pt-3 px-3 sm:pt-4 sm:px-4">
                  <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Aggregate Balance
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
                  <div className="text-lg sm:text-2xl font-mono font-medium text-emerald-500">
                    ${filteredVendors.reduce((sum, v) => sum + (v.on_chain_balance || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{vendorToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteVendor}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Edit Dialog */}
      {batchEditDialogOpen && (
        <BatchVendorEditDialog
          open={batchEditDialogOpen}
          onOpenChange={setBatchEditDialogOpen}
          vendors={sortedVendors.filter((v) => selectedVendorIds.has(v.id))}
          onSubmit={handleBatchEditSubmit}
        />
      )}
    </div>
  )
}
