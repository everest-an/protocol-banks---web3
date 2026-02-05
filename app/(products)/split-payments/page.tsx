"use client"

import { useState } from "react"
import { SplitPaymentForm } from "@/components/split-payment-form"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useDemo } from "@/contexts/demo-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Wallet,
  DollarSign,
  TrendingUp,
  History,
} from "lucide-react"

// --- Demo Data Types ---
interface DemoParticipant {
  name: string
  address: string
  amount: string
  percentage: number
  status: "paid" | "pending" | "failed"
}

interface DemoSplitPayment {
  id: string
  title: string
  description: string
  total_amount: string
  token: string
  chain: string
  participants: DemoParticipant[]
  creator: string
  created_at: string
  status: "completed" | "in_progress" | "pending"
  tx_hash?: string
}

// --- Demo Split Payment Data ---
const DEMO_SPLIT_PAYMENTS: DemoSplitPayment[] = [
  {
    id: "sp-001",
    title: "Q1 Team Dinner - ETH Denver",
    description: "Team dinner at steakhouse during ETH Denver conference",
    total_amount: "450.00",
    token: "USDC",
    chain: "Arbitrum",
    participants: [
      {
        name: "Alice Chen",
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f7DCFF",
        amount: "112.50",
        percentage: 25,
        status: "paid",
      },
      {
        name: "Bob Martinez",
        address: "0x8B3392483BA26D65E331dB86D4F430E9B3814E5e",
        amount: "112.50",
        percentage: 25,
        status: "paid",
      },
      {
        name: "Charlie Kim",
        address: "0x1234567890123456789012345678901234567890",
        amount: "112.50",
        percentage: 25,
        status: "paid",
      },
      {
        name: "Diana Patel",
        address: "0x9876543210987654321098765432109876543210",
        amount: "112.50",
        percentage: 25,
        status: "paid",
      },
    ],
    creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f7DCFF",
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: "completed",
    tx_hash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abcd",
  },
  {
    id: "sp-002",
    title: "Shared AWS Hosting - March 2025",
    description: "Monthly AWS infrastructure costs split between 3 project teams",
    total_amount: "2,400.00",
    token: "USDT",
    chain: "Ethereum",
    participants: [
      {
        name: "Frontend Team",
        address: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
        amount: "960.00",
        percentage: 40,
        status: "paid",
      },
      {
        name: "Backend Team",
        address: "0xDEF0123456789ABCDEF0123456789ABCDEF01234",
        amount: "960.00",
        percentage: 40,
        status: "paid",
      },
      {
        name: "DevOps Team",
        address: "0x1111222233334444555566667777888899990000",
        amount: "480.00",
        percentage: 20,
        status: "pending",
      },
    ],
    creator: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    status: "in_progress",
  },
  {
    id: "sp-003",
    title: "Figma Enterprise Subscription",
    description: "Annual Figma Enterprise license shared across design and product",
    total_amount: "1,200.00",
    token: "USDC",
    chain: "Base",
    participants: [
      {
        name: "Design Department",
        address: "0x2222333344445555666677778888999900001111",
        amount: "720.00",
        percentage: 60,
        status: "paid",
      },
      {
        name: "Product Team",
        address: "0x3333444455556666777788889999000011112222",
        amount: "360.00",
        percentage: 30,
        status: "paid",
      },
      {
        name: "Engineering Leads",
        address: "0x4444555566667777888899990000111122223333",
        amount: "120.00",
        percentage: 10,
        status: "paid",
      },
    ],
    creator: "0x2222333344445555666677778888999900001111",
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: "completed",
    tx_hash: "0xdef789012345678def789012345678def789012345678def789012345678defa",
  },
  {
    id: "sp-004",
    title: "Coworking Space - April Rent",
    description: "Shared coworking space rental between 5 freelancers",
    total_amount: "3,500.00",
    token: "USDT",
    chain: "Polygon",
    participants: [
      {
        name: "James Wong",
        address: "0x5555666677778888999900001111222233334444",
        amount: "700.00",
        percentage: 20,
        status: "pending",
      },
      {
        name: "Sarah Lee",
        address: "0x6666777788889999000011112222333344445555",
        amount: "700.00",
        percentage: 20,
        status: "pending",
      },
      {
        name: "Miguel Santos",
        address: "0x7777888899990000111122223333444455556666",
        amount: "700.00",
        percentage: 20,
        status: "pending",
      },
      {
        name: "Priya Sharma",
        address: "0x8888999900001111222233334444555566667777",
        amount: "700.00",
        percentage: 20,
        status: "pending",
      },
      {
        name: "Alex Turner",
        address: "0x9999000011112222333344445555666677778888",
        amount: "700.00",
        percentage: 20,
        status: "pending",
      },
    ],
    creator: "0x5555666677778888999900001111222233334444",
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    status: "pending",
  },
  {
    id: "sp-005",
    title: "Hackathon Prize Pool Distribution",
    description: "ETH Global hackathon prize distributed to winning team members",
    total_amount: "10,000.00",
    token: "USDC",
    chain: "Arbitrum",
    participants: [
      {
        name: "Lead Developer",
        address: "0xAAAABBBBCCCCDDDDEEEEFFFF0000111122223333",
        amount: "4,000.00",
        percentage: 40,
        status: "paid",
      },
      {
        name: "Smart Contract Dev",
        address: "0xBBBBCCCCDDDDEEEEFFFF00001111222233334444",
        amount: "3,000.00",
        percentage: 30,
        status: "paid",
      },
      {
        name: "UI/UX Designer",
        address: "0xCCCCDDDDEEEEFFFF000011112222333344445555",
        amount: "2,000.00",
        percentage: 20,
        status: "paid",
      },
      {
        name: "Pitch & Strategy",
        address: "0xDDDDEEEEFFFF0000111122223333444455556666",
        amount: "1,000.00",
        percentage: 10,
        status: "paid",
      },
    ],
    creator: "0xAAAABBBBCCCCDDDDEEEEFFFF0000111122223333",
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: "completed",
    tx_hash: "0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234",
  },
]

// --- Helper Functions ---
function getStatusColor(status: DemoSplitPayment["status"]) {
  switch (status) {
    case "completed":
      return "default"
    case "in_progress":
      return "warning"
    case "pending":
      return "secondary"
    default:
      return "outline"
  }
}

function getStatusIcon(status: DemoSplitPayment["status"]) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case "in_progress":
      return <Clock className="h-4 w-4 text-amber-500" />
    case "pending":
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />
    default:
      return null
  }
}

function getParticipantStatusColor(status: DemoParticipant["status"]) {
  switch (status) {
    case "paid":
      return "text-green-600 dark:text-green-400 bg-green-500/10"
    case "pending":
      return "text-amber-600 dark:text-amber-400 bg-amber-500/10"
    case "failed":
      return "text-red-600 dark:text-red-400 bg-red-500/10"
    default:
      return ""
  }
}

function getCompletionPercentage(payment: DemoSplitPayment) {
  const paid = payment.participants.filter((p) => p.status === "paid").length
  return Math.round((paid / payment.participants.length) * 100)
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return "Just now"
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// --- Demo Summary Stats ---
function getDemoStats(payments: DemoSplitPayment[]) {
  const totalVolume = payments.reduce((sum, p) => {
    return sum + parseFloat(p.total_amount.replace(/,/g, ""))
  }, 0)

  const completedCount = payments.filter((p) => p.status === "completed").length
  const activeCount = payments.filter((p) => p.status === "in_progress").length
  const totalParticipants = payments.reduce((sum, p) => sum + p.participants.length, 0)

  return { totalVolume, completedCount, activeCount, totalParticipants }
}

// --- Split Payment Detail Card ---
function SplitPaymentCard({
  payment,
  expanded,
  onToggle,
}: {
  payment: DemoSplitPayment
  expanded: boolean
  onToggle: () => void
}) {
  const completionPct = getCompletionPercentage(payment)

  return (
    <Card
      className="bg-card cursor-pointer hover:border-primary/30 transition-colors"
      onClick={onToggle}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-base truncate">{payment.title}</CardTitle>
              <Badge variant="outline" className="text-xs shrink-0 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                Test Data
              </Badge>
            </div>
            <CardDescription className="line-clamp-1">{payment.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {getStatusIcon(payment.status)}
            <Badge variant={getStatusColor(payment.status)}>
              {payment.status === "in_progress" ? "In Progress" : payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Amount and Chain Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-2xl font-bold font-mono">${payment.total_amount}</span>
              <span className="text-sm text-muted-foreground ml-1">{payment.token}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {payment.chain}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {payment.participants.length} participants
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {payment.participants.filter((p) => p.status === "paid").length} of{" "}
              {payment.participants.length} paid
            </span>
            <span>{completionPct}%</span>
          </div>
          <Progress value={completionPct} className="h-2" />
        </div>

        {/* Timestamp */}
        <div className="text-xs text-muted-foreground">
          Created {formatTimeAgo(payment.created_at)} by{" "}
          <span className="font-mono">{payment.creator.slice(0, 6)}...{payment.creator.slice(-4)}</span>
        </div>

        {/* Expanded Participant Details */}
        {expanded && (
          <div className="pt-3 mt-3 border-t space-y-2" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold mb-2">Participants</h4>
            {payment.participants.map((participant, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                    {participant.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{participant.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {participant.address.slice(0, 10)}...{participant.address.slice(-6)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-mono text-sm font-medium">${participant.amount}</div>
                    <div className="text-xs text-muted-foreground">{participant.percentage}%</div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${getParticipantStatusColor(participant.status)}`}
                  >
                    {participant.status.charAt(0).toUpperCase() + participant.status.slice(1)}
                  </Badge>
                </div>
              </div>
            ))}
            {payment.tx_hash && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                <ArrowRight className="h-3 w-3" />
                <span className="font-mono">
                  Tx: {payment.tx_hash.slice(0, 14)}...{payment.tx_hash.slice(-8)}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- Main Page Component ---
export default function SplitPaymentsPage() {
  const { address, isConnected } = useUnifiedWallet()
  const { isDemoMode } = useDemo()
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"active" | "history">("active")

  const showDemo = isDemoMode || !isConnected

  const stats = getDemoStats(DEMO_SPLIT_PAYMENTS)
  const activePayments = DEMO_SPLIT_PAYMENTS.filter(
    (p) => p.status === "pending" || p.status === "in_progress"
  )
  const completedPayments = DEMO_SPLIT_PAYMENTS.filter((p) => p.status === "completed")

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Split Payments</h1>
        <p className="text-muted-foreground">
          Distribute funds to multiple recipients based on percentage allocation.
          Perfect for revenue sharing, payroll, and team expenses.
        </p>
      </div>

      {/* Connected wallet: show the split payment form */}
      {isConnected && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Split Payment</CardTitle>
              <CardDescription>
                Add recipients and set their percentage share. The total must equal 100%.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SplitPaymentForm
                userAddress={address || ""}
                onExecute={(result) => {
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Demo / Preview Section */}
      {showDemo && (
        <div className="space-y-6">
          {/* Banner for non-connected users */}
          {!isConnected && (
            <Alert className="bg-blue-500/10 border-blue-500/20">
              <Wallet className="h-4 w-4 text-blue-500" />
              <AlertTitle className="text-blue-500">Preview Mode</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                Connect your wallet to create and manage real split payments. Below is sample data
                showing how split payments work.
              </AlertDescription>
            </Alert>
          )}

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total Volume</span>
                </div>
                <div className="text-2xl font-bold font-mono">
                  ${stats.totalVolume.toLocaleString()}
                </div>
                <Badge variant="outline" className="text-xs mt-1 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                  Test Data
                </Badge>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Completed</span>
                </div>
                <div className="text-2xl font-bold">{stats.completedCount}</div>
                <span className="text-xs text-muted-foreground">splits finalized</span>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Active</span>
                </div>
                <div className="text-2xl font-bold">{stats.activeCount + DEMO_SPLIT_PAYMENTS.filter(p => p.status === "pending").length}</div>
                <span className="text-xs text-muted-foreground">in progress or pending</span>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Participants</span>
                </div>
                <div className="text-2xl font-bold">{stats.totalParticipants}</div>
                <span className="text-xs text-muted-foreground">across all splits</span>
              </CardContent>
            </Card>
          </div>

          {/* Tab View for Active / History */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "active" | "history")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 lg:w-[300px]">
              <TabsTrigger value="active" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Active ({activePayments.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                History ({completedPayments.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4 mt-4">
              {activePayments.length === 0 ? (
                <Card className="bg-card">
                  <CardContent className="py-12 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No active split payments</p>
                  </CardContent>
                </Card>
              ) : (
                activePayments.map((payment) => (
                  <SplitPaymentCard
                    key={payment.id}
                    payment={payment}
                    expanded={expandedPayment === payment.id}
                    onToggle={() =>
                      setExpandedPayment(
                        expandedPayment === payment.id ? null : payment.id
                      )
                    }
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4 mt-4">
              {completedPayments.length === 0 ? (
                <Card className="bg-card">
                  <CardContent className="py-12 text-center">
                    <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No completed split payments yet</p>
                  </CardContent>
                </Card>
              ) : (
                completedPayments.map((payment) => (
                  <SplitPaymentCard
                    key={payment.id}
                    payment={payment}
                    expanded={expandedPayment === payment.id}
                    onToggle={() =>
                      setExpandedPayment(
                        expandedPayment === payment.id ? null : payment.id
                      )
                    }
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
