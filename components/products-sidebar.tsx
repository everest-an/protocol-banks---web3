"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  tradingItems,
  overviewItems,
  businessItems,
  ProductItem
} from "@/lib/products-config"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

function SidebarSection({ title, items }: { title: string, items: ProductItem[] }) {
  const pathname = usePathname()

  return (
    <div className="mb-4">
      <h3 className="mb-2 px-4 text-[11px] font-semibold uppercase text-muted-foreground/60 tracking-[0.1em]">
        {title}
      </h3>
      <div className="space-y-0.5 px-2">
        {items.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/')
          return (
            <Button
              key={item.href}
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start h-9",
                isActive
                  ? "font-bold text-foreground"
                  : "font-semibold text-foreground/80 hover:text-foreground",
                item.disabled && "opacity-50 pointer-events-none"
              )}
              asChild
            >
              <Link href={item.disabled ? "#" : item.href}>
                <item.icon
                  className={cn(
                    "mr-2.5 h-4 w-4 stroke-[2]",
                    isActive
                      ? "text-foreground"
                      : "text-foreground/60"
                  )}
                />
                <span className="flex-1 text-left text-sm">{item.title}</span>
              </Link>
            </Button>
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
          <Separator className="mx-4 mb-4 w-auto" />
          <SidebarSection title="Overview" items={overviewItems} />
          <Separator className="mx-4 mb-4 w-auto" />
          <SidebarSection title="Business" items={businessItems} />
        </ScrollArea>
      </div>
    </aside>
  )
}
