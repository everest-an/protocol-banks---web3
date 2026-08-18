"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  tradingItems,
  overviewItems,
  businessItems,
  ProductItem
} from "@/lib/products-config"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

function SidebarSection({
  title,
  items,
  defaultCollapsed = false,
}: {
  title: string
  items: ProductItem[]
  defaultCollapsed?: boolean
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const hasActiveItem = items.some((item) => pathname === item.href || pathname.startsWith(item.href))

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="mb-1 flex w-full items-center justify-between px-4 py-1 text-[11px] font-semibold uppercase text-muted-foreground/60 tracking-[0.1em] hover:text-muted-foreground transition-colors"
      >
        <span>{title}</span>
        {defaultCollapsed && (
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", collapsed ? "" : "rotate-180")}
          />
        )}
      </button>
      {!collapsed && (
        <div className="space-y-0.5 px-2">
          {items.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/")
            return (
              <Link
                key={item.href}
                href={item.disabled ? "#" : item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-white/10 dark:bg-white/5 font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5 dark:hover:bg-white/5",
                  item.disabled && "opacity-50 pointer-events-none",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.title}</span>
              </Link>
            )
          })}
        </div>
      )}
      {defaultCollapsed && collapsed && hasActiveItem && (
        <p className="px-4 mt-0.5 text-[10px] text-primary/70 truncate">
          → {items.find((i) => pathname.startsWith(i.href))?.title}
        </p>
      )}
    </div>
  )
}

export function ProductsSidebar() {
  return (
    <aside className="w-64 hidden md:block shrink-0 border-r border-white/10 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-[12px] backdrop-saturate-[1.2]">
      <div className="sticky top-16 h-[calc(100vh-4rem)]">
        <ScrollArea className="h-full py-4">
          <SidebarSection title="Trading" items={tradingItems} />
          <Separator className="mx-4 mb-3 w-auto" />
          <SidebarSection title="Overview" items={overviewItems} />
          <Separator className="mx-4 mb-3 w-auto" />
          <SidebarSection title="Business" items={businessItems} defaultCollapsed />
        </ScrollArea>
      </div>
    </aside>
  )
}
