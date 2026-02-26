"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GlassCard,
  GlassCardContent,
  GlassCardDescription,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Store,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { useDemo } from "@/contexts/demo-context";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { authHeaders } from "@/lib/authenticated-fetch";

// Demo stats shown when no wallet is connected
const DEMO_STATS = {
  totalMerchants: 3,
  totalOrders: 47,
  pendingOrders: 5,
  paidOrders: 38,
  totalAmount: 12480.50,
};

export default function AcquiringDashboard() {
  const { isDemoMode } = useDemo();
  const { address } = useUnifiedWallet();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMerchants: 0,
    totalOrders: 0,
    pendingOrders: 0,
    paidOrders: 0,
    totalAmount: 0,
  });

  useEffect(() => {
    if (isDemoMode) {
      setStats(DEMO_STATS);
      setLoading(false);
    } else {
      loadStats();
    }
  }, [isDemoMode]);

  const loadStats = async () => {
    try {
      const [merchantsRes, ordersRes] = await Promise.all([
        fetch("/api/acquiring/merchants", { headers: authHeaders(address, undefined, { isDemoMode }) }),
        fetch("/api/acquiring/orders?limit=1000", { headers: authHeaders(address, undefined, { isDemoMode }) }),
      ]);

      const merchantsData = await merchantsRes.json();
      const ordersData = await ordersRes.json();

      const merchants = merchantsData.merchants || [];
      const orders = ordersData.orders || [];

      const pendingOrders = orders.filter(
        (o: any) => o.status === "pending",
      ).length;
      const paidOrders = orders.filter((o: any) => o.status === "paid").length;
      const totalAmount = orders
        .filter((o: any) => o.status === "paid")
        .reduce((sum: number, o: any) => sum + parseFloat(o.amount), 0);

      setStats({
        totalMerchants: merchants.length,
        totalOrders: orders.length,
        pendingOrders,
        paidOrders,
        totalAmount,
      });
    } catch (error) {
      console.error("[Dashboard] Load stats error:", error);
    } finally {
      setLoading(false);
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
    <div className="container max-w-7xl mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Acquiring Console</h1>
        <p className="text-muted-foreground mt-2">
          Manage your acquiring business
        </p>
      </div>

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <GlassCard className="mb-6 border-blue-500/20 bg-blue-500/5">
          <GlassCardContent className="pt-6 pb-4">
            <p className="text-sm text-blue-500">
              You are viewing demo data. Connect your wallet to see real acquiring data.
            </p>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Data Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <GlassCard>
          <GlassCardHeader className="flex flex-row items-center justify-between pb-2">
            <GlassCardTitle className="text-sm font-medium text-muted-foreground">
              Total Merchants
            </GlassCardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold">{stats.totalMerchants}</div>
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader className="flex flex-row items-center justify-between pb-2">
            <GlassCardTitle className="text-sm font-medium text-muted-foreground">
              Total Orders
            </GlassCardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending: {stats.pendingOrders} | Paid: {stats.paidOrders}
            </p>
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader className="flex flex-row items-center justify-between pb-2">
            <GlassCardTitle className="text-sm font-medium text-muted-foreground">
              Transaction Amount
            </GlassCardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold">
              ${stats.totalAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Completed orders
            </p>
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader className="flex flex-row items-center justify-between pb-2">
            <GlassCardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </GlassCardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold">
              {stats.totalOrders > 0
                ? ((stats.paidOrders / stats.totalOrders) * 100).toFixed(1)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.paidOrders} / {stats.totalOrders} orders
            </p>
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>Merchant Management</GlassCardTitle>
            <GlassCardDescription>
              Create and manage acquiring merchants
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <Link href="/acquiring/merchants">
              <Button className="w-full">
                Go to Merchant Management
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>Order Management</GlassCardTitle>
            <GlassCardDescription>
              Create orders and view transaction records
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <Link href="/acquiring/orders">
              <Button className="w-full">
                Go to Order Management
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>Payment Links</GlassCardTitle>
            <GlassCardDescription>
              Create no-code payment links to accept crypto payments
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <Link href="/acquiring/payment-links">
              <Button className="w-full">
                Go to Payment Links
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>Invoices</GlassCardTitle>
            <GlassCardDescription>
              Create and manage crypto invoices with dual currency pricing
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <Link href="/acquiring/invoices">
              <Button className="w-full">
                Go to Invoices
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* Usage Guide */}
      <GlassCard className="mt-8">
        <GlassCardHeader>
          <GlassCardTitle>Quick Start</GlassCardTitle>
          <GlassCardDescription>
            Follow these steps to start using the acquiring feature
          </GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              1
            </div>
            <div>
              <h3 className="font-semibold">Create Merchant</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Go to merchant management page, create your first acquiring
                merchant and get API key
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              2
            </div>
            <div>
              <h3 className="font-semibold">Create Order</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create orders via backend or API to generate checkout link
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              3
            </div>
            <div>
              <h3 className="font-semibold">Share Checkout</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Send checkout link to users, users select payment method to
                complete payment
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              4
            </div>
            <div>
              <h3 className="font-semibold">Receive Callback</h3>
              <p className="text-sm text-muted-foreground mt-1">
                After payment is completed, the system will automatically call
                your configured Webhook URL to notify you
              </p>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
