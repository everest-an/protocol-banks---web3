"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Edit, Trash2, Mail, Wallet } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getSupabase } from "@/lib/supabase"
import { Users } from "lucide-react" // Import Users component

interface Vendor {
  id: string
  wallet_address: string
  name: string
  email: string
  notes: string
  created_at: string
}

export default function VendorsPage() {
  const { wallet, isConnected } = useWeb3()
  const { toast } = useToast()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    wallet_address: "",
    email: "",
    notes: "",
  })

  useEffect(() => {
    if (isConnected && wallet) {
      loadVendors()
    }
  }, [isConnected, wallet])

  const loadVendors = async () => {
    try {
      const supabase = getSupabase()

      if (!supabase) {
        console.warn("[v0] Supabase client not initialized")
        setLoading(false)
        return
      }

      const { data, error } = await supabase.from("vendors").select("*").eq("created_by", wallet).order("name")

      if (error) throw error
      setVendors(data || [])
    } catch (error) {
      console.error("[v0] Failed to load vendors:", error)
      toast({
        title: "Error loading wallet tags",
        description: "Failed to fetch wallet tag list",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.wallet_address) {
      toast({
        title: "Missing required fields",
        description: "Please provide tag name and wallet address",
        variant: "destructive",
      })
      return
    }

    try {
      const supabase = getSupabase()

      if (!supabase) {
        toast({
          title: "Configuration Error",
          description: "Supabase is not configured correctly. Please check environment variables.",
          variant: "destructive",
        })
        return
      }

      if (editingVendor) {
        // Update existing vendor
        const { error } = await supabase
          .from("vendors")
          .update({
            name: formData.name,
            wallet_address: formData.wallet_address,
            email: formData.email,
            notes: formData.notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingVendor.id)

        if (error) throw error

        toast({
          title: "Wallet Tag updated",
          description: `Successfully updated ${formData.name}`,
        })
      } else {
        // Create new vendor
        const { error } = await supabase.from("vendors").insert({
          name: formData.name,
          wallet_address: formData.wallet_address,
          email: formData.email,
          notes: formData.notes,
          created_by: wallet,
        })

        if (error) throw error

        toast({
          title: "Wallet Tag added",
          description: `Successfully added ${formData.name}`,
        })
      }

      setDialogOpen(false)
      setEditingVendor(null)
      setFormData({ name: "", wallet_address: "", email: "", notes: "" })
      loadVendors()
    } catch (error: any) {
      toast({
        title: "Error saving wallet tag",
        description: error.message || "Failed to save wallet tag",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setFormData({
      name: vendor.name,
      wallet_address: vendor.wallet_address,
      email: vendor.email || "",
      notes: vendor.notes || "",
    })
    setDialogOpen(true)
  }

  const handleDelete = async (vendor: Vendor) => {
    if (!confirm(`Are you sure you want to delete ${vendor.name}?`)) {
      return
    }

    try {
      const supabase = getSupabase()

      if (!supabase) {
        throw new Error("Supabase client not initialized")
      }

      const { error } = await supabase.from("vendors").delete().eq("id", vendor.id)

      if (error) throw error

      toast({
        title: "Wallet Tag deleted",
        description: `Successfully deleted ${vendor.name}`,
      })

      loadVendors()
    } catch (error: any) {
      toast({
        title: "Error deleting wallet tag",
        description: error.message || "Failed to delete wallet tag",
        variant: "destructive",
      })
    }
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingVendor(null)
    setFormData({ name: "", wallet_address: "", email: "", notes: "" })
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`
  }

  if (!isConnected) {
    return (
      <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <Card className="max-w-md w-full bg-card border-border">
          <CardHeader className="text-center">
            <CardTitle className="text-foreground">Connect Wallet</CardTitle>
            <CardDescription className="text-muted-foreground">
              Please connect your wallet to manage wallet tags
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Wallet Tags</h1>
          <p className="text-muted-foreground">Organize and manage your wallet addresses with tags</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Add Wallet Tag
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingVendor ? "Edit Wallet Tag" : "Add New Wallet Tag"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingVendor ? "Update tag information and wallet address" : "Add a new tag to your address book"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">
                  Tag Name *
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. Marketing Team"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wallet_address" className="text-foreground">
                  Wallet Address *
                </Label>
                <Input
                  id="wallet_address"
                  placeholder="0x..."
                  value={formData.wallet_address}
                  onChange={(e) => setFormData({ ...formData, wallet_address: e.target.value })}
                  className="bg-background border-border text-foreground font-mono"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Email (Optional)
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@acme.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-foreground">
                  Notes (Optional)
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this tag..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="bg-background border-border text-foreground min-h-[100px]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDialogClose}
                  className="flex-1 border-border bg-transparent"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                  {editingVendor ? "Update Tag" : "Add Tag"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Wallet Tags ({vendors.length})</CardTitle>
          <CardDescription className="text-muted-foreground">All your saved wallet address tags</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading tags...</div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No tags yet</h3>
              <p className="text-muted-foreground mb-4">Add your first wallet tag to start organizing addresses</p>
              <Button
                onClick={() => setDialogOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Tag
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                    <TableHead className="text-foreground whitespace-nowrap">Tag Name</TableHead>
                    <TableHead className="text-foreground whitespace-nowrap">Wallet Address</TableHead>
                    <TableHead className="text-foreground whitespace-nowrap">Contact</TableHead>
                    <TableHead className="text-foreground whitespace-nowrap">Notes</TableHead>
                    <TableHead className="text-foreground text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((vendor) => (
                    <TableRow key={vendor.id} className="border-border">
                      <TableCell className="font-medium text-foreground whitespace-nowrap">{vendor.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                          <code className="text-sm font-mono text-foreground">
                            {formatAddress(vendor.wallet_address)}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell>
                        {vendor.email ? (
                          <div className="flex items-center gap-2 text-muted-foreground whitespace-nowrap">
                            <Mail className="h-4 w-4" />
                            <span className="text-sm">{vendor.email}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-sm text-muted-foreground truncate">{vendor.notes || "-"}</p>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(vendor)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(vendor)}
                            className="text-muted-foreground hover:text-destructive"
                          >
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
        </CardContent>
      </Card>
    </div>
  )
}
