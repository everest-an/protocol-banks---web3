"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, AlertTriangle, Info } from "lucide-react"
import type {
  SplitCalculation,
  SplitFeeBreakdown,
  SplitValidationResult,
  AllocationMethod,
} from "@/types/split-payment"

interface SplitPreviewProps {
  totalAmount: number
  token: string
  method: AllocationMethod
  calculation: SplitCalculation | null
  fees: SplitFeeBreakdown | null
  validation: SplitValidationResult | null
  isLoading?: boolean
}

export function SplitPreview({
  totalAmount,
  token,
  method,
  calculation,
  fees,
  validation,
  isLoading = false,
}: SplitPreviewProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-sm text-muted-foreground">计算中...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasErrors = validation && !validation.valid
  const hasWarnings = validation?.warnings && validation.warnings.length > 0

  return (
    <div className="space-y-4">
      {/* 验证状态 */}
      {validation && (
        <Card className={hasErrors ? "border-red-500" : hasWarnings ? "border-yellow-500" : "border-green-500"}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {hasErrors ? (
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
              ) : hasWarnings ? (
                <Info className="h-5 w-5 text-yellow-500 shrink-0" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              )}
              <div className="space-y-1">
                <p className="font-medium">
                  {hasErrors ? "验证失败" : hasWarnings ? "有警告信息" : "验证通过"}
                </p>
                {hasErrors && (
                  <ul className="text-sm text-red-600 space-y-1">
                    {validation.errors.map((err, i) => (
                      <li key={i}>{err.message}</li>
                    ))}
                  </ul>
                )}
                {hasWarnings && (
                  <ul className="text-sm text-yellow-600 space-y-1">
                    {validation.warnings.map((warn, i) => (
                      <li key={i}>{warn.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 分配预览 */}
      {calculation && calculation.valid && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              分账预览
              <Badge variant="outline">
                {method === "percentage" ? "百分比模式" : "固定金额模式"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 收款人列表 */}
            <div className="space-y-2">
              {calculation.recipients.map((r, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {r.name || `收款人 ${index + 1}`}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {r.address}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-medium">
                      {r.calculatedAmount.toFixed(2)} {token}
                    </p>
                    {method === "percentage" && (
                      <p className="text-xs text-muted-foreground">
                        {r.allocation}%
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 汇总 */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">总金额</span>
                <span className="font-medium">
                  {calculation.totalAmount.toFixed(2)} {token}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">分配总额</span>
                <span>
                  {calculation.allocatedTotal.toFixed(2)} {token}
                </span>
              </div>
              {calculation.roundingDifference !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">舍入调整</span>
                  <span className="text-yellow-600">
                    {calculation.roundingDifference > 0 ? "+" : ""}
                    {calculation.roundingDifference.toFixed(6)} {token}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 手续费预览 */}
      {fees && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">费用明细</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">支付金额</span>
              <span>
                {fees.totalAmount.toFixed(2)} {token}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                平台费用 ({(fees.platformFeeRate * 100).toFixed(1)}%)
              </span>
              <span>
                {fees.platformFee.toFixed(4)} {token}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">预估 Gas 费</span>
              <span>~{fees.estimatedGasFee.toFixed(6)} ETH</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-medium">
              <span>净支付金额</span>
              <span>
                {fees.netAmount.toFixed(2)} {token}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 无数据提示 */}
      {!calculation && !validation && (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-sm text-muted-foreground">
              添加收款人后将显示分账预览
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
