"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import {
  DollarSign,
  TrendingUp,
  Percent,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Crown,
  Building2,
  User,
} from "lucide-react"
import { useWeb3 } from "@/contexts/web3-context"
import {
  getFeeStats,
  getMonthlyFeeSummary,
  getRecentFees,
  formatFee,
  getTierFromVolume,
  type ProtocolFee,
  type MonthlyFeeSummary,
  type UserTier,
} from "@/lib/protocol-fees"

export default function FeesPage() {
  const { address, isConnected } = useWeb3()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{
    totalFeesCollected: number
    totalTransactionVolume: number
    transactionCount: number
    averageFeeRate: number
    pendingFees: number
    collectedFees: number
  } | null>(null)
  const [monthlySummary, setMonthlySummary] = useState<MonthlyFeeSummary | null>(null)
  const [recentFees, setRecentFees] = useState<ProtocolFee[]>([])
  const [currentTier, setCurrentTier] = useState<UserTier>("standard")

  useEffect(() => {
    async function loadData() {
      if (!isConnected || !address) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const [statsData, summaryData, feesData] = await Promise.all([
          getFeeStats(address),
          getMonthlyFeeSummary(address),
          getRecentFees(address, 20),
        ])

        setStats(statsData)
        setMonthlySummary(summaryData)
        setRecentFees(feesData)

        if (summaryData) {
          setCurrentTier(getTierFromVolume(summaryData.totalTransactionVolume))
        }
      } catch (error) {
        console.error("Error loading fee data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [isConnected, address])

  const tierConfig = {
    standard: { icon: User, color: "bg-gray-500", nextTier: "business", nextThreshold: 100000 },
    business: { icon: Building2, color: "bg-blue-500", nextTier: "enterprise", nextThreshold: 1000000 },
    enterprise: { icon: Crown, color: "bg-amber-500", nextTier: null, nextThreshold: null },
  }

  const currentTierConfig = tierConfig[currentTier]
  const TierIcon = currentTierConfig.icon
  const progressToNextTier = currentTierConfig.nextThreshold
    ? Math.min(((monthlySummary?.totalTransactionVolume || 0) / currentTierConfig.nextThreshold) * 100, 100)
    : 100

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Connect Wallet</CardTitle>
            <CardDescription>Connect your wallet to view your fee history and tier status</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fee Dashboard</h1>
          <p className="text-muted-foreground">Track your protocol fees and tier benefits</p>
        </div>
        <Badge className={`${currentTierConfig.color} text-white gap-1`}>
          <TierIcon className="h-3 w-3" />
          {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} Tier
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fees Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatFee(stats?.totalFeesCollected || 0)}</div>
            <p className="text-xs text-muted-foreground">From {stats?.transactionCount || 0} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transaction Volume</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(stats?.totalTransactionVolume || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Effective Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{((stats?.averageFeeRate || 0) * 100).toFixed(3)}%</div>
            <p className="text-xs text-muted-foreground">Average fee rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discounts Earned</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatFee(monthlySummary?.totalDiscountsGiven || 0)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Tier Progress */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Tier Progress</CardTitle>
            <CardDescription>Your path to lower fees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${currentTierConfig.color}`}>
                <TierIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-medium">{currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}</div>
                <div className="text-sm text-muted-foreground">Current Tier</div>
              </div>
            </div>

            {currentTierConfig.nextTier && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress to {currentTierConfig.nextTier}</span>
                  <span>{progressToNextTier.toFixed(1)}%</span>
                </div>
                <Progress value={progressToNextTier} />
                <p className="text-xs text-muted-foreground">
                  ${(monthlySummary?.totalTransactionVolume || 0).toLocaleString()} / $
                  {currentTierConfig.nextThreshold?.toLocaleString()} monthly volume
                </p>
              </div>
            )}

            <div className="pt-4 space-y-3">
              <h4 className="text-sm font-medium">Tier Benefits</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Standard</span>
                  <span>0% discount</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Business ($100K+/mo)</span>
                  <span className="text-green-600">15% discount</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Enterprise ($1M+/mo)</span>
                  <span className="text-green-600">30% discount</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fee History */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Recent Fee History</CardTitle>
            <CardDescription>Your latest protocol fee transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentFees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No fee history yet. Make your first transaction!
                    </TableCell>
                  </TableRow>
                ) : (
                  recentFees.slice(0, 10).map((fee) => (
                    <TableRow key={fee.id}>
                      <TableCell className="text-sm">{new Date(fee.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        ${fee.transactionAmount.toLocaleString()} {fee.tokenSymbol}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{formatFee(fee.finalFee)}</span>
                          {fee.discountAmount > 0 && (
                            <span className="text-xs text-green-600">Saved {formatFee(fee.discountAmount)}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{(fee.feeRate * 100).toFixed(2)}%</TableCell>
                      <TableCell>
                        {fee.status === "collected" ? (
                          <Badge variant="outline" className="text-green-600 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Collected
                          </Badge>
                        ) : fee.status === "pending" ? (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-200">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-600 border-red-200">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {fee.status}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Fee Structure Info */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Structure</CardTitle>
          <CardDescription>Transparent pricing that rewards growth</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-medium">Base Fee</h4>
              <p className="text-2xl font-bold">0.1%</p>
              <p className="text-sm text-muted-foreground">Per transaction, with $0.50 minimum and $500 maximum</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Volume Discounts</h4>
              <div className="space-y-1 text-sm">
                <p>
                  $100K+ monthly: <span className="text-green-600 font-medium">10% off</span>
                </p>
                <p>
                  $500K+ monthly: <span className="text-green-600 font-medium">20% off</span>
                </p>
                <p>
                  $1M+ monthly: <span className="text-green-600 font-medium">30% off</span>
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Security Allocation</h4>
              <p className="text-sm text-muted-foreground">
                20% of all protocol fees are allocated to the Security Reserve Fund for audits, bug bounties, and smart
                contract insurance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
