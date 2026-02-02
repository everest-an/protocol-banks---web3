"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Calendar, History, Loader2, RefreshCw } from "lucide-react"
import { PayrollScheduleForm, PayrollScheduleList } from "@/components/payroll"
import { PayrollScheduleDetail } from "@/components/payroll/payroll-schedule-detail"
import type { PayrollSchedule, PayrollExecution, CreatePayrollScheduleRequest } from "@/types/payroll"
import { toast } from "sonner"

type ViewMode = "list" | "detail" | "edit"

export default function PayrollPage() {
  const { walletAddress } = useAuth()
  const [schedules, setSchedules] = useState<PayrollSchedule[]>([])
  const [executions, setExecutions] = useState<PayrollExecution[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("schedules")
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [selectedSchedule, setSelectedSchedule] = useState<PayrollSchedule | null>(null)
  const [selectedExecutions, setSelectedExecutions] = useState<PayrollExecution[]>([])

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    if (!walletAddress) return

    try {
      const response = await fetch(`/api/payroll/schedules?ownerAddress=${walletAddress}`)
      const data = await response.json()

      if (data.success) {
        setSchedules(data.schedules)
      } else {
        toast.error("加载发薪计划失败")
      }
    } catch (error) {
      console.error("Fetch schedules error:", error)
      toast.error("加载发薪计划失败")
    }
  }, [walletAddress])

  // Fetch executions
  const fetchExecutions = useCallback(async () => {
    if (!walletAddress) return

    try {
      const response = await fetch(`/api/payroll/executions?ownerAddress=${walletAddress}&limit=50`)
      const data = await response.json()

      if (data.success) {
        setExecutions(data.executions)
      }
    } catch (error) {
      console.error("Fetch executions error:", error)
    }
  }, [walletAddress])

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([fetchSchedules(), fetchExecutions()])
      setIsLoading(false)
    }

    if (walletAddress) {
      loadData()
    }
  }, [walletAddress, fetchSchedules, fetchExecutions])

  // Create schedule
  const handleCreateSchedule = async (request: CreatePayrollScheduleRequest) => {
    if (!walletAddress) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/payroll/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...request,
          ownerAddress: walletAddress,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success("发薪计划创建成功")
        setShowCreateDialog(false)
        await fetchSchedules()
      } else {
        toast.error(data.error || "创建失败")
      }
    } catch (error) {
      console.error("Create schedule error:", error)
      toast.error("创建发薪计划失败")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Pause schedule
  const handlePause = async (id: string) => {
    if (!walletAddress) return

    try {
      const response = await fetch(`/api/payroll/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pause",
          ownerAddress: walletAddress,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success("计划已暂停")
        await fetchSchedules()
      } else {
        toast.error(data.error || "暂停失败")
      }
    } catch (error) {
      console.error("Pause schedule error:", error)
      toast.error("暂停失败")
    }
  }

  // Resume schedule
  const handleResume = async (id: string) => {
    if (!walletAddress) return

    try {
      const response = await fetch(`/api/payroll/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resume",
          ownerAddress: walletAddress,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success("计划已恢复")
        await fetchSchedules()
      } else {
        toast.error(data.error || "恢复失败")
      }
    } catch (error) {
      console.error("Resume schedule error:", error)
      toast.error("恢复失败")
    }
  }

  // Delete schedule
  const handleDelete = async () => {
    if (!walletAddress || !deleteScheduleId) return

    try {
      const response = await fetch(
        `/api/payroll/schedules/${deleteScheduleId}?ownerAddress=${walletAddress}`,
        { method: "DELETE" }
      )

      const data = await response.json()

      if (data.success) {
        toast.success("计划已删除")
        setDeleteScheduleId(null)
        await fetchSchedules()
      } else {
        toast.error(data.error || "删除失败")
      }
    } catch (error) {
      console.error("Delete schedule error:", error)
      toast.error("删除失败")
    }
  }

  // Fetch schedule details
  const fetchScheduleDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/payroll/schedules/${id}`)
      const data = await response.json()

      if (data.success) {
        setSelectedSchedule(data.schedule)
        setSelectedExecutions(data.executions || [])
        return data.schedule
      } else {
        toast.error("获取计划详情失败")
        return null
      }
    } catch (error) {
      console.error("Fetch schedule details error:", error)
      toast.error("获取计划详情失败")
      return null
    }
  }

  // Edit schedule
  const handleEdit = async (id: string) => {
    setIsLoading(true)
    const schedule = await fetchScheduleDetails(id)
    setIsLoading(false)

    if (schedule) {
      setViewMode("edit")
    }
  }

  // View schedule details
  const handleView = async (id: string) => {
    setIsLoading(true)
    const schedule = await fetchScheduleDetails(id)
    setIsLoading(false)

    if (schedule) {
      setViewMode("detail")
    }
  }

  // Back to list
  const handleBackToList = () => {
    setViewMode("list")
    setSelectedSchedule(null)
    setSelectedExecutions([])
  }

  // Refresh data
  const handleRefresh = async () => {
    setIsLoading(true)
    await Promise.all([fetchSchedules(), fetchExecutions()])
    setIsLoading(false)
    toast.success("数据已刷新")
  }

  // Statistics
  const stats = {
    total: schedules.length,
    active: schedules.filter((s) => s.status === "active").length,
    paused: schedules.filter((s) => s.status === "paused").length,
    totalPaid: schedules.reduce((sum, s) => sum + s.totalPaid, 0),
  }

  if (!walletAddress) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>请先连接钱包</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Detail view
  if (viewMode === "detail" && selectedSchedule) {
    return (
      <div className="container mx-auto py-8">
        <PayrollScheduleDetail
          schedule={selectedSchedule}
          executions={selectedExecutions}
          onBack={handleBackToList}
          onEdit={() => setViewMode("edit")}
          onPause={() => handlePause(selectedSchedule.id)}
          onResume={() => handleResume(selectedSchedule.id)}
          onDelete={() => setDeleteScheduleId(selectedSchedule.id)}
          isLoading={isSubmitting}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteScheduleId} onOpenChange={() => setDeleteScheduleId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                此操作将删除该发薪计划，已执行的记录将保留。确定要继续吗？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await handleDelete()
                  handleBackToList()
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  // Edit view
  if (viewMode === "edit" && selectedSchedule) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>编辑发薪计划</CardTitle>
            <CardDescription>修改 "{selectedSchedule.name}" 的设置</CardDescription>
          </CardHeader>
          <CardContent>
            <PayrollScheduleForm
              initialData={selectedSchedule}
              onSubmit={async (data) => {
                // TODO: Implement update API
                toast.info("更新功能开发中")
                handleBackToList()
              }}
              onCancel={handleBackToList}
              isLoading={isSubmitting}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">定时发薪</h1>
          <p className="text-muted-foreground">
            设置自动化发薪计划，支持按日、周、月等周期自动执行
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建计划
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">总计划数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-sm text-muted-foreground">运行中</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.paused}</div>
            <p className="text-sm text-muted-foreground">已暂停</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.totalPaid.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">累计支付 (USD)</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="schedules">
            <Calendar className="h-4 w-4 mr-2" />
            发薪计划
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            执行历史
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="mt-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <PayrollScheduleList
              schedules={schedules}
              onPause={handlePause}
              onResume={handleResume}
              onDelete={(id) => setDeleteScheduleId(id)}
              onEdit={handleEdit}
              onView={handleView}
              isLoading={isSubmitting}
            />
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <ExecutionHistory executions={executions} isLoading={isLoading} />
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>创建发薪计划</DialogTitle>
            <DialogDescription>
              设置自动化发薪规则，系统将按照设定周期自动执行发薪
            </DialogDescription>
          </DialogHeader>
          <PayrollScheduleForm
            onSubmit={handleCreateSchedule}
            onCancel={() => setShowCreateDialog(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteScheduleId} onOpenChange={() => setDeleteScheduleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将删除该发薪计划，已执行的记录将保留。确定要继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Execution History Component
function ExecutionHistory({
  executions,
  isLoading,
}: {
  executions: PayrollExecution[]
  isLoading: boolean
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600 bg-green-500/10"
      case "partial":
        return "text-yellow-600 bg-yellow-500/10"
      case "failed":
        return "text-red-600 bg-red-500/10"
      case "pending":
      case "confirming":
      case "approving":
        return "text-blue-600 bg-blue-500/10"
      case "executing":
        return "text-purple-600 bg-purple-500/10"
      case "cancelled":
      case "missed":
        return "text-gray-600 bg-gray-500/10"
      default:
        return "text-gray-600 bg-gray-500/10"
    }
  }

  const getStatusLabel = (status: string) => {
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (executions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>暂无执行记录</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>执行历史</CardTitle>
        <CardDescription>最近 50 条执行记录</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {executions.map((execution) => (
            <div
              key={execution.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${getStatusColor(execution.status)}`}
                  >
                    {getStatusLabel(execution.status)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(execution.scheduledTime).toLocaleString("zh-CN")}
                  </span>
                </div>
                <div className="mt-1 text-sm">
                  <span className="font-medium">
                    {execution.totalAmount.toLocaleString()} {execution.token}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    → {execution.recipientCount} 人
                  </span>
                </div>
                {execution.status === "completed" && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    成功 {execution.successCount} / 失败 {execution.failedCount}
                  </div>
                )}
                {execution.errorMessage && (
                  <div className="mt-1 text-xs text-red-600">{execution.errorMessage}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
