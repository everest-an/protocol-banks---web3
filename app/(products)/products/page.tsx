"use client"

import Link from "next/link"
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  FileText,
  Zap,
  ChevronRight,
  Sparkles,
  Bot,
} from "lucide-react"

export default function ProductsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-6 px-4 space-y-8 pb-24 md:pb-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Products</h1>
            <p className="text-muted-foreground">
              Select a product from the sidebar to get started
            </p>
          </div>
          <Link href="/help">
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="h-4 w-4" />
              Documentation
            </Button>
          </Link>
        </div>

        {/* Featured: AI Agents */}
        <GlassCard className="bg-gradient-to-br from-yellow-500/10 via-background to-purple-500/10 border-yellow-500/20 overflow-hidden">
          <GlassCardContent className="pt-6 pb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-yellow-500/20">
                  <Bot className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">AI-Powered Payments</h3>
                    <Badge className="bg-yellow-500/20 text-yellow-600">New</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Enable autonomous payments with session keys. Perfect for AI agents,
                    automated trading bots, and smart contract integrations.
                  </p>
                </div>
              </div>
              <Link href="/agents">
                <Button className="gap-2 bg-yellow-500 hover:bg-yellow-600 text-black">
                  <Zap className="h-4 w-4" />
                  Try AI Agents
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Developer Resources */}
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="text-lg">Developer Resources</GlassCardTitle>
            <GlassCardDescription>Build on Protocol Banks</GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link href="/help">
                <div className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">API Docs</p>
                    <p className="text-xs text-muted-foreground">REST & x402 reference</p>
                  </div>
                </div>
              </Link>
              <Link href="/whitepaper">
                <div className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Whitepaper</p>
                    <p className="text-xs text-muted-foreground">Technical specifications</p>
                  </div>
                </div>
              </Link>
              <Link href="/embed">
                <div className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Embed SDK</p>
                    <p className="text-xs text-muted-foreground">Payment widgets</p>
                  </div>
                </div>
              </Link>
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>
    </div>
  )
}
