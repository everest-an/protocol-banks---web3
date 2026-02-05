"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Send,
  Plus,
  FileUp,
  CheckCircle2,
  Building2,
  User,
  Wallet,
} from "lucide-react"

interface DemoRecipient {
  id: string
  name: string
  address: string
  amount: string
  token: string
  category: string
  selected: boolean
}

export function BatchPaymentDemo() {
  const [recipients, setRecipients] = useState<DemoRecipient[]>([
    {
      id: "1",
      name: "Acme Corp",
      address: "0x742d...7DCFF",
      amount: "5,000",
      token: "USDC",
      category: "Technology",
      selected: true,
    },
    {
      id: "2",
      name: "CloudHost Inc",
      address: "0x8Ba1...9E0C2",
      amount: "2,500",
      token: "USDC",
      category: "Infrastructure",
      selected: true,
    },
    {
      id: "3",
      name: "DevTeam LLC",
      address: "0x1234...5678A",
      amount: "8,000",
      token: "USDC",
      category: "Development",
      selected: true,
    },
    {
      id: "4",
      name: "Marketing Pro",
      address: "0xaBcD...eF012",
      amount: "3,200",
      token: "USDC",
      category: "Marketing",
      selected: false,
    },
    {
      id: "5",
      name: "Legal Services",
      address: "0x9876...54321",
      amount: "4,500",
      token: "USDC",
      category: "Legal",
      selected: true,
    },
  ])

  const selectedCount = recipients.filter((r) => r.selected).length
  const totalAmount = recipients
    .filter((r) => r.selected)
    .reduce((sum, r) => sum + parseFloat(r.amount.replace(",", "")), 0)

  const toggleRecipient = (id: string) => {
    setRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
    )
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Technology: "bg-blue-500/10 text-blue-500",
      Infrastructure: "bg-green-500/10 text-green-500",
      Development: "bg-purple-500/10 text-purple-500",
      Marketing: "bg-pink-500/10 text-pink-500",
      Legal: "bg-orange-500/10 text-orange-500",
    }
    return colors[category] || "bg-gray-500/10 text-gray-500"
  }

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-orange-500" />
            Vendor Payments
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <FileUp className="h-3 w-3" />
              CSV
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Recipients Table */}
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <div className="grid grid-cols-[24px_1fr_100px_80px] gap-2 p-2 bg-muted/30 text-xs font-medium text-muted-foreground border-b">
            <div></div>
            <div>Recipient</div>
            <div className="text-right">Amount</div>
            <div className="text-center">Status</div>
          </div>
          <div className="divide-y divide-border/30">
            {recipients.map((recipient) => (
              <div
                key={recipient.id}
                className={`grid grid-cols-[24px_1fr_100px_80px] gap-2 p-2 items-center text-sm transition-colors cursor-pointer hover:bg-muted/20 ${
                  recipient.selected ? "bg-primary/5" : "opacity-50"
                }`}
                onClick={() => toggleRecipient(recipient.id)}
              >
                <Checkbox
                  checked={recipient.selected}
                  className="h-4 w-4"
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={() => toggleRecipient(recipient.id)}
                />
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-[10px] text-white font-medium shrink-0">
                    {recipient.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate text-xs">{recipient.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {recipient.address}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-xs">${recipient.amount}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">
                    {recipient.token}
                  </span>
                </div>
                <div className="flex justify-center">
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 ${getCategoryColor(recipient.category)}`}
                  >
                    {recipient.category}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary & Action */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedCount}</span> selected
            <span className="mx-2">•</span>
            Total: <span className="font-semibold text-foreground">${totalAmount.toLocaleString()}</span> USDC
          </div>
          <Button size="sm" className="h-8 gap-1.5 bg-orange-500 hover:bg-orange-600">
            <Send className="h-3.5 w-3.5" />
            Execute Batch
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
