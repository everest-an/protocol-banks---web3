"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Calendar,
  Clock,
  DollarSign,
  Users,
  Play,
  Pause,
  Edit,
  Trash2,
  History,
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react"
import type { PayrollSchedule, PayrollExecution } from "@/types/payroll"
import {
  FREQUENCY_LABELS,
  EXECUTION_MODE_LABELS,
  SCHEDULE_STATUS_LABELS,
} from "@/types/payroll"

interface PayrollScheduleDetailProps {
  schedule: PayrollSchedule
  executions: PayrollExecution[]
  onBack: () => void
  onEdit: () => void
  onPause: () => void
  onResume: () => void
  onDelete: () => void
  isLoading?: boolean
}

export function PayrollScheduleDetail({
  schedule,
  executions,
  onBack,
  onEdit,
  onPause,
  onResume,
  onDelete,
  isLoading = false,
}: PayrollScheduleDetailProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-600 border-green-500/20"
      case "paused":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
      case "expired":
        return "bg-gray-500/10 text-gray-600 border-gray-500/20"
      case "cancelled":
        return "bg-red-500/10 text-red-600 border-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20"
    }
  }

  const getExecutionStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "partial":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-blue-600" />
    }
  }

  const getExecutionStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "待执行",
      confirming: "待确认",
      approving: "待审批",
      executing: "执行中",
      completed: "已完成",
      partial: "部分成功",
      failed: "失败",
      cancelled: "已取消",
      missed: "已错过",
    }
    return labels[status] || status
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{schedule.name}</h2>
              <Badge variant="outline" className={getStatusColor(schedule.status)}>
                {SCHEDULE_STATUS_LABELS[schedule.status]}
              </Badge>
            </div>
            {schedule.description && (
              <p className="text-sm text-muted-foreground mt-1">{schedule.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onEdit} disabled={isLoading}>
            <Edit className="h-4 w-4 mr-2" />
            编辑
          </Button>
          {schedule.status === "active" ? (
            <Button variant="outline" onClick={onPause} disabled={isLoading}>
              <Pause className="h-4 w-4 mr-2" />
              暂停
            </Button>
          ) : schedule.status === "paused" ? (
            <Button variant="outline" onClick={onResume} disabled={isLoading}>
              <Play className="h-4 w-4 mr-2" />
              恢复
            </Button>
          ) : null}
          <Button variant="destructive" onClick={onDelete} disabled={isLoading}>
            <Trash2 className="h-4 w-4 mr-2" />
            删除
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">每次金额</span>
            </div>
            <div className="text-2xl font-bold">
              {schedule.splitRule.totalAmount.toLocaleString()}
              <span className="text-sm font-normal ml-1">{schedule.splitRule.token}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">收款人数</span>
            </div>
            <div className="text-2xl font-bold">{schedule.splitRule.recipients.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <History className="h-4 w-4" />
              <span className="text-sm">已执行</span>
            </div>
            <div className="text-2xl font-bold">{schedule.executionCount} 次</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">累计支付</span>
            </div>
            <div className="text-2xl font-bold">
              {schedule.totalPaid.toLocaleString()}
              <span className="text-sm font-normal ml-1">{schedule.splitRule.token}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Schedule Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">计划详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">执行周期</span>
              <span className="font-medium">{FREQUENCY_LABELS[schedule.frequency.type]}</span>
            </div>
            {schedule.frequency.time && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">执行时间</span>
                <span className="font-medium">{schedule.frequency.time}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">执行模式</span>
              <Badge variant="secondary">{EXECUTION_MODE_LABELS[schedule.executionMode]}</Badge>
            </div>
            {schedule.nextExecution && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">下次执行</span>
                <span className="font-medium text-primary">{formatDate(schedule.nextExecution)}</span>
              </div>
            )}
            {schedule.lastExecution && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">上次执行</span>
                <span className="font-medium">{formatDate(schedule.lastExecution)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">创建时间</span>
              <span className="font-medium">{formatDate(schedule.createdAt)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Recipients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">收款人列表</CardTitle>
            <CardDescription>
              分配方式: {schedule.splitRule.method === "percentage" ? "按比例" : "固定金额"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {schedule.splitRule.recipients.map((recipient, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    {recipient.name && (
                      <p className="font-medium truncate">{recipient.name}</p>
                    )}
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {recipient.address}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    {schedule.splitRule.method === "percentage" ? (
                      <span className="font-medium">{recipient.allocation}%</span>
                    ) : (
                      <span className="font-medium">
                        {recipient.allocation} {schedule.splitRule.token}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Execution History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">执行历史</CardTitle>
          <CardDescription>最近 20 条执行记录</CardDescription>
        </CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>暂无执行记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {executions.map((execution) => (
                <div
                  key={execution.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {getExecutionStatusIcon(execution.status)}
                    <div>
                      <p className="font-medium">
                        {execution.totalAmount.toLocaleString()} {execution.token}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(execution.scheduledTime)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className={
                        execution.status === "completed"
                          ? "bg-green-500/10 text-green-600"
                          : execution.status === "failed"
                          ? "bg-red-500/10 text-red-600"
                          : "bg-blue-500/10 text-blue-600"
                      }
                    >
                      {getExecutionStatusLabel(execution.status)}
                    </Badge>
                    {execution.status === "completed" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        成功 {execution.successCount} / 失败 {execution.failedCount}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
