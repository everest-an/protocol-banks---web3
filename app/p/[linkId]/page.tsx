"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Clock, Wallet, ShieldCheck, Gift } from "lucide-react";
import { useWeb3 } from "@/contexts/web3-context";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { sendToken, getTokenAddress, getTokenBalance } from "@/lib/web3";
import { FeePreview } from "@/components/fee-preview";
import { SettlementMethodBadge } from "@/components/settlement-method-badge";

interface PaymentLinkData {
  link_id: string;
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
  status: string;
  brand_color?: string;
  logo_url?: string;
  distribute_asset?: boolean;
  asset_type?: string;
}

function PaymentLinkContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { isConnected, wallets, chainId } = useWeb3();

  const linkId = params.linkId as string;

  const [loading, setLoading] = useState(true);
  const [linkData, setLinkData] = useState<PaymentLinkData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [txHash, setTxHash] = useState("");

  // Track view
  useEffect(() => {
    fetch(`/api/acquiring/payment-links/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId, event: "view" }),
    }).catch(() => {});
  }, [linkId]);

  // Fetch link data
  useEffect(() => {
    if (!linkId) return;

    fetch(`/api/acquiring/payment-links?linkId=${linkId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Link not found");
        return res.json();
      })
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }

        const link = data.link_id ? data : data;

        // Check if expired
        if (link.expires_at && new Date(link.expires_at) < new Date()) {
          setError("expired");
          return;
        }

        // Check if active
        if (link.status !== "active") {
          setError("inactive");
          return;
        }

        setLinkData(link);
      })
      .catch(() => {
        setError("not_found");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [linkId]);

  const getPaymentAmount = (): string => {
    if (linkData?.amount_type === "fixed" && linkData.amount) {
      return linkData.amount.toString();
    }
    return customAmount;
  };

  const handlePayment = async () => {
    if (!isConnected || !wallets.EVM || !linkData) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to continue.",
        variant: "destructive",
      });
      return;
    }

    const paymentAmount = getPaymentAmount();
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }

    // Validate amount range for customer_input
    if (linkData.amount_type === "customer_input") {
      const amt = parseFloat(paymentAmount);
      if (linkData.min_amount && amt < linkData.min_amount) {
        toast({
          title: "Amount Too Low",
          description: `Minimum amount is ${linkData.min_amount} ${linkData.token}`,
          variant: "destructive",
        });
        return;
      }
      if (linkData.max_amount && amt > linkData.max_amount) {
        toast({
          title: "Amount Too High",
          description: `Maximum amount is ${linkData.max_amount} ${linkData.token}`,
          variant: "destructive",
        });
        return;
      }
    }

    setProcessing(true);

    try {
      const tokenAddress = getTokenAddress(chainId, linkData.token);
      if (!tokenAddress) throw new Error("Token not supported on this network");

      // Check balance
      const balance = await getTokenBalance(wallets.EVM, tokenAddress);
      if (parseFloat(balance) < parseFloat(paymentAmount)) {
        toast({
          title: "Insufficient Balance",
          description: `You need ${paymentAmount} ${linkData.token} but only have ${parseFloat(balance).toFixed(6)}`,
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      toast({
        title: "Confirm Transaction",
        description: "Please confirm the transaction in your wallet.",
      });

      const hash = await sendToken(tokenAddress, linkData.recipient_address, paymentAmount);

      setTxHash(hash);
      setCompleted(true);

      // Track payment
      fetch(`/api/acquiring/payment-links/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkId,
          event: "payment",
          txHash: hash,
          amount: paymentAmount,
          payer: wallets.EVM,
        }),
      }).catch(() => {});

      // Trigger asset distribution if configured
      if (linkData.distribute_asset && linkData.asset_type) {
        try {
          await fetch("/api/distribute-asset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentTxHash: hash,
              recipientAddress: wallets.EVM,
              assetType: linkData.asset_type,
              contractAddress: (linkData as any).asset_contract_address,
              chainId,
              tokenId: (linkData as any).asset_token_id,
              amount: (linkData as any).asset_amount,
              linkId,
            }),
          });
        } catch (distErr) {
          console.warn("[PaymentLink] Asset distribution failed:", distErr);
        }
      }

      toast({
        title: "Payment Successful!",
        description: "Your payment has been processed.",
      });

      // Redirect after delay
      if (linkData.redirect_url) {
        setTimeout(() => {
          window.location.href = linkData.redirect_url!;
        }, 3000);
      }
    } catch (error: any) {
      console.error("Payment failed:", error);
      toast({
        title: "Payment Failed",
        description: error.message || "Something went wrong.",
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

  if (error) {
    return (
      <div className="container max-w-md mx-auto py-20 px-4">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              {error === "expired" ? (
                <Clock className="h-6 w-6 text-destructive" />
              ) : (
                <AlertCircle className="h-6 w-6 text-destructive" />
              )}
            </div>
            <CardTitle className="text-destructive">
              {error === "expired"
                ? "Payment Link Expired"
                : error === "inactive"
                  ? "Payment Link Inactive"
                  : "Payment Link Not Found"}
            </CardTitle>
            <CardDescription>
              {error === "expired"
                ? "This payment link has passed its expiration date."
                : error === "inactive"
                  ? "This payment link has been deactivated by the merchant."
                  : "The payment link you're looking for doesn't exist."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!linkData) return null;

  const brandColor = linkData.brand_color || undefined;

  if (completed) {
    return (
      <div className="container max-w-md mx-auto py-20 px-4">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle className="text-green-500">Payment Successful</CardTitle>
            <CardDescription>Your payment has been processed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-card border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">
                  {getPaymentAmount()} {linkData.token}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">To</span>
                <span className="font-mono text-xs truncate max-w-[180px]">
                  {linkData.recipient_address}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction</span>
                <span className="font-mono text-xs truncate max-w-[150px]">{txHash}</span>
              </div>
            </div>
            {linkData.distribute_asset && (
              <div className="flex items-center gap-2 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <Gift className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-purple-400">
                  {linkData.asset_type === "nft" ? "NFT" : "Tokens"} will be distributed to your wallet shortly.
                </span>
              </div>
            )}
            {linkData.redirect_url && (
              <Button
                className="w-full"
                style={brandColor ? { backgroundColor: brandColor } : undefined}
                onClick={() => (window.location.href = linkData.redirect_url!)}
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
    <div className="container max-w-lg mx-auto py-12 px-4">
      <Card className="border-border shadow-lg">
        <CardHeader className="text-center border-b border-border/50 pb-6">
          {linkData.logo_url && (
            <div className="flex justify-center mb-3">
              <img
                src={linkData.logo_url}
                alt="Merchant"
                className="h-12 w-12 rounded-lg object-contain"
              />
            </div>
          )}
          <div className="mx-auto mb-3 h-12 w-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: brandColor ? `${brandColor}20` : "var(--primary-10)" }}
          >
            <Wallet className="h-6 w-6" style={brandColor ? { color: brandColor } : undefined} />
          </div>
          <CardTitle className="text-2xl">{linkData.title}</CardTitle>
          {linkData.description && (
            <CardDescription>{linkData.description}</CardDescription>
          )}
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Amount Section */}
          {linkData.amount_type === "fixed" && linkData.amount ? (
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Amount Due</div>
              <div className="text-4xl font-bold">
                {linkData.amount}{" "}
                <span className="text-xl text-muted-foreground">{linkData.token}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Label htmlFor="amount">Enter Payment Amount</Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={
                    linkData.min_amount
                      ? `Min: ${linkData.min_amount}`
                      : "0.00"
                  }
                  className="text-2xl h-14 font-mono"
                />
                <Badge variant="outline" className="h-14 px-4 text-lg flex items-center">
                  {linkData.token}
                </Badge>
              </div>
              {(linkData.min_amount || linkData.max_amount) && (
                <p className="text-xs text-muted-foreground">
                  {linkData.min_amount && `Min: ${linkData.min_amount} ${linkData.token}`}
                  {linkData.min_amount && linkData.max_amount && " | "}
                  {linkData.max_amount && `Max: ${linkData.max_amount} ${linkData.token}`}
                </p>
              )}
            </div>
          )}

          {/* Payment Details */}
          <div className="rounded-lg bg-secondary/50 p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Recipient</span>
              <span className="font-mono text-xs bg-background px-2 py-1 rounded border truncate max-w-[180px]">
                {linkData.recipient_address}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Network</span>
              <span className="text-sm">
                {chainId === 8453 ? "Base" : chainId === 1 ? "Ethereum" : chainId === 42161 ? "Arbitrum" : `Chain ${chainId}`}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-sm text-muted-foreground">Settlement</span>
              <SettlementMethodBadge
                method={chainId === 8453 ? "cdp" : "relayer"}
                chainId={chainId}
              />
            </div>
          </div>

          {/* Asset Distribution Notice */}
          {linkData.distribute_asset && (
            <div className="flex items-center gap-2 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <Gift className="h-4 w-4 text-purple-500" />
              <span className="text-sm">
                You will receive {linkData.asset_type === "nft" ? "an NFT" : "tokens"} after payment.
              </span>
            </div>
          )}

          {/* Fee Preview */}
          {getPaymentAmount() && parseFloat(getPaymentAmount()) > 0 && wallets.EVM && (
            <FeePreview
              amount={parseFloat(getPaymentAmount())}
              walletAddress={wallets.EVM}
              tokenSymbol={linkData.token}
              compact={true}
            />
          )}

          {/* Pay Button */}
          <Button
            size="lg"
            className="w-full"
            style={brandColor ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}
            onClick={handlePayment}
            disabled={
              !isConnected ||
              processing ||
              (linkData.amount_type !== "fixed" && (!customAmount || parseFloat(customAmount) <= 0))
            }
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : !isConnected ? (
              "Connect Wallet to Pay"
            ) : (
              `Pay ${getPaymentAmount() || "0"} ${linkData.token}`
            )}
          </Button>

          {/* Expiration */}
          {linkData.expires_at && (
            <p className="text-xs text-center text-muted-foreground">
              <Clock className="inline h-3 w-3 mr-1" />
              Expires: {new Date(linkData.expires_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Powered by{" "}
        <span className="font-semibold" style={brandColor ? { color: brandColor } : undefined}>
          Protocol Banks
        </span>
      </div>
    </div>
  );
}

export default function PaymentLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <PaymentLinkContent />
    </Suspense>
  );
}
