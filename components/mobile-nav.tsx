"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Wallet, Send, QrCode, ArrowLeftRight, Shield, ShoppingBag } from "lucide-react"

const navItems = [
  { href: "/", label: "Account", icon: Wallet },
  { href: "/batch-payment", label: "Pay", icon: Send },
  { href: "/receive", label: "Receive", icon: QrCode },
  { href: "/swap", label: "Swap", icon: ArrowLeftRight },
  { href: "/acquiring", label: "Acquiring", icon: ShoppingBag },
  { href: "/settings/multisig", label: "Multi-sig", icon: Shield },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-lg border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href === "/batch-payment" && pathname === "/send")

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
