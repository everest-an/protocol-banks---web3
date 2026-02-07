"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  CheckCircle2,
  QrCode,
  DollarSign,
  RefreshCw,
  Wifi,
  WifiOff,
  Volume2,
  History,
  Settings,
  ArrowLeft,
  Copy,
  Delete,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { getTokenAddress, ERC20_ABI, CHAIN_IDS, RPC_URLS } from "@/lib/web3";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";

interface Transaction {
  id: string;
  amount: string;
  token: string;
  from: string;
  txHash: string;
  timestamp: Date;
  status: "confirmed" | "pending";
}

function TerminalContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Terminal state
  const [mode, setMode] = useState<"input" | "qr" | "success" | "history" | "settings">("input");
  const [amount, setAmount] = useState("0");
  const [token, setToken] = useState("USDC");
  const [network, setNetwork] = useState("base");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [monitoring, setMonitoring] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [online, setOnline] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [merchantName, setMerchantName] = useState("Protocol Banks POS");
  const [paymentMode, setPaymentMode] = useState<"crypto" | "fiat">("crypto");

  // Load settings from URL params or localStorage
  useEffect(() => {
    // 1. Get URL params
    const addressParam = searchParams.get("address");
    const nameParam = searchParams.get("merchant");
    const tokenParam = searchParams.get("token");
    const networkParam = searchParams.get("network");

    // 2. Get saved settings
    let savedSettings: any = {};
    try {
      const saved = localStorage.getItem("pos_settings");
      if (saved) savedSettings = JSON.parse(saved);
    } catch {}

    // 3. Apply (URL > Saved > Default)
    if (addressParam) setRecipientAddress(addressParam);
    else if (savedSettings.recipientAddress) setRecipientAddress(savedSettings.recipientAddress);

    if (nameParam) setMerchantName(decodeURIComponent(nameParam));
    else if (savedSettings.merchantName) setMerchantName(savedSettings.merchantName);

    if (tokenParam) setToken(tokenParam.toUpperCase());
    else if (savedSettings.token) setToken(savedSettings.token);

    if (networkParam) setNetwork(networkParam);
    else if (savedSettings.network) setNetwork(savedSettings.network);

    // If no address set (from URL or storage), prompt for it
    if (!addressParam && !savedSettings.recipientAddress) {
       // We can optionally setMode("settings") here, but let's let the user discover it or click charge first
       // Actually, good UX might be to show settings if it's "fresh"
       // But handleCharge already checks for recipientAddress, so we are safe.
    }
  }, [searchParams]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load cached transactions from localStorage
  useEffect(() => {
    try {
      const cached = localStorage.getItem("pos_transactions");
      if (cached) {
        const parsed = JSON.parse(cached);
        setTransactions(parsed.map((t: any) => ({ ...t, timestamp: new Date(t.timestamp) })));
      }
    } catch {}
  }, []);

  // Save transactions to localStorage
  const saveTransactions = useCallback((txs: Transaction[]) => {
    setTransactions(txs);
    try {
      localStorage.setItem("pos_transactions", JSON.stringify(txs));
    } catch {}
  }, []);

  const NETWORK_CHAIN_IDS: Record<string, number> = {
    eth: CHAIN_IDS.MAINNET,
    base: CHAIN_IDS.BASE,
    arb: CHAIN_IDS.ARBITRUM,
    bnb: CHAIN_IDS.BSC,
  };

  // Numpad input
  const handleNumpadPress = (key: string) => {
    if (key === "C") {
      setAmount("0");
      return;
    }
    if (key === "DEL") {
      setAmount((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
      return;
    }
    if (key === "." && amount.includes(".")) return;
    if (amount === "0" && key !== ".") {
      setAmount(key);
    } else {
      // Limit decimal places
      const parts = (amount + key).split(".");
      if (parts[1] && parts[1].length > 2) return;
      setAmount(amount + key);
    }
  };

  // Generate QR and start monitoring
  const handleCharge = () => {
    if (!recipientAddress) {
      toast({
        title: "Configuration Required",
        description: "Please set a recipient wallet address in settings.",
        variant: "destructive",
      });
      setMode("settings");
      return;
    }

    if (parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }

    setMode("qr");
    startMonitoring();
  };

  const startMonitoring = () => {
    setMonitoring(true);
  };

  // Monitor blockchain for incoming payment
  useEffect(() => {
    if (!monitoring || mode !== "qr" || !recipientAddress) return;

    const chainId = NETWORK_CHAIN_IDS[network];
    if (!chainId) return;

    const rpcUrl = RPC_URLS[chainId as keyof typeof RPC_URLS];
    if (!rpcUrl) return;

    let contract: ethers.Contract | null = null;
    let provider: ethers.JsonRpcProvider | null = null;

    const monitor = async () => {
      try {
        provider = new ethers.JsonRpcProvider(rpcUrl);
        const tokenAddress = getTokenAddress(chainId, token);
        if (!tokenAddress) return;

        contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const filter = contract.filters.Transfer(null, recipientAddress);

        contract.on(filter, async (from, to, value, event) => {
          try {
            const decimals = await contract!.decimals();
            const formattedAmount = ethers.formatUnits(value, decimals);

            if (parseFloat(formattedAmount) >= parseFloat(amount)) {
              const tx: Transaction = {
                id: `tx_${Date.now()}`,
                amount: formattedAmount,
                token,
                from,
                txHash: event.log.transactionHash,
                timestamp: new Date(),
                status: "confirmed",
              };

              setLastTransaction(tx);
              saveTransactions([tx, ...transactions]);
              setMonitoring(false);
              setMode("success");

              // Play success sound
              if (soundEnabled) {
                playSuccessSound();
              }

              toast({
                title: "Payment Received!",
                description: `${formattedAmount} ${token} from ${from.slice(0, 8)}...`,
              });
            }
          } catch (err) {
            console.error("Error processing event:", err);
          }
        });
      } catch (err) {
        console.error("Monitoring error:", err);
      }
    };

    monitor();

    return () => {
      if (contract) {
        contract.removeAllListeners();
      }
    };
  }, [monitoring, mode, recipientAddress, network, token, amount, soundEnabled, transactions, saveTransactions, toast]);

  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch {}
  };

  const getQRValue = () => {
    // Demo Fiat On-Ramp URL (Transak)
    if (paymentMode === "fiat") {
      // Basic Transak URL for demo. In production, this would use an API Key and sign the request.
      const baseUrl = "https://global.transak.com";
      const params = new URLSearchParams({
        // apiKey: "YOUR_API_KEY", // Hidden for demo
        walletAddress: recipientAddress,
        fiatCurrency: "USD",
        fiatAmount: amount,
        cryptoCurrencyCode: token,
        network: network === "eth" ? "ethereum" : network, // Simple mapping
        redirectURL: "https://protocol-banks.com/success", // Placeholder
      });
      return `${baseUrl}?${params.toString()}`;
    }

    const chainId = NETWORK_CHAIN_IDS[network];
    if (!chainId) return recipientAddress;
    const tokenAddress = getTokenAddress(chainId, token);
    if (tokenAddress) {
      return `ethereum:${tokenAddress}@${chainId}/transfer?address=${recipientAddress}&uint256=${ethers.parseUnits(amount, 6)}`;
    }
    return `ethereum:${recipientAddress}@${chainId}?value=${ethers.parseEther(amount)}`;
  };

  const handleNewTransaction = () => {
    setAmount("0");
    setLastTransaction(null);
    setMode("input");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied" });
  };

  const todayTotal = transactions
    .filter((t) => {
      const today = new Date();
      return t.timestamp.toDateString() === today.toDateString();
    })
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{merchantName}</span>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`text-xs ${
              online
                ? "border-green-500/30 text-green-400"
                : "border-red-500/30 text-red-400"
            }`}
          >
            {online ? (
              <Wifi className="h-3 w-3 mr-1" />
            ) : (
              <WifiOff className="h-3 w-3 mr-1" />
            )}
            {online ? "Online" : "Offline"}
          </Badge>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1 rounded hover:bg-zinc-800"
          >
            <Volume2
              className={`h-4 w-4 ${soundEnabled ? "text-white" : "text-zinc-600"}`}
            />
          </button>
          <button
            onClick={() => setMode("history")}
            className="p-1 rounded hover:bg-zinc-800"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMode("settings")}
            className="p-1 rounded hover:bg-zinc-800"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {mode === "input" && (
          <>

              {/* Payment Mode Switcher */}
              <div className="flex justify-center mt-6 mb-2">
                <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setPaymentMode("crypto")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      paymentMode === "crypto"
                        ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-400"
                    }`}
                  >
                    Crypto
                  </button>
                  <button
                    onClick={() => setPaymentMode("fiat")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      paymentMode === "fiat"
                        ? "bg-blue-600/20 text-blue-400 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-400"
                    }`}
                  >
                    Fiat / Card
                  </button>
                </div>
              </div>
            {/* Amount Display */}
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <div className="text-sm text-zinc-500 mb-2">CHARGE AMOUNT</div>
              <div className="text-6xl font-mono font-bold tracking-tight mb-2">
                {amount}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                  {token}
                </Badge>
                <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                  {network.toUpperCase()}
                </Badge>
              </div>
              <div className="text-xs text-zinc-600 mt-4">
                Today: {todayTotal.toFixed(2)} {token} | {transactions.filter((t) => t.timestamp.toDateString() === new Date().toDateString()).length} txns
              </div>
            </div>

            {/* Numpad */}
            <div className="px-4 pb-4">
              <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "DEL"].map(
                  (key) => (
                    <button
                      key={key}
                      onClick={() => handleNumpadPress(key)}
                      className={`h-16 rounded-xl text-xl font-medium transition-all active:scale-95 ${
                        key === "DEL"
                          ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                          : "bg-zinc-900 text-white hover:bg-zinc-800 border border-zinc-800"
                      }`}
                    >
                      {key === "DEL" ? <Delete className="h-5 w-5 mx-auto" /> : key}
                    </button>
                  ),
                )}
              </div>

              <div className="flex gap-2 mt-4 max-w-sm mx-auto">
                <Button
                  variant="outline"
                  className="flex-1 h-14 bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                  onClick={() => setAmount("0")}
                >
                  Clear
                </Button>
                <Button
                  className="flex-[2] h-14 bg-blue-600 hover:bg-blue-700 text-lg font-semibold"
                  onClick={handleCharge}
                  disabled={parseFloat(amount) <= 0}
                >
                  <QrCode className="mr-2 h-5 w-5" />
                  Charge {amount} {token}
                </Button>
              </div>
            </div>
          </>
        )}

        {mode === "qr" && (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="text-sm text-zinc-500 mb-4">SCAN TO PAY</div>
            <div className="text-3xl font-bold mb-6">
              {amount} {token}
            </div>

            <div className="p-6 bg-white rounded-2xl shadow-2xl mb-6">
              <QRCodeSVG
                value={getQRValue()}
                size={240}
                level="H"
              />
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className="border-blue-500/30 text-blue-400 animate-pulse">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Monitoring for payment...
              </Badge>
            </div>

            <div className="text-xs text-zinc-600 text-center mb-6">
              <p>Send exactly {amount} {token} on {network.toUpperCase()}</p>
              <p className="mt-1 font-mono text-zinc-700">
                {recipientAddress.slice(0, 10)}...{recipientAddress.slice(-8)}
              </p>
            </div>

            <Button
              variant="outline"
              className="bg-zinc-900 border-zinc-800 text-zinc-400"
              onClick={() => {
                setMonitoring(false);
                setMode("input");
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        )}

        {mode === "success" && lastTransaction && (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6 animate-in zoom-in duration-300">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-400 mb-2">
              Payment Received!
            </div>
            <div className="text-4xl font-mono font-bold mb-4">
              {lastTransaction.amount} {lastTransaction.token}
            </div>

            <div className="w-full max-w-sm space-y-2 text-sm mb-8">
              <div className="flex justify-between py-2 border-b border-zinc-800">
                <span className="text-zinc-500">From</span>
                <button
                  className="font-mono text-xs text-zinc-400 hover:text-white"
                  onClick={() => copyToClipboard(lastTransaction.from)}
                >
                  {lastTransaction.from.slice(0, 10)}...{lastTransaction.from.slice(-6)}
                </button>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-800">
                <span className="text-zinc-500">Tx Hash</span>
                <button
                  className="font-mono text-xs text-zinc-400 hover:text-white"
                  onClick={() => copyToClipboard(lastTransaction.txHash)}
                >
                  {lastTransaction.txHash.slice(0, 10)}...{lastTransaction.txHash.slice(-6)}
                </button>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-800">
                <span className="text-zinc-500">Time</span>
                <span className="text-zinc-400">
                  {lastTransaction.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>

            <Button
              className="w-full max-w-sm h-14 bg-blue-600 hover:bg-blue-700 text-lg"
              onClick={handleNewTransaction}
            >
              New Transaction
            </Button>
          </div>
        )}

        {mode === "history" && (
          <div className="flex-1 flex flex-col px-4 pt-4">
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setMode("input")}
                className="p-2 rounded-lg hover:bg-zinc-800"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-bold">Transaction History</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <GlassCard className="bg-zinc-900 border-zinc-800">
                <GlassCardContent className="pt-4">
                  <div className="text-xs text-zinc-500">Today&apos;s Total</div>
                  <div className="text-xl font-bold text-white">
                    {todayTotal.toFixed(2)} {token}
                  </div>
                </GlassCardContent>
              </GlassCard>
              <GlassCard className="bg-zinc-900 border-zinc-800">
                <GlassCardContent className="pt-4">
                  <div className="text-xs text-zinc-500">Transactions</div>
                  <div className="text-xl font-bold text-white">
                    {transactions.length}
                  </div>
                </GlassCardContent>
              </GlassCard>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1">
              {transactions.length === 0 ? (
                <div className="text-center text-zinc-600 py-12">
                  No transactions yet
                </div>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800"
                  >
                    <div>
                      <div className="font-medium">
                        {tx.amount} {tx.token}
                      </div>
                      <div className="text-xs text-zinc-600 font-mono">
                        {tx.from.slice(0, 8)}...{tx.from.slice(-4)}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant="outline"
                        className="border-green-500/30 text-green-400 text-xs"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Confirmed
                      </Badge>
                      <div className="text-xs text-zinc-600 mt-1">
                        {tx.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {mode === "settings" && (
          <div className="flex-1 flex flex-col px-4 pt-4">
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setMode("input")}
                className="p-2 rounded-lg hover:bg-zinc-800"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-bold">Terminal Settings</h2>
            </div>

            <div className="space-y-6 max-w-md">
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Merchant Name</label>
                <Input
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-400">
                  Receiving Wallet Address *
                </label>
                <Input
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="0x..."
                  className="bg-zinc-900 border-zinc-800 text-white font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Default Token</label>
                  <Select value={token} onValueChange={setToken}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
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
                  <label className="text-sm text-zinc-400">Network</label>
                  <Select value={network} onValueChange={setNetwork}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">Base</SelectItem>
                      <SelectItem value="eth">Ethereum</SelectItem>
                      <SelectItem value="arb">Arbitrum</SelectItem>
                      <SelectItem value="bnb">BNB Chain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  if (recipientAddress) {
                    // Save settings
                    try {
                      localStorage.setItem("pos_settings", JSON.stringify({
                        recipientAddress,
                        merchantName,
                        token,
                        network
                      }));
                    } catch {}

                    toast({ title: "Settings Saved" });
                    setMode("input");
                  } else {
                    toast({
                      title: "Wallet Address Required",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Save Settings
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TerminalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <TerminalContent />
    </Suspense>
  );
}
