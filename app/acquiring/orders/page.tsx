"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";
import {
  Card,
  CardContent,
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
    const variants: Record<string, { variant: any; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      paid: { variant: "default", label: "Paid" },
      expired: { variant: "outline", label: "Expired" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
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
    <div className="container max-w-7xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Order Management</h1>
          <p className="text-muted-foreground mt-2">
            View and manage acquiring orders
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          disabled={merchants.length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Order
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search order number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
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
        </CardContent>
      </Card>

      {/* Order List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No orders</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card
              key={order.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedOrder(order)}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm font-semibold">
                        {order.order_no}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Amount</span>
                        <div className="font-medium mt-1">
                          {order.amount} {order.token}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Payment Method
                        </span>
                        <div className="mt-1">
                          {order.payment_method || "-"}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Created At
                        </span>
                        <div className="mt-1">
                          {new Date(order.created_at).toLocaleString("zh-CN")}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Expires At
                        </span>
                        <div className="mt-1">
                          {new Date(order.expires_at).toLocaleString("zh-CN")}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {order.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
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
          ))
        )}
      </div>

      <Dialog 
        open={showCreateDialog} 
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setNewCheckoutUrl("");
          }
        }}
      >
        <DialogContent>
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
                <SelectTrigger>
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
                placeholder="0.99"
                required
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
              />
            </div>
            {newCheckoutUrl && (
              <div className="space-y-2 p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
                <Label>Checkout Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={newCheckoutUrl}
                    readOnly
                    className="font-mono text-xs"
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
            <div className="flex gap-2">
              {!newCheckoutUrl && (
                <Button type="submit" disabled={creating}>
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
        <DialogContent>
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
                  <span className="text-muted-foreground">Status</span>
                  <div className="mt-1">
                    {getStatusBadge(selectedOrder.status)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount</span>
                  <div className="font-medium mt-1">
                    {selectedOrder.amount} {selectedOrder.token}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Method</span>
                  <div className="mt-1">
                    {selectedOrder.payment_method || "-"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Chain ID</span>
                  <div className="mt-1">{selectedOrder.chain_id}</div>
                </div>
              </div>

              {selectedOrder.status === "pending" && (
                <div className="space-y-2 p-3 bg-secondary/20 rounded-lg">
                  <Label className="text-xs text-muted-foreground">
                    Checkout Link
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex-1 p-2 bg-background rounded border text-xs font-mono truncate">
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
                  <span className="text-muted-foreground">Payer Address</span>
                  <div className="font-mono text-xs mt-1 break-all">
                    {selectedOrder.payer_address}
                  </div>
                </div>
              )}
              {selectedOrder.tx_hash && (
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    Transaction Hash
                  </span>
                  <div className="font-mono text-xs mt-1 break-all">
                    {selectedOrder.tx_hash}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Created At</span>
                  <div className="mt-1">
                    {new Date(selectedOrder.created_at).toLocaleString("zh-CN")}
                  </div>
                </div>
                {selectedOrder.paid_at && (
                  <div>
                    <span className="text-muted-foreground">Paid At</span>
                    <div className="mt-1">
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
