"use client"

import { useState } from "react"
import { Plus, Trash2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import type { SplitRecipient, AllocationMethod } from "@/types/split-payment"

interface SplitRecipientListProps {
  recipients: SplitRecipient[]
  method: AllocationMethod
  onChange: (recipients: SplitRecipient[]) => void
  errors?: Record<number, string>
  disabled?: boolean
}

export function SplitRecipientList({
  recipients,
  method,
  onChange,
  errors = {},
  disabled = false,
}: SplitRecipientListProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  const addRecipient = () => {
    const newRecipient: SplitRecipient = {
      address: "",
      allocation: method === "percentage" ? 0 : 0,
      name: "",
    }
    onChange([...recipients, newRecipient])
  }

  const removeRecipient = (index: number) => {
    const updated = recipients.filter((_, i) => i !== index)
    onChange(updated)
  }

  const updateRecipient = (index: number, field: keyof SplitRecipient, value: string | number) => {
    const updated = recipients.map((r, i) => {
      if (i !== index) return r
      return { ...r, [field]: value }
    })
    onChange(updated)
  }

  const totalAllocation = recipients.reduce((sum, r) => sum + (r.allocation || 0), 0)
  const isPercentageValid = method === "percentage" ? Math.abs(totalAllocation - 100) < 0.01 : true

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">
          收款人列表 ({recipients.length})
        </Label>
        {method === "percentage" && (
          <span className={`text-sm ${isPercentageValid ? "text-green-600" : "text-red-500"}`}>
            总计: {totalAllocation.toFixed(2)}%
            {!isPercentageValid && " (必须为 100%)"}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {recipients.map((recipient, index) => (
          <Card
            key={index}
            className={`${errors[index] ? "border-red-500" : ""} ${
              focusedIndex === index ? "ring-2 ring-primary/20" : ""
            }`}
          >
            <CardContent className="p-4">
              <div className="grid gap-4 md:grid-cols-12">
                {/* 地址 */}
                <div className="md:col-span-5">
                  <Label className="text-xs text-muted-foreground">钱包地址</Label>
                  <Input
                    placeholder="0x..."
                    value={recipient.address}
                    onChange={(e) => updateRecipient(index, "address", e.target.value)}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    disabled={disabled}
                    className="mt-1 font-mono text-sm"
                  />
                </div>

                {/* 分配值 */}
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">
                    {method === "percentage" ? "百分比" : "金额"}
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      placeholder={method === "percentage" ? "10" : "100"}
                      value={recipient.allocation || ""}
                      onChange={(e) =>
                        updateRecipient(index, "allocation", parseFloat(e.target.value) || 0)
                      }
                      onFocus={() => setFocusedIndex(index)}
                      onBlur={() => setFocusedIndex(null)}
                      disabled={disabled}
                      min={0}
                      step={method === "percentage" ? 0.01 : 1}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {method === "percentage" ? "%" : ""}
                    </span>
                  </div>
                </div>

                {/* 名称（可选） */}
                <div className="md:col-span-3">
                  <Label className="text-xs text-muted-foreground">名称 (可选)</Label>
                  <Input
                    placeholder="收款人名称"
                    value={recipient.name || ""}
                    onChange={(e) => updateRecipient(index, "name", e.target.value)}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    disabled={disabled}
                    className="mt-1"
                  />
                </div>

                {/* 删除按钮 */}
                <div className="md:col-span-2 flex items-end justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRecipient(index)}
                    disabled={disabled || recipients.length <= 1}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* 错误提示 */}
              {errors[index] && (
                <div className="mt-2 flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  {errors[index]}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 添加按钮 */}
      <Button
        variant="outline"
        onClick={addRecipient}
        disabled={disabled}
        className="w-full border-dashed"
      >
        <Plus className="mr-2 h-4 w-4" />
        添加收款人
      </Button>

      {/* 快速分配 */}
      {method === "percentage" && recipients.length > 1 && (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const equalShare = 100 / recipients.length
              onChange(recipients.map((r) => ({ ...r, allocation: equalShare })))
            }}
            disabled={disabled}
            className="text-xs"
          >
            平均分配
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const remaining = 100 - totalAllocation
              if (remaining > 0 && recipients.length > 0) {
                const lastIndex = recipients.length - 1
                onChange(
                  recipients.map((r, i) =>
                    i === lastIndex ? { ...r, allocation: r.allocation + remaining } : r
                  )
                )
              }
            }}
            disabled={disabled || isPercentageValid}
            className="text-xs"
          >
            补齐至 100%
          </Button>
        </div>
      )}
    </div>
  )
}
