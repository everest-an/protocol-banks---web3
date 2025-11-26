"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Info, TrendingDown, Percent } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { calculateFee, formatFee, getTierFromVolume, type UserTier, type FeeCalculation } from "@/lib/protocol-fees"

interface FeePreviewProps {
  amount: number
  walletAddress?: string
  tokenSymbol?: string
  showBreakdown?: boolean
  compact?: boolean
}

export function FeePreview({
  amount,
  walletAddress,
  tokenSymbol = "USDC",
  showBreakdown = true,
  compact = false,
}: FeePreviewProps) {
  const [feeData, setFeeData] = useState<FeeCalculation | null>(null)
  const [loading, setLoading] = useState(false)
  const [tier, setTier] = useState<UserTier>("standard")

  useEffect(() => {
    async function loadFee() {
      if (!amount || amount <= 0) {
        setFeeData(null)
        return
      }

      setLoading(true)
      try {
        const fee = await calculateFee(amount, walletAddress || "", tier)
        setFeeData(fee)

        // Update tier based on volume if wallet connected
        if (walletAddress) {
          const { getMonthlyVolume } = await import("@/lib/protocol-fees")
          const volume = await getMonthlyVolume(walletAddress)
          setTier(getTierFromVolume(volume))
        }
      } catch (error) {
        console.error("Error calculating fee:", error)
        // Set default fee data on error
        setFeeData({
          baseFee: amount * 0.001,
          discountAmount: 0,
          finalFee: Math.max(amount * 0.001, 0.5),
          feeRate: 0.001,
          volumeDiscount: 0,
          tierDiscount: 0,
        })
      } finally {
        setLoading(false)
      }
    }

    loadFee()
  }, [amount, walletAddress, tier])

  if (!feeData || amount <= 0) {
    return null
  }

  const hasDiscount = feeData.discountAmount > 0
  const effectiveRate = (feeData.finalFee / amount) * 100

  if (compact) {
    return (
      <div className="flex items-center justify-between text-sm py-2 px-3 bg-muted/50 rounded-md">
        <span className="text-muted-foreground">Protocol Fee:</span>
        <span className="font-medium">
          {formatFee(feeData.finalFee)}
          {hasDiscount && <span className="ml-1 text-xs text-green-600">(-{formatFee(feeData.discountAmount)})</span>}
        </span>
      </div>
    )
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Protocol Fee</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Protocol fees support platform security, development, and operations. Fees decrease with higher volume
                  and tier upgrades.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {tier !== "standard" && (
          <Badge variant="secondary" className="w-fit text-xs">
            {tier.charAt(0).toUpperCase() + tier.slice(1)} Tier
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {showBreakdown && (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaction Amount</span>
                <span>
                  {amount.toLocaleString()} {tokenSymbol}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base Fee ({(feeData.feeRate * 100).toFixed(1)}%)</span>
                <span>{formatFee(feeData.baseFee)}</span>
              </div>
              {hasDiscount && (
                <div className="flex justify-between text-sm text-green-600">
                  <span className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" />
                    Discount Applied
                  </span>
                  <span>-{formatFee(feeData.discountAmount)}</span>
                </div>
              )}
            </div>
            <Separator />
          </>
        )}

        <div className="flex justify-between items-center">
          <span className="font-medium">Total Fee</span>
          <div className="text-right">
            <div className="font-semibold text-lg">{formatFee(feeData.finalFee)}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
              <Percent className="h-3 w-3" />
              {effectiveRate.toFixed(3)}% effective rate
            </div>
          </div>
        </div>

        {hasDiscount && (
          <div className="bg-green-50 dark:bg-green-950/30 rounded-md p-2 text-xs text-green-700 dark:text-green-400">
            You saved {formatFee(feeData.discountAmount)} with your {tier} tier
            {feeData.volumeDiscount > 0 && " and volume"} discount!
          </div>
        )}
      </CardContent>
    </Card>
  )
}
