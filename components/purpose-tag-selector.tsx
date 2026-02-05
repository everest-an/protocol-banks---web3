"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { PAYMENT_PURPOSES, PURPOSE_COLORS } from "@/lib/payment-constants"

interface PurposeTagSelectorProps {
  value?: string
  onChange: (purpose: string) => void
  showCustomInput?: boolean
}

export function PurposeTagSelector({ value, onChange, showCustomInput = true }: PurposeTagSelectorProps) {
  const [customValue, setCustomValue] = useState("")
  const isCustom = value && !PAYMENT_PURPOSES.some((p) => p.value === value)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PAYMENT_PURPOSES.map((purpose) => {
          const isSelected = value === purpose.value
          const colorClass = PURPOSE_COLORS[purpose.value] || PURPOSE_COLORS.other
          return (
            <Badge
              key={purpose.value}
              variant="outline"
              className={`cursor-pointer transition-all ${
                isSelected
                  ? colorClass + " ring-1 ring-current"
                  : "hover:bg-muted"
              }`}
              onClick={() => onChange(isSelected ? "" : purpose.value)}
            >
              {purpose.label}
            </Badge>
          )
        })}
      </div>
      {showCustomInput && (
        <div className="flex gap-2">
          <Input
            placeholder="Custom purpose..."
            value={isCustom ? value : customValue}
            onChange={(e) => {
              setCustomValue(e.target.value)
              if (e.target.value) {
                onChange(e.target.value)
              }
            }}
            className="h-8 text-sm"
          />
        </div>
      )}
    </div>
  )
}
