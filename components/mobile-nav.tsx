"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Wallet,
  ArrowLeftRight,
  Send,
  LayoutGrid,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  overviewItems,
  paymentProducts,
  receivingProducts,
  defiProducts,
  advancedProducts,
  type ProductItem,
} from "@/lib/products-config"

// 底部导航 - 4个核心入口 + 1个抽屉触发按钮
const coreNav = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/balances", label: "Balances", icon: Wallet },
  { href: "/pay", label: "Pay", icon: Send },
  { href: "/history", label: "Activity", icon: ArrowLeftRight },
]

// 产品分组（用于抽屉）
const productSections = [
  { title: "Overview", items: overviewItems },
  { title: "Payments", items: paymentProducts },
  { title: "Receiving", items: receivingProducts },
  { title: "DeFi", items: defiProducts },
  { title: "Advanced", items: advancedProducts },
]

function ProductSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string
  items: ProductItem[]
  pathname: string
  onNavigate: () => void
}) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase text-muted-foreground/60 tracking-[0.1em]">
        {title}
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (pathname.startsWith(item.href) && item.href !== "/")
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.disabled ? "#" : item.href}
              onClick={onNavigate}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl text-center",
                "transition-all duration-200 active:scale-95",
                "border",
                isActive
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-white/40 dark:bg-slate-800/40 border-white/15 dark:border-white/8 text-muted-foreground hover:text-foreground",
                item.disabled && "opacity-40 pointer-events-none"
              )}
            >
              <Icon
                className={cn(
                  "size-5 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span className="text-[11px] font-medium leading-tight line-clamp-1">
                {item.title}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function MobileNav() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const closeDrawer = () => setDrawerOpen(false)

  return (
    <>
      {/* 产品抽屉遮罩 */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden"
          onClick={closeDrawer}
        />
      )}

      {/* 产品抽屉（从底部滑出） */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[70] md:hidden",
          "transition-transform duration-300 ease-out",
          drawerOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
        )}
      >
        <div
          className={cn(
            "mx-2 mb-[calc(4rem+env(safe-area-inset-bottom,0px)+0.5rem)]",
            "max-h-[70vh] overflow-y-auto overscroll-contain",
            "rounded-2xl",
            "bg-white/80 dark:bg-slate-900/85",
            "backdrop-blur-[24px] backdrop-saturate-[1.5]",
            "border border-white/20 dark:border-white/10",
            "shadow-[0_-8px_32px_rgba(0,0,0,0.12)]"
          )}
        >
          {/* 拖拽把手 */}
          <div className="flex justify-center pt-2">
            <div className="w-8 h-1 rounded-full bg-muted-foreground/20" />
          </div>

          {/* 抽屉头部 */}
          <div className="flex items-center justify-between px-4 py-2.5">
            <h2 className="text-base font-semibold">All Products</h2>
            <button
              onClick={closeDrawer}
              className="p-1.5 rounded-full hover:bg-muted/50 transition-colors"
            >
              <X className="size-5 text-muted-foreground" />
            </button>
          </div>

          {/* 产品列表 */}
          <div className="px-4 pb-4">
            {productSections.map((section) => (
              <ProductSection
                key={section.title}
                title={section.title}
                items={section.items}
                pathname={pathname}
                onNavigate={closeDrawer}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 底部导航栏（玻璃态） */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[80] md:hidden",
          "pb-safe",
          "bg-white/80 dark:bg-slate-900/80",
          "backdrop-blur-[20px] backdrop-saturate-[1.4]",
          "border-t border-white/20 dark:border-white/10",
          "shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
        )}
      >
        <div className="flex items-center justify-around h-16">
          {coreNav.map((item) => {
            const Icon = item.icon
            const isActive =
              pathname === item.href ||
              (pathname.startsWith(`${item.href}/`) && item.href !== "/")

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => drawerOpen && closeDrawer()}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 w-full h-full",
                  "transition-colors duration-200",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                )}
              >
                <Icon className="size-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}

          {/* More 按钮（打开产品抽屉） */}
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 w-full h-full",
              "transition-colors duration-200",
              drawerOpen
                ? "text-primary"
                : "text-muted-foreground active:text-foreground"
            )}
          >
            <LayoutGrid className="size-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
