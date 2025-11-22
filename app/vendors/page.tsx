"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Plus, Search, LayoutGrid, ListIcon, Download, Calendar, Filter } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getSupabase } from "@/lib/supabase"
import { NetworkGraph } from "@/components/network-graph"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"

// Mock categories for categorization logic
const categories = ["Infrastructure", "Services", "Payroll", "Marketing", "Legal", "Software", "Logistics", "R&D"]

interface Vendor {
  id: string
  wallet_address: string
  name: string
  email: string
  notes: string
  created_at: string
  totalReceived?: number
  transactionCount?: number
  category?: string
  tier?: "subsidiary" | "partner" | "vendor" // Added tier for hierarchy
  parentId?: string // For connection logic
}

// Generate 50+ realistic enterprise nodes
const generateEnterpriseDemoData = (): Vendor[] => {
  const vendors: Vendor[] = []

  // 1. Subsidiaries (Tier 1)
  const subsidiaries = ["APAC Division", "EMEA Operations", "North America HQ", "Ventures Lab"]
  subsidiaries.forEach((name, i) => {
    vendors.push({
      id: `sub-${i}`,
      name,
      wallet_address: `0x${Math.random().toString(16).substr(2, 40)}`,
      email: `finance@${name.toLowerCase().replace(/\s/g, "")}.com`,
      notes: "Internal Transfer",
      created_at: new Date().toISOString(),
      totalReceived: 500000 + Math.random() * 1000000,
      transactionCount: 120 + Math.floor(Math.random() * 50),
      category: "Internal",
      tier: "subsidiary",
    })
  })

  // 2. Key Partners (Tier 2) - Connected to Subsidiaries
  const partners = ["Cloudflare", "AWS", "Google Cloud", "Salesforce", "Stripe", "Deel", "WeWork", "Slack"]
  partners.forEach((name, i) => {
    vendors.push({
      id: `partner-${i}`,
      name,
      wallet_address: `0x${Math.random().toString(16).substr(2, 40)}`,
      email: `billing@${name.toLowerCase().replace(/\s/g, "")}.com`,
      notes: "Annual Contract",
      created_at: new Date().toISOString(),
      totalReceived: 100000 + Math.random() * 300000,
      transactionCount: 12,
      category: "Infrastructure",
      tier: "partner",
      parentId: `sub-${i % subsidiaries.length}`, // Link to a subsidiary
    })
  })

  // 3. Regular Vendors (Tier 3)
  for (let i = 0; i < 40; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)]
    vendors.push({
      id: `vendor-${i}`,
      name: `Vendor ${Math.random().toString(36).substr(2, 5).toUpperCase()} Ltd`,
      wallet_address: `0x${Math.random().toString(16).substr(2, 40)}`,
      email: `invoices@vendor${i}.com`,
      notes: `Invoice #${1000 + i}`,
      created_at: new Date().toISOString(),
      totalReceived: 5000 + Math.random() * 50000,
      transactionCount: 1 + Math.floor(Math.random() * 20),
      category,
      tier: "vendor",
      parentId: Math.random() > 0.3 ? `partner-${i % partners.length}` : undefined, // Mixed connections
    })
  }

  return vendors
}

const demoVendors = generateEnterpriseDemoData()

export default function VendorsPage() {
  const { wallet, isConnected } = useWeb3()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  const router = useRouter()

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph")

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const [yearRange, setYearRange] = useState([2024])
  const [allowRange, setAllowRange] = useState(false)

  // Dialog States
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({ name: "", wallet_address: "", email: "", notes: "" })

  const displayVendors = !isConnected || isDemoMode ? demoVendors : vendors

  const filteredVendors = useMemo(() => {
    return displayVendors.filter((v) => {
      const matchesSearch =
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.wallet_address.toLowerCase().includes(searchQuery.toLowerCase())

      // Assign category for demo visualization
      if (!v.category) {
        v.category = categories[v.id.charCodeAt(0) % categories.length]
      }

      return matchesSearch
    })
  }, [displayVendors, searchQuery])

  useEffect(() => {
    if (isConnected && wallet) {
      loadVendors()
    } else {
      setLoading(false)
    }
  }, [isConnected, wallet, isDemoMode])

  const loadVendors = async () => {
    try {
      const supabase = getSupabase()
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data: vendorsData, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("created_by", wallet)
        .order("name")

      if (error) throw error

      // In a real app, we would join with payments table here or fetch efficiently
      // For now, fetching payments to calculate volumes on client side
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("amount_usd, to_address, vendor_id")
        .eq("from_address", wallet)

      const vendorsWithStats = (vendorsData || []).map((vendor) => {
        const vendorPayments = (paymentsData || []).filter(
          (p) => p.vendor_id === vendor.id || p.to_address === vendor.wallet_address,
        )
        const totalReceived = vendorPayments.reduce((sum, p) => sum + (Number(p.amount_usd) || 0), 0)
        return {
          ...vendor,
          totalReceived,
          transactionCount: vendorPayments.length,
          category: categories[vendor.id.charCodeAt(0) % categories.length], // Mock cat logic
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
    // Navigate to batch payment with pre-filled info
    const url = `/batch-payment?recipient=${vendor.wallet_address}&name=${encodeURIComponent(vendor.name)}`
    router.push(url)
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // ... existing submission logic ...
    // Simplified for brevity as logic is unchanged, just restoring context
    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { error } = await supabase.from("vendors").insert({
        name: formData.name,
        wallet_address: formData.wallet_address,
        email: formData.email,
        notes: formData.notes,
        created_by: wallet,
      })

      if (error) throw error

      toast({ title: "Success", description: "Vendor added successfully" })
      setDialogOpen(false)
      setFormData({ name: "", wallet_address: "", email: "", notes: "" })
      loadVendors()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {!isConnected && (
        <div className="bg-indigo-600 text-white px-4 py-2 text-center text-sm font-medium animate-in slide-in-from-top">
          You are viewing a live demo. Connect your wallet to visualize your own payment network.
        </div>
      )}
      {/* Enterprise Header Toolbar */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto py-3 px-4 flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex items-center justify-between w-full lg:w-auto gap-4">
            <h1 className="text-xl font-bold tracking-tight whitespace-nowrap">Wallet Tags</h1>
            <div className="h-4 w-px bg-border hidden lg:block"></div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground hidden lg:flex whitespace-nowrap">
              <Calendar className="w-4 h-4" />
              <span>Fiscal Year: {allowRange ? `${yearRange[0]} - ${yearRange[1]}` : yearRange[0]}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search entities..."
                className="pl-9 bg-secondary/50 border-transparent focus:bg-background transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between w-full sm:w-auto gap-3">
              <div className="flex items-center border border-border rounded-md bg-secondary/30 p-1 shrink-0">
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

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-white text-black hover:bg-zinc-200 whitespace-nowrap shrink-0"
                    disabled={isDemoMode}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Entity
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Entity</DialogTitle>
                    <DialogDescription>Add a new vendor or partner to your network.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
                    <div className="grid gap-2">
                      <Label>Name</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Wallet Address</Label>
                      <Input
                        value={formData.wallet_address}
                        onChange={(e) => setFormData({ ...formData, wallet_address: e.target.value })}
                        required
                        className="font-mono"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Email (Optional)</Label>
                      <Input
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      />
                    </div>
                    <Button type="submit" className="w-full">
                      Create Entity
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Secondary Filters Bar */}
      <div className="border-b border-border bg-background py-3 px-4 overflow-x-auto">
        <div className="container mx-auto flex items-center justify-between min-w-[600px]">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                Time Range
              </span>
              <div className="w-48 px-2">
                <Slider
                  defaultValue={[2024]}
                  max={2025}
                  min={2020}
                  step={1}
                  value={yearRange}
                  onValueChange={setYearRange}
                  className="py-1"
                />
              </div>
              <div className="flex items-center gap-2 ml-2">
                <Checkbox
                  id="range-mode"
                  checked={allowRange}
                  onCheckedChange={(c) => {
                    setAllowRange(!!c)
                    setYearRange(!!c ? [2023, 2024] : [2024])
                  }}
                />
                <Label htmlFor="range-mode" className="text-xs font-normal text-muted-foreground">
                  Range
                </Label>
              </div>
            </div>

            <div className="h-4 w-px bg-border"></div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Active Filter:</span>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                All Categories
              </Badge>
            </div>
          </div>

          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
            <Download className="w-3.5 h-3.5 mr-2" /> Export Data
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 container mx-auto p-4 md:p-6">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="space-y-4">
          <TabsContent value="graph" className="m-0 border-none p-0 outline-none">
            <NetworkGraph
              vendors={filteredVendors}
              userAddress={wallet || undefined}
              onPaymentRequest={handlePaymentRequest}
            />

            {/* Stats Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <Card className="bg-card/50 border-border">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Network Volume
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-mono font-medium">
                    ${filteredVendors.reduce((sum, v) => sum + (v.totalReceived || 0), 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Active Entities
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-mono font-medium">{filteredVendors.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Avg. Transaction
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-mono font-medium">$1,240.50</div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Health Score
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-mono font-medium text-emerald-500">98.2%</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="list" className="m-0 border-none p-0 outline-none">
            <Card className="border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Entity Name</TableHead>
                    <TableHead>Wallet Address</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">Tx Count</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium">{vendor.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{vendor.wallet_address}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal text-xs">
                          {vendor.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${vendor.totalReceived?.toLocaleString() ?? "0"}
                      </TableCell>
                      <TableCell className="text-right font-mono">{vendor.transactionCount ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handlePaymentRequest(vendor)}>
                          Pay
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
