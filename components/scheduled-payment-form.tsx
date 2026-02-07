"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Calendar, Clock, AlertCircle, CheckCircle2 } from "lucide-react"
import type { ScheduleType, ScheduleConfig, ScheduledRecipient } from "@/types/scheduled-payment"
import { getScheduleDescription } from "@/types/scheduled-payment"

interface ScheduledPaymentFormProps {
  userAddress: string
  onSuccess?: () => void
}

const TOKENS = ["USDT", "USDC", "DAI", "HSK"]
const SCHEDULE_TYPES: { value: ScheduleType; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "bi-weekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
]

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

export function ScheduledPaymentForm({ userAddress, onSuccess }: ScheduledPaymentFormProps) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const [token, setToken] = useState("USDT")
  const [scheduleType, setScheduleType] = useState<ScheduleType>("monthly")
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    day_of_month: 1,
    time: "09:00",
  })
  const [recipients, setRecipients] = useState<ScheduledRecipient[]>([
    { address: "", amount: "0", vendorName: "" },
  ])
  const [creating, setCreating] = useState(false)

  // Calculate totals
  const totalRecipientAmount = useMemo(() => {
    return recipients.reduce((sum, r) => sum + parseFloat(r.amount || "0"), 0)
  }, [recipients])

  const hasValidAddresses = recipients.every(
    (r) => r.address && r.address.startsWith("0x") && r.address.length === 42
  )

  const canCreate =
    name &&
    totalAmount > 0 &&
    hasValidAddresses &&
    recipients.length >= 1 &&
    Math.abs(totalAmount - totalRecipientAmount) < 0.01

  const addRecipient = () => {
    setRecipients([...recipients, { address: "", amount: "0", vendorName: "" }])
  }

  const removeRecipient = (index: number) => {
    if (recipients.length <= 1) {
      toast({
        title: "Cannot Remove",
        description: "At least 1 recipient is required",
        variant: "destructive",
      })
      return
    }
    setRecipients(recipients.filter((_, i) => i !== index))
  }

  const updateRecipient = (
    index: number,
    field: keyof ScheduledRecipient,
    value: string
  ) => {
    const updated = [...recipients]
    updated[index] = { ...updated[index], [field]: value }
    setRecipients(updated)
  }

  const distributeEvenly = () => {
    if (recipients.length === 0 || totalAmount <= 0) return
    const amountPerRecipient = (totalAmount / recipients.length).toFixed(2)
    setRecipients(recipients.map((r) => ({ ...r, amount: amountPerRecipient })))
  }

  const handleCreate = async () => {
    if (!canCreate) return

    setCreating(true)
    try {
      const response = await fetch("/api/scheduled-payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-address": userAddress,
        },
        body: JSON.stringify({
          name,
          total_amount: totalAmount,
          token,
          schedule_type: scheduleType,
          schedule_config: scheduleConfig,
          recipients,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        toast({
          title: "Scheduled Payment Created",
          description: `"${name}" has been scheduled`,
        })
        onSuccess?.()
        // Reset form
        setName("")
        setTotalAmount(0)
        setRecipients([{ address: "", amount: "0", vendorName: "" }])
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create scheduled payment",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule Payment</CardTitle>
          <CardDescription>
            Set up recurring payments that execute automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Payment Name</Label>
            <Input
              placeholder="Monthly Payroll"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total Amount</Label>
              <Input
                type="number"
                placeholder="10000"
                value={totalAmount || ""}
                onChange={(e) => setTotalAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Token</Label>
              <Select value={token} onValueChange={setToken}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOKENS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Frequency</Label>
            <Select
              value={scheduleType}
              onValueChange={(v) => setScheduleType(v as ScheduleType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {scheduleType === "weekly" || scheduleType === "bi-weekly" ? (
            <div>
              <Label>Day of Week</Label>
              <Select
                value={String(scheduleConfig.day_of_week || 1)}
                onValueChange={(v) =>
                  setScheduleConfig({ ...scheduleConfig, day_of_week: Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day.value} value={String(day.value)}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : scheduleType === "monthly" ? (
            <div>
              <Label>Day of Month</Label>
              <Select
                value={String(scheduleConfig.day_of_month || 1)}
                onValueChange={(v) =>
                  setScheduleConfig({ ...scheduleConfig, day_of_month: Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div>
            <Label>Time (UTC)</Label>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={scheduleConfig.time || "09:00"}
                onChange={(e) =>
                  setScheduleConfig({ ...scheduleConfig, time: e.target.value })
                }
              />
            </div>
          </div>

          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Schedule:</strong>{" "}
              {getScheduleDescription(scheduleType, scheduleConfig)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recipients */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recipients</CardTitle>
              <CardDescription>Add recipients and their payment amounts</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {totalRecipientAmount.toFixed(2)} / {totalAmount.toFixed(2)} {token}
              </span>
              {Math.abs(totalAmount - totalRecipientAmount) < 0.01 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {recipients.map((recipient, index) => (
            <div key={index} className="flex items-end gap-3 p-4 border rounded-lg">
              <div className="flex-1">
                <Label>Recipient Name (optional)</Label>
                <Input
                  placeholder="Employee name"
                  value={recipient.vendorName || ""}
                  onChange={(e) => updateRecipient(index, "vendorName", e.target.value)}
                />
              </div>
              <div className="flex-[2]">
                <Label>Wallet Address</Label>
                <Input
                  placeholder="0x..."
                  value={recipient.address}
                  onChange={(e) => updateRecipient(index, "address", e.target.value)}
                  className={
                    recipient.address &&
                    (!recipient.address.startsWith("0x") || recipient.address.length !== 42)
                      ? "border-destructive"
                      : ""
                  }
                />
              </div>
              <div className="w-32">
                <Label>Amount</Label>
                <div className="flex items-center">
                  <Input
                    type="number"
                    value={recipient.amount}
                    onChange={(e) => updateRecipient(index, "amount", e.target.value)}
                  />
                  <span className="ml-1 text-sm text-muted-foreground">{token}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => removeRecipient(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" onClick={addRecipient} className="flex-1">
              <Plus className="h-4 w-4 mr-2" />
              Add Recipient
            </Button>
            <Button variant="outline" onClick={distributeEvenly} disabled={totalAmount <= 0}>
              Distribute Evenly
            </Button>
          </div>

          {Math.abs(totalAmount - totalRecipientAmount) >= 0.01 && totalAmount > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">
                Recipient amounts ({totalRecipientAmount.toFixed(2)}) must equal total amount (
                {totalAmount.toFixed(2)})
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {name && totalAmount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xl font-bold">{name}</p>
                <p className="text-sm text-muted-foreground">Payment Name</p>
              </div>
              <div>
                <p className="text-xl font-bold">
                  {totalAmount.toLocaleString()} {token}
                </p>
                <p className="text-sm text-muted-foreground">Total Amount</p>
              </div>
              <div>
                <p className="text-xl font-bold">{recipients.length}</p>
                <p className="text-sm text-muted-foreground">Recipients</p>
              </div>
              <div>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {scheduleType}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">Frequency</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Button className="w-full" disabled={!canCreate || creating} onClick={handleCreate}>
        {creating ? (
          "Creating..."
        ) : (
          <>
            <Calendar className="h-4 w-4 mr-2" />
            Create Scheduled Payment
          </>
        )}
      </Button>
    </div>
  )
}
