"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWeb3 } from "@/contexts/web3-context";
import { sendToken, getTokenAddress } from "@/lib/web3";
import { ethers } from "ethers";
import type { AcquiringOrder } from "@/types/acquiring";

interface PaymentMethod {
  id: "crypto_transfer" | "binance_pay" | "kucoin_pay";
  name: string;
  badge: "Instant" | "2-10 mins";
  description: string;
  feesIncluded: boolean;
  icon: string;
  tokens?: string[];
}

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "binance_pay",
    name: "Binance Pay",
    badge: "Instant",
    description: "Pay with any token in your Binance account",
    feesIncluded: true,
    icon: "⚡",
  },
  {
    id: "kucoin_pay",
    name: "KuCoin Pay",
    badge: "Instant",
    description: "Pay with any token in your KuCoin account",
    feesIncluded: true,
    icon: "⚡",
  },
  {
    id: "crypto_transfer",
    name: "Crypto Transfer",
    badge: "2-10 mins",
    description: "No Channel Fee",
    feesIncluded: false,
    icon: "🔗",
    tokens: ["USDC", "USDT", "DAI"],
  },
];

function CheckoutContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isConnected, wallets, chainId } = useWeb3();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [order, setOrder] = useState<AcquiringOrder | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [completed, setCompleted] = useState(false);

  const orderNo = searchParams.get("order");

  // Fetch order information
  useEffect(() => {
    if (!orderNo) return;

    fetch(`/api/acquiring/orders/${orderNo}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.order) {
          setOrder(data.order);
        } else {
          toast({
            title: "Order Not Found",
            description: data.error || "Cannot find this order",
            variant: "destructive",
          });
        }
      })
      .catch((err) => {
        console.error("[Checkout] Order fetch error:", err);
        toast({
          title: "Load Failed",
          description: "Cannot load order information",
          variant: "destructive",
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [orderNo, toast]);

  // Countdown timer
  useEffect(() => {
    if (!order || order.status !== "pending") return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiresAt = new Date(order.expires_at).getTime();
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(diff);

      if (diff === 0) {
        setOrder({ ...order, status: "expired" });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [order]);

  // Format countdown time
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")} : ${String(m).padStart(2, "0")} : ${String(s).padStart(2, "0")}`;
  };

  // Handle payment
  const handlePayment = async () => {
    if (!selectedMethod || !order || !isConnected || !wallets.EVM) {
      toast({
        title: "Please Connect Wallet",
        description: "You need to connect wallet to complete payment",
        variant: "destructive",
      });
      return;
    }

    if (selectedMethod === "binance_pay" || selectedMethod === "kucoin_pay") {
      toast({
        title: "Feature In Development",
        description:
          "This payment method is not yet integrated, please choose Crypto Transfer",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);

    try {
      const tokenAddress = getTokenAddress(chainId, order.token);
      if (!tokenAddress) {
        throw new Error("Token not supported on this network");
      }

      toast({
        title: "Please Confirm Transaction",
        description: "Please confirm the payment transaction in your wallet",
      });

      // Send tokens
      // Note: This should use the merchant's wallet address, currently using merchant_id as placeholder
      // Should actually return merchant's wallet_address from order details API
      const recipientAddress =
        (order as any).merchant_wallet_address || order.merchant_id;

      if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
        throw new Error("Invalid merchant wallet address");
      }

      const txHash = await sendToken(
        tokenAddress,
        recipientAddress,
        order.amount.toString(),
      );

      // Update order status
      await fetch(`/api/acquiring/orders/${order.order_no}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paid",
          payment_method: selectedMethod,
          payer_address: wallets.EVM,
          tx_hash: txHash,
        }),
      });

      setCompleted(true);
      toast({
        title: "Payment Successful",
        description: "Your payment has been completed",
      });

      // If there's a return URL, redirect after 3 seconds
      if (order.return_url) {
        setTimeout(() => {
          window.location.href = order.return_url!;
        }, 3000);
      }
    } catch (error: any) {
      console.error("[Checkout] Payment error:", error);
      toast({
        title: "Payment Failed",
        description: error.message || "An error occurred during payment",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container max-w-md mx-auto py-20 px-4">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Order Not Found</h2>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (order.status === "expired") {
    return (
      <div className="container max-w-md mx-auto py-20 px-4">
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardHeader>
            <div className="flex items-center gap-2 text-yellow-500">
              <Clock className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Order Expired</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              This order has exceeded its validity period, please place a new
              order
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (completed || order.status === "paid") {
    return (
      <div className="container max-w-md mx-auto py-20 px-4">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <h2 className="text-lg font-semibold text-green-500">
              Payment Successful
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Your payment has been completed
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-card border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order No.</span>
                <span className="font-mono text-xs">{order.order_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Amount</span>
                <span className="font-medium">
                  {order.amount} {order.token}
                </span>
              </div>
              {order.tx_hash && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Transaction Hash
                  </span>
                  <span className="font-mono text-xs truncate max-w-[150px]">
                    {order.tx_hash}
                  </span>
                </div>
              )}
            </div>
            {order.return_url && (
              <Button
                className="w-full"
                onClick={() => (window.location.href = order.return_url!)}
              >
                Return to Merchant
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-lg mx-auto py-10 px-4">
      <Card className="border-border shadow-lg">
        <CardHeader className="text-center border-b border-border/50 pb-6">
          <div className="text-sm text-muted-foreground mb-2">
            {(order as any).merchant_name || "Merchant"} | Order{" "}
            {order.order_no.slice(-8)}
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Order Amount</div>
            <div className="text-4xl font-bold">
              {order.amount}{" "}
              <span className="text-2xl text-muted-foreground">
                {order.currency}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">Expiration Time</span>
            <span className="font-mono text-lg">{formatTime(timeLeft)}</span>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.id}
              onClick={() => setSelectedMethod(method.id)}
              className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                selectedMethod === method.id
                  ? "border-primary bg-primary/10 shadow-md transform scale-[1.02]"
                  : "border-border hover:border-primary/50 opacity-80 hover:opacity-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{method.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{method.name}</span>
                      <Badge
                        variant="secondary"
                        className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs"
                      >
                        {method.badge}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {method.description}
                    </div>
                    {method.feesIncluded && (
                      <div className="text-xs text-muted-foreground italic mt-1">
                        Fees Included
                      </div>
                    )}
                    {method.tokens && (
                      <div className="flex gap-1 mt-2">
                        {method.tokens.map((token) => (
                          <span
                            key={token}
                            className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs"
                          >
                            {token[0]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedMethod === method.id
                      ? "border-primary"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {selectedMethod === method.id && (
                    <div className="w-3 h-3 rounded-full bg-primary" />
                  )}
                </div>
              </div>
            </button>
          ))}

          <Button
            size="lg"
            className="w-full mt-6"
            onClick={handlePayment}
            disabled={!selectedMethod || processing || !isConnected}
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : !isConnected ? (
              "Please Connect Wallet"
            ) : (
              "Continue"
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground mt-4">
            Powered by Protocol Banks
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
