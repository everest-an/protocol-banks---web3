import {
  Send,
  Users,
  Link as LinkIcon,
  RefreshCw,
  Layers,
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
  Monitor,
  ShoppingCart,
} from "lucide-react"

export interface ProductItem {
  href: string
  title: string
  description: string
  icon: React.ElementType
  disabled?: boolean
}

// Overview
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
    href: "/vendors",
    title: "Contacts",
    description: "Manage suppliers and partners",
    icon: ShoppingBag,
  },
  {
    href: "/settings",
    title: "Settings",
    description: "API keys, webhooks, and preferences",
    icon: Settings,
  },
]

// Payments
export const paymentProducts: ProductItem[] = [
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
]

// Receiving
export const receivingProducts: ProductItem[] = [
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
    href: "/checkout",
    title: "Checkout",
    description: "Hosted checkout pages for merchants",
    icon: ShoppingCart,
  },
  {
    href: "/terminal",
    title: "POS Terminal",
    description: "Point-of-sale payment terminal",
    icon: Monitor,
  },
]

// DeFi
export const defiProducts: ProductItem[] = [
  {
    href: "/swap",
    title: "Swap",
    description: "Exchange tokens or off-ramp to fiat",
    icon: RefreshCw,
  },
  {
    href: "/omnichain",
    title: "Bridge",
    description: "Cross-chain asset transfers",
    icon: Layers,
  },
  {
    href: "/yield",
    title: "Yield",
    description: "Earn interest via Aave & JustLend",
    icon: PiggyBank,
  },
]

// Advanced
export const advancedProducts: ProductItem[] = [
  {
    href: "/agents",
    title: "AI Agents",
    description: "Autonomous payments with session keys",
    icon: Bot,
  },
  {
    href: "/embed",
    title: "SDK / Embed",
    description: "Integrate payments into your app",
    icon: Code,
  },
]
