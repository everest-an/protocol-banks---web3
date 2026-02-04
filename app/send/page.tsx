"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Send, Users, ArrowRight, Zap, Globe, CreditCard, Wallet, Building2, User } from "lucide-react"
import Link from "next/link"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useUserType } from "@/contexts/user-type-context"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function SendPage() {
  const { isConnected } = useUnifiedWallet()
  const { translateTerm } = useUserType()
  const [userMode, setUserMode] = useState<"personal" | "business">("personal")

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Send Payment</h1>
        <p className="text-muted-foreground">Choose how you want to send money</p>
      </div>

      {!isConnected && (
        <Alert className="mb-6 bg-primary/5 border-primary/20">
          <Wallet className="h-4 w-4" />
          <AlertDescription>Connect your wallet to start sending payments</AlertDescription>
        </Alert>
      )}

      {/* User Mode Toggle */}
      <div className="flex gap-2 mb-8 p-1 bg-secondary/50 rounded-lg w-fit">
        <Button
          variant={userMode === "personal" ? "default" : "ghost"}
          size="sm"
          onClick={() => setUserMode("personal")}
          className="gap-2"
        >
          <User className="h-4 w-4" />
          Personal
        </Button>
        <Button
          variant={userMode === "business" ? "default" : "ghost"}
          size="sm"
          onClick={() => setUserMode("business")}
          className="gap-2"
        >
          <Building2 className="h-4 w-4" />
          Business
        </Button>
      </div>

      {userMode === "personal" ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Single Payment */}
          <Card className="bg-card border-border hover:border-primary/50 transition-all group cursor-pointer">
            <Link href="/batch-payment">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Send className="h-6 w-6 text-primary" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle className="text-xl">Send to Someone</CardTitle>
                <CardDescription>
                  Transfer money to a friend, family member, or anyone with a wallet address
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                    <Zap className="h-3 w-3 mr-1" />
                    {translateTerm("Gasless")}
                  </Badge>
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                    Instant
                  </Badge>
                </div>
              </CardContent>
            </Link>
          </Card>

          {/* Cross-Chain Transfer */}
          <Card className="bg-card border-border hover:border-primary/50 transition-all group cursor-pointer">
            <Link href="/omnichain">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Globe className="h-6 w-6 text-purple-500" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle className="text-xl">{translateTerm("Cross-Chain Transfer")}</CardTitle>
                <CardDescription>Send to different blockchains like Bitcoin, Ethereum, or Solana</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                    Multi-Chain
                  </Badge>
                  <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                    BTC Support
                  </Badge>
                </div>
              </CardContent>
            </Link>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Batch Payment */}
          <Card className="bg-card border-border hover:border-primary/50 transition-all group cursor-pointer">
            <Link href="/batch-payment">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle className="text-xl">Batch Payment</CardTitle>
                <CardDescription>
                  Pay multiple recipients at once - perfect for payroll, vendor payments, or distributions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                    <Zap className="h-3 w-3 mr-1" />
                    {translateTerm("Gasless")}
                  </Badge>
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                    Up to 100 recipients
                  </Badge>
                </div>
              </CardContent>
            </Link>
          </Card>

          {/* Cross-Chain Batch */}
          <Card className="bg-card border-border hover:border-primary/50 transition-all group cursor-pointer">
            <Link href="/omnichain">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Globe className="h-6 w-6 text-purple-500" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle className="text-xl">{translateTerm("Cross-Chain Payment")}</CardTitle>
                <CardDescription>
                  Pay employees or vendors across different blockchains with automatic conversion
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                    Multi-Chain
                  </Badge>
                  <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                    Auto Convert
                  </Badge>
                </div>
              </CardContent>
            </Link>
          </Card>

          {/* Card Payment */}
          <Card className="bg-card border-border hover:border-muted transition-all group cursor-pointer opacity-60">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-muted-foreground" />
                </div>
                <Badge variant="outline" className="text-xs">
                  Coming Soon
                </Badge>
              </div>
              <CardTitle className="text-xl text-muted-foreground">Card Payment</CardTitle>
              <CardDescription>
                Use your crypto debit card for everyday purchases with automatic settlement
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Scheduled Payments */}
          <Card className="bg-card border-border hover:border-muted transition-all group cursor-pointer opacity-60">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-muted-foreground" />
                </div>
                <Badge variant="outline" className="text-xs">
                  Coming Soon
                </Badge>
              </div>
              <CardTitle className="text-xl text-muted-foreground">Recurring Payments</CardTitle>
              <CardDescription>
                Set up automatic recurring payments for subscriptions and regular expenses
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}
    </main>
  )
}
