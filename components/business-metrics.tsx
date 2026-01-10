"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingDown, TrendingUp, Activity, PieChart, Wallet } from "lucide-react"
import { calculateMonthlyBurnRate, calculateRunway, getTopCategories } from "@/lib/business-logic"

interface BusinessMetricsProps {
  payments: any[]
  balance?: number // Optional balance to calculate runway
  loading?: boolean
}

export function BusinessMetrics({ payments, balance = 0, loading }: BusinessMetricsProps) {
  const burnRate = calculateMonthlyBurnRate(payments)
  const runway = calculateRunway(balance, burnRate)
  const topCategories = getTopCategories(payments)
  const topCategory = topCategories[0]

  // Calculate burn rate trend (compare last 30 days vs previous 30 days)
  const now = new Date()
  const thirtyDaysAgo = new Date(new Date().setDate(now.getDate() - 30))
  const sixtyDaysAgo = new Date(new Date().setDate(now.getDate() - 60))

  const previousBurnRate = payments
    .filter((p) => {
      const date = new Date(p.timestamp)
      return date >= sixtyDaysAgo && date < thirtyDaysAgo
    })
    .reduce((sum, p) => sum + (p.amount_usd || 0), 0)

  const burnRateChange = previousBurnRate > 0 ? ((burnRate - previousBurnRate) / previousBurnRate) * 100 : 0

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-card border-border animate-pulse">
            <CardHeader className="h-20" />
            <CardContent className="h-24" />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Burn Rate</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            ${burnRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="flex items-center mt-1">
            {burnRateChange > 0 ? (
              <TrendingUp className="h-3 w-3 text-red-500 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 text-green-500 mr-1" />
            )}
            <p className={`text-xs ${burnRateChange > 0 ? "text-red-500" : "text-green-500"}`}>
              {Math.abs(burnRateChange).toFixed(1)}% from last month
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Runway</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {runway > 24 ? "> 24 Months" : `${runway.toFixed(1)} Months`}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Based on current holdings</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Top Expense Category</CardTitle>
          <PieChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{topCategory?.name || "None"}</div>
          <p className="text-xs text-muted-foreground mt-1">
            ${(topCategory?.value || 0).toLocaleString()} (
            {burnRate > 0 ? (((topCategory?.value || 0) / burnRate) * 100).toFixed(1) : 0}%)
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Avg Transaction</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            $
            {(payments.length > 0 ? burnRate / payments.length : 0).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Per transaction average</p>
        </CardContent>
      </Card>
    </div>
  )
}
