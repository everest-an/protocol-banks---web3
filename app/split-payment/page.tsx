"use client"

import { useState, useEffect, useCallback } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { SplitPaymentForm } from "@/components/split-payment"
import { createClient } from "@/lib/supabase-client"
import {
  PieChart,
  History,
  FileText,
  Percent,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from "lucide-react"
import type { SplitPaymentResponse, SplitPaymentHistory, SplitTemplate } from "@/types/split-payment"

export default function SplitPaymentPage() {
  const { wallets, isConnected } = useWeb3()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  const supabase = createClient()

  const activeChain = "EVM"
  const currentWallet = wallets[activeChain]

  const [activeTab, setActiveTab] = useState<"create" | "history" | "templates">("create")
  const [history, setHistory] = useState<SplitPaymentHistory[]>([])
  const [templates, setTemplates] = useState<SplitTemplate[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<SplitTemplate | null>(null)

  // Demo data
  const demoHistory: SplitPaymentHistory[] = [
    {
      id: "split_demo_1",
      status: "completed",
      totalAmount: 10000,
      token: "USDC",
      recipientCount: 3,
      successCount: 3,
      method: "percentage",
      created_by: "0x1234...5678",
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "split_demo_2",
      status: "partial",
      totalAmount: 5000,
      token: "USDT",
      recipientCount: 4,
      successCount: 3,
      method: "percentage",
      created_by: "0x1234...5678",
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "split_demo_3",
      status: "completed",
      totalAmount: 25000,
      token: "USDC",
      recipientCount: 5,
      successCount: 5,
      method: "fixed",
      templateName: "Monthly Payroll",
      created_by: "0x1234...5678",
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]

  const demoTemplates: SplitTemplate[] = [
    {
      id: "tpl_demo_1",
      name: "团队月薪分账",
      description: "每月工资分配",
      method: "percentage",
      recipients: [
        { address: "0x1234567890123456789012345678901234567890", allocation: 40, name: "CEO" },
        { address: "0x2345678901234567890123456789012345678901", allocation: 30, name: "CTO" },
        { address: "0x3456789012345678901234567890123456789012", allocation: 20, name: "COO" },
        { address: "0x4567890123456789012345678901234567890123", allocation: 10, name: "CFO" },
      ],
      default_token: "USDC",
      created_by: "0x1234...5678",
      created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      usage_count: 12,
      is_active: true,
    },
    {
      id: "tpl_demo_2",
      name: "投资人分红",
      description: "季度利润分配",
      method: "percentage",
      recipients: [
        { address: "0x5678901234567890123456789012345678901234", allocation: 50, name: "主投资人" },
        { address: "0x6789012345678901234567890123456789012345", allocation: 30, name: "联合投资人" },
        { address: "0x7890123456789012345678901234567890123456", allocation: 20, name: "种子投资人" },
      ],
      default_token: "USDT",
      created_by: "0x1234...5678",
      created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      usage_count: 4,
      is_active: true,
    },
  ]

  // Load history
  const loadHistory = useCallback(async () => {
    if (isDemoMode || !currentWallet) return

    setHistoryLoading(true)
    try {
      const response = await fetch(`/api/split-payment?fromAddress=${currentWallet}`)
      const data = await response.json()
      setHistory(data.splits || [])
    } catch (error) {
      console.error("[SplitPayment] Failed to load history:", error)
    } finally {
      setHistoryLoading(false)
    }
  }, [currentWallet, isDemoMode])

  // Load templates
  const loadTemplates = useCallback(async () => {
    if (isDemoMode || !currentWallet) return

    setTemplatesLoading(true)
    try {
      const response = await fetch(`/api/split-payment/templates?ownerAddress=${currentWallet}`)
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error("[SplitPayment] Failed to load templates:", error)
    } finally {
      setTemplatesLoading(false)
    }
  }, [currentWallet, isDemoMode])

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory()
    } else if (activeTab === "templates") {
      loadTemplates()
    }
  }, [activeTab, loadHistory, loadTemplates])

  const displayHistory = isDemoMode ? demoHistory : history
  const displayTemplates = isDemoMode ? demoTemplates : templates

  const handlePaymentSuccess = (response: SplitPaymentResponse) => {
    toast({
      title: "分账完成",
      description: `成功支付 ${response.successCount}/${response.results.length} 笔`,
    })
    // Refresh history
    loadHistory()
  }

  const handlePaymentError = (error: Error) => {
    toast({
      title: "分账失败",
      description: error.message,
      variant: "destructive",
    })
  }

  const useTemplate = (template: SplitTemplate) => {
    setSelectedTemplate(template)
    setActiveTab("create")
    toast({
      title: "已加载模板",
      description: `使用模板: ${template.name}`,
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "partial":
        return <Clock className="h-4 w-4 text-yellow-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "全部成功"
      case "partial":
        return "部分成功"
      case "failed":
        return "失败"
      case "pending":
        return "处理中"
      default:
        return status
    }
  }

  if (!isConnected && !isDemoMode) {
    return (
      <main className="container mx-auto py-6 px-4 max-w-7xl">
        <Alert>
          <AlertTitle>请先连接钱包</AlertTitle>
          <AlertDescription>
            使用分账功能前请先连接您的钱包
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  return (
    <main className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">分账支付</h1>
          <p className="text-muted-foreground">
            将一笔支付按百分比或固定金额分配给多个收款人
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="create">
            <PieChart className="h-4 w-4 mr-2" />
            创建分账
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            历史记录
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="h-4 w-4 mr-2" />
            我的模板
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          <SplitPaymentForm
            walletAddress={currentWallet || ""}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            defaultTemplate={selectedTemplate || undefined}
            chainId={8453}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-6 space-y-4">
          {historyLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
                </div>
              </CardContent>
            </Card>
          ) : displayHistory.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">暂无分账记录</p>
              </CardContent>
            </Card>
          ) : (
            displayHistory.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        {item.method === "percentage" ? (
                          <Percent className="h-5 w-5 text-primary" />
                        ) : (
                          <DollarSign className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {item.totalAmount.toLocaleString()} {item.token}
                          {item.templateName && (
                            <Badge variant="outline" className="text-xs">
                              {item.templateName}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.recipientCount} 个收款人 · {item.method === "percentage" ? "百分比" : "固定金额"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(item.status)}
                          <span className="text-sm">{getStatusText(item.status)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.successCount}/{item.recipientCount} 成功
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-6 space-y-4">
          {templatesLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
                </div>
              </CardContent>
            </Card>
          ) : displayTemplates.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  暂无模板，在创建分账时可以保存为模板
                </p>
              </CardContent>
            </Card>
          ) : (
            displayTemplates.map((template) => (
              <Card key={template.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        {template.description && (
                          <div className="text-sm text-muted-foreground">{template.description}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {template.recipients.length} 收款人
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {template.method === "percentage" ? "百分比" : "固定金额"}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {template.default_token}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          已使用 {template.usage_count} 次
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => useTemplate(template)}>
                      使用
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>

                  {/* Show recipients preview */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-xs text-muted-foreground mb-2">分配预览</div>
                    <div className="flex flex-wrap gap-2">
                      {template.recipients.slice(0, 4).map((r, i) => (
                        <Badge key={i} variant="secondary" className="text-xs font-normal">
                          {r.name || `收款人 ${i + 1}`}: {r.allocation}
                          {template.method === "percentage" ? "%" : ` ${template.default_token}`}
                        </Badge>
                      ))}
                      {template.recipients.length > 4 && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          +{template.recipients.length - 4} 更多
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </main>
  )
}
