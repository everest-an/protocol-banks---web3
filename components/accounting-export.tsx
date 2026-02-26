"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { Download, FileSpreadsheet, FileText, Calendar } from "lucide-react"
import { authHeaders } from "@/lib/authenticated-fetch"

interface AccountingExportProps {
  userAddress: string
}

type ExportFormat = "csv" | "xlsx" | "json"

export function AccountingExport({ userAddress }: AccountingExportProps) {
  const { toast } = useToast()
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0]
  })
  const [format, setFormat] = useState<ExportFormat>("csv")
  const [includePending, setIncludePending] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
        format,
        include_pending: String(includePending),
      })

      const response = await fetch(`/api/reports/accounting?${params}`, {
        headers: authHeaders(userAddress),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Export failed")
      }

      if (format === "json") {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data.report, null, 2)], {
          type: "application/json",
        })
        downloadBlob(blob, `accounting-report-${startDate}-${endDate}.json`)
      } else {
        const blob = await response.blob()
        const extension = format === "csv" ? "csv" : "xlsx"
        downloadBlob(blob, `accounting-report-${startDate}-${endDate}.${extension}`)
      }

      toast({
        title: "Export Complete",
        description: `Report exported as ${format.toUpperCase()}`,
      })
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export report",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const setQuickRange = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setStartDate(start.toISOString().split("T")[0])
    setEndDate(end.toISOString().split("T")[0])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Export Accounting Report
        </CardTitle>
        <CardDescription>
          Generate a detailed accounting report for your records
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Date Ranges */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setQuickRange(7)}>
            Last 7 Days
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQuickRange(30)}>
            Last 30 Days
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQuickRange(90)}>
            Last 90 Days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date()
              const start = new Date(now.getFullYear(), now.getMonth(), 1)
              setStartDate(start.toISOString().split("T")[0])
              setEndDate(now.toISOString().split("T")[0])
            }}
          >
            This Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date()
              const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
              const end = new Date(now.getFullYear(), now.getMonth(), 0)
              setStartDate(start.toISOString().split("T")[0])
              setEndDate(end.toISOString().split("T")[0])
            }}
          >
            Last Month
          </Button>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Start Date
            </Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              End Date
            </Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Format */}
        <div>
          <Label>Export Format</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  CSV - Comma Separated Values
                </div>
              </SelectItem>
              <SelectItem value="xlsx">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel - XLSX Format
                </div>
              </SelectItem>
              <SelectItem value="json">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  JSON - Raw Data
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Options */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="include-pending"
            checked={includePending}
            onCheckedChange={(checked) => setIncludePending(checked as boolean)}
          />
          <Label htmlFor="include-pending" className="cursor-pointer">
            Include pending transactions
          </Label>
        </div>

        {/* Report Info */}
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <p className="text-sm font-medium">Report will include:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>- Transaction summary (total incoming/outgoing)</li>
            <li>- Breakdown by token</li>
            <li>- Breakdown by category</li>
            <li>- Breakdown by vendor</li>
            <li>- Full transaction list with details</li>
            <li>- Running balance calculation</li>
          </ul>
        </div>

        {/* Export Button */}
        <Button className="w-full" onClick={handleExport} disabled={exporting}>
          {exporting ? (
            "Generating Report..."
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export Report ({format.toUpperCase()})
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
