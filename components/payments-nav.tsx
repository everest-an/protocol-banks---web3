"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const MODES = [
  { href: "/pay", label: "Single" },
  { href: "/batch-payment", label: "Batch" },
  { href: "/split-payments", label: "Split" },
  { href: "/subscriptions", label: "Auto Pay" },
  { href: "/receive", label: "Collect" },
]

export function PaymentsNav() {
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/70 bg-muted/30 p-1">
      {MODES.map((mode) => {
        const active = pathname === mode.href
        return (
          <Link
            key={mode.href}
            href={mode.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            {mode.label}
          </Link>
        )
      })}
    </div>
  )
}
