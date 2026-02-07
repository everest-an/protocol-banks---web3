/**
 * Vendor Address List Component
 * Read-only display of vendor's multi-network addresses
 */

import { NetworkBadge } from "./network-badge"
import { Star, Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface VendorAddress {
  id: string
  network: string
  address: string
  label?: string
  isPrimary: boolean
  verifiedAt?: string
}

interface VendorAddressListProps {
  addresses: VendorAddress[]
  showCopy?: boolean
  compact?: boolean
}

export function VendorAddressList({
  addresses,
  showCopy = true,
  compact = false,
}: VendorAddressListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyToClipboard = async (address: string, id: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const formatAddress = (address: string) => {
    if (address.length <= 12) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  if (addresses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        No addresses available
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {addresses.map(addr => (
          <div
            key={addr.id}
            className="flex items-center space-x-2 rounded-md border px-3 py-1.5"
          >
            <NetworkBadge network={addr.network} />
            <code className="text-xs font-mono">{formatAddress(addr.address)}</code>
            {addr.isPrimary && (
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {addresses.map(addr => (
        <div
          key={addr.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="flex items-center space-x-3">
            <NetworkBadge network={addr.network} />
            <div>
              <div className="flex items-center space-x-2">
                <code className="text-sm font-mono">{addr.address}</code>
                {addr.isPrimary && (
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                )}
                {addr.verifiedAt && (
                  <Check className="h-4 w-4 text-green-500" />
                )}
              </div>
              {addr.label && (
                <p className="text-xs text-muted-foreground">{addr.label}</p>
              )}
            </div>
          </div>
          {showCopy && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(addr.address, addr.id)}
            >
              {copiedId === addr.id ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
