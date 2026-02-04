"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  paymentProducts,
  commerceProducts,
  defiProducts,
  advancedProducts,
  ProductItem
} from "@/lib/products-config"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

function SidebarSection({ title, items }: { title: string, items: ProductItem[] }) {
  const pathname = usePathname()

  return (
    <div className="mb-6">
      <h3 className="mb-2 px-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
        {title}
      </h3>
      <div className="space-y-1 px-2">
        {items.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/')
          return (
            <Button
              key={item.href}
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start font-normal h-9",
                isActive && "font-medium"
              )}
              asChild
            >
              <Link href={item.href}>
                <item.icon className={cn("mr-2 h-4 w-4", item.color.split(" ")[1])} />
                {item.title}
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
    <aside className="w-64 border-r hidden md:block shrink-0">
      <div className="sticky top-16 h-[calc(100vh-4rem)]">
        <ScrollArea className="h-full py-6">
          <SidebarSection title="Payments" items={paymentProducts} />
          <SidebarSection title="Commerce" items={commerceProducts} />
          <SidebarSection title="DeFi" items={defiProducts} />
          <SidebarSection title="Advanced" items={advancedProducts} />
        </ScrollArea>
      </div>
    </aside>
  )
}
