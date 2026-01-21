"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react"

interface BatchStatusTrackerProps {
  batchId: string
  status: "pending" | "processing" | "completed" | "failed"
  total: number
  processed: number
  successful: number
  failed: number
}

export function BatchStatusTracker({
  batchId,
  status,
  total,
  processed,
  successful,
  failed,
}: BatchStatusTrackerProps) {
  const progress = total > 0 ? (processed / total) * 100 : 0

  const statusConfig = {
    pending: { icon: Clock, color: "bg-yellow-500", label: "Pending" },
    processing: { icon: Loader2, color: "bg-blue-500", label: "Processing" },
    completed: { icon: CheckCircle2, color: "bg-green-500", label: "Completed" },
    failed: { icon: XCircle, color: "bg-red-500", label: "Failed" },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          Batch {batchId.slice(0, 8)}...
          <Badge className={config.color}>
            <Icon className={`h-3 w-3 mr-1 ${status === "processing" ? "animate-spin" : ""}`} />
            {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={progress} className="h-2" />
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-muted-foreground">Total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-500">{successful}</div>
            <div className="text-muted-foreground">Success</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-500">{failed}</div>
            <div className="text-muted-foreground">Failed</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
