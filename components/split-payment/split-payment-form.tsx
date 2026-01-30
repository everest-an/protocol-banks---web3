"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Loader2, Send, Save, FileText } from "lucide-react"
import { SplitRecipientList } from "./split-recipient-list"
import { SplitPreview } from "./split-preview"
import type {
  SplitRecipient,
  SplitPaymentRequest,
  SplitPaymentResponse,
  SplitCalculation,
  SplitFeeBreakdown,
  SplitValidationResult,
  AllocationMethod,
  SplitTemplate,
} from "@/types/split-payment"

interface SplitPaymentFormProps {
  walletAddress: string
  onSuccess?: (response: SplitPaymentResponse) => void
  onError?: (error: Error) => void
  defaultTemplate?: SplitTemplate
  chainId?: number
}

const SUPPORTED_TOKENS = ["USDC", "USDT", "DAI"]

export function SplitPaymentForm({
  walletAddress,
  onSuccess,
  onError,
  defaultTemplate,
  chainId = 8453,
}: SplitPaymentFormProps) {
  // Form state
  const [totalAmount, setTotalAmount] = useState<string>("")
  const [token, setToken] = useState<string>("USDC")
  const [method, setMethod] = useState<AllocationMethod>("percentage")
  const [recipients, setRecipients] = useState<SplitRecipient[]>([
    { address: "", allocation: 50, name: "" },
    { address: "", allocation: 50, name: "" },
  ])
  const [memo, setMemo] = useState<string>("")

  // Preview state
  const [preview, setPreview] = useState<{
    validation: SplitValidationResult | null
    calculation: SplitCalculation | null
    fees: SplitFeeBreakdown | null
  }>({ validation: null, calculation: null, fees: null })
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [result, setResult] = useState<SplitPaymentResponse | null>(null)

  // Load template if provided
  useEffect(() => {
    if (defaultTemplate) {
      setMethod(defaultTemplate.method)
      setToken(defaultTemplate.default_token)
      setRecipients(
        defaultTemplate.recipients.map((r) => ({
          address: r.address,
          allocation: r.allocation,
          name: r.name,
          memo: r.memo,
        }))
      )
    }
  }, [defaultTemplate])

  // Fetch preview when inputs change
  const fetchPreview = useCallback(async () => {
    if (!totalAmount || parseFloat(totalAmount) <= 0 || recipients.length === 0) {
      setPreview({ validation: null, calculation: null, fees: null })
      return
    }

    // Check if any recipient has valid data
    const hasValidRecipients = recipients.some((r) => r.address && r.allocation > 0)
    if (!hasValidRecipients) {
      setPreview({ validation: null, calculation: null, fees: null })
      return
    }

    setIsPreviewLoading(true)
    try {
      const response = await fetch("/api/split-payment/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: parseFloat(totalAmount),
          token,
          method,
          recipients: recipients.filter((r) => r.address),
        }),
      })

      const data = await response.json()
      setPreview({
        validation: data.validation,
        calculation: data.calculation,
        fees: data.fees,
      })
    } catch (error) {
      console.error("Preview error:", error)
    } finally {
      setIsPreviewLoading(false)
    }
  }, [totalAmount, token, method, recipients])

  // Debounced preview
  useEffect(() => {
    const timer = setTimeout(fetchPreview, 500)
    return () => clearTimeout(timer)
  }, [fetchPreview])

  // Execute split payment
  const handleExecute = async () => {
    if (!preview.validation?.valid) return

    setIsExecuting(true)
    setProgress({ current: 0, total: recipients.length })
    setResult(null)

    try {
      const request: SplitPaymentRequest = {
        totalAmount: parseFloat(totalAmount),
        token,
        method,
        recipients: recipients.filter((r) => r.address),
        chainId,
        memo,
      }

      const response = await fetch("/api/split-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...request,
          fromAddress: walletAddress,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "分账失败")
      }

      setResult(data)
      setProgress({ current: data.successCount, total: recipients.length })
      onSuccess?.(data)
    } catch (error) {
      console.error("Execute error:", error)
      onError?.(error instanceof Error ? error : new Error("分账失败"))
    } finally {
      setIsExecuting(false)
    }
  }

  // Save as template
  const handleSaveTemplate = async () => {
    const templateName = prompt("请输入模板名称:")
    if (!templateName) return

    try {
      const response = await fetch("/api/split-payment/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          method,
          recipients: recipients.filter((r) => r.address),
          defaultToken: token,
          ownerAddress: walletAddress,
        }),
      })

      if (response.ok) {
        alert("模板保存成功")
      } else {
        const data = await response.json()
        alert(data.error || "保存失败")
      }
    } catch (error) {
      console.error("Save template error:", error)
      alert("保存失败")
    }
  }

  const canExecute =
    preview.validation?.valid && !isExecuting && parseFloat(totalAmount) > 0

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 左侧：表单 */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>分账支付</CardTitle>
            <CardDescription>
              将一笔支付按百分比或固定金额分配给多个收款人
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 基本信息 */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>总金额</Label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  disabled={isExecuting}
                  min={0}
                  step={0.01}
                />
              </div>
              <div className="space-y-2">
                <Label>代币</Label>
                <Select value={token} onValueChange={setToken} disabled={isExecuting}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_TOKENS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 分配模式 */}
            <div className="space-y-2">
              <Label>分配模式</Label>
              <Tabs
                value={method}
                onValueChange={(v) => setMethod(v as AllocationMethod)}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="percentage" disabled={isExecuting}>
                    百分比
                  </TabsTrigger>
                  <TabsTrigger value="fixed" disabled={isExecuting}>
                    固定金额
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* 收款人列表 */}
            <SplitRecipientList
              recipients={recipients}
              method={method}
              onChange={setRecipients}
              disabled={isExecuting}
              errors={
                preview.validation?.errors.reduce((acc, err) => {
                  if (err.index !== undefined) {
                    acc[err.index] = err.message
                  }
                  return acc
                }, {} as Record<number, string>) || {}
              }
            />

            {/* 备注 */}
            <div className="space-y-2">
              <Label>备注 (可选)</Label>
              <Input
                placeholder="添加备注信息..."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                disabled={isExecuting}
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <Button
                onClick={handleExecute}
                disabled={!canExecute}
                className="flex-1"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    执行分账
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleSaveTemplate}
                disabled={isExecuting || recipients.length === 0}
              >
                <Save className="mr-2 h-4 w-4" />
                保存模板
              </Button>
            </div>

            {/* 执行进度 */}
            {isExecuting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>执行进度</span>
                  <span>
                    {progress.current} / {progress.total}
                  </span>
                </div>
                <Progress value={(progress.current / progress.total) * 100} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 执行结果 */}
        {result && (
          <Card className={result.status === "completed" ? "border-green-500" : "border-yellow-500"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                执行结果
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">状态</span>
                <span
                  className={
                    result.status === "completed"
                      ? "text-green-600"
                      : result.status === "partial"
                        ? "text-yellow-600"
                        : "text-red-600"
                  }
                >
                  {result.status === "completed"
                    ? "全部成功"
                    : result.status === "partial"
                      ? "部分成功"
                      : "失败"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">成功/失败</span>
                <span>
                  {result.successCount} / {result.failedCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">实际支付</span>
                <span>
                  {result.paidAmount.toFixed(2)} {token}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 右侧：预览 */}
      <div className="space-y-6">
        <SplitPreview
          totalAmount={parseFloat(totalAmount) || 0}
          token={token}
          method={method}
          calculation={preview.calculation}
          fees={preview.fees}
          validation={preview.validation}
          isLoading={isPreviewLoading}
        />
      </div>
    </div>
  )
}
