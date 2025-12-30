"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Search, LayoutGrid, ListIcon, Calendar, Filter, Plus, Wallet, ArrowUpRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { NetworkGraph } from "@/components/network-graph"
import { Label } from "@/components/ui/label"
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

import type { Vendor, VendorInput } from "@/types"
import { useVendors } from "@/hooks/use-vendors"
import { useBalance } from "@/hooks/use-balance"
import { calculateNetworkStats } from "@/lib/services/vendor-service"

const categories = ["Infrastructure", "Services", "Payroll", "Marketing", "Legal", "Software", "Logistics", "R&D"]

export default function HomePage() {
  const { isConnected, connectWallet, wallet } = useWeb3()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  const router = useRouter()

  const { vendors, loading, addVendor, updateVendor, deleteVendor } = useVendors({ isDemoMode, walletAddress: wallet })
  const { balance, loading: balanceLoading } = useBalance({ isDemoMode, walletAddress: wallet })

  const [tierFilter, setTierFilter] = useState<"all" | "subsidiary" | "partner" | "vendor">("all")
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph")
  const [timeRange, setTimeRange] = useState([0, 100])
  const [dateRange, setDateRange] = useState({
    start: new Date(2025, 0, 1),
    end: new Date(2025, 11, 31),
  })

  const [searchQuery, setSearchQuery] = useState("")
  const [yearRange, setYearRange] = useState([2024])
  const [allowRange, setAllowRange] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null)

  const [formData, setFormData] = useState<VendorInput>({
    name: "",
    wallet_address: "",
    email: "",
    notes: "",
    category: "",
    tier: "vendor",
    chain: "ethereum",
  })

  const displayBalance = (balance?.totalUSD ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const matchesSearch =
        (v.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (v.wallet_address?.toLowerCase() || "").includes(searchQuery.toLowerCase())

      return matchesSearch && (tierFilter === "all" || tierFilter === v.tier)
    })
  }, [vendors, searchQuery, tierFilter])

  const stats = useMemo(() => calculateNetworkStats(vendors), [vendors])

  const handlePaymentRequest = (vendor: Vendor) => {
    const url = `/batch-payment?recipient=${vendor.wallet_address}&name=${encodeURIComponent(vendor.name)}`
    router.push(url)
  }

  const handleEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setFormData({
      name: vendor.name,
      wallet_address: vendor.wallet_address,
      email: vendor.email || "",
      notes: vendor.notes || "",
      category: vendor.category || "",
      tier: vendor.tier || "vendor",
      chain: vendor.chain || "ethereum",
    })
    setEditMode(true)
    setDialogOpen(true)
  }

  const handleDeleteVendor = (vendor: Vendor) => {
    setVendorToDelete(vendor)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteVendor = async () => {
    if (!vendorToDelete) return

    try {
      await deleteVendor(vendorToDelete.id)
      toast({ title: "Success", description: "Wallet tag deleted successfully" })
      setDeleteDialogOpen(false)
      setVendorToDelete(null)
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!wallet && !isDemoMode) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to add contacts",
        variant: "destructive",
      })
      return
    }

    try {
      if (editMode && editingVendor) {
        await updateVendor(editingVendor.id, formData)
        toast({ title: "Success", description: "Wallet tag updated successfully" })
      } else {
        await addVendor(formData)
        toast({ title: "Success", description: "Wallet tag added successfully" })
      }

      setDialogOpen(false)
      setEditMode(false)
      setEditingVendor(null)
      setFormData({
        name: "",
        wallet_address: "",
        email: "",
        notes: "",
        category: "",
        tier: "vendor",
        chain: "ethereum",
      })
    } catch (err: any) {
      console.error("Failed to save vendor:", err)
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setEditMode(false)
      setEditingVendor(null)
      setFormData({
        name: "",
        wallet_address: "",
        email: "",
        notes: "",
        category: "",
        tier: "vendor",
        chain: "ethereum",
      })
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Balance Bar */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto py-3 px-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 sm:gap-6">
              <div>
                <div className="text-xs text-muted-foreground">Balance</div>
                <div className="text-xl sm:text-2xl font-bold font-mono">${displayBalance}</div>
              </div>
              <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-border text-xs">
                <span className="text-muted-foreground">
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-0 mr-1">
                    USDC
                  </Badge>
                  {balance?.usdc?.toLocaleString()}
                </span>
                <span className="text-muted-foreground">
                  <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-0 mr-1">
                    USDT
                  </Badge>
                  {balance?.usdt?.toLocaleString()}
                </span>
                <span className="text-muted-foreground">
                  <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-0 mr-1">
                    DAI
                  </Badge>
                  {balance?.dai?.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              {!isConnected ? (
                <Button onClick={connectWallet} size="sm">
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect
                </Button>
              ) : (
                <>
                  <Button variant="default" size="sm">
                    <Plus className="mr-1 h-4 w-4" />
                    Add
                  </Button>
                  <Button variant="outline" size="sm" className="bg-transparent">
                    <ArrowUpRight className="mr-1 h-4 w-4" />
                    Withdraw
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Header with controls */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto py-3 px-3 sm:px-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2 text-sm">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground font-medium">FILTERS:</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={tierFilter === "all" ? "default" : "outline"}
                onClick={() => setTierFilter("all")}
                className="h-8"
              >
                All
              </Button>
              <Button
                size="sm"
                variant={tierFilter === "vendor" ? "default" : "outline"}
                onClick={() => setTierFilter("vendor")}
                className="h-8"
              >
                Suppliers
              </Button>
              <Button
                size="sm"
                variant={tierFilter === "partner" ? "default" : "outline"}
                onClick={() => setTierFilter("partner")}
                className="h-8"
              >
                Partners
              </Button>
              <Button
                size="sm"
                variant={tierFilter === "subsidiary" ? "default" : "outline"}
                onClick={() => setTierFilter("subsidiary")}
                className="h-8"
              >
                Subsidiaries
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pb-2">
            <div className="flex items-center gap-4 flex-1 w-full">
              <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">TIME RANGE</span>
              <div className="flex-1 px-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={timeRange[1]}
                  onChange={(e) => setTimeRange([timeRange[0], Number.parseInt(e.target.value)])}
                  className="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
              <div className="flex items-center gap-2 text-xs bg-secondary px-3 py-1 rounded">
                <span className="text-muted-foreground">Range</span>
                <Calendar className="w-3 h-3" />
                <span className="font-mono">
                  {dateRange.start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {" - "}
                  {dateRange.end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>

          {/* Existing controls row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap">Global Payment Mesh</h1>
              <div className="h-4 w-px bg-border hidden sm:block"></div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs">FY: {allowRange ? `${yearRange[0]}-${yearRange[1]}` : yearRange[0]}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogTrigger asChild>
                  <Button size="sm" className="hidden sm:flex gap-2">
                    <Plus className="w-4 h-4" /> Add Tag
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editMode ? "Edit Wallet Tag" : "Add New Wallet Tag"}</DialogTitle>
                    <DialogDescription>
                      {editMode
                        ? "Update the wallet tag information below."
                        : "Tag a wallet address with business metadata for easier identification."}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddSubmit} className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="address">Wallet Address</Label>
                      <Input
                        id="address"
                        placeholder="0x..."
                        value={formData.wallet_address}
                        onChange={(e) => setFormData({ ...formData, wallet_address: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="name">Entity / Company Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g. Acme Corp"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="category">Category</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(val) => setFormData({ ...formData, category: val })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="tier">Tier / Attribute</Label>
                        <Select
                          value={formData.tier}
                          onValueChange={(val) => setFormData({ ...formData, tier: val as any })}
                        >
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
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        placeholder="Additional details..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit">{editMode ? "Update Tag" : "Save Tag"}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2 text-sm">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs">Active Filter:</span>
                  <Badge variant="secondary" className="text-xs">
                    {tierFilter === "all"
                      ? "All Categories"
                      : tierFilter === "vendor"
                        ? "Suppliers"
                        : tierFilter === "partner"
                          ? "Partners"
                          : "Subsidiaries"}
                  </Badge>
                </div>

                {/* View mode toggle */}
                <div className="flex gap-1 border border-border rounded-md p-1">
                  <Button
                    size="sm"
                    variant={viewMode === "graph" ? "default" : "ghost"}
                    onClick={() => setViewMode("graph")}
                    className="h-7 px-2"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "list" ? "default" : "ghost"}
                    onClick={() => setViewMode("list")}
                    className="h-7 px-2"
                  >
                    <ListIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Existing search row */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search entities..."
              className="pl-9 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container mx-auto py-6 px-4">
        {viewMode === "graph" ? (
          <NetworkGraph
            vendors={filteredVendors}
            userAddress={wallet}
            onPaymentRequest={(vendor) => {
              console.log("[v0] Payment requested for vendor:", vendor)
            }}
          />
        ) : (
          <div className="grid gap-4">
            {filteredVendors.map((vendor) => (
              <Card key={vendor.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{vendor.company_name || vendor.name}</h3>
                        <Badge
                          variant={
                            vendor.tier === "subsidiary"
                              ? "default"
                              : vendor.tier === "partner"
                                ? "secondary"
                                : "outline"
                          }
                          className={
                            vendor.tier === "subsidiary"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : vendor.tier === "partner"
                                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                : ""
                          }
                        >
                          {vendor.tier}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{vendor.wallet_address}</p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 bg-transparent">
                      Initiate Transfer
                    </Button>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-t border-b border-border">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Volume</p>
                      <p className="text-lg font-semibold">${(vendor.monthly_volume || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Transactions</p>
                      <p className="text-lg font-semibold">{vendor.transaction_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Chain</p>
                      <p className="text-lg font-semibold">{vendor.chain || "Ethereum"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Category</p>
                      <p className="text-lg font-semibold capitalize">{vendor.category || "General"}</p>
                    </div>
                  </div>

                  {/* Contact & details row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="truncate">{(vendor as any).email || vendor.contact_email || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Contract</p>
                      <p>{(vendor as any).notes || "Standard Agreement"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Added</p>
                      <p>{new Date(vendor.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Active Contract
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Wallet Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag for "{vendorToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteVendor}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
