"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import {
  Wallet,
  Send,
  QrCode,
  History,
  MoreHorizontal,
  Play,
  StopCircle,
  Menu,
  Users,
  Shield,
  DollarSign,
  Loader2,
  Globe,
  BarChart3,
  HelpCircle,
} from "lucide-react"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState } from "react"

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
  const [isOpen, setIsOpen] = useState(false)

  const mainNavItems = [
    { href: "/", label: "Account", icon: Wallet, description: "Balance & Overview" },
    { href: "/send", label: "Pay", icon: Send, description: "Send Payments" },
    { href: "/receive", label: "Receive", icon: QrCode, description: "Get Paid" },
    { href: "/history", label: "History", icon: History, description: "Transactions" },
  ]

  // More menu items - less frequently used features
  const moreNavItems = [
    { href: "/omnichain", label: "Cross-Chain", icon: Globe, description: "Swap & Bridge" },
    { href: "/vendors", label: "Contacts", icon: Users, description: "Address Book" },
    { href: "/analytics", label: "Reports", icon: BarChart3, description: "Analytics" },
    { href: "/security", label: "Security", icon: Shield, description: "Protection" },
    { href: "/fees", label: "Fees", icon: DollarSign, description: "Fee Settings" },
    { href: "/help", label: "Help", icon: HelpCircle, description: "Support" },
  ]

  // Check if current path matches any "more" item
  const isMoreActive = moreNavItems.some((item) => pathname === item.href)
  // Check if on batch-payment (which is accessed via /send)
  const isSendActive = pathname === "/send" || pathname === "/batch-payment"

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-4 md:gap-8 overflow-hidden">
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
                    <Image src="/logo-text-white.png" alt="Protocol Bank" fill className="object-contain object-left" />
                  </div>
                </Link>

                {/* Main Navigation */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground px-4 mb-2">MAIN</p>
                  {mainNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = item.href === "/send" ? isSendActive : pathname === item.href
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
                        <div>
                          <div>{item.label}</div>
                          <div className="text-xs text-muted-foreground">{item.description}</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>

                {/* More Navigation */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground px-4 mb-2">MORE</p>
                  {moreNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
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
              <Image src="/logo-text-white.png" alt="Protocol Bank" fill className="object-contain object-left" />
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

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon
              const isActive = item.href === "/send" ? isSendActive : pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}

            {/* More Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isMoreActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span>More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                {moreNavItems.map((item, index) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <div key={item.href}>
                      {index === 3 && <DropdownMenuSeparator />}
                      <DropdownMenuItem asChild>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-2 cursor-pointer ${isActive ? "text-primary" : ""}`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </DropdownMenuItem>
                    </div>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
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
          <UnifiedWalletButton />
        </div>
      </div>
    </header>
  )
}
