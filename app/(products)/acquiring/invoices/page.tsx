"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Plus,
  Copy,
  FileText,
  ExternalLink,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  DollarSign,
  QrCode,
  Download,
  RefreshCw,
  Settings,
  Receipt,
  Link as LinkIcon,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import Image from "next/image";
import { useDemo } from "@/contexts/demo-context";
import { InvoicePreview } from "@/components/invoice-preview";

interface Invoice {
  id: string;
  invoice_id: string;
  recipient_address: string;
  amount: number;
  amount_fiat?: number;
  fiat_currency?: string;
  token: string;
  chain?: string;
  description?: string;
  merchant_name?: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  signature: string;
  tx_hash?: string;
  paid_by?: string;
  paid_at?: string;
  expires_at: string;
  created_at: string;
  metadata?: any;
}

export default function InvoicesPage() {
  const { isDemoMode } = useDemo();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showQRModal, setShowQRModal] = useState<Invoice | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<{
    invoice: Invoice;
    paymentLink: string;
    qrCodeData: string;
  } | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [formData, setFormData] = useState({
    recipientAddress: "",
    amount: "99.00",
    amountFiat: "99.00",
    fiatCurrency: "USD",
    token: "USDC",
    chain: "Ethereum",
    description: "Business credits",
    merchantName: "Protocol Bank",
    expiresIn: "24", // hours
    // Customer info
    customerName: "",
    customerEmail: "",
    // Line items
    lineItems: [] as { description: string; quantity: number; price: number }[],
    // Settings
    enableConfirmationPage: true,
    enablePostPaymentInvoice: true,
    customMessage: "",
  });

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      // For demo, we'll use mock data since the table might not exist
      const mockInvoices: Invoice[] = [
        {
          id: "1",
          invoice_id: "INV-ABC123",
          recipient_address: "0x1234567890123456789012345678901234567890",
          amount: 100,
          amount_fiat: 100,
          fiat_currency: "USD",
          token: "USDC",
          chain: "Ethereum",
          description: "Consulting Services - January 2024",
          merchant_name: "Protocol Bank",
          status: "paid",
          signature: "abc123",
          tx_hash: "0x71c66743905359db5a16d55d22228514930be82a17058564a51e51b312788e0c",
          paid_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: "2",
          invoice_id: "INV-DEF456",
          recipient_address: "0x1234567890123456789012345678901234567890",
          amount: 250,
          amount_fiat: 250,
          fiat_currency: "USD",
          token: "USDC",
          chain: "Polygon",
          description: "Software License - Annual",
          merchant_name: "Protocol Bank",
          status: "pending",
          signature: "def456",
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          created_at: new Date().toISOString(),
        },
      ];
      setInvoices(mockInvoices);
    } catch (error) {
      console.error("[Invoices] Load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const payload = {
        recipientAddress: formData.recipientAddress,
        amount: formData.amount,
        token: formData.token,
        chain: formData.chain,
        description: formData.description,
        merchantName: formData.merchantName,
        expiresIn: parseInt(formData.expiresIn) * 60 * 60 * 1000, // Convert hours to ms
        metadata: {
          amountFiat: formData.amountFiat,
          fiatCurrency: formData.fiatCurrency,
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          lineItems: formData.lineItems,
          enableConfirmationPage: formData.enableConfirmationPage,
          enablePostPaymentInvoice: formData.enablePostPaymentInvoice,
        },
      };

      const res = await fetch("/api/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success || data.invoice) {
        toast({
          title: "Invoice Created",
          description: "Your invoice is ready to send",
        });

        setCreatedInvoice(data);
        setInvoices([data.invoice, ...invoices]);
        resetForm();
      } else {
        toast({
          title: "Creation Failed",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      recipientAddress: "",
      amount: "99.00",
      amountFiat: "99.00",
      fiatCurrency: "USD",
      token: "USDC",
      chain: "Ethereum",
      description: "Business credits",
      merchantName: "Protocol Bank",
      expiresIn: "24",
      customerName: "",
      customerEmail: "",
      lineItems: [],
      enableConfirmationPage: true,
      enablePostPaymentInvoice: true,
      customMessage: "",
    });
    setShowCreateForm(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  const getPaymentLink = (invoice: Invoice) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    return `${baseUrl}/pay?invoice=${invoice.invoice_id}&sig=${invoice.signature}`;
  };

  const getStatusBadge = (status: Invoice["status"]) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="secondary">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
    }
  };

  const filteredInvoices =
    statusFilter === "all"
      ? invoices
      : invoices.filter((i) => i.status === statusFilter);

  const stats = {
    total: invoices.length,
    pending: invoices.filter((i) => i.status === "pending").length,
    paid: invoices.filter((i) => i.status === "paid").length,
    totalPaid: invoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.amount, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage crypto invoices for your business
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Invoices</span>
            </div>
            <div className="text-2xl font-bold mt-2">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <div className="text-2xl font-bold mt-2">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Paid</span>
            </div>
            <div className="text-2xl font-bold mt-2">{stats.paid}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Received</span>
            </div>
            <div className="text-2xl font-bold mt-2">${stats.totalPaid}</div>
          </CardContent>
        </Card>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Create New Invoice</CardTitle>
              <CardDescription>
                Details for your crypto payment invoice
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate}>
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 mb-4 h-auto">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="payment">Payment</TabsTrigger>
                    <TabsTrigger value="customer">Client</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="merchantName">Business Name *</Label>
                      <Input
                        id="merchantName"
                        value={formData.merchantName}
                        onChange={(e) =>
                          setFormData({ ...formData, merchantName: e.target.value })
                        }
                        placeholder="Protocol Bank"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        placeholder="Project consultation, Web3 development, etc."
                        rows={3}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expiresIn">Expires In</Label>
                      <Select
                        value={formData.expiresIn}
                        onValueChange={(v) =>
                          setFormData({ ...formData, expiresIn: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                          <SelectItem value="72">3 days</SelectItem>
                          <SelectItem value="168">7 days</SelectItem>
                          <SelectItem value="720">30 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  <TabsContent value="payment" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="amountFiat">Amount</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                          <Input
                            id="amountFiat"
                            type="number"
                            step="0.01"
                            value={formData.amountFiat}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                amountFiat: e.target.value,
                                amount: e.target.value,
                              })
                            }
                            className="pl-7"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fiatCurrency">Currency</Label>
                        <Select
                          value={formData.fiatCurrency}
                          onValueChange={(v) =>
                            setFormData({ ...formData, fiatCurrency: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD - US Dollar</SelectItem>
                            <SelectItem value="EUR">EUR - Euro</SelectItem>
                            <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="token">Settlement Token</Label>
                        <Select
                          value={formData.token}
                          onValueChange={(v) =>
                            setFormData({ ...formData, token: v })
                          }
                        >
                          <SelectTrigger>
                            <div className="flex items-center gap-2">
                              <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                {formData.token[0]}
                              </div>
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USDC">USDC (USD Coin)</SelectItem>
                            <SelectItem value="USDT">USDT (Tether)</SelectItem>
                            <SelectItem value="DAI">DAI</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="chain">Network</Label>
                         <Select
                          value={formData.chain}
                          onValueChange={(v) =>
                            setFormData({ ...formData, chain: v })
                          }
                        >
                          <SelectTrigger>
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Ethereum">Ethereum</SelectItem>
                            <SelectItem value="Polygon">Polygon</SelectItem>
                            <SelectItem value="Arbitrum">Arbitrum</SelectItem>
                            <SelectItem value="Optimism">Optimism</SelectItem>
                            <SelectItem value="Base">Base</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="recipientAddress">
                        Wallet Address *
                      </Label>
                      <Input
                        id="recipientAddress"
                        value={formData.recipientAddress}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            recipientAddress: e.target.value,
                          })
                        }
                        placeholder="0x..."
                        className="font-mono text-xs"
                        required
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="customer" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Customer Name</Label>
                      <Input
                        id="customerName"
                        value={formData.customerName}
                        onChange={(e) =>
                          setFormData({ ...formData, customerName: e.target.value })
                        }
                        placeholder="Client Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerEmail">Customer Email</Label>
                      <Input
                        id="customerEmail"
                        type="email"
                        value={formData.customerEmail}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customerEmail: e.target.value,
                          })
                        }
                        placeholder="name@company.com"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="space-y-6 pt-2">
                    <div className="flex items-center justify-between space-x-4">
                      <Label htmlFor="confirmation-page" className="flex flex-col space-y-1 cursor-pointer">
                        <span>Confirmation Page</span>
                        <span className="font-normal text-xs text-muted-foreground">Show a branded success message after payment</span>
                      </Label>
                      <Switch 
                        id="confirmation-page"
                        checked={formData.enableConfirmationPage}
                        onCheckedChange={(c) => setFormData({...formData, enableConfirmationPage: c})}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between space-x-4">
                      <Label htmlFor="post-payment-invoice" className="flex flex-col space-y-1 cursor-pointer">
                        <span>Post-payment Invoice</span>
                        <span className="font-normal text-xs text-muted-foreground">Generate a downloadable PDF invoice after payment</span>
                      </Label>
                      <Switch 
                        id="post-payment-invoice" 
                        checked={formData.enablePostPaymentInvoice}
                        onCheckedChange={(c) => setFormData({...formData, enablePostPaymentInvoice: c})}
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex gap-2 mt-8">
                  {/* Form actions */}
                  <Button type="submit" disabled={creating} className="flex-1">
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Invoice...
                      </>
                    ) : (
                      "Create Invoice"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="flex flex-col space-y-4">
             <div className="flex items-center justify-between px-1">
                <Label className="text-muted-foreground">Live Preview</Label>
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                   <span className="text-xs text-muted-foreground">Updates automatically</span>
                </div>
             </div>
             <InvoicePreview data={formData} isDemoMode={isDemoMode} />
          </div>
        </div>
      )}

      {/* Created Invoice Success */}
      {createdInvoice && (
        <Card className="mb-8 border-green-500/20 bg-green-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <CardTitle className="text-green-500">Invoice Created!</CardTitle>
            </div>
            <CardDescription>
              Share this invoice with your customer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Invoice ID</Label>
              <div className="font-mono text-sm bg-muted px-3 py-2 rounded">
                {createdInvoice.invoice.invoice_id}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Link</Label>
              <div className="flex gap-2">
                <Input
                  value={createdInvoice.paymentLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    copyToClipboard(createdInvoice.paymentLink, "Payment Link")
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setShowQRModal(createdInvoice.invoice)}
              >
                <QrCode className="mr-2 h-4 w-4" />
                Show QR Code
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(createdInvoice.paymentLink, "_blank")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button variant="ghost" onClick={() => setCreatedInvoice(null)}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4 mb-4">
        <Label>Filter by status:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadInvoices}
          className="ml-auto"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      No invoices found. Create your first invoice to get started.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-sm">
                      {invoice.invoice_id}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {invoice.description || "-"}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">
                          {invoice.amount} {invoice.token}
                        </span>
                        {invoice.amount_fiat && (
                          <div className="text-xs text-muted-foreground">
                            {invoice.amount_fiat} {invoice.fiat_currency || "USD"}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            copyToClipboard(getPaymentLink(invoice), "Link")
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowQRModal(invoice)}
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            window.open(getPaymentLink(invoice), "_blank")
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      {showQRModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQRModal(null)}
        >
          <Card className="max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="text-center">
              <CardTitle>Invoice {showQRModal.invoice_id}</CardTitle>
              <CardDescription>
                {showQRModal.amount} {showQRModal.token}
                {showQRModal.amount_fiat && (
                  <span className="block text-xs mt-1">
                    ({showQRModal.amount_fiat} {showQRModal.fiat_currency || "USD"})
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white rounded-lg">
                <QRCodeSVG
                  value={getPaymentLink(showQRModal)}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  copyToClipboard(getPaymentLink(showQRModal), "Payment Link")
                }
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
              <Button variant="ghost" onClick={() => setShowQRModal(null)}>
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
