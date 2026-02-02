"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Calendar,
  Clock,
  MoreVertical,
  Pause,
  Play,
  Trash2,
  Edit,
  Users,
  DollarSign,
} from "lucide-react"
import type { PayrollSchedule } from "@/types/payroll"
import {
  FREQUENCY_LABELS,
  EXECUTION_MODE_LABELS,
  SCHEDULE_STATUS_LABELS,
} from "@/types/payroll"

interface PayrollScheduleListProps {
  schedules: PayrollSchedule[]
  onPause: (id: string) => void
  onResume: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
  onView: (id: string) => void
  isLoading?: boolean
}

export function PayrollScheduleList({
  schedules,
  onPause,
  onResume,
  onDelete,
  onEdit,
  onView,
  isLoading = false,
}: PayrollScheduleListProps) {
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

  const formatNextExecution = (dateStr?: string) => {
    if (!dateStr) return "未设定"
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return "已过期"
    if (diffDays === 0) return "今天"
    if (diffDays === 1) return "明天"
    if (diffDays < 7) return `${diffDays} 天后`

    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    })
  }

  if (schedules.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>暂无发薪计划</p>
            <p className="text-sm mt-1">创建您的第一个定时发薪计划</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {schedules.map((schedule) => (
        <Card
          key={schedule.id}
          className={`cursor-pointer hover:border-primary/50 transition-colors ${
            schedule.status === "paused" ? "opacity-75" : ""
          }`}
          onClick={() => onView(schedule.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* 标题行 */}
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-medium truncate">{schedule.name}</h3>
                  <Badge variant="outline" className={getStatusColor(schedule.status)}>
                    {SCHEDULE_STATUS_LABELS[schedule.status]}
                  </Badge>
                </div>

                {/* 描述 */}
                {schedule.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                    {schedule.description}
                  </p>
                )}

                {/* 详情 */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {/* 金额 */}
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    <span>
                      {schedule.splitRule.totalAmount.toLocaleString()}{" "}
                      {schedule.splitRule.token}
                    </span>
                  </div>

                  {/* 收款人数 */}
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{schedule.splitRule.recipients.length} 人</span>
                  </div>

                  {/* 周期 */}
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{FREQUENCY_LABELS[schedule.frequency.type]}</span>
                  </div>

                  {/* 执行模式 */}
                  <Badge variant="secondary" className="text-xs">
                    {EXECUTION_MODE_LABELS[schedule.executionMode]}
                  </Badge>
                </div>

                {/* 下次执行 */}
                {schedule.status === "active" && schedule.nextExecution && (
                  <div className="mt-3 flex items-center gap-1 text-sm">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-primary">
                      下次执行: {formatNextExecution(schedule.nextExecution)}
                    </span>
                  </div>
                )}

                {/* 统计 */}
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>已执行 {schedule.executionCount} 次</span>
                  <span>
                    累计支付 {schedule.totalPaid.toLocaleString()} {schedule.splitRule.token}
                  </span>
                </div>
              </div>

              {/* 操作按钮 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" disabled={isLoading}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(schedule.id); }}>
                    <Edit className="h-4 w-4 mr-2" />
                    编辑
                  </DropdownMenuItem>
                  {schedule.status === "active" ? (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPause(schedule.id); }}>
                      <Pause className="h-4 w-4 mr-2" />
                      暂停
                    </DropdownMenuItem>
                  ) : schedule.status === "paused" ? (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onResume(schedule.id); }}>
                      <Play className="h-4 w-4 mr-2" />
                      恢复
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onDelete(schedule.id); }}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
