"use client";

import { useEffect, useState } from "react";
import {
  GlassCard,
  GlassCardContent,
  GlassCardDescription,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Copy, CheckCircle2, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDemo } from "@/contexts/demo-context";
import type { Merchant } from "@/types/acquiring";

// Demo merchants shown when no wallet is connected
const DEMO_MERCHANTS: Merchant[] = [
  {
    id: "demo-merchant-001",
    user_id: "demo-user",
    name: "Protocol Coffee Shop",
    wallet_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    callback_url: "https://protocoffee.example.com/webhook",
    logo_url: "",
    status: "active",
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "demo-merchant-002",
    user_id: "demo-user",
    name: "Web3 Design Studio",
    wallet_address: "0x8Ba1f109551bD432803012645Ac136ddd64DBA72",
    callback_url: "https://web3design.example.com/api/payments",
    logo_url: "",
    status: "active",
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "demo-merchant-003",
    user_id: "demo-user",
    name: "DeFi Tutoring",
    wallet_address: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0",
    callback_url: "",
    logo_url: "",
    status: "active",
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

export default function MerchantsPage() {
  const { isDemoMode } = useDemo();
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

  // Load merchant list
  useEffect(() => {
    if (isDemoMode) {
      setMerchants(DEMO_MERCHANTS);
      setLoading(false);
    } else {
      loadMerchants();
    }
  }, [isDemoMode]);

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
    <div className="container max-w-6xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Merchant Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage your acquiring merchants and API keys
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Merchant
        </Button>
      </div>

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <GlassCard className="mb-6 border-blue-500/20 bg-blue-500/5">
          <GlassCardContent className="pt-6 pb-4">
            <p className="text-sm text-blue-500">
              You are viewing demo merchants. Connect your wallet to manage real merchants.
            </p>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Create Merchant Form */}
      {showCreateForm && (
        <GlassCard className="mb-8">
          <GlassCardHeader>
            <GlassCardTitle>Create New Merchant</GlassCardTitle>
            <GlassCardDescription>
              Fill in merchant information to create acquiring account
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                />
              </div>
              <div className="flex gap-2">
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
                >
                  Cancel
                </Button>
              </div>
            </form>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* API Key Notice */}
      {newApiKey && (
        <GlassCard className="mb-8 border-green-500/20 bg-green-500/5">
          <GlassCardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <GlassCardTitle className="text-green-500">
                API Key Generated
              </GlassCardTitle>
            </div>
            <GlassCardDescription>
              Please save the following keys securely, they cannot be viewed
              again after closing
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent className="space-y-3">
            <div className="space-y-2">
              <Label>API Key ID</Label>
              <div className="flex gap-2">
                <Input
                  value={newApiKey.key_id}
                  readOnly
                  className="font-mono text-sm"
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
              <Label>API Secret</Label>
              <div className="flex gap-2">
                <Input
                  value={newApiKey.key_secret}
                  readOnly
                  className="font-mono text-sm"
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
              className="w-full"
            >
              I have saved it, close notice
            </Button>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Merchant List */}
      <div className="grid gap-4">
        {merchants.length === 0 ? (
          <GlassCard>
            <GlassCardContent className="py-12 text-center">
              <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No merchants yet, click the button above to create your first
                merchant
              </p>
            </GlassCardContent>
          </GlassCard>
        ) : (
          merchants.map((merchant) => (
            <GlassCard key={merchant.id}>
              <GlassCardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {merchant.logo_url ? (
                      <img
                        src={merchant.logo_url}
                        alt={merchant.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Store className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div>
                      <GlassCardTitle>{merchant.name}</GlassCardTitle>
                      <GlassCardDescription className="font-mono text-xs mt-1">
                        ID: {merchant.id.slice(0, 8)}...
                      </GlassCardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={
                      merchant.status === "active" ? "default" : "secondary"
                    }
                  >
                    {merchant.status === "active" ? "Active" : "Paused"}
                  </Badge>
                </div>
              </GlassCardHeader>
              <GlassCardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">
                      Payment Address
                    </span>
                    <div className="font-mono text-xs mt-1 flex items-center gap-2">
                      <span className="truncate">
                        {merchant.wallet_address}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
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
                    <span className="text-muted-foreground">Created At</span>
                    <div className="text-xs mt-1">
                      {new Date(merchant.created_at).toLocaleString("zh-CN")}
                    </div>
                  </div>
                </div>
                {merchant.callback_url && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Callback URL</span>
                    <div className="font-mono text-xs mt-1 truncate">
                      {merchant.callback_url}
                    </div>
                  </div>
                )}
              </GlassCardContent>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
