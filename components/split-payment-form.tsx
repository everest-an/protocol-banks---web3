"use client"

import { useState, useEffect, useMemo } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Save, Play, AlertCircle, CheckCircle2 } from "lucide-react"
import type { SplitRecipient, SplitTemplate, CreateSplitTemplateInput } from "@/types/split-payment"
import { validateSplitRecipients, calculateSplitAmounts } from "@/types/split-payment"
import { authHeaders } from "@/lib/authenticated-fetch"

interface SplitPaymentFormProps {
  userAddress: string
  onExecute?: (result: { success: boolean; tx_hash?: string; error?: string }) => void
  templates?: SplitTemplate[]
  onSaveTemplate?: (template: CreateSplitTemplateInput) => Promise<void>
}

const TOKENS = ["USDT", "USDC", "DAI", "HSK"]

export function SplitPaymentForm({
  userAddress,
  onExecute,
  templates = [],
  onSaveTemplate,
}: SplitPaymentFormProps) {
  const { toast } = useToast()
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const [token, setToken] = useState("USDT")
  const [recipients, setRecipients] = useState<SplitRecipient[]>([
    { address: "", percentage: 50, vendorName: "" },
    { address: "", percentage: 50, vendorName: "" },
  ])
  const [templateName, setTemplateName] = useState("")
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [executing, setExecuting] = useState(false)

  // Calculate amounts when totalAmount or recipients change
  const calculatedRecipients = useMemo(() => {
    if (totalAmount <= 0) return recipients
    return calculateSplitAmounts(String(totalAmount), recipients)
  }, [totalAmount, recipients])

  // Validation
  const validation = useMemo(() => {
    return validateSplitRecipients(recipients)
  }, [recipients])

  const totalPercentage = useMemo(() => {
    return recipients.reduce((sum, r) => sum + (r.percentage || 0), 0)
  }, [recipients])

  const hasValidAddresses = recipients.every(
    (r) => r.address && r.address.startsWith("0x") && r.address.length === 42
  )

  const canExecute =
    validation.is_valid &&
    totalAmount > 0 &&
    hasValidAddresses &&
    recipients.length >= 2

  const addRecipient = () => {
    const remainingPercentage = Math.max(0, 100 - totalPercentage)
    setRecipients([
      ...recipients,
      { address: "", percentage: remainingPercentage, vendorName: "" },
    ])
  }

  const removeRecipient = (index: number) => {
    if (recipients.length <= 2) {
      toast({
        title: "Cannot Remove",
        description: "At least 2 recipients are required",
        variant: "destructive",
      })
      return
    }
    setRecipients(recipients.filter((_, i) => i !== index))
  }

  const updateRecipient = (index: number, field: keyof SplitRecipient, value: string | number) => {
    const updated = [...recipients]
    updated[index] = { ...updated[index], [field]: value }
    setRecipients(updated)
  }

  const loadTemplate = (template: SplitTemplate) => {
    setRecipients(template.recipients)
    toast({ title: "Template Loaded", description: `Loaded "${template.name}"` })
  }

  const handleSaveTemplate = async () => {
    if (!templateName || !onSaveTemplate) return

    try {
      await onSaveTemplate({
        name: templateName,
        recipients,
      })
      toast({ title: "Template Saved", description: `"${templateName}" has been saved` })
      setSaveDialogOpen(false)
      setTemplateName("")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save template",
        variant: "destructive",
      })
    }
  }

  const handleExecute = async () => {
    if (!canExecute) return

    setExecuting(true)
    try {
      const response = await fetch("/api/split-payment", {
        method: "POST",
        headers: authHeaders(userAddress, { contentType: "application/json" }),
        body: JSON.stringify({
          total_amount: totalAmount,
          token,
          recipients: calculatedRecipients,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        toast({
          title: "Split Payment Executed",
          description: `Transaction hash: ${data.execution?.tx_hash?.slice(0, 10)}...`,
        })
        onExecute?.({ success: true, tx_hash: data.execution?.tx_hash })
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" })
        onExecute?.({ success: false, error: data.error })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to execute split payment",
        variant: "destructive",
      })
      onExecute?.({ success: false, error: error.message })
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Amount & Token */}
      <Card>
        <CardHeader>
          <CardTitle>Split Payment</CardTitle>
          <CardDescription>
            Distribute a payment across multiple recipients by percentage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total Amount</Label>
              <Input
                type="number"
                placeholder="1000"
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

          {/* Template Selector */}
          {templates.length > 0 && (
            <div>
              <Label>Load Template</Label>
              <Select onValueChange={(id) => {
                const template = templates.find((t) => t.id === id)
                if (template) loadTemplate(template)
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a saved template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({template.recipients.length} recipients)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recipients */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recipients</CardTitle>
              <CardDescription>
                Set the percentage for each recipient. Must total 100%.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={totalPercentage === 100 ? "default" : "destructive"}
                className="text-lg px-3"
              >
                {totalPercentage}%
              </Badge>
              {totalPercentage === 100 ? (
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
                  placeholder="Vendor name"
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
              <div className="w-24">
                <Label>Percentage</Label>
                <div className="flex items-center">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={recipient.percentage}
                    onChange={(e) => updateRecipient(index, "percentage", Number(e.target.value))}
                  />
                  <span className="ml-1">%</span>
                </div>
              </div>
              <div className="w-28 text-right">
                <Label>Amount</Label>
                <p className="h-10 flex items-center justify-end font-mono text-lg">
                  {totalAmount > 0
                    ? calculatedRecipients[index]?.calculatedAmount || "0.00"
                    : "-"}
                </p>
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

          <Button variant="outline" onClick={addRecipient} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Recipient
          </Button>

          {!validation.is_valid && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{validation.errors[0]}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {totalAmount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">
                  {totalAmount.toLocaleString()} {token}
                </p>
                <p className="text-sm text-muted-foreground">Total Amount</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{recipients.length}</p>
                <p className="text-sm text-muted-foreground">Recipients</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPercentage}%</p>
                <p className="text-sm text-muted-foreground">Allocated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {onSaveTemplate && (
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!validation.is_valid}>
                <Save className="h-4 w-4 mr-2" />
                Save as Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Template</DialogTitle>
                <DialogDescription>
                  Save this split configuration as a reusable template
                </DialogDescription>
              </DialogHeader>
              <div>
                <Label>Template Name</Label>
                <Input
                  placeholder="Monthly Payroll Split"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTemplate} disabled={!templateName}>
                  Save Template
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <Button
          className="flex-1"
          disabled={!canExecute || executing}
          onClick={handleExecute}
        >
          {executing ? (
            "Executing..."
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Execute Split Payment
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
