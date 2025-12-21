"use client"

import { useState, useEffect } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Wallet, Plus, ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { NetworkGraph } from "@/components/network-graph"
import { getSupabase } from "@/lib/supabase"

interface Vendor {
  id: string
  wallet_address: string
  name: string
  email: string
  category?: string
  notes?: string
  tier?: "subsidiary" | "partner" | "vendor"
  parentId?: string
  totalReceived?: number
  transactionCount?: number
}

export default function HomePage() {
  const { isConnected, connectWallet, wallet, usdtBalance, usdcBalance, daiBalance } = useWeb3()
  const isDemoMode = !isConnected
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loadingVendors, setLoadingVendors] = useState(true)

  const totalBalance =
    Number.parseFloat(usdtBalance || "0") + Number.parseFloat(usdcBalance || "0") + Number.parseFloat(daiBalance || "0")

  const demoBalance = {
    usdc: "12,450.00",
    usdt: "8,320.50",
    dai: "3,200.00",
    total: "23,970.50",
  }

  const displayBalance = isDemoMode
    ? demoBalance.total
    : totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  useEffect(() => {
    loadVendors()
  }, [isConnected, wallet])

  const loadVendors = async () => {
    setLoadingVendors(true)
    try {
      if (isDemoMode) {
        setVendors([
          // === SUBSIDIARIES ===
          {
            id: "sub-1",
            wallet_address: "0x1111...aaaa",
            name: "APAC DIVISION",
            email: "apac@protocol.bank",
            category: "Regional HQ",
            tier: "subsidiary",
            totalReceived: 1372857,
            transactionCount: 168,
          },
          {
            id: "sub-2",
            wallet_address: "0x2222...bbbb",
            name: "NORTH AMERICA H",
            email: "na@protocol.bank",
            category: "Regional HQ",
            tier: "subsidiary",
            totalReceived: 2100000,
            transactionCount: 142,
          },
          {
            id: "sub-3",
            wallet_address: "0x3333...cccc",
            name: "EMEA OPERATIONS",
            email: "emea@protocol.bank",
            category: "Regional HQ",
            tier: "subsidiary",
            totalReceived: 890000,
            transactionCount: 95,
          },
          // === PARTNERS ===
          {
            id: "partner-1",
            wallet_address: "0x5555...eeee",
            name: "SALESFORCE",
            email: "billing@salesforce.com",
            category: "CRM",
            tier: "partner",
            parentId: "sub-1",
            totalReceived: 450000,
            transactionCount: 28,
          },
          {
            id: "partner-2",
            wallet_address: "0x6666...ffff",
            name: "SLACK",
            email: "finance@slack.com",
            category: "Communication",
            tier: "partner",
            parentId: "sub-1",
            totalReceived: 120000,
            transactionCount: 12,
          },
          {
            id: "partner-3",
            wallet_address: "0x7777...0000",
            name: "VENTURES LAB",
            email: "treasury@ventures.io",
            category: "Investment",
            tier: "partner",
            parentId: "sub-1",
            totalReceived: 620000,
            transactionCount: 34,
          },
          {
            id: "partner-4",
            wallet_address: "0x8888...1111",
            name: "GOOGLE CLOUD",
            email: "billing@google.com",
            category: "Infrastructure",
            tier: "partner",
            parentId: "sub-2",
            totalReceived: 380000,
            transactionCount: 22,
          },
          {
            id: "partner-5",
            wallet_address: "0x9999...2222",
            name: "WEWORK",
            email: "accounts@wework.com",
            category: "Real Estate",
            tier: "partner",
            parentId: "sub-2",
            totalReceived: 195000,
            transactionCount: 15,
          },
          {
            id: "partner-6",
            wallet_address: "0xaaaa...3333",
            name: "STRIPE",
            email: "partners@stripe.com",
            category: "Payments",
            tier: "partner",
            parentId: "sub-2",
            totalReceived: 240000,
            transactionCount: 18,
          },
          {
            id: "partner-7",
            wallet_address: "0xbbbb...4444",
            name: "CLOUDFLARE",
            email: "enterprise@cloudflare.com",
            category: "Security",
            tier: "partner",
            parentId: "sub-2",
            totalReceived: 175000,
            transactionCount: 8,
          },
          // === VENDORS ===
          {
            id: "vendor-1",
            wallet_address: "0xf001...v001",
            name: "VENDOR PRDOB LT",
            email: "ap@vendor1.com",
            category: "Supplies",
            tier: "vendor",
            parentId: "partner-6",
            totalReceived: 45000,
            transactionCount: 12,
          },
          {
            id: "vendor-2",
            wallet_address: "0xf002...v002",
            name: "VENDOR EL3GF LT",
            email: "billing@vendor2.com",
            category: "Services",
            tier: "vendor",
            parentId: "partner-6",
            totalReceived: 28000,
            transactionCount: 8,
          },
          {
            id: "vendor-3",
            wallet_address: "0xf003...v003",
            name: "VENDOR LT",
            email: "accounts@vendor3.com",
            category: "Logistics",
            tier: "vendor",
            parentId: "partner-7",
            totalReceived: 62000,
            transactionCount: 45,
          },
          {
            id: "vendor-4",
            wallet_address: "0xf004...v004",
            name: "VENDOR 47VF5 LT",
            email: "finance@vendor4.com",
            category: "Hardware",
            tier: "vendor",
            parentId: "partner-7",
            totalReceived: 85000,
            transactionCount: 14,
          },
          {
            id: "vendor-5",
            wallet_address: "0xf005...v005",
            name: "VENDOR VNP2L LT",
            email: "pay@vendor5.com",
            category: "Software",
            tier: "vendor",
            parentId: "partner-7",
            totalReceived: 35000,
            transactionCount: 4,
          },
          {
            id: "vendor-6",
            wallet_address: "0xf006...v006",
            name: "VENDOR SI667 LT",
            email: "ar@vendor6.com",
            category: "Consulting",
            tier: "vendor",
            parentId: "partner-7",
            totalReceived: 48000,
            transactionCount: 16,
          },
          {
            id: "vendor-7",
            wallet_address: "0xf007...v007",
            name: "VENDOR EUSWJ LT",
            email: "sales@vendor7.com",
            category: "Marketing",
            tier: "vendor",
            parentId: "partner-4",
            totalReceived: 92000,
            transactionCount: 24,
          },
          {
            id: "vendor-8",
            wallet_address: "0xf008...v008",
            name: "VENDOR BKWFM LT",
            email: "contact@vendor8.com",
            category: "Support",
            tier: "vendor",
            parentId: "partner-4",
            totalReceived: 55000,
            transactionCount: 6,
          },
          {
            id: "vendor-9",
            wallet_address: "0xf009...v009",
            name: "EIR LT",
            email: "info@vendor9.com",
            category: "Legal",
            tier: "vendor",
            parentId: "partner-5",
            totalReceived: 125000,
            transactionCount: 3,
          },
        ])
      } else if (wallet) {
        const supabase = getSupabase()
        const { data } = await supabase
          .from("vendors")
          .select("*")
          .eq("user_address", wallet.toLowerCase())
          .order("created_at", { ascending: false })

        if (data) {
          setVendors(
            data.map((v) => ({
              ...v,
              totalReceived: Math.random() * 50000,
              transactionCount: Math.floor(Math.random() * 20),
            })),
          )
        }
      }
    } catch (error) {
      console.error("Failed to load vendors:", error)
    } finally {
      setLoadingVendors(false)
    }
  }

  return (
    <main className="container mx-auto py-4 px-4 max-w-7xl">
      {/* Balance Bar */}
      <div className="mb-4 p-3 rounded-lg bg-card border border-border">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 sm:gap-6">
            <div>
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="text-xl sm:text-2xl font-bold font-mono">${displayBalance}</div>
            </div>
            <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-border text-xs">
              <span className="text-muted-foreground">
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-0 mr-1">
                  USDC
                </Badge>
                {isDemoMode ? demoBalance.usdc : Number(usdcBalance || 0).toLocaleString()}
              </span>
              <span className="text-muted-foreground">
                <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-0 mr-1">
                  USDT
                </Badge>
                {isDemoMode ? demoBalance.usdt : Number(usdtBalance || 0).toLocaleString()}
              </span>
              <span className="text-muted-foreground">
                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-0 mr-1">
                  DAI
                </Badge>
                {isDemoMode ? demoBalance.dai : Number(daiBalance || 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {!isConnected ? (
              <Button onClick={connectWallet} size="sm">
                <Wallet className="mr-2 h-4 w-4" />
                Connect
              </Button>
            ) : (
              <>
                <Button variant="default" size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
                <Button variant="outline" size="sm" className="bg-transparent">
                  <ArrowUpRight className="mr-1 h-4 w-4" />
                  Withdraw
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Global Payment Mesh - Full Width */}
      <Card className="bg-card border-border overflow-hidden">
        <CardContent className="p-0">
          {loadingVendors ? (
            <div className="h-[600px] flex items-center justify-center text-muted-foreground bg-[#0a0a0f]">
              Loading network data...
            </div>
          ) : (
            <div style={{ height: "600px" }}>
              <NetworkGraph
                vendors={vendors}
                userAddress={wallet || "Protocol Banks HQ"}
                onPaymentRequest={(vendor) => {
                  window.location.href = `/batch-payment?to=${vendor.wallet_address}&name=${encodeURIComponent(vendor.name)}`
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
