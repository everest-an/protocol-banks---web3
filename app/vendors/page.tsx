"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import { useVendors } from "@/hooks/use-vendors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Search, LayoutGrid, ListIcon, Calendar, Plus, Edit, Trash2, Loader2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { NetworkGraph } from "@/components/network-graph"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
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
import { VendorSidebar } from "@/components/vendor-sidebar"
import { Skeleton } from "@/components/ui/skeleton"

// Categories for vendor classification
const categories = ["Infrastructure", "Services", "Payroll", "Marketing", "Legal", "Software", "Logistics", "R&D"]

export default function VendorsPage() {
  const { wallet, isConnected } = useWeb3()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  const router = useRouter()

  // Use the vendors hook for data management
  const {
    vendors,
    loading,
    error,
    refresh,
    addVendor,
    updateVendor,
    deleteVendor,
  } = useVendors({
    isDemoMode,
    walletAddress: wallet || undefined,
  })

  const [viewMode, setViewMode] = useState<"graph" | "list">("graph")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const [yearRange, setYearRange] = useState([2024])
  const [allowRange, setAllowRange] = useState(false)

  // Dialog States
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingVendor, setEditingVendor] = useState<any | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [vendorToDelete, setVendorToDelete] = useState<any | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    company_name: "",
    wallet_address: "",
    email: "",
    notes: "",
    category: "",
    tier: "vendor" as "vendor" | "partner" | "subsidiary",
  })

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const name = v.company_name || ""
      const address = v.wallet_address || ""
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        address.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesSearch && (selectedCategories.length === 0 || selectedCategories.includes(v.category || "All"))
    })
  }, [vendors, searchQuery, selectedCategories])

  const handlePaymentRequest = (vendor: any) => {
    const url = `/batch-payment?recipient=${vendor.wallet_address}&name=${encodeURIComponent(vendor.company_name || vendor.name || "")}`
    router.push(url)
  }

  const handleEditVendor = (vendor: any) => {
    setEditingVendor(vendor)
    setFormData({
      company_name: vendor.company_name || vendor.name || "",
      wallet_address: vendor.wallet_address,
      email: vendor.email || "",
      notes: vendor.notes || "",
      category: vendor.category || "",
      tier: vendor.tier || "vendor",
    })
    setEditMode(true)
    setDialogOpen(true)
  }

  const handleDeleteVendor = (vendor: any) => {
    setVendorToDelete(vendor)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteVendor = async () => {
    if (!vendorToDelete) return

    try {
      await deleteVendor(vendorToDelete.id)
      toast({ title: "Success", description: "Vendor deleted successfully" })
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
        description: "Please connect your wallet to add vendors",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      if (editMode && editingVendor) {
        await updateVendor(editingVendor.id, {
          company_name: formData.company_name,
          wallet_address: formData.wallet_address,
          email: formData.email,
          notes: formData.notes,
          category: formData.category as any,
          tier: formData.tier,
        })
        toast({ title: "Success", description: "Vendor updated successfully" })
      } else {
        await addVendor({
          company_name: formData.company_name,
          wallet_address: formData.wallet_address,
          email: formData.email,
          notes: formData.notes,
          category: formData.category as any,
          tier: formData.tier,
          chain: "Ethereum",
          created_by: wallet || "demo",
        })
        toast({ title: "Success", description: "Vendor added successfully" })
      }

      setDialogOpen(false)
      setEditMode(false)
      setEditingVendor(null)
      setFormData({ company_name: "", wallet_address: "", email: "", notes: "", category: "", tier: "vendor" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setEditMode(false)
      setEditingVendor(null)
      setFormData({ company_name: "", wallet_address: "", email: "", notes: "", category: "", tier: "vendor" })
    }
  }

  // Transform vendors for NetworkGraph component
  const networkVendors = useMemo(() => {
    return filteredVendors.map((v) => ({
      id: v.id,
      name: v.company_name || "Unknown",
      wallet_address: v.wallet_address,
      email: v.email,
      notes: v.notes,
      created_at: v.created_at,
      totalReceived: v.monthly_volume || 0,
      transactionCount: v.transaction_count || 0,
      category: v.category || "vendor",
      tier: v.tier || "vendor",
      parentId: v.parentId,
    }))
  }, [filteredVendors])

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {!isConnected && !isDemoMode && (
        <div className="bg-indigo-600 text-white px-4 py-2 text-center text-sm font-medium animate-in slide-in-from-top">
          You are viewing a live demo. Connect your wallet to visualize your own payment network.
        </div>
      )}
      
      {/* Enterprise Header Toolbar */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto py-3 px-3 sm:px-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap">Wallet Tags</h1>
              <div className="h-4 w-px bg-border hidden sm:block" />
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs">FY: {allowRange ? `${yearRange[0]}-${yearRange[1]}` : yearRange[0]}</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {filteredVendors.length} vendors
              </Badge>
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
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
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
                          onValueChange={(val: "vendor" | "partner" | "subsidiary") =>
                            setFormData({ ...formData, tier: val })
                          }
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
                      <Label htmlFor="email">Email (optional)</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="billing@company.com"
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
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : editMode ? (
                          "Update Tag"
                        ) : (
                          "Save Tag"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              
              <div className="sm:hidden fixed bottom-20 right-4 z-50">
                <Button size="icon" className="rounded-full h-12 w-12 shadow-lg" onClick={() => setDialogOpen(true)}>
                  <Plus className="w-6 h-6" />
                </Button>
              </div>

              <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>

              <div className="relative flex-1 sm:flex-none sm:w-48 lg:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-8 sm:pl-9 h-9 text-sm bg-secondary/50 border-transparent focus:bg-background transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center border border-border rounded-md bg-secondary/30 p-0.5 shrink-0">
                <Button
                  variant={viewMode === "graph" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("graph")}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("list")}
                >
                  <ListIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Category filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
            {categories.map((cat) => (
              <div key={cat} className="flex items-center space-x-1.5 shrink-0">
                <Checkbox
                  id={cat}
                  checked={selectedCategories.includes(cat)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedCategories([...selectedCategories, cat])
                    } else {
                      setSelectedCategories(selectedCategories.filter((c) => c !== cat))
                    }
                  }}
                />
                <Label htmlFor={cat} className="text-xs cursor-pointer whitespace-nowrap">
                  {cat}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading vendors...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <p className="text-destructive">{error}</p>
            <Button onClick={refresh}>Retry</Button>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">No vendors found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Add your first vendor to start building your payment network"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Vendor
                </Button>
              )}
            </div>
          </div>
        ) : viewMode === "graph" ? (
          <div className="h-[calc(100vh-200px)]">
            <NetworkGraph
              vendors={networkVendors}
              onVendorClick={(vendor) => handlePaymentRequest(vendor)}
            />
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Wallet Address</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-medium">{vendor.company_name || "Unknown"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {vendor.wallet_address?.slice(0, 6)}...{vendor.wallet_address?.slice(-4)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{vendor.category || "N/A"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          vendor.tier === "subsidiary"
                            ? "default"
                            : vendor.tier === "partner"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {vendor.tier || "vendor"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${(vendor.monthly_volume || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{vendor.transaction_count || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handlePaymentRequest(vendor)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEditVendor(vendor)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteVendor(vendor)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{vendorToDelete?.company_name || vendorToDelete?.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteVendor} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
