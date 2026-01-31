"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useDemo } from "@/contexts/demo-context"
import { useWeb3 } from "@/contexts/web3-context"
import { useVendors } from "@/hooks/use-vendors"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  ArrowLeft, 
  ExternalLink, 
  Send, 
  Edit, 
  Trash2, 
  Mail, 
  Building, 
  Wallet, 
  Calendar, 
  TrendingUp,
  Network,
  FileText,
  Copy,
  Check
} from "lucide-react"
import Link from "next/link"
import type { Vendor } from "@/types"

export default function VendorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isDemoMode } = useDemo()
  const { wallet, isConnected } = useWeb3()
  const vendorId = params.id as string
  const [copied, setCopied] = useState(false)

  const { vendors, loading, error } = useVendors({
    isDemoMode,
    walletAddress: wallet || undefined,
  })

  const vendor = useMemo(() => {
    return vendors.find((v) => v.id === vendorId)
  }, [vendors, vendorId])

  // Find related vendors (same parent or children)
  const relatedVendors = useMemo(() => {
    if (!vendor) return []
    return vendors.filter((v) => {
      if (v.id === vendor.id) return false
      // Children of this vendor
      if (v.parentId === vendor.id) return true
      // Siblings (same parent)
      if (vendor.parentId && v.parentId === vendor.parentId) return true
      return false
    }).slice(0, 5)
  }, [vendors, vendor])

  const handleCopyAddress = async () => {
    if (vendor?.wallet_address) {
      await navigator.clipboard.writeText(vendor.wallet_address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handlePaymentRequest = () => {
    if (vendor) {
      const url = `/batch-payment?recipient=${vendor.wallet_address}&name=${encodeURIComponent(vendor.company_name || vendor.name || "")}`
      router.push(url)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-6 px-4 max-w-5xl">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-6">
              <Skeleton className="h-48" />
              <Skeleton className="h-64" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-48" />
              <Skeleton className="h-32" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => router.push("/vendors")}>Back to Vendors</Button>
        </div>
      </div>
    )
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Vendor Not Found</h2>
          <p className="text-muted-foreground mb-4">The vendor you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => router.push("/vendors")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Vendors
          </Button>
        </div>
      </div>
    )
  }

  const tierColors = {
    subsidiary: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    partner: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    vendor: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  }

  return (
    <div className="min-h-screen bg-background">
      {!isConnected && !isDemoMode && (
        <div className="bg-indigo-600 text-white px-4 py-2 text-center text-sm font-medium">
          You are viewing a live demo. Connect your wallet to view your own vendors.
        </div>
      )}

      <div className="container mx-auto py-6 px-4 max-w-5xl">
        {/* Back Button */}
        <Button variant="ghost" size="sm" className="mb-6" onClick={() => router.push("/vendors")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Vendors
        </Button>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* Header Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <Avatar className="h-16 w-16 border-2 border-border">
                    <AvatarImage src={`https://avatar.vercel.sh/${vendor.wallet_address}`} />
                    <AvatarFallback className="text-lg">
                      {(vendor.company_name || vendor.name || "?").substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h1 className="text-2xl font-bold">{vendor.company_name || vendor.name || "Unknown"}</h1>
                      <Badge variant="outline" className={tierColors[vendor.tier || "vendor"]}>
                        {(vendor.tier || "vendor").toUpperCase()}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <Wallet className="h-4 w-4" />
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">
                        {vendor.wallet_address?.slice(0, 10)}...{vendor.wallet_address?.slice(-8)}
                      </code>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyAddress}>
                        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={handlePaymentRequest}>
                        <Send className="mr-2 h-4 w-4" />
                        Send Payment
                      </Button>
                      {vendor.wallet_address && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(`https://etherscan.io/address/${vendor.wallet_address}`, "_blank")
                          }
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View on Etherscan
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment Statistics</CardTitle>
                <CardDescription>Overview of payment activity with this entity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Volume</p>
                    <p className="text-2xl font-bold">
                      ${(vendor.monthly_volume || vendor.totalReceived || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Transactions</p>
                    <p className="text-2xl font-bold">{vendor.transaction_count || 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg. Transaction</p>
                    <p className="text-2xl font-bold">
                      $
                      {vendor.transaction_count && vendor.transaction_count > 0
                        ? Math.round(
                            (vendor.monthly_volume || vendor.totalReceived || 0) / vendor.transaction_count
                          ).toLocaleString()
                        : "0"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Chain</p>
                    <p className="text-2xl font-bold">{vendor.chain || "ETH"}</p>
                  </div>
                </div>

                {/* Mini Chart */}
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Payment Flow (YTD)</p>
                    <div className="flex items-center gap-1 text-xs text-emerald-500">
                      <TrendingUp className="h-3 w-3" />
                      <span>+12.4%</span>
                    </div>
                  </div>
                  <div className="h-16 flex items-end gap-1">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-primary/20 hover:bg-primary/30 transition-all rounded-t"
                        style={{ height: `${20 + ((i * 17) % 80)}%` }}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Entity Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Category</p>
                      <p className="font-medium">{vendor.category || "General"}</p>
                    </div>
                  </div>

                  {vendor.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <a href={`mailto:${vendor.email}`} className="font-medium text-primary hover:underline">
                          {vendor.email}
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Added</p>
                      <p className="font-medium">
                        {vendor.created_at
                          ? new Date(vendor.created_at).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  {vendor.parentId && (
                    <div className="flex items-start gap-3">
                      <Network className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Parent Entity</p>
                        <Link href={`/vendors/${vendor.parentId}`} className="font-medium text-primary hover:underline">
                          View Parent
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {vendor.notes && (
                  <div className="pt-4 border-t">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Notes</p>
                        <p className="text-sm">{vendor.notes}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start bg-transparent" onClick={handlePaymentRequest}>
                  <Send className="mr-2 h-4 w-4" />
                  Initiate Transfer
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                  <Link href={`/vendors?edit=${vendor.id}`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Details
                  </Link>
                </Button>
                {vendor.email && (
                  <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                    <a href={`mailto:${vendor.email}`}>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Email
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Related Entities */}
            {relatedVendors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Related Entities</CardTitle>
                  <CardDescription>Connected vendors and partners</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {relatedVendors.map((rv) => (
                      <Link
                        key={rv.id}
                        href={`/vendors/${rv.id}`}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={`https://avatar.vercel.sh/${rv.wallet_address}`} />
                          <AvatarFallback className="text-xs">
                            {(rv.company_name || rv.name || "?").substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{rv.company_name || rv.name}</p>
                          <p className="text-xs text-muted-foreground">{rv.tier || "vendor"}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Network Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Network Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm">Active Contract</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Last activity: {vendor.updated_at ? new Date(vendor.updated_at).toLocaleDateString() : "N/A"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
