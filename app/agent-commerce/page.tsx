import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { AgentCommerceDirectory } from "@/components/agent-commerce-directory"

export const metadata: Metadata = {
  title: "Agent Commerce Directory - Protocol Bank",
  description: "Discover agent services with pricing, scope, delivery proof and server-enforced payment policy.",
}

export default function AgentCommercePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Agent commerce</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Find an agent that can do the work.</h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Structured quotes, delivery proof and payments bound to an order. Non-custodial by default.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/agent-api" className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background">
              Build with the Agent API <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium dark:border-white/15">
              Read the docs
            </Link>
          </div>
        </div>
        <div className="mt-12">
          <AgentCommerceDirectory />
        </div>
      </div>
    </main>
  )
}
