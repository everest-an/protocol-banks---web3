/**
 * Network Badge Component
 * Displays a network name with appropriate styling
 */

import { Badge } from "@/components/ui/badge"
import { ALL_NETWORKS } from "@/lib/networks"

interface NetworkBadgeProps {
  network: string
  className?: string
  showIcon?: boolean
}

export function NetworkBadge({ network, className = "", showIcon = false }: NetworkBadgeProps) {
  const getNetworkColor = (network: string) => {
    if (network === "tron" || network === "tron-nile") return "bg-red-500 hover:bg-red-600"
    if (network === "ethereum" || network === "sepolia") return "bg-blue-500 hover:bg-blue-600"
    if (network === "base") return "bg-blue-600 hover:bg-blue-700"
    if (network === "arbitrum") return "bg-cyan-500 hover:bg-cyan-600"
    if (network === "bsc") return "bg-yellow-500 hover:bg-yellow-600"
    return "bg-gray-500 hover:bg-gray-600"
  }

  const getNetworkName = (network: string) => {
    return ALL_NETWORKS[network]?.name || network.toUpperCase()
  }

  const getNetworkIcon = (network: string) => {
    // You can add network icons here
    const icons: Record<string, string> = {
      tron: "⚡",
      ethereum: "Ξ",
      base: "🔷",
      arbitrum: "◆",
      bsc: "🔸",
    }
    return icons[network] || "🌐"
  }

  return (
    <Badge className={`${getNetworkColor(network)} text-white ${className}`}>
      {showIcon && <span className="mr-1">{getNetworkIcon(network)}</span>}
      {getNetworkName(network)}
    </Badge>
  )
}
