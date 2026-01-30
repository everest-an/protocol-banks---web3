"use client";

import { useEffect, useState, useMemo } from "react";
import NextImage from "next/image";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Copy,
  ExternalLink,
  Search,
  Filter,
  DollarSign,
  Receipt,
  Clock,
  CheckCircle2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AcquiringOrder, Merchant } from "@/types/acquiring";

export default function OrdersPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [orders, setOrders] = useState<AcquiringOrder[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AcquiringOrder | null>(
    null,
  );
  const [newCheckoutUrl, setNewCheckoutUrl] = useState<string>("");

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    merchant_id: "",
    amount: "",
    token: "USDC",
    expire_minutes: "30",
  });

  // Calculate stats
  const stats = useMemo(() => {
    const totalAmount = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const paidOrders = orders.filter((o) => o.status === "paid");
    const pendingOrders = orders.filter((o) => o.status === "pending");
    const expiredOrders = orders.filter((o) => o.status === "expired");
    const paidAmount = paidOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

    return {
      totalOrders: orders.length,
      totalAmount,
      paidCount: paidOrders.length,
      paidAmount,
      pendingCount: pendingOrders.length,
      expiredCount: expiredOrders.length,
    };
  }, [orders]);

  useEffect(() => {
    loadMerchants();
    loadOrders();
  }, []);

  const loadMerchants = async () => {
    try {
      const res = await fetch("/api/acquiring/merchants");
      const data = await res.json();
      if (data.success) {
        setMerchants(data.merchants || []);
        if (data.merchants?.length > 0) {
          setFormData((prev) => ({
            ...prev,
            merchant_id: data.merchants[0].id,
          }));
        }
      }
    } catch (error) {
      console.error("[Orders] Load merchants error:", error);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await fetch("/api/acquiring/orders?limit=100");
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error("[Orders] Load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/acquiring/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          expire_minutes: parseInt(formData.expire_minutes),
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Order Created Successfully",
          description: "Checkout link generated",
        });

        setNewCheckoutUrl(data.checkout_url);
        setOrders([data.order, ...orders]);
        setFormData({ ...formData, amount: "" });
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Link copied to clipboard",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string; className?: string }> = {
      pending: { variant: "secondary", label: "Pending", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
      paid: { variant: "default", label: "Paid", className: "bg-green-500/10 text-green-500 border-green-500/20" },
      expired: { variant: "outline", label: "Expired", className: "bg-muted text-muted-foreground" },
      cancelled: { variant: "destructive", label: "Cancelled", className: "bg-red-500/10 text-red-500 border-red-500/20" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const filteredOrders = orders.filter((order) => {
    if (filterStatus !== "all" && order.status !== filterStatus) return false;
    if (
      searchQuery &&
      !order.order_no.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6 max-w-7xl">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Order Management</h1>
          <p className="text-muted-foreground">
            View and manage acquiring orders, track payments and generate checkout links
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadOrders}
            className="border-border bg-transparent"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => setShowCreateDialog(true)}
            disabled={merchants.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">All time orders</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground font-mono">
              ${stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all orders</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid Orders</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.paidCount}</div>
            <p className="text-xs text-green-500 mt-1">
              ${stats.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} received
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.expiredCount} expired
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Search and filter orders</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search order number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background border-border"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px] bg-background border-border">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(searchQuery || filterStatus !== "all") && (
            <p className="text-sm text-muted-foreground mt-3">
              Showing {filteredOrders.length} of {orders.length} orders
            </p>
          )}
        </CardContent>
      </Card>

      {/* Order List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Orders</h2>
          <span className="text-sm text-muted-foreground">{filteredOrders.length} items</span>
        </div>

        {filteredOrders.length === 0 ? (
          <Card className="bg-card border-border border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                <Receipt className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No orders found</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                {searchQuery || filterStatus !== "all"
                  ? "Try adjusting your filters"
                  : "Create your first order to get started"}
              </p>
              {!searchQuery && filterStatus === "all" && merchants.length > 0 && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Order
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredOrders.map((order) => (
              <Card
                key={order.id}
                className="bg-card border-border cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedOrder(order)}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {order.order_no}
                        </span>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs uppercase tracking-wider">Amount</span>
                          <div className="font-medium mt-1 font-mono text-foreground">
                            {order.amount} {order.token}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs uppercase tracking-wider">
                            Payment Method
                          </span>
                          <div className="mt-1 text-foreground">
                            {order.payment_method || "-"}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs uppercase tracking-wider">
                            Created At
                          </span>
                          <div className="mt-1 text-foreground">
                            {new Date(order.created_at).toLocaleString("zh-CN")}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs uppercase tracking-wider">
                            Expires At
                          </span>
                          <div className="mt-1 text-foreground">
                            {new Date(order.expires_at).toLocaleString("zh-CN")}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {order.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-transparent border-border"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              `${window.location.origin}/checkout?order=${order.order_no}`,
                              "_blank",
                            );
                          }}
                        >
                          Checkout
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Order Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setNewCheckoutUrl("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Order</DialogTitle>
            <DialogDescription>
              Fill in order information to generate checkout link
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Select Merchant</Label>
              <Select
                value={formData.merchant_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, merchant_id: value })
                }
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {merchants.map((merchant) => (
                    <SelectItem key={merchant.id} value={merchant.id}>
                      {merchant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                placeholder="0.00"
                required
                className="bg-background border-border font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Validity (Minutes)</Label>
              <Input
                type="number"
                value={formData.expire_minutes}
                onChange={(e) =>
                  setFormData({ ...formData, expire_minutes: e.target.value })
                }
                placeholder="30"
                className="bg-background border-border"
              />
            </div>
            {newCheckoutUrl && (
              <div className="space-y-2 p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
                <Label className="text-green-600">Checkout Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={newCheckoutUrl}
                    readOnly
                    className="font-mono text-xs bg-background"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(newCheckoutUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(newCheckoutUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              {!newCheckoutUrl && (
                <Button type="submit" disabled={creating} className="flex-1">
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Order"
                  )}
                </Button>
              )}
              <Button
                type="button"
                variant={newCheckoutUrl ? "default" : "outline"}
                onClick={() => setShowCreateDialog(false)}
                className={newCheckoutUrl ? "flex-1" : ""}
              >
                {newCheckoutUrl ? "Close" : "Cancel"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog
        open={!!selectedOrder}
        onOpenChange={() => setSelectedOrder(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription className="font-mono">
              {selectedOrder?.order_no}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">Status</span>
                  <div className="mt-1">
                    {getStatusBadge(selectedOrder.status)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">Amount</span>
                  <div className="font-medium mt-1 font-mono text-foreground">
                    {selectedOrder.amount} {selectedOrder.token}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">Payment Method</span>
                  <div className="mt-1 text-foreground">
                    {selectedOrder.payment_method || "-"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">Chain ID</span>
                  <div className="mt-1 text-foreground">{selectedOrder.chain_id}</div>
                </div>
              </div>

              {selectedOrder.status === "pending" && (
                <div className="space-y-2 p-4 bg-secondary/20 rounded-lg border border-border">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Checkout Link
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex-1 p-2 bg-background rounded border border-border text-xs font-mono truncate">
                      {typeof window !== "undefined"
                        ? `${window.location.origin}/checkout?order=${selectedOrder.order_no}`
                        : ""}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        copyToClipboard(
                          `${window.location.origin}/checkout?order=${selectedOrder.order_no}`,
                        )
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        window.open(
                          `${window.location.origin}/checkout?order=${selectedOrder.order_no}`,
                          "_blank",
                        )
                      }
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {selectedOrder.payer_address && (
                <div className="text-sm">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">Payer Address</span>
                  <div className="font-mono text-xs mt-1 break-all text-foreground p-2 bg-muted/30 rounded">
                    {selectedOrder.payer_address}
                  </div>
                </div>
              )}
              {selectedOrder.tx_hash && (
                <div className="text-sm">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    Transaction Hash
                  </span>
                  <div className="font-mono text-xs mt-1 break-all text-primary p-2 bg-muted/30 rounded">
                    <a
                      href={`https://etherscan.io/tx/${selectedOrder.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {selectedOrder.tx_hash}
                    </a>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm border-t border-border pt-4">
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">Created At</span>
                  <div className="mt-1 text-foreground">
                    {new Date(selectedOrder.created_at).toLocaleString("zh-CN")}
                  </div>
                </div>
                {selectedOrder.paid_at && (
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">Paid At</span>
                    <div className="mt-1 text-foreground">
                      {new Date(selectedOrder.paid_at).toLocaleString("zh-CN")}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
