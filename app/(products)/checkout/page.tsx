"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Clock, Copy, ArrowLeft, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { sendToken, getTokenAddress, ERC20_ABI, CHAIN_IDS, RPC_URLS } from "@/lib/web3";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import type { AcquiringOrder } from "@/types/acquiring";

interface PaymentMethod {
  id: "crypto_transfer" | "binance_pay" | "kucoin_pay";
  name: string;
  badge: "Instant" | "2-10 mins";
  description: string;
  feesIncluded: boolean;
  icon: string;
  tokens?: { symbol: string; logo: string }[];
  disabled?: boolean;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "binance_pay",
    name: "Binance Pay",
    badge: "Instant",
    description: "Pay with any token in your Binance account",
    feesIncluded: true,
    icon: "⚡",
    disabled: true,
  },
  {
    id: "kucoin_pay",
    name: "KuCoin Pay",
    badge: "Instant",
    description: "Pay with any token in your KuCoin account",
    feesIncluded: true,
    icon: "⚡",
    disabled: true,
  },
  {
    id: "crypto_transfer",
    name: "Crypto Transfer",
    badge: "2-10 mins",
    description: "No Channel Fee",
    feesIncluded: false,
    icon: "🔗",
    tokens: [
      { symbol: "USDT", logo: "/tokens/usdt.png" },
      { symbol: "USDC", logo: "/tokens/usdc.png" },
    ],
  },
];

function CheckoutContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { chainId } = useUnifiedWallet();

  const NETWORK_CHAIN_IDS: Record<string, number> = {
    eth: CHAIN_IDS.MAINNET,
    base: CHAIN_IDS.BASE,
    arb: CHAIN_IDS.ARBITRUM,
    bnb: CHAIN_IDS.BSC,
    hsk: CHAIN_IDS.HASHKEY,
  };

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [order, setOrder] = useState<AcquiringOrder | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [completed, setCompleted] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showNetworkSelection, setShowNetworkSelection] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);

  // Branding
  const [brandColor, setBrandColor] = useState<string | null>(null);
  const [merchantLogo, setMerchantLogo] = useState<string | null>(null);

  const orderNo = searchParams.get("order");
  const brandColorParam = searchParams.get("brandColor");
  const logoParam = searchParams.get("logo");

  // Set branding from URL params
  useEffect(() => {
    if (brandColorParam) setBrandColor(brandColorParam);
    if (logoParam) setMerchantLogo(decodeURIComponent(logoParam));
  }, [brandColorParam, logoParam]);

  // Fetch order information
  useEffect(() => {
    if (!orderNo) {
      setLoading(false);
      return;
    }

    fetch(`/api/acquiring/orders/${orderNo}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.order) {
          setOrder(data.order);
          // Set branding from order metadata if available
          const meta = data.order.metadata;
          if (meta?.brandColor && !brandColorParam) setBrandColor(meta.brandColor);
          if (meta?.logoUrl && !logoParam) setMerchantLogo(meta.logoUrl);
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
  }, [orderNo, toast, brandColorParam, logoParam]);

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

  // Monitor transactions when QR code is shown
  useEffect(() => {
    if (!showQRCode || !order || completed || !selectedNetwork) return;

    const targetChainId = NETWORK_CHAIN_IDS[selectedNetwork];
    if (!targetChainId) return;

    const rpcUrl = RPC_URLS[targetChainId as keyof typeof RPC_URLS];
    // If no RPC (e.g. Tron), we can't monitor via EVM provider. 
    // Ideally we should have a Tron monitoring logic, but for now skip.
    if (!rpcUrl) return;

    let contract: ethers.Contract | null = null;
    let provider: ethers.JsonRpcProvider | null = null;

    const startMonitoring = async () => {
      try {
        // Use JsonRpcProvider to monitor the specific chain independent of user wallet
        provider = new ethers.JsonRpcProvider(rpcUrl);
        
        const tokenAddress = getTokenAddress(targetChainId, order.token);
        
        if (!tokenAddress) return;

        contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const recipientAddress = (order as any).merchant_wallet_address || order.merchant_id;

        // Filter for Transfer events to the recipient
        const filter = contract.filters.Transfer(null, recipientAddress);

        // Listen for events
        contract.on(filter, async (from, to, value, event) => {
          try {
            // Get token decimals to format amount correctly
            const decimals = await contract!.decimals();
            const formattedAmount = ethers.formatUnits(value, decimals);
            
            // Check if amount matches (or is greater/equal)
            // Note: In production, we should also check the timestamp/block to ensure it's new
            if (parseFloat(formattedAmount) >= order.amount) {
              // Update order status
              await fetch(`/api/acquiring/orders/${order.order_no}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  status: "paid",
                  payment_method: "crypto_transfer_qr",
                  payer_address: from,
                  tx_hash: event.log.transactionHash,
                }),
              });

              setCompleted(true);
              setShowQRCode(false);
              toast({
                title: "Payment Successful",
                description: "Transaction detected and confirmed",
              });
              
              if (order.return_url) {
                setTimeout(() => {
                  window.location.href = order.return_url!;
                }, 3000);
              }
            }
          } catch (err) {
            console.error("Error processing event:", err);
          }
        });

      } catch (err) {
        console.error("Error setting up monitoring:", err);
      }
    };

    startMonitoring();

    return () => {
      if (contract) {
        contract.removeAllListeners();
      }
      // JsonRpcProvider doesn't need explicit destroy usually, but good to clean up listeners
    };
  }, [showQRCode, order, completed, toast, selectedNetwork]);


  // Format countdown time
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")} : ${String(m).padStart(2, "0")} : ${String(s).padStart(2, "0")}`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard",
    });
  };

  // Handle payment
  const handlePayment = async () => {
    if (!selectedMethod) return;

    if (selectedMethod === "binance_pay" || selectedMethod === "kucoin_pay") {
        // Disabled in UI, but keep safety check
        return;
    }

    if (selectedMethod === "crypto_transfer") {
        setShowNetworkSelection(true);
        return;
    }
  };

  const NETWORKS = [
    { id: "eth", name: "Ethereum", logo: "/networks/eth.png" },
    { id: "base", name: "Base", logo: "/networks/base.png" },
    { id: "arb", name: "Arbitrum", logo: "/networks/arb.png" },
    { id: "bnb", name: "BNB Chain", logo: "/networks/bnb.png" },
    { id: "tron", name: "Tron", logo: "/networks/tron.png" },
    { id: "hsk", name: "HashKey Chain", logo: "/networks/hsk.png" },
  ];

  const handleNetworkSelect = (networkId: string) => {
    setSelectedNetwork(networkId);
    setShowNetworkSelection(false);
    setShowQRCode(true);
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

  const recipientAddress = (order as any).merchant_wallet_address || order.merchant_id;

  const getQRCodeValue = () => {
    if (!selectedNetwork) return recipientAddress;

    const chainId = NETWORK_CHAIN_IDS[selectedNetwork];
    if (!chainId) return recipientAddress;

    const tokenAddress = getTokenAddress(chainId, order.token);
    
    // EIP-681 URI
    if (tokenAddress) {
       // ethereum:<token_address>@<chain_id>/transfer?address=<recipient_address>
       return `ethereum:${tokenAddress}@${chainId}/transfer?address=${recipientAddress}`;
    }
    
    // Fallback for native or if token address not found
    return `ethereum:${recipientAddress}@${chainId}`;
  };

  return (
    <div className="container max-w-lg mx-auto py-10 px-4">
      <Card className="border-border shadow-lg">
        <CardHeader className="text-center border-b border-border/50 pb-6">
          {merchantLogo && (
            <div className="flex justify-center mb-3">
              <Image
                src={merchantLogo}
                alt="Merchant"
                width={48}
                height={48}
                className="rounded-lg object-contain"
              />
            </div>
          )}
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
          {showNetworkSelection ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
              <div className="flex items-center mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNetworkSelection(false)}
                  className="-ml-2"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <h3 className="text-lg font-semibold ml-2">Select Network</h3>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {NETWORKS.map((network) => (
                  <button
                    key={network.id}
                    onClick={() => handleNetworkSelect(network.id)}
                    className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                  >
                    <Image
                      src={network.logo}
                      alt={network.name}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                    <span className="font-medium">{network.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : !showQRCode ? (
            <>
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.id}
                  onClick={() => !method.disabled && setSelectedMethod(method.id)}
                  disabled={method.disabled}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    selectedMethod === method.id
                      ? "border-primary bg-primary/10 shadow-md transform scale-[1.02]"
                      : method.disabled
                        ? "border-border/50 opacity-50 cursor-not-allowed bg-muted/20"
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
                          <div className="flex gap-2 mt-2">
                            {method.tokens.map((token) => (
                              <div
                                key={token.symbol}
                                className="w-6 h-6 rounded-full bg-background border flex items-center justify-center overflow-hidden"
                                title={token.symbol}
                              >
                                <Image 
                                    src={token.logo} 
                                    alt={token.symbol} 
                                    width={24} 
                                    height={24}
                                />
                              </div>
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
                style={brandColor ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}
                onClick={handlePayment}
                disabled={!selectedMethod || processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-6 animate-in fade-in zoom-in duration-300">
               <div className="flex items-center justify-between">
                   <Button variant="ghost" size="sm" onClick={() => setShowQRCode(false)} className="-ml-2">
                       <ArrowLeft className="w-4 h-4 mr-2" />
                       Back
                   </Button>
                   <Badge variant="outline" className="animate-pulse">
                       <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                       Monitoring Network
                   </Badge>
               </div>
               
               <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-inner border border-border">
                  <QRCodeSVG 
                    value={getQRCodeValue()} 
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
               </div>

               <div className="space-y-4">
                  <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Send Amount</div>
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                          <div className="flex items-center gap-2">
                             {['USDC', 'USDT'].includes(order.token) && (
                                <Image 
                                    src={`/tokens/${order.token.toLowerCase()}.png`}
                                    alt={order.token}
                                    width={24}
                                    height={24}
                                    className="rounded-full"
                                />
                             )}
                             <span className="font-mono font-bold text-lg">{order.amount} {order.token}</span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleCopy(order.amount.toString())}>
                              <Copy className="w-4 h-4" />
                          </Button>
                      </div>
                  </div>
                  
                  <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Network</div>
                      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border border-border">
                          {selectedNetwork && (() => {
                              const network = NETWORKS.find(n => n.id === selectedNetwork);
                              return network ? (
                                  <>
                                      <Image 
                                          src={network.logo} 
                                          alt={network.name} 
                                          width={20} 
                                          height={20}
                                          className="rounded-full"
                                      />
                                      <span className="font-medium">{network.name}</span>
                                  </>
                              ) : null;
                          })()}
                      </div>
                  </div>
                  
                  <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">To Address</div>
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                          <span className="font-mono text-xs break-all">{recipientAddress}</span>
                          <Button variant="ghost" size="icon" onClick={() => handleCopy(recipientAddress)}>
                              <Copy className="w-4 h-4" />
                          </Button>
                      </div>
                  </div>
               </div>

               <div className="text-center text-sm text-muted-foreground bg-blue-500/5 p-4 rounded-lg border border-blue-500/10">
                   <p>Please send the exact amount to the address above.</p>
                   <p className="mt-1">The page will automatically update once payment is detected.</p>
               </div>
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground mt-4">
            Powered by{" "}
            <span style={brandColor ? { color: brandColor } : undefined}>
              Protocol Banks
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 text-center">
        <Link href="/acquiring/orders">
          <Button variant="link" className="text-muted-foreground">
            Back to Console
          </Button>
        </Link>
      </div>
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
