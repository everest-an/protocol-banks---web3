"use client"

/**
 * Export Dialog Component
 * Allows users to configure and download payment reports
 */

import { useState, useEffect } from "react"
import { Download, FileText, FileSpreadsheet, File, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"

// ============================================
// Types
// ============================================

type ReportType = "transactions" | "monthly" | "recipient"
type ReportFormat = "csv" | "excel" | "pdf"

interface ExportDialogProps {
  walletAddress: string
  trigger?: React.ReactNode
}

interface ReportPreview {
  transactionCount: number
  totalAmount: number
  token: string
  uniqueRecipients: number
}

// ============================================
// Export Dialog Component
// ============================================

export function ExportDialog({ walletAddress, trigger }: ExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<ReportPreview | null>(null)

  // Form state
  const [reportType, setReportType] = useState<ReportType>("transactions")
  const [format, setFormat] = useState<ReportFormat>("pdf")
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0]
  })

  // PDF options
  const [companyName, setCompanyName] = useState("")
  const [companyAddress, setCompanyAddress] = useState("")
  const [includeLogo, setIncludeLogo] = useState(true)

  // Fetch preview when dialog opens or dates change
  useEffect(() => {
    if (open && walletAddress && startDate && endDate) {
      fetchPreview()
    }
  }, [open, walletAddress, startDate, endDate])

  const fetchPreview = async () => {
    setPreviewLoading(true)
    try {
      const params = new URLSearchParams({
        walletAddress,
        startDate,
        endDate,
      })

      const response = await fetch(`/api/reports/generate?${params}`)
      const data = await response.json()

      if (data.success) {
        setPreview(data.data.preview)
      }
    } catch (error) {
      console.error("Failed to fetch preview:", error)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleExport = async () => {
    if (!walletAddress) {
      toast.error("Wallet address is required")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: reportType,
          format,
          startDate,
          endDate,
          walletAddress,
          pdfOptions:
            format === "pdf"
              ? {
                  companyName: companyName || undefined,
                  companyAddress: companyAddress || undefined,
                  includeLogo,
                }
              : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || "Export failed")
      }

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition")
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      a.download = filenameMatch?.[1] || `report.${format}`

      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("Report downloaded successfully")
      setOpen(false)
    } catch (error) {
      console.error("Export error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to export report")
    } finally {
      setLoading(false)
    }
  }

  const formatIcon = {
    csv: <FileText className="h-4 w-4" />,
    excel: <FileSpreadsheet className="h-4 w-4" />,
    pdf: <File className="h-4 w-4" />,
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Report</DialogTitle>
          <DialogDescription>
            Generate and download payment reports in various formats
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Report Type */}
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transactions">Transaction Details</SelectItem>
                <SelectItem value="monthly">Monthly Summary</SelectItem>
                <SelectItem value="recipient">Recipient Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Format */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["csv", "excel", "pdf"] as const).map((f) => (
                <Button
                  key={f}
                  variant={format === f ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setFormat(f)}
                >
                  {formatIcon[f]}
                  <span className="ml-2 uppercase">{f}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* PDF Options */}
          {format === "pdf" && (
            <div className="space-y-4 rounded-lg border p-4">
              <Label className="text-sm font-medium">PDF Settings</Label>
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-xs text-muted-foreground">
                  Company Name (optional)
                </Label>
                <Input
                  id="companyName"
                  placeholder="Your Company Name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyAddress" className="text-xs text-muted-foreground">
                  Company Address (optional)
                </Label>
                <Input
                  id="companyAddress"
                  placeholder="123 Business St, City, Country"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeLogo"
                  checked={includeLogo}
                  onCheckedChange={(checked) => setIncludeLogo(checked === true)}
                />
                <Label htmlFor="includeLogo" className="text-sm">
                  Include Protocol Banks logo
                </Label>
              </div>
            </div>
          )}

          {/* Preview */}
          {previewLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Loading preview...</span>
            </div>
          ) : preview ? (
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-medium">Report Preview</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Transactions:</span>{" "}
                  <span className="font-medium">{preview.transactionCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Amount:</span>{" "}
                  <span className="font-medium">
                    {preview.totalAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    {preview.token}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Recipients:</span>{" "}
                  <span className="font-medium">{preview.uniqueRecipients}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={loading || !preview?.transactionCount}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
