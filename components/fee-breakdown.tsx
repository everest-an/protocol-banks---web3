"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SettlementMethodBadge } from "./settlement-method-badge"

interface FeeBreakdownProps {
  amount: number
  chainId: number
  token: string
}

export function FeeBreakdown({ amount, chainId, token }: FeeBreakdownProps) {
  const isCDP = chainId === 8453 // Base chain
  const feeRate = isCDP ? 0 : 0.001 // 0.1% for non-Base chains
  const fee = amount * feeRate
  const total = amount + fee

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          Fee Breakdown
          <SettlementMethodBadge method={isCDP ? "cdp" : "relayer"} chainId={chainId} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Amount</span>
          <span>
            {amount.toFixed(2)} {token}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Network Fee</span>
          <span className={isCDP ? "text-green-500" : ""}>
            {isCDP ? "0.00" : fee.toFixed(6)} {token}
          </span>
        </div>
        <div className="border-t pt-2 flex justify-between font-medium">
          <span>Total</span>
          <span>
            {total.toFixed(2)} {token}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
