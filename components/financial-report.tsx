"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { ExternalLink } from "lucide-react"
import { categorizeTransaction, CATEGORY_COLORS } from "@/lib/business-logic"

interface Payment {
  id: string
  timestamp: string
  to_address: string
  amount: string
  amount_usd: number
  status: string
  notes?: string
  tx_hash?: string
  token_symbol?: string
  vendor?: {
    name: string
  }
  is_external?: boolean
}

interface FinancialReportProps {
  payments: Payment[]
  loading: boolean
}

export function FinancialReport({ payments, loading }: FinancialReportProps) {
  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Financial Report</CardTitle>
          <CardDescription>Loading transaction history...</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Financial Report</CardTitle>
        <CardDescription>Detailed transaction history and records</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground">Date & Time</TableHead>
                <TableHead className="text-muted-foreground">Related Transaction</TableHead>
                <TableHead className="text-muted-foreground">Category</TableHead>
                <TableHead className="text-muted-foreground">Amount</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Reason / Notes</TableHead>
                <TableHead className="text-right text-muted-foreground">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => {
                  const category = categorizeTransaction(payment.vendor?.name, payment.notes)
                  return (
                    <TableRow key={payment.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-mono text-xs">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {format(new Date(payment.timestamp), "MMM d, yyyy")}
                          </span>
                          <span className="text-muted-foreground">
                            {format(new Date(payment.timestamp), "HH:mm:ss")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {payment.vendor?.name || (payment.is_external ? "External Transfer" : "Unknown Vendor")}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                            {payment.to_address}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-normal"
                          style={{
                            borderColor: `${CATEGORY_COLORS[category]}40`,
                            backgroundColor: `${CATEGORY_COLORS[category]}10`,
                            color: CATEGORY_COLORS[category],
                          }}
                        >
                          {category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            ${payment.amount_usd?.toFixed(2) || "0.00"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {payment.amount} {payment.token_symbol}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            payment.status === "completed" || payment.status === "success"
                              ? "default"
                              : payment.status === "pending"
                                ? "secondary"
                                : "destructive"
                          }
                          className={
                            payment.status === "completed" || payment.status === "success"
                              ? "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20"
                              : payment.status === "pending"
                                ? "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20"
                                : ""
                          }
                        >
                          {payment.status}
                        </Badge>
                        {payment.is_external && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-[10px] h-5 border-muted-foreground/30 text-muted-foreground"
                          >
                            On-Chain
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {payment.notes || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {payment.tx_hash && (
                          <a
                            href={`https://etherscan.io/tx/${payment.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span className="sr-only">View on Etherscan</span>
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
