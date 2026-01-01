"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChainDistribution } from "@/types"

interface ChainDistributionProps {
  distributions: ChainDistribution[]
  className?: string
}

export function ChainDistributionCard({ distributions, className }: ChainDistributionProps) {
  const [expanded, setExpanded] = useState(false)

  if (!distributions || distributions.length === 0) {
    return null
  }

  return (
    <div className={cn("", className)}>
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>View by chain</span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {/* Expanded distribution */}
      {expanded && (
        <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          {distributions.map((chain) => (
            <div key={chain.chainKey} className="flex items-center gap-3">
              {/* Chain icon and name */}
              <div className="flex items-center gap-2 min-w-[100px]">
                <span className="text-sm">{chain.chainIcon}</span>
                <span className="text-xs text-muted-foreground">{chain.chainName}</span>
              </div>

              {/* Progress bar */}
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(chain.percentage, 100)}%` }}
                />
              </div>

              {/* Percentage and amount */}
              <div className="flex items-center gap-2 min-w-[120px] justify-end">
                <span className="text-xs font-medium">{chain.percentage.toFixed(1)}%</span>
                <span className="text-xs text-muted-foreground">
                  ${chain.balanceUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Compact inline version for the balance bar
export function ChainDistributionInline({ distributions }: { distributions: ChainDistribution[] }) {
  if (!distributions || distributions.length === 0) {
    return null
  }

  // Show top 2 chains inline
  const topChains = distributions.slice(0, 2)
  const remaining = distributions.length - 2

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {topChains.map((chain, idx) => (
        <span key={chain.chainKey} className="flex items-center gap-1">
          <span>{chain.chainIcon}</span>
          <span>{chain.percentage.toFixed(0)}%</span>
          {idx < topChains.length - 1 && <span className="text-border">·</span>}
        </span>
      ))}
      {remaining > 0 && <span className="text-muted-foreground/60">+{remaining} more</span>}
    </div>
  )
}
