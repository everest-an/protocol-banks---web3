import {
  Send,
  Users,
  Link as LinkIcon,
  RefreshCw,
  Clock,
  Bot,
  ArrowRightLeft,
  Home,
  CreditCard,
  ShoppingBag,
  Store,
  Wallet,
  Code,
  Settings,
  PiggyBank,
  BarChart3,
  FileCheck,
  SplitSquareHorizontal,
  FileText,
} from "lucide-react"

export interface ProductItem {
  href: string
  title: string
  description: string
  icon: React.ElementType
  disabled?: boolean
}

// Trading (hero product, pinned to top)
export const tradingItems: ProductItem[] = [
  {
    href: "/trading",
    title: "AI Trading",
    description: "AI automated trading cockpit",
    icon: Bot,
  },
]

// Overview (account-level)
export const overviewItems: ProductItem[] = [
  {
    href: "/dashboard",
    title: "Dashboard",
    description: "Dashboard overview and analytics",
    icon: Home,
  },
  {
    href: "/balances",
    title: "Balances",
    description: "View wallet balances across chains",
    icon: CreditCard,
  },
  {
    href: "/analytics",
    title: "Analytics",
    description: "Financial reports and insights",
    icon: BarChart3,
  },
  {
    href: "/settings",
    title: "Settings",
    description: "API keys, webhooks, and preferences",
    icon: Settings,
  },
]

// Business (enterprise payments — consolidated, not hero)
export const businessItems: ProductItem[] = [
  {
    href: "/pay",
    title: "Pay",
    description: "Send crypto to any wallet address instantly",
    icon: Send,
  },
  {
    href: "/batch-payment",
    title: "Batch Payment",
    description: "Pay multiple recipients or split revenue",
    icon: Users,
  },
  {
    href: "/split-payments",
    title: "Split Payments",
    description: "Split bills and revenue sharing",
    icon: SplitSquareHorizontal,
  },
  {
    href: "/subscriptions",
    title: "Auto Pay",
    description: "Recurring payments & enterprise auto-pay",
    icon: Clock,
  },
  {
    href: "/vendors",
    title: "Contacts",
    description: "Manage suppliers and partners",
    icon: ShoppingBag,
  },
  {
    href: "/card",
    title: "Card",
    description: "Virtual crypto debit card",
    icon: Wallet,
  },
  {
    href: "/history",
    title: "Transactions",
    description: "History, reconciliation, and analytics",
    icon: ArrowRightLeft,
  },
  {
    href: "/reconciliation",
    title: "Reconciliation",
    description: "Match and verify payment records",
    icon: FileCheck,
  },
  {
    href: "/acquiring",
    title: "Acquiring",
    description: "Checkout, invoicing, and POS terminal",
    icon: Store,
  },
  {
    href: "/receive",
    title: "Payment Links",
    description: "Generate QR codes and shareable links",
    icon: LinkIcon,
  },
  {
    href: "/swap",
    title: "Swap",
    description: "Exchange tokens or off-ramp to fiat",
    icon: RefreshCw,
  },
  {
    href: "/yield",
    title: "Yield",
    description: "Earn interest via Aave & JustLend",
    icon: PiggyBank,
  },
  {
    href: "/agents",
    title: "Payment Agents",
    description: "Autonomous payments with session keys",
    icon: Bot,
  },
  {
    href: "/agents/proposals",
    title: "Agent Proposals",
    description: "Review and approve AI payment requests",
    icon: FileText,
  },
  {
    href: "/embed",
    title: "SDK / Embed",
    description: "Integrate payments into your app",
    icon: Code,
  },
]

// Kept for backward compatibility with any existing imports
export const paymentProducts: ProductItem[] = businessItems.slice(0, 8)
export const receivingProducts: ProductItem[] = businessItems.slice(8, 10)
export const defiProducts: ProductItem[] = businessItems.slice(10, 12)
export const advancedProducts: ProductItem[] = businessItems.slice(12)
