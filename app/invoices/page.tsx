"use client"

import { useState, useEffect, useCallback } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus,
  Copy,
  Check,
  ExternalLink,
  MoreHorizontal,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  RefreshCw,
  QrCode,
  Share2,
  Trash2,
  Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useInvoice, type Invoice } from "@/hooks/use-invoice"
import { QRCodeSVG } from "qrcode.react"
import { formatDistanceToNow } from "date-fns"

export default function InvoicesPage() {
  const { isConnected, wallets, activeChain } = useWeb3()
  const { toast } = useToast()
  const { createInvoice, cancelInvoice, isLoading: invoiceLoading } = useInvoice()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showQRDialog, setShowQRDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Create invoice form state
  const [newInvoice, setNewInvoice] = useState({
    amount: "",
    token: "USDC",
    description: "",
    merchantName: "",
    expiryHours: "24",
  })

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true)
      const status = activeTab === "all" ? "" : activeTab
      const response = await fetch(`/api/invoices?status=${status}`)
      const data = await response.json()

      if (response.ok) {
        setInvoices(data.invoices || [])
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to fetch invoices",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch invoices",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [activeTab, toast])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const handleCreateInvoice = async () => {
    if (!isConnected || !wallets[activeChain]) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create invoices",
        variant: "destructive",
      })
      return
    }

    if (!newInvoice.amount || parseFloat(newInvoice.amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      })
      return
    }

    const result = await createInvoice({
      recipientAddress: wallets[activeChain]!,
      amount: newInvoice.amount,
      token: newInvoice.token,
      description: newInvoice.description,
      merchantName: newInvoice.merchantName,
      expiresIn: parseInt(newInvoice.expiryHours) * 60 * 60 * 1000,
    })

    if (result.success) {
      setShowCreateDialog(false)
      setNewInvoice({
        amount: "",
        token: "USDC",
        description: "",
        merchantName: "",
        expiryHours: "24",
      })
      fetchInvoices()
    }
  }

  const handleCancelInvoice = async (invoiceId: string) => {
    const success = await cancelInvoice(invoiceId)
    if (success) {
      fetchInvoices()
    }
  }

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/invoices?id=${invoiceId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "Invoice Deleted",
          description: "Invoice has been deleted",
        })
        fetchInvoices()
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to delete invoice",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete invoice",
        variant: "destructive",
      })
    }
  }

  const copyPaymentLink = async (invoice: Invoice) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    const link = `${baseUrl}/pay?invoice=${invoice.invoice_id}&sig=${invoice.signature}`

    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(invoice.invoice_id)
      toast({
        title: "Link Copied",
        description: "Payment link copied to clipboard",
      })
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      case "paid":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        )
      case "expired":
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
            <AlertCircle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        )
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      inv.invoice_id.toLowerCase().includes(query) ||
      inv.description?.toLowerCase().includes(query) ||
      inv.merchant_name?.toLowerCase().includes(query) ||
      inv.recipient_address.toLowerCase().includes(query)
    )
  })

  const stats = {
    total: invoices.length,
    pending: invoices.filter((i) => i.status === "pending").length,
    paid: invoices.filter((i) => i.status === "paid").length,
    totalAmount: invoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.amount, 0),
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex flex-col md:flex-row items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage payment invoices with secure, signed links
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
              <DialogDescription>
                Generate a new payment invoice with a secure payment link
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={newInvoice.amount}
                    onChange={(e) =>
                      setNewInvoice({ ...newInvoice, amount: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Token</Label>
                  <Select
                    value={newInvoice.token}
                    onValueChange={(v) =>
                      setNewInvoice({ ...newInvoice, token: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USDC">USDC</SelectItem>
                      <SelectItem value="USDT">USDT</SelectItem>
                      <SelectItem value="DAI">DAI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="merchantName">Merchant Name (Optional)</Label>
                <Input
                  id="merchantName"
                  placeholder="Your business name"
                  value={newInvoice.merchantName}
                  onChange={(e) =>
                    setNewInvoice({ ...newInvoice, merchantName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Payment for services..."
                  value={newInvoice.description}
                  onChange={(e) =>
                    setNewInvoice({ ...newInvoice, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry</Label>
                <Select
                  value={newInvoice.expiryHours}
                  onValueChange={(v) =>
                    setNewInvoice({ ...newInvoice, expiryHours: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="6">6 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="72">3 days</SelectItem>
                    <SelectItem value="168">7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="bg-transparent"
              >
                Cancel
              </Button>
              <Button onClick={handleCreateInvoice} disabled={invoiceLoading}>
                {invoiceLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Invoice"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.paid}</p>
                <p className="text-sm text-muted-foreground">Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ${stats.totalAmount.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Total Received</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="expired">Expired</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={fetchInvoices}
                disabled={loading}
                className="bg-transparent"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice List</CardTitle>
          <CardDescription>
            {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No Invoices Found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Create your first invoice to get started"}
              </p>
              {!searchQuery && (
                <Button
                  className="mt-4"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Invoice
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">
                        {invoice.invoice_id}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {invoice.amount.toLocaleString()} {invoice.token}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {invoice.description || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(invoice.created_at), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(invoice.expires_at), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => copyPaymentLink(invoice)}>
                              {copiedId === invoice.invoice_id ? (
                                <Check className="mr-2 h-4 w-4" />
                              ) : (
                                <Copy className="mr-2 h-4 w-4" />
                              )}
                              Copy Payment Link
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedInvoice(invoice)
                                setShowQRDialog(true)
                              }}
                            >
                              <QrCode className="mr-2 h-4 w-4" />
                              Show QR Code
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a
                                href={`/pay?invoice=${invoice.invoice_id}&sig=${invoice.signature}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open Payment Page
                              </a>
                            </DropdownMenuItem>
                            {invoice.status === "pending" && (
                              <DropdownMenuItem
                                onClick={() => handleCancelInvoice(invoice.invoice_id)}
                                className="text-destructive"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancel Invoice
                              </DropdownMenuItem>
                            )}
                            {(invoice.status === "cancelled" ||
                              invoice.status === "expired") && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteInvoice(invoice.invoice_id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Invoice
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Payment QR Code</DialogTitle>
            <DialogDescription>
              Scan this QR code to open the payment page
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/pay?invoice=${selectedInvoice.invoice_id}&sig=${selectedInvoice.signature}`}
                  size={200}
                  level="H"
                  includeMargin
                />
              </div>
              <div className="text-center space-y-1">
                <p className="font-mono text-sm">{selectedInvoice.invoice_id}</p>
                <p className="text-lg font-bold">
                  {selectedInvoice.amount} {selectedInvoice.token}
                </p>
                {selectedInvoice.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedInvoice.description}
                  </p>
                )}
              </div>
              <Button
                className="w-full"
                onClick={() => copyPaymentLink(selectedInvoice)}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share Payment Link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
