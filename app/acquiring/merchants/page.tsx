"use client";

import { useEffect, useState, useMemo } from "react";
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
  Loader2,
  Plus,
  Copy,
  CheckCircle2,
  Store,
  Users,
  RefreshCw,
  Building2,
  Key,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Merchant } from "@/types/acquiring";

export default function MerchantsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newApiKey, setNewApiKey] = useState<{
    key_id: string;
    key_secret: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    wallet_address: "",
    callback_url: "",
    logo_url: "",
  });

  // Calculate stats
  const stats = useMemo(() => {
    const activeMerchants = merchants.filter((m) => m.status === "active");
    return {
      total: merchants.length,
      active: activeMerchants.length,
      paused: merchants.length - activeMerchants.length,
    };
  }, [merchants]);

  // Load merchant list
  useEffect(() => {
    loadMerchants();
  }, []);

  const loadMerchants = async () => {
    try {
      const res = await fetch("/api/acquiring/merchants");
      const data = await res.json();

      if (data.success) {
        setMerchants(data.merchants || []);
      }
    } catch (error) {
      console.error("[Merchants] Load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/acquiring/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Merchant Created Successfully",
          description: "API key automatically generated",
        });

        setNewApiKey(data.api_key);
        setMerchants([data.merchant, ...merchants]);
        setFormData({
          name: "",
          wallet_address: "",
          callback_url: "",
          logo_url: "",
        });
        setShowCreateForm(false);
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Merchant Management</h1>
          <p className="text-muted-foreground">
            Manage your acquiring merchants and API keys
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMerchants}
            className="border-border bg-transparent"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Merchant
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Merchants</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered merchants</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.active}</div>
            <p className="text-xs text-green-500 mt-1">Processing payments</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paused</CardTitle>
            <Building2 className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.paused}</div>
            <p className="text-xs text-muted-foreground mt-1">Inactive merchants</p>
          </CardContent>
        </Card>
      </div>

      {/* Create Merchant Form */}
      {showCreateForm && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Create New Merchant</CardTitle>
            <CardDescription>
              Fill in merchant information to create acquiring account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Merchant Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="My Store"
                    required
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wallet_address">
                    Payment Wallet Address *
                  </Label>
                  <Input
                    id="wallet_address"
                    value={formData.wallet_address}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        wallet_address: e.target.value,
                      })
                    }
                    placeholder="0x..."
                    required
                    className="bg-background border-border font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="callback_url">Callback URL (Optional)</Label>
                <Input
                  id="callback_url"
                  value={formData.callback_url}
                  onChange={(e) =>
                    setFormData({ ...formData, callback_url: e.target.value })
                  }
                  placeholder="https://your-site.com/webhook"
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL (Optional)</Label>
                <Input
                  id="logo_url"
                  value={formData.logo_url}
                  onChange={(e) =>
                    setFormData({ ...formData, logo_url: e.target.value })
                  }
                  placeholder="https://..."
                  className="bg-background border-border"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Merchant"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  className="bg-transparent"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* API Key Notice */}
      {newApiKey && (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-green-500" />
              <CardTitle className="text-green-600">
                API Key Generated
              </CardTitle>
            </div>
            <CardDescription>
              Please save the following keys securely, they cannot be viewed
              again after closing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">API Key ID</Label>
              <div className="flex gap-2">
                <Input
                  value={newApiKey.key_id}
                  readOnly
                  className="font-mono text-sm bg-background"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    copyToClipboard(newApiKey.key_id, "API Key ID")
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">API Secret</Label>
              <div className="flex gap-2">
                <Input
                  value={newApiKey.key_secret}
                  readOnly
                  className="font-mono text-sm bg-background"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    copyToClipboard(newApiKey.key_secret, "API Secret")
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setNewApiKey(null)}
              className="w-full bg-transparent"
            >
              I have saved it, close notice
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Merchant List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Merchants</h2>
          <span className="text-sm text-muted-foreground">{merchants.length} items</span>
        </div>

        {merchants.length === 0 ? (
          <Card className="bg-card border-border border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                <Store className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No merchants yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                Create your first merchant to start accepting payments
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Merchant
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {merchants.map((merchant) => (
              <Card key={merchant.id} className="bg-card border-border hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {merchant.logo_url ? (
                        <img
                          src={merchant.logo_url}
                          alt={merchant.name}
                          className="w-12 h-12 rounded-lg object-cover border border-border"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Store className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-base">{merchant.name}</CardTitle>
                        <CardDescription className="font-mono text-xs mt-1">
                          ID: {merchant.id.slice(0, 8)}...
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={
                        merchant.status === "active" ? "default" : "secondary"
                      }
                      className={
                        merchant.status === "active"
                          ? "bg-green-500/10 text-green-500 border-green-500/20"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {merchant.status === "active" ? "Active" : "Paused"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">
                        Payment Address
                      </span>
                      <div className="font-mono text-xs mt-1 flex items-center gap-2">
                        <span className="truncate text-foreground">
                          {merchant.wallet_address}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={() =>
                            copyToClipboard(
                              merchant.wallet_address,
                              "Wallet Address",
                            )
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">Created At</span>
                      <div className="text-xs mt-1 text-foreground">
                        {new Date(merchant.created_at).toLocaleString("zh-CN")}
                      </div>
                    </div>
                  </div>
                  {merchant.callback_url && (
                    <div className="text-sm pt-2 border-t border-border">
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">Callback URL</span>
                      <div className="font-mono text-xs mt-1 truncate text-foreground">
                        {merchant.callback_url}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
