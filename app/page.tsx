"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Search, LayoutGrid, ListIcon, Calendar, Filter, Plus, ArrowUpRight } from "lucide-react"
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { useMediaQuery } from "@/hooks/use-media-query"

import type { Vendor, VendorInput, VendorCategory } from "@/types"
import { useVendors } from "@/hooks/use-vendors"
import { useBalance } from "@/hooks/use-balance"
import { calculateNetworkStats } from "@/lib/services/vendor-service"
import { BalanceDistribution } from "@/components/balance-distribution"
import { QuantumReadinessCard } from "@/components/quantum-readiness-card"
import { DashboardActivity } from "@/components/dashboard-activity"

const categories = ["Infrastructure", "Services", "Payroll", "Marketing", "Legal", "Software", "Logistics", "R&D"]

export default function HomePage() {
  const { isConnected, connectWallet, wallet } = useWeb3()
  const { isDemoMode, setWalletConnected } = useDemo()
  const { toast } = useToast()
  const router = useRouter()
  const isMobile = useMediaQuery("(max-width: 768px)")

  useEffect(() => {
    setWalletConnected(isConnected)
  }, [isConnected, setWalletConnected])

  const { vendors, loading, addVendor, updateVendor, deleteVendor } = useVendors({ isDemoMode, walletAddress: wallet || undefined })
  const { balance, loading: balanceLoading } = useBalance({ isDemoMode, walletAddress: wallet || undefined })

  const [tierFilter, setTierFilter] = useState<"all" | "subsidiary" | "partner" | "vendor">("all")
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph")
  const [timeRange, setTimeRange] = useState([0, 100])
  
  // Use dynamic date range based on current year
  const currentYear = new Date().getFullYear()
  const [dateRange, setDateRange] = useState({
    start: new Date(currentYear, 0, 1),
    end: new Date(currentYear, 11, 31),
  })

  const [searchQuery, setSearchQuery] = useState("")
  const [yearRange, setYearRange] = useState([currentYear])
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
    category: undefined,
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
    const url = `/batch-payment?recipient=${vendor.wallet_address}&name=${encodeURIComponent(vendor.name || vendor.company_name || '')}`
    router.push(url)
  }

  const handleEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setFormData({
      name: vendor.name || vendor.company_name || "",
      wallet_address: vendor.wallet_address,
      email: vendor.email || vendor.contact_email || "",
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
        category: undefined,
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
        category: undefined,
        tier: "vendor",
        chain: "ethereum",
      })
    }
  }

  const formContent = (
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
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="category">Category</Label>
          <Select value={formData.category || ""} onValueChange={(val) => setFormData({ ...formData, category: val as VendorCategory })}>
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
          <Label htmlFor="tier">Tier</Label>
          <Select value={formData.tier} onValueChange={(val) => setFormData({ ...formData, tier: val as any })}>
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
          className="min-h-[80px]"
        />
      </div>
      {!isMobile && (
        <DialogFooter>
          <Button type="submit">{editMode ? "Update Tag" : "Save Tag"}</Button>
        </DialogFooter>
      )}
    </form>
  )

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Balance Header - optimized for mobile */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto py-3 px-3 sm:px-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 sm:gap-6">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Total Balance</div>
                <div className="text-xl sm:text-3xl font-bold font-mono tracking-tight truncate">${displayBalance}</div>
                {balance?.chainDistribution && balance.chainDistribution.length > 0 && (
                  <BalanceDistribution
                    distribution={balance.chainDistribution}
                    totalUSD={balance.totalUSD}
                    className="mt-1"
                  />
                )}
              </div>
            </div>

            {isConnected && (
              <div className="flex gap-2">
                <Button variant="default" size="sm" className="h-8 px-2 sm:px-3">
                  <Plus className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Add</span>
                </Button>
                <Button variant="outline" size="sm" className="bg-transparent h-8 px-2 sm:px-3">
                  <ArrowUpRight className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Withdraw</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Header with controls - optimized for mobile */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto py-3 px-3 sm:px-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2 text-sm">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground font-medium text-xs sm:text-sm">FILTERS:</span>
            </div>
            <div className="flex gap-1.5 sm:gap-2 flex-wrap">
              {[
                { key: "all", label: "All" },
                { key: "vendor", label: "Suppliers" },
                { key: "partner", label: "Partners" },
                { key: "subsidiary", label: "Subs" },
              ].map((f) => (
                <Button
                  key={f.key}
                  size="sm"
                  variant={tierFilter === f.key ? "default" : "outline"}
                  onClick={() => setTierFilter(f.key as any)}
                  className="h-7 px-2 sm:px-3 text-xs sm:text-sm"
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="hidden sm:flex flex-col sm:flex-row items-start sm:items-center gap-3 pb-2">
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

          {/* Title and controls row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <h1 className="text-base sm:text-xl font-bold tracking-tight whitespace-nowrap">Global Payment Mesh</h1>
              <div className="h-4 w-px bg-border hidden sm:block"></div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                <Calendar className="w-3 h-3" />
                <span>FY: {allowRange ? `${yearRange[0]}-${yearRange[1]}` : yearRange[0]}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              {isMobile ? (
                <Drawer open={dialogOpen} onOpenChange={handleDialogOpenChange}>
                  <DrawerTrigger asChild>
                    <Button size="sm" className="h-8 gap-1">
                      <Plus className="w-4 h-4" />
                      <span>Add</span>
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-h-[85vh]">
                    <DrawerHeader>
                      <DrawerTitle>{editMode ? "Edit Wallet Tag" : "Add New Wallet Tag"}</DrawerTitle>
                      <DrawerDescription>
                        {editMode ? "Update wallet information" : "Tag a wallet with business metadata"}
                      </DrawerDescription>
                    </DrawerHeader>
                    <div className="px-4 overflow-y-auto">{formContent}</div>
                    <DrawerFooter className="pt-4">
                      <Button type="submit" onClick={handleAddSubmit} className="w-full">
                        {editMode ? "Update Tag" : "Save Tag"}
                      </Button>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              ) : (
                <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
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
                    {formContent}
                  </DialogContent>
                </Dialog>
              )}

              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs hidden sm:flex">
                  {tierFilter === "all"
                    ? "All"
                    : tierFilter === "vendor"
                      ? "Suppliers"
                      : tierFilter === "partner"
                        ? "Partners"
                        : "Subs"}
                </Badge>

                {/* View mode toggle */}
                <div className="flex gap-0.5 border border-border rounded-md p-0.5">
                  <Button
                    size="sm"
                    variant={viewMode === "graph" ? "default" : "ghost"}
                    onClick={() => setViewMode("graph")}
                    className="h-7 w-7 p-0"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "list" ? "default" : "ghost"}
                    onClick={() => setViewMode("list")}
                    className="h-7 w-7 p-0"
                  >
                    <ListIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Search - full width on mobile */}
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

      {/* Main content - Fixed height and overflow for mobile */}
      <main className="flex-1 container mx-auto py-4 sm:py-6 px-3 sm:px-4 pb-20 sm:pb-6">
        {viewMode === "graph" ? (
          <div className="h-[calc(100vh-280px)] sm:h-[600px] md:h-[800px] min-h-[400px]">
            <NetworkGraph
              vendors={filteredVendors}
              userAddress={wallet || undefined}
              isDemoMode={isDemoMode}
              onAddContact={() => setDialogOpen(true)}
              onPaymentRequest={(vendor) => {
                console.log("[v0] Payment requested for vendor:", vendor)
              }}
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4">
            {!isDemoMode && filteredVendors.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Search className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-2">No Contacts Yet</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                    Add your first vendor, partner, or subsidiary to start managing your payment network.
                  </p>
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Contact
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredVendors.map((vendor) => (
                <Card key={vendor.id} className="hover:border-primary/50 transition-colors overflow-hidden">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-base sm:text-lg truncate">
                            {vendor.company_name || vendor.name}
                          </h3>
                          <Badge
                            variant={
                              vendor.tier === "subsidiary"
                                ? "default"
                                : vendor.tier === "partner"
                                  ? "secondary"
                                  : "outline"
                            }
                            className={`text-xs shrink-0 ${
                              vendor.tier === "subsidiary"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : vendor.tier === "partner"
                                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                  : ""
                            }`}
                          >
                            {vendor.tier}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">{vendor.wallet_address}</p>
                      </div>
                      <Button size="sm" variant="outline" className="shrink-0 bg-transparent h-8 px-2 sm:px-3">
                        <span className="hidden sm:inline">Initiate Transfer</span>
                        <ArrowUpRight className="w-4 h-4 sm:hidden" />
                      </Button>
                    </div>

                    {/* Stats row - 2 columns on mobile */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 py-3 border-t border-b border-border">
                      <div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Volume</p>
                        <p className="text-sm sm:text-lg font-semibold">
                          ${(vendor.monthly_volume || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Txns</p>
                        <p className="text-sm sm:text-lg font-semibold">{vendor.transaction_count || 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Chain</p>
                        <p className="text-sm sm:text-lg font-semibold">{vendor.chain || "ETH"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">
                          Category
                        </p>
                        <p className="text-sm sm:text-lg font-semibold capitalize truncate">
                          {vendor.category || "General"}
                        </p>
                      </div>
                    </div>

                    {/* Contact row - Hidden on mobile, shown on expand */}
                    <div className="hidden sm:grid grid-cols-4 gap-4 pt-3 text-sm">
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
                        <p>{vendor.created_at ? new Date(vendor.created_at).toLocaleDateString() : "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          Active
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Dashboard Activity Section */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <DashboardActivity walletAddress={wallet || undefined} limit={10} showTabs={true} />
          <div className="space-y-6">
            {balance?.chainDistribution && balance.chainDistribution.length > 0 && (
              <BalanceDistribution
                distribution={balance.chainDistribution}
                totalUSD={balance.totalUSD}
              />
            )}
            <QuantumReadinessCard 
              addressAge={30} 
              totalValue={balance?.totalUSD || 0} 
              transactionCount={vendors.length} 
            />
          </div>
        </div>
      </main>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Wallet Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{vendorToDelete?.name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteVendor} className="w-full sm:w-auto">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
