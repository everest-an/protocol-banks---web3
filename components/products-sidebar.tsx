"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { tradingItems, overviewItems, businessItems, ProductItem } from "@/lib/products-config"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

function SidebarSection({ title, items }: { title: string; items: ProductItem[] }) {
  const pathname = usePathname()

  return (
    <div className="mb-3">
      <div className="mb-1 px-4 py-1 text-[11px] font-semibold uppercase text-muted-foreground/60 tracking-[0.1em]">
        {title}
      </div>
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
          <SidebarSection title="Business" items={businessItems} />
        </ScrollArea>
      </div>
    </aside>
  )
}
