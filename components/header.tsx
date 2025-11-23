"use client"

import Link from "next/link"
import { WalletButton } from "./wallet-button"
import { LayoutDashboard, Users, Send, Play, StopCircle, Menu, Receipt } from "lucide-react"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useState } from "react"

export function Header() {
  const pathname = usePathname()
  const { isDemoMode, toggleDemoMode } = useDemo()
  const [isOpen, setIsOpen] = useState(false)

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/batch-payment", label: "Batch Payment", icon: Send },
    { href: "/receive", label: "Receive", icon: Receipt },
    { href: "/vendors", label: "Wallet Tags", icon: Users },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-4 md:gap-8 overflow-hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[240px] sm:w-[300px] bg-card border-border">
              <div className="flex flex-col gap-6 py-4">
                <Link href="/" className="flex items-center space-x-3" onClick={() => setIsOpen(false)}>
                  <div className="h-8 w-8 relative shrink-0">
                    <Image src="/logo.png" alt="Protocol Bank Mark" fill className="object-contain" />
                  </div>
                  <div className="h-5 w-32 relative">
                    <Image src="/logo-text-white.png" alt="Protocol Bank" fill className="object-contain object-left" />
                  </div>
                </Link>
                <nav className="flex flex-col gap-2">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    )
                  })}
                </nav>
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/" className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div className="h-7 w-7 sm:h-8 sm:w-8 relative shrink-0">
              <Image src="/logo.png" alt="Protocol Bank Mark" fill className="object-contain" />
            </div>
            <div className="hidden sm:block h-4 sm:h-5 w-24 sm:w-32 relative">
              <Image src="/logo-text-white.png" alt="Protocol Bank" fill className="object-contain object-left" />
            </div>
          </Link>

          {isDemoMode && (
            <Badge
              variant="outline"
              className="hidden lg:inline-flex border-primary text-primary animate-pulse whitespace-nowrap text-xs"
            >
              DEMO MODE
            </Badge>
          )}

          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleDemoMode}
            className={`hidden sm:flex ${
              isDemoMode
                ? "text-white border-white/20 bg-white/5 hover:bg-white/10"
                : "border-white text-white hover:bg-white/10 bg-transparent"
            }`}
          >
            {isDemoMode ? (
              <>
                <StopCircle className="mr-2 h-4 w-4" />
                <span className="hidden lg:inline">Exit Demo</span>
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                <span className="hidden lg:inline">Try Demo</span>
              </>
            )}
          </Button>
          <WalletButton />
        </div>
      </div>
    </header>
  )
}
