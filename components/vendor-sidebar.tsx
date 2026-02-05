"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Users, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import type { Vendor } from "@/types/vendor"
import { getVendorDisplayName, getVendorInitials } from "@/lib/utils"

interface VendorSidebarProps {
  vendors: Vendor[]
  loading: boolean
}

export function VendorSidebar({ vendors, loading }: VendorSidebarProps) {
  // Sort vendors by total received (descending)
  const sortedVendors = [...vendors].sort((a, b) => (b.totalReceived || 0) - (a.totalReceived || 0))

  return (
    <Card className="bg-card border-border h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Supplier Details</CardTitle>
          <Link href="/vendors" className="text-xs text-primary hover:underline flex items-center">
            View All <ArrowUpRight className="ml-1 h-3 w-3" />
          </Link>
        </div>
        <CardDescription>Top suppliers by volume</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>
        ) : sortedVendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground">
            <Users className="h-8 w-8 mb-2 opacity-50" />
            <p>No suppliers found</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {sortedVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src={`https://avatar.vercel.sh/${vendor.wallet_address}`} />
                      <AvatarFallback>{getVendorInitials(vendor)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-medium text-sm truncate text-foreground">{getVendorDisplayName(vendor)}</span>
                      <span className="text-xs text-muted-foreground truncate font-mono">
                        {vendor.wallet_address.substring(0, 6)}...{vendor.wallet_address.substring(38)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-sm text-foreground">
                      ${(vendor.totalReceived || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Paid</div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
