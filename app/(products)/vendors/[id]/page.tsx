"use client"

import { useState, useEffect, use } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Send, Copy, ExternalLink, Building2, Mail, Calendar, Wallet, TrendingUp, Activity, History } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { authHeaders } from "@/lib/authenticated-fetch"
import { useToast } from "@/hooks/use-toast"
import type { Vendor } from "@/types/vendor"
import { getVendorDisplayName } from "@/lib/utils"

// Demo data for when vendor is not found in database
const demoVendors: Record<string, Vendor> = {
  "root": {
    id: "root",
    company_name: "Protocol Bank HQ",
    name: "Protocol Bank HQ",
    wallet_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD73",
    contact_email: "treasury@protocolbank.io",
    email: "treasury@protocolbank.io",
    notes: "Main treasury wallet for Protocol Bank operations",
    created_at: new Date().toISOString(),
    totalReceived: 2500000,
    transaction_count: 450,
    category: "Internal",
    tier: "subsidiary",
    chain: "Ethereum",
  },
  "apac-division": {
    id: "apac-division",
    company_name: "APAC Division",
    name: "APAC Division",
    wallet_address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
    contact_email: "apac@protocolbank.io",
    email: "apac@protocolbank.io",
    notes: "Asia-Pacific regional operations",
    created_at: new Date().toISOString(),
    totalReceived: 850000,
    transaction_count: 120,
    category: "Internal",
    tier: "subsidiary",
    chain: "Ethereum",
  },
  "emea-operations": {
    id: "emea-operations",
    company_name: "EMEA Operations",
    name: "EMEA Operations",
    wallet_address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    contact_email: "emea@protocolbank.io",
    email: "emea@protocolbank.io",
    notes: "Europe, Middle East, and Africa operations",
    created_at: new Date().toISOString(),
    totalReceived: 720000,
    transaction_count: 95,
    category: "Internal",
    tier: "subsidiary",
    chain: "Ethereum",
  },
}

// Mock transaction history
const mockTransactions = [
  { id: "tx1", type: "received", amount: 50000, from: "0x123...abc", date: "2025-12-15", status: "confirmed" },
  { id: "tx2", type: "sent", amount: 25000, to: "0x456...def", date: "2025-12-10", status: "confirmed" },
  { id: "tx3", type: "received", amount: 100000, from: "0x789...ghi", date: "2025-12-05", status: "confirmed" },
  { id: "tx4", type: "sent", amount: 15000, to: "0xabc...jkl", date: "2025-11-28", status: "confirmed" },
  { id: "tx5", type: "received", amount: 75000, from: "0xdef...mno", date: "2025-11-20", status: "confirmed" },
]

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { address: wallet } = useUnifiedWallet()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchVendor = async () => {
      setLoading(true)
      
      // First check demo data
      if (demoVendors[id]) {
        setVendor(demoVendors[id])
        setLoading(false)
        return
      }

      // Then try database via API if connected
      if (wallet && !isDemoMode) {
        try {
          const res = await fetch(`/api/vendors/${id}`, {
            headers: authHeaders(wallet),
          })
          if (res.ok) {
            const data = await res.json()
            const vendorData = data.vendor || data
            if (vendorData && vendorData.id) {
              setVendor(vendorData)
              setLoading(false)
              return
            }
          }
        } catch (error) {
          console.error("Error fetching vendor:", error)
        }
      }

      // If not found anywhere, show not found state
      setVendor(null)
      setLoading(false)
    }

    fetchVendor()
  }, [id, wallet, isDemoMode])

  const copyAddress = () => {
    if (vendor?.wallet_address) {
      navigator.clipboard.writeText(vendor.wallet_address)
      toast({
        title: "Copied",
        description: "Wallet address copied to clipboard",
      })
    }
  }

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case "subsidiary":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
      case "partner":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-muted" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <GlassCard className="max-w-md w-full mx-4">
          <GlassCardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Vendor Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The vendor with ID "{id}" could not be found.
            </p>
            <Link href="/vendors">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Contacts
              </Button>
            </Link>
          </GlassCardContent>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl pb-24 md:pb-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/vendors">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold">{getVendorDisplayName(vendor)}</h1>
              <Badge variant="outline" className={getTierColor(vendor.tier)}>
                {vendor.tier || "vendor"}
              </Badge>
            </div>
            <p className="text-muted-foreground">{vendor.category}</p>
          </div>
          <Link href={`/send?to=${vendor.wallet_address}`}>
            <Button>
              <Send className="w-4 h-4 mr-2" />
              Send Payment
            </Button>
          </Link>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Wallet Info */}
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Wallet Information
                </GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Wallet Address</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-muted px-3 py-2 rounded-lg font-mono text-sm break-all">
                      {vendor.wallet_address}
                    </code>
                    <Button variant="ghost" size="icon" onClick={copyAddress}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <a
                      href={`https://etherscan.io/address/${vendor.wallet_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="icon">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Network</label>
                    <p className="font-medium">{vendor.chain || "Ethereum"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Created</label>
                    <p className="font-medium">
                      {vendor.created_at ? new Date(vendor.created_at).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* Contact Info */}
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Contact Information
                </GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Email</label>
                  <p className="font-medium">{vendor.contact_email || vendor.email || "Not provided"}</p>
                </div>
                {vendor.notes && (
                  <div>
                    <label className="text-sm text-muted-foreground">Notes</label>
                    <p className="text-foreground">{vendor.notes}</p>
                  </div>
                )}
              </GlassCardContent>
            </GlassCard>

            {/* Recent Transactions */}
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Recent Transactions
                </GlassCardTitle>
                <GlassCardDescription>Last 5 transactions with this entity</GlassCardDescription>
              </GlassCardHeader>
              <GlassCardContent>
                <div className="space-y-3">
                  {mockTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            tx.type === "received"
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                          }`}
                        >
                          {tx.type === "received" ? "↓" : "↑"}
                        </div>
                        <div>
                          <p className="font-medium">
                            {tx.type === "received" ? "Received" : "Sent"}
                          </p>
                          <p className="text-xs text-muted-foreground">{tx.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono font-medium ${
                          tx.type === "received" ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                        }`}>
                          {tx.type === "received" ? "+" : "-"}${tx.amount.toLocaleString()}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCardContent>
            </GlassCard>
          </div>

          {/* Right Column - Stats */}
          <div className="space-y-6">
            {/* Financial Summary */}
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Financial Summary
                </GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Total Received</p>
                  <p className="text-2xl font-bold font-mono">
                    ${(vendor.totalReceived || 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Transaction Count</p>
                  <p className="text-2xl font-bold font-mono">
                    {vendor.transaction_count || 0}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Average Transaction</p>
                  <p className="text-2xl font-bold font-mono">
                    ${vendor.transaction_count && vendor.totalReceived
                      ? Math.round(vendor.totalReceived / vendor.transaction_count).toLocaleString()
                      : 0}
                  </p>
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* Activity Status */}
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Activity Status
                </GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent>
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-green-600 dark:text-green-400 font-medium">Active</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Last transaction: 2 days ago
                </p>
              </GlassCardContent>
            </GlassCard>

            {/* Quick Actions */}
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle>Quick Actions</GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent className="space-y-2">
                <Link href={`/send?to=${vendor.wallet_address}`} className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Send className="w-4 h-4 mr-2" />
                    Send Payment
                  </Button>
                </Link>
                <Link href={`/batch-payment?recipients=${vendor.wallet_address}`} className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Payment
                  </Button>
                </Link>
                <Link href={`/history?address=${vendor.wallet_address}`} className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <History className="w-4 h-4 mr-2" />
                    View Full History
                  </Button>
                </Link>
              </GlassCardContent>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  )
}
