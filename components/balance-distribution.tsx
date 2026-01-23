"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChainDistribution } from "@/types"

interface BalanceDistributionProps {
  distribution: ChainDistribution[]
  totalUSD: number
  className?: string
}

// Chain colors
const CHAIN_COLORS: Record<string, string> = {
  Ethereum: "bg-[#627EEA]",
  Polygon: "bg-[#8247E5]",
  Arbitrum: "bg-[#28A0F0]",
  Base: "bg-[#0052FF]",
  Optimism: "bg-[#FF0420]",
  "BNB Chain": "bg-[#F0B90B]",
}

export function BalanceDistribution({ distribution = [], totalUSD = 0, className }: BalanceDistributionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Guard against undefined or empty distribution
  if (!distribution || distribution.length === 0) {
    return null
  }

  return (
    <div className={cn("", className)}>
      {/* Collapsed view - just show summary */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>
          {distribution.length} network{distribution.length !== 1 ? "s" : ""}
        </span>
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {/* Expanded view */}
      {isExpanded && (
        <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
          {/* Progress bar showing distribution */}
          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
            {distribution.map((chain, index) => (
              <div
                key={chain.chainId}
                className={cn("h-full transition-all", CHAIN_COLORS[chain.chain] || "bg-gray-500")}
                style={{ width: `${chain.percentage}%` }}
                title={`${chain.chain}: ${chain.percentage.toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Chain breakdown list */}
          <div className="space-y-1.5">
            {distribution.map((chain) => (
              <div key={chain.chainId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", CHAIN_COLORS[chain.chain] || "bg-gray-500")} />
                  <span className="text-muted-foreground">{chain.chain}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{chain.percentage.toFixed(1)}%</span>
                  <span className="font-mono text-foreground">
                    $
                    {chain.totalUSD.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
