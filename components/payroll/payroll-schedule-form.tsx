"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Trash2, Calendar, Users } from "lucide-react"
import { FrequencySelector } from "./frequency-selector"
import { SplitRecipientList } from "@/components/split-payment/split-recipient-list"
import type {
  PayrollSchedule,
  FrequencyConfig,
  ExecutionMode,
  PayrollSplitRule,
} from "@/types/payroll"
import type { SplitRecipient, AllocationMethod } from "@/types/split-payment"
import { EXECUTION_MODE_LABELS } from "@/types/payroll"

interface PayrollScheduleFormProps {
  walletAddress: string
  onSubmit: (schedule: Partial<PayrollSchedule>) => Promise<void>
  initialData?: Partial<PayrollSchedule>
  isLoading?: boolean
}

const SUPPORTED_TOKENS = ["USDC", "USDT", "DAI"]

export function PayrollScheduleForm({
  walletAddress,
  onSubmit,
  initialData,
  isLoading = false,
}: PayrollScheduleFormProps) {
  // 基本信息
  const [name, setName] = useState(initialData?.name || "")
  const [description, setDescription] = useState(initialData?.description || "")

  // 分账配置
  const [totalAmount, setTotalAmount] = useState<string>(
    initialData?.splitRule?.totalAmount?.toString() || ""
  )
  const [token, setToken] = useState(initialData?.splitRule?.token || "USDC")
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>(
    initialData?.splitRule?.mode || "percentage"
  )
  const [recipients, setRecipients] = useState<SplitRecipient[]>(
    initialData?.splitRule?.recipients || [
      { address: "", allocation: 50, name: "" },
      { address: "", allocation: 50, name: "" },
    ]
  )

  // 周期配置
  const [frequency, setFrequency] = useState<FrequencyConfig>(
    initialData?.frequency || {
      type: "monthly",
      dayOfMonth: 1,
      time: "09:00",
      timezone: "UTC",
    }
  )

  // 执行配置
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(
    initialData?.executionMode || "auto"
  )
  const [approverAddresses, setApproverAddresses] = useState<string[]>(
    initialData?.approverAddresses || []
  )
  const [maxAmount, setMaxAmount] = useState<string>(
    initialData?.maxAmountPerExecution?.toString() || ""
  )

  // 通知配置
  const [notifyEmail, setNotifyEmail] = useState(initialData?.notifyEmail || "")

  // 有效期
  const [startDate, setStartDate] = useState(initialData?.startDate || "")
  const [endDate, setEndDate] = useState(initialData?.endDate || "")

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("请输入计划名称")
      return
    }

    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      alert("请输入有效的总金额")
      return
    }

    const validRecipients = recipients.filter((r) => r.address)
    if (validRecipients.length === 0) {
      alert("请至少添加一个收款人")
      return
    }

    const splitRule: PayrollSplitRule = {
      totalAmount: parseFloat(totalAmount),
      token,
      chainId: 8453, // Base
      mode: allocationMethod,
      recipients: validRecipients,
    }

    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      splitRule,
      frequency,
      executionMode,
      approverAddresses: executionMode === "approval" ? approverAddresses : undefined,
      maxAmountPerExecution: maxAmount ? parseFloat(maxAmount) : undefined,
      notifyEmail: notifyEmail.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })
  }

  const addApprover = () => {
    setApproverAddresses([...approverAddresses, ""])
  }

  const removeApprover = (index: number) => {
    setApproverAddresses(approverAddresses.filter((_, i) => i !== index))
  }

  const updateApprover = (index: number, value: string) => {
    setApproverAddresses(
      approverAddresses.map((addr, i) => (i === index ? value : addr))
    )
  }

  return (
    <div className="space-y-6">
      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>计划名称 *</Label>
            <Input
              placeholder="例如: 团队月薪"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label>描述 (可选)</Label>
            <Textarea
              placeholder="添加备注..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* 分账配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">分账配置</CardTitle>
          <CardDescription>设置每次发薪的金额和收款人</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>总金额 *</Label>
              <Input
                type="number"
                placeholder="10000"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                disabled={isLoading}
                min={0}
                step={0.01}
              />
            </div>
            <div className="space-y-2">
              <Label>代币</Label>
              <Select value={token} onValueChange={setToken} disabled={isLoading}>
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

          <div className="space-y-2">
            <Label>分配模式</Label>
            <Tabs
              value={allocationMethod}
              onValueChange={(v) => setAllocationMethod(v as AllocationMethod)}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="percentage" disabled={isLoading}>
                  百分比
                </TabsTrigger>
                <TabsTrigger value="fixed" disabled={isLoading}>
                  固定金额
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <SplitRecipientList
            recipients={recipients}
            method={allocationMethod}
            onChange={setRecipients}
            disabled={isLoading}
          />
        </CardContent>
      </Card>

      {/* 周期配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            执行周期
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FrequencySelector
            value={frequency}
            onChange={setFrequency}
            disabled={isLoading}
          />
        </CardContent>
      </Card>

      {/* 执行模式 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            执行模式
          </CardTitle>
          <CardDescription>设置发薪时是否需要确认或审批</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>执行模式</Label>
            <Select
              value={executionMode}
              onValueChange={(v) => setExecutionMode(v as ExecutionMode)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXECUTION_MODE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {executionMode === "auto" && "到时间自动执行，无需人工干预"}
              {executionMode === "confirm" && "到时间后需要您手动确认才会执行"}
              {executionMode === "approval" && "到时间后需要审批人批准才会执行"}
            </p>
          </div>

          {/* 审批人列表 */}
          {executionMode === "approval" && (
            <div className="space-y-3">
              <Label>审批人地址</Label>
              {approverAddresses.map((addr, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="0x..."
                    value={addr}
                    onChange={(e) => updateApprover(index, e.target.value)}
                    disabled={isLoading}
                    className="font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeApprover(index)}
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addApprover}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                添加审批人
              </Button>
            </div>
          )}

          {/* 单次限额 */}
          <div className="space-y-2">
            <Label>单次执行限额 (可选)</Label>
            <Input
              type="number"
              placeholder="留空表示不限"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              disabled={isLoading}
              min={0}
            />
            <p className="text-xs text-muted-foreground">
              超过此金额将需要额外确认
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 通知与有效期 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">通知与有效期</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>通知邮箱 (可选)</Label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>开始日期 (可选)</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>结束日期 (可选)</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 提交按钮 */}
      <Button onClick={handleSubmit} disabled={isLoading} className="w-full" size="lg">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            保存中...
          </>
        ) : (
          "创建发薪计划"
        )}
      </Button>
    </div>
  )
}
