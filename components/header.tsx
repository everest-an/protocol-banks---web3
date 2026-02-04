"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import {
  Wallet,
  Menu,
  Play,
  StopCircle,
  Loader2,
  ArrowLeftRight,
  CreditCard,
  ShoppingBag,
  Grid3X3,
} from "lucide-react"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { useTheme } from "next-themes"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useState, useEffect } from "react"
import { SoundSettings } from "@/components/sound-settings"
import { ThemeToggle } from "@/components/theme-toggle"

const UnifiedWalletButton = dynamic(() => import("./unified-wallet-button").then((mod) => mod.UnifiedWalletButton), {
  ssr: false,
  loading: () => (
    <Button variant="default" size="sm" disabled className="text-xs sm:text-sm px-3 sm:px-4">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading...
    </Button>
  ),
})

export function Header() {
  const pathname = usePathname()
  const { isDemoMode, toggleDemoMode } = useDemo()
  const { theme, resolvedTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Determine which logo to use based on theme
  const logoTextSrc = mounted && resolvedTheme === 'light' ? '/logo-text-black.png' : '/logo-text-white.png'

  const navItems = [
    { href: "/", label: "Home", icon: Wallet },
    { href: "/balances", label: "Balances", icon: CreditCard },
    { href: "/history", label: "Transactions", icon: ArrowLeftRight },
    { href: "/vendors", label: "Contacts", icon: ShoppingBag },
    { href: "/products", label: "Products", icon: Grid3X3 },
  ]

  const isActivePath = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-4 md:gap-6 overflow-hidden">
          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] bg-card border-border">
              <div className="flex flex-col gap-6 py-4">
                <Link href="/" className="flex items-center space-x-3" onClick={() => setIsOpen(false)}>
                  <div className="h-8 w-8 relative shrink-0">
                    <Image src="/logo.png" alt="Protocol Bank Mark" fill className="object-contain" />
                  </div>
                  <div className="h-5 w-32 relative">
                    <Image src={logoTextSrc} alt="Protocol Bank" fill className="object-contain object-left" />
                  </div>
                </Link>

                {/* Navigation */}
                <div className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = isActivePath(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-primary/10 text-primary border-l-2 border-primary"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </div>

                {/* Demo Toggle */}
                <div className="pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      toggleDemoMode()
                      setIsOpen(false)
                    }}
                    className={`w-full ${
                      isDemoMode
                        ? "text-primary border-primary/20 bg-primary/5 hover:bg-primary/10"
                        : "border-border text-foreground hover:bg-secondary/50 bg-transparent"
                    }`}
                  >
                    {isDemoMode ? (
                      <>
                        <StopCircle className="mr-2 h-4 w-4" />
                        Exit Demo Mode
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Try Demo Mode
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div className="h-7 w-7 sm:h-8 sm:w-8 relative shrink-0">
              <Image src="/logo.png" alt="Protocol Bank Mark" fill className="object-contain" />
            </div>
            <div className="hidden sm:block h-4 sm:h-5 w-24 sm:w-32 relative">
              <Image src={logoTextSrc} alt="Protocol Bank" fill className="object-contain object-left" />
            </div>
          </Link>

          {isDemoMode && (
            <Badge
              variant="outline"
              className="hidden lg:inline-flex border-primary text-primary animate-pulse whitespace-nowrap text-xs"
            >
              DEMO
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SoundSettings />
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={toggleDemoMode}
            className={`hidden sm:flex ${
              isDemoMode
                ? "text-primary border-primary/20 bg-primary/5 hover:bg-primary/10"
                : "border-border text-foreground hover:bg-muted bg-transparent"
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
          <UnifiedWalletButton />
        </div>
      </div>
    </header>
  )
}
