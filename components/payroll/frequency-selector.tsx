"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FrequencyConfig, PayrollFrequency } from "@/types/payroll"
import { FREQUENCY_LABELS, DAY_OF_WEEK_LABELS } from "@/types/payroll"

interface FrequencySelectorProps {
  value: FrequencyConfig
  onChange: (config: FrequencyConfig) => void
  disabled?: boolean
}

export function FrequencySelector({
  value,
  onChange,
  disabled = false,
}: FrequencySelectorProps) {
  const updateField = <K extends keyof FrequencyConfig>(
    field: K,
    fieldValue: FrequencyConfig[K]
  ) => {
    onChange({ ...value, [field]: fieldValue })
  }

  return (
    <div className="space-y-4">
      {/* 周期类型 */}
      <div className="space-y-2">
        <Label>执行周期</Label>
        <Select
          value={value.type}
          onValueChange={(v) => updateField("type", v as PayrollFrequency)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 执行时间 */}
      <div className="space-y-2">
        <Label>执行时间</Label>
        <Input
          type="time"
          value={value.time || "09:00"}
          onChange={(e) => updateField("time", e.target.value)}
          disabled={disabled}
        />
      </div>

      {/* Weekly: 选择星期几 */}
      {value.type === "weekly" && (
        <div className="space-y-2">
          <Label>每周几</Label>
          <Select
            value={String(value.dayOfWeek ?? 1)}
            onValueChange={(v) => updateField("dayOfWeek", Number(v))}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_OF_WEEK_LABELS.map((label, index) => (
                <SelectItem key={index} value={String(index)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Biweekly: 起始日期 */}
      {value.type === "biweekly" && (
        <div className="space-y-2">
          <Label>起始日期</Label>
          <Input
            type="date"
            value={value.startDate || ""}
            onChange={(e) => updateField("startDate", e.target.value)}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            从此日期开始，每两周执行一次
          </p>
        </div>
      )}

      {/* Monthly: 选择日期 */}
      {value.type === "monthly" && (
        <div className="space-y-2">
          <Label>每月几号</Label>
          <Select
            value={String(value.dayOfMonth ?? 1)}
            onValueChange={(v) => updateField("dayOfMonth", Number(v))}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <SelectItem key={day} value={String(day)}>
                  {day} 号
                </SelectItem>
              ))}
              <SelectItem value="-1">最后一天</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Custom: Cron 表达式 */}
      {value.type === "custom" && (
        <div className="space-y-2">
          <Label>Cron 表达式</Label>
          <Input
            placeholder="0 9 1 * *"
            value={value.cronExpression || ""}
            onChange={(e) => updateField("cronExpression", e.target.value)}
            disabled={disabled}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            格式: 分 时 日 月 周 (例如: "0 9 1 * *" 表示每月1号9点)
          </p>
        </div>
      )}

      {/* 时区 */}
      <div className="space-y-2">
        <Label>时区</Label>
        <Select
          value={value.timezone || "UTC"}
          onValueChange={(v) => updateField("timezone", v)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UTC">UTC</SelectItem>
            <SelectItem value="Asia/Shanghai">北京时间 (UTC+8)</SelectItem>
            <SelectItem value="Asia/Tokyo">东京时间 (UTC+9)</SelectItem>
            <SelectItem value="America/New_York">纽约时间 (UTC-5)</SelectItem>
            <SelectItem value="America/Los_Angeles">洛杉矶时间 (UTC-8)</SelectItem>
            <SelectItem value="Europe/London">伦敦时间 (UTC+0)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
