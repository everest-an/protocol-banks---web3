"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Grid3X3, Wallet, Send, Layers, ArrowLeftRight } from "lucide-react"

const navItems = [
  { href: "/products", label: "Products", icon: Grid3X3 },
  { href: "/history", label: "Payments", icon: Wallet },
  { href: "/pay", label: "Pay", icon: Send },
  { href: "/batch-payment", label: "Batch", icon: Layers },
  { href: "/swap", label: "Swap", icon: ArrowLeftRight },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-lg border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground active:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
