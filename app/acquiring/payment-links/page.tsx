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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Plus,
  Copy,
  Link2,
  QrCode,
  ExternalLink,
  Trash2,
  Settings,
  DollarSign,
  Clock,
  CheckCircle2,
  Gift,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";

interface PaymentLink {
  id: string;
  link_id: string;
  merchant_id?: string;
  title: string;
  description?: string;
  amount: number | null;
  currency: string;
  token: string;
  recipient_address: string;
  amount_type: "fixed" | "dynamic" | "customer_input";
  min_amount?: number;
  max_amount?: number;
  expires_at?: string;
  redirect_url?: string;
  status: "active" | "paused" | "expired";
  total_payments: number;
  total_amount: number;
  created_at: string;
  // Branding
  brand_color?: string;
  logo_url?: string;
  // Asset distribution
  distribute_asset?: boolean;
  asset_type?: "nft" | "token";
  asset_contract_address?: string;
  asset_token_id?: string;
  asset_amount?: string;
}

export default function PaymentLinksPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showQRModal, setShowQRModal] = useState<PaymentLink | null>(null);
  const [createdLink, setCreatedLink] = useState<{
    link: PaymentLink;
    paymentUrl: string;
    shortUrl: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    amount: "",
    currency: "USD",
    token: "USDC",
    recipientAddress: "",
    amountType: "fixed" as "fixed" | "dynamic" | "customer_input",
    minAmount: "",
    maxAmount: "",
    expiresAt: "",
    redirectUrl: "",
    // Branding
    brandColor: "#3B82F6",
    logoUrl: "",
    // Asset distribution
    distributeAsset: false,
    assetType: "nft" as "nft" | "token",
    assetContractAddress: "",
    assetTokenId: "",
    assetAmount: "",
  });

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      const res = await fetch("/api/acquiring/payment-links");
      const data = await res.json();

      if (data.success) {
        setLinks(data.links || []);
      }
    } catch (error) {
      console.error("[PaymentLinks] Load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const payload: any = {
        title: formData.title,
        description: formData.description,
        currency: formData.currency,
        token: formData.token,
        recipientAddress: formData.recipientAddress,
        amountType: formData.amountType,
        redirectUrl: formData.redirectUrl || undefined,
        brandColor: formData.brandColor,
        logoUrl: formData.logoUrl || undefined,
        distributeAsset: formData.distributeAsset,
      };

      if (formData.amountType === "fixed") {
        payload.amount = formData.amount;
      } else {
        payload.minAmount = formData.minAmount || undefined;
        payload.maxAmount = formData.maxAmount || undefined;
      }

      if (formData.expiresAt) {
        payload.expiresAt = new Date(formData.expiresAt).toISOString();
      }

      if (formData.distributeAsset) {
        payload.assetType = formData.assetType;
        payload.assetContractAddress = formData.assetContractAddress;
        if (formData.assetType === "nft") {
          payload.assetTokenId = formData.assetTokenId;
        } else {
          payload.assetAmount = formData.assetAmount;
        }
      }

      const res = await fetch("/api/acquiring/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Payment Link Created",
          description: "Your payment link is ready to share",
        });

        setCreatedLink(data);
        setLinks([data.link, ...links]);
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
      title: "",
      description: "",
      amount: "",
      currency: "USD",
      token: "USDC",
      recipientAddress: "",
      amountType: "fixed",
      minAmount: "",
      maxAmount: "",
      expiresAt: "",
      redirectUrl: "",
      brandColor: "#3B82F6",
      logoUrl: "",
      distributeAsset: false,
      assetType: "nft",
      assetContractAddress: "",
      assetTokenId: "",
      assetAmount: "",
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

  const getPaymentUrl = (link: PaymentLink) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    return `${baseUrl}/pay?to=${link.recipient_address}&amount=${link.amount || ""}&token=${link.token}&merchant=${encodeURIComponent(link.title)}&linkId=${link.link_id}`;
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm("Are you sure you want to delete this payment link?")) return;

    try {
      const res = await fetch(`/api/acquiring/payment-links?linkId=${linkId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setLinks(links.filter((l) => l.link_id !== linkId));
        toast({
          title: "Link Deleted",
          description: "Payment link has been removed",
        });
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Could not delete payment link",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Payment Links</h1>
          <p className="text-muted-foreground mt-2">
            Create no-code payment links to accept crypto payments
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Payment Link
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create Payment Link</CardTitle>
            <CardDescription>
              Configure your payment link settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate}>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="amount">Amount Settings</TabsTrigger>
                  <TabsTrigger value="branding">Branding</TabsTrigger>
                  <TabsTrigger value="assets">Asset Distribution</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Link Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                        placeholder="Product Payment"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recipientAddress">
                        Recipient Address *
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
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Payment for services..."
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="token">Payment Token</Label>
                      <Select
                        value={formData.token}
                        onValueChange={(v) =>
                          setFormData({ ...formData, token: v })
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
                    <div className="space-y-2">
                      <Label htmlFor="redirectUrl">Redirect URL (Optional)</Label>
                      <Input
                        id="redirectUrl"
                        value={formData.redirectUrl}
                        onChange={(e) =>
                          setFormData({ ...formData, redirectUrl: e.target.value })
                        }
                        placeholder="https://your-site.com/success"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="amount" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Amount Type</Label>
                    <Select
                      value={formData.amountType}
                      onValueChange={(v: "fixed" | "dynamic" | "customer_input") =>
                        setFormData({ ...formData, amountType: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                        <SelectItem value="customer_input">
                          Customer Enters Amount
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.amountType === "fixed" ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount *</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          value={formData.amount}
                          onChange={(e) =>
                            setFormData({ ...formData, amount: e.target.value })
                          }
                          placeholder="100.00"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="currency">Currency</Label>
                        <Select
                          value={formData.currency}
                          onValueChange={(v) =>
                            setFormData({ ...formData, currency: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="CNY">CNY</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="minAmount">Minimum Amount</Label>
                        <Input
                          id="minAmount"
                          type="number"
                          step="0.01"
                          value={formData.minAmount}
                          onChange={(e) =>
                            setFormData({ ...formData, minAmount: e.target.value })
                          }
                          placeholder="1.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxAmount">Maximum Amount</Label>
                        <Input
                          id="maxAmount"
                          type="number"
                          step="0.01"
                          value={formData.maxAmount}
                          onChange={(e) =>
                            setFormData({ ...formData, maxAmount: e.target.value })
                          }
                          placeholder="10000.00"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="expiresAt">Expiration Date (Optional)</Label>
                    <Input
                      id="expiresAt"
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) =>
                        setFormData({ ...formData, expiresAt: e.target.value })
                      }
                    />
                  </div>
                </TabsContent>

                <TabsContent value="branding" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="brandColor">Brand Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="brandColor"
                          type="color"
                          value={formData.brandColor}
                          onChange={(e) =>
                            setFormData({ ...formData, brandColor: e.target.value })
                          }
                          className="w-16 h-10 p-1"
                        />
                        <Input
                          value={formData.brandColor}
                          onChange={(e) =>
                            setFormData({ ...formData, brandColor: e.target.value })
                          }
                          placeholder="#3B82F6"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="logoUrl">Logo URL</Label>
                      <Input
                        id="logoUrl"
                        value={formData.logoUrl}
                        onChange={(e) =>
                          setFormData({ ...formData, logoUrl: e.target.value })
                        }
                        placeholder="https://your-site.com/logo.png"
                      />
                    </div>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Preview: Your payment page will use your brand color and
                      logo to provide a consistent customer experience.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="assets" className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div>
                      <Label>Enable Asset Distribution</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Automatically send NFT or tokens after payment
                      </p>
                    </div>
                    <Switch
                      checked={formData.distributeAsset}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, distributeAsset: checked })
                      }
                    />
                  </div>

                  {formData.distributeAsset && (
                    <>
                      <div className="space-y-2">
                        <Label>Asset Type</Label>
                        <Select
                          value={formData.assetType}
                          onValueChange={(v: "nft" | "token") =>
                            setFormData({ ...formData, assetType: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nft">NFT (ERC-721)</SelectItem>
                            <SelectItem value="token">Token (ERC-20)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="assetContractAddress">
                          Contract Address *
                        </Label>
                        <Input
                          id="assetContractAddress"
                          value={formData.assetContractAddress}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              assetContractAddress: e.target.value,
                            })
                          }
                          placeholder="0x..."
                        />
                      </div>

                      {formData.assetType === "nft" ? (
                        <div className="space-y-2">
                          <Label htmlFor="assetTokenId">Token ID *</Label>
                          <Input
                            id="assetTokenId"
                            value={formData.assetTokenId}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                assetTokenId: e.target.value,
                              })
                            }
                            placeholder="1"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="assetAmount">Token Amount *</Label>
                          <Input
                            id="assetAmount"
                            value={formData.assetAmount}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                assetAmount: e.target.value,
                              })
                            }
                            placeholder="100"
                          />
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex gap-2 mt-6">
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Payment Link"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Created Link Success */}
      {createdLink && (
        <Card className="mb-8 border-green-500/20 bg-green-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <CardTitle className="text-green-500">
                Payment Link Created!
              </CardTitle>
            </div>
            <CardDescription>
              Share this link with your customers to receive payments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Link</Label>
              <div className="flex gap-2">
                <Input
                  value={createdLink.paymentUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    copyToClipboard(createdLink.paymentUrl, "Payment Link")
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setShowQRModal(createdLink.link)}
              >
                <QrCode className="mr-2 h-4 w-4" />
                Show QR Code
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  window.open(createdLink.paymentUrl, "_blank")
                }
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button variant="ghost" onClick={() => setCreatedLink(null)}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links List */}
      <div className="grid gap-4">
        {links.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No payment links yet. Create your first payment link to start
                accepting crypto payments.
              </p>
            </CardContent>
          </Card>
        ) : (
          links.map((link) => (
            <Card key={link.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Link2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{link.title}</CardTitle>
                      <CardDescription className="font-mono text-xs mt-1">
                        {link.link_id}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        link.status === "active" ? "default" : "secondary"
                      }
                    >
                      {link.status === "active" ? "Active" : "Paused"}
                    </Badge>
                    {link.distribute_asset && (
                      <Badge
                        variant="outline"
                        className="bg-purple-500/10 text-purple-500 border-purple-500/20"
                      >
                        <Gift className="h-3 w-3 mr-1" />
                        {link.asset_type === "nft" ? "NFT" : "Token"}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Amount
                    </span>
                    <div className="font-medium mt-1">
                      {link.amount
                        ? `${link.amount} ${link.token}`
                        : "Customer Input"}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payments</span>
                    <div className="font-medium mt-1">
                      {link.total_payments || 0}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Received</span>
                    <div className="font-medium mt-1">
                      {link.total_amount || 0} {link.token}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created
                    </span>
                    <div className="text-xs mt-1">
                      {new Date(link.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-border/50">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(getPaymentUrl(link), "Link")}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowQRModal(link)}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    QR Code
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(getPaymentUrl(link), "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(link.link_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQRModal(null)}
        >
          <Card
            className="max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="text-center">
              <CardTitle>{showQRModal.title}</CardTitle>
              <CardDescription>
                Scan to pay {showQRModal.amount || "any amount"} {showQRModal.token}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white rounded-lg">
                <QRCodeSVG
                  value={getPaymentUrl(showQRModal)}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  copyToClipboard(getPaymentUrl(showQRModal), "Payment Link")
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
