import {
  Send,
  Users,
  Link as LinkIcon,
  ShoppingCart,
  FileText,
  Monitor,
  RefreshCw,
  Layers,
  Clock,
  Bot,
  Globe,
  BarChart3,
  ArrowRightLeft,
  Home,
  CreditCard,
  ShoppingBag,
  PieChart,
  Store,
  Banknote,
  Wallet,
  Code,
  Settings,
} from "lucide-react"

export interface ProductItem {
  href: string
  title: string
  description: string
  icon: React.ElementType
  color: string
  badge?: string
  badgeColor?: string
  disabled?: boolean
}

// 📊 Overview - 核心导航
export const overviewItems: ProductItem[] = [
  {
    href: "/",
    title: "Home",
    description: "Dashboard overview",
    icon: Home,
    color: "bg-slate-500/10 text-slate-500",
  },
  {
    href: "/balances",
    title: "Balances",
    description: "View wallet balances across chains",
    icon: CreditCard,
    color: "bg-emerald-500/10 text-emerald-500",
  },
  {
    href: "/vendors",
    title: "Contacts",
    description: "Manage suppliers and partners",
    icon: ShoppingBag,
    color: "bg-orange-500/10 text-orange-500",
  },
  {
    href: "/settings",
    title: "Settings",
    description: "API keys, webhooks, and preferences",
    icon: Settings,
    color: "bg-gray-500/10 text-gray-500",
  },
]

// 💳 Payments - 支付
export const paymentProducts: ProductItem[] = [
  {
    href: "/pay",
    title: "Pay",
    description: "Send crypto to any wallet address instantly",
    icon: Send,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    href: "/batch-payment",
    title: "Batch Payment",
    description: "Pay multiple recipients in one transaction",
    icon: Users,
    color: "bg-orange-500/10 text-orange-500",
  },
  {
    href: "/split-payments",
    title: "Split Payments",
    description: "Distribute revenue to multiple recipients",
    icon: PieChart,
    color: "bg-pink-500/10 text-pink-500",
    badge: "New",
    badgeColor: "bg-pink-500/20 text-pink-500",
  },
  {
    href: "/subscriptions",
    title: "Auto Pay",
    description: "Recurring payments & enterprise auto-pay",
    icon: Clock,
    color: "bg-purple-500/10 text-purple-500",
  },
  {
    href: "/card",
    title: "Card",
    description: "Virtual crypto debit card",
    icon: Wallet,
    color: "bg-rose-500/10 text-rose-500",
    badge: "New",
    badgeColor: "bg-rose-500/20 text-rose-500",
  },
  {
    href: "/history",
    title: "Transactions",
    description: "Payment history and activity",
    icon: ArrowRightLeft,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    href: "/analytics",
    title: "Analytics",
    description: "Payment analytics and reports",
    icon: BarChart3,
    color: "bg-indigo-500/10 text-indigo-500",
  },
]

// 📥 Receiving - 收款
export const receivingProducts: ProductItem[] = [
  {
    href: "/acquiring",
    title: "Acquiring",
    description: "Merchant SDK, orders, and payment acceptance",
    icon: Store,
    color: "bg-teal-500/10 text-teal-500",
  },
  {
    href: "/receive",
    title: "Payment Links",
    description: "Generate QR codes and shareable payment links",
    icon: LinkIcon,
    color: "bg-green-500/10 text-green-500",
  },
  {
    href: "/checkout",
    title: "Checkout",
    description: "Accept crypto payments on your website",
    icon: ShoppingCart,
    color: "bg-emerald-500/10 text-emerald-500",
    badge: "Popular",
    badgeColor: "bg-emerald-500/20 text-emerald-500",
  },
  {
    href: "/acquiring/invoices",
    title: "Invoicing",
    description: "Professional crypto invoices with tracking",
    icon: FileText,
    color: "bg-indigo-500/10 text-indigo-500",
    badge: "New",
    badgeColor: "bg-indigo-500/20 text-indigo-500",
  },
  {
    href: "/terminal",
    title: "POS Terminal",
    description: "In-person payments with QR codes",
    icon: Monitor,
    color: "bg-amber-500/10 text-amber-500",
    badge: "Beta",
    badgeColor: "bg-amber-500/20 text-amber-500",
  },
]

// 🔄 DeFi - 去中心化金融
export const defiProducts: ProductItem[] = [
  {
    href: "/swap",
    title: "Swap",
    description: "Exchange tokens at the best rates",
    icon: RefreshCw,
    color: "bg-pink-500/10 text-pink-500",
  },
  {
    href: "/omnichain",
    title: "Cross-chain",
    description: "Bridge assets across multiple chains",
    icon: Layers,
    color: "bg-cyan-500/10 text-cyan-500",
    badge: "Beta",
    badgeColor: "bg-cyan-500/20 text-cyan-500",
  },
  {
    href: "/offramp",
    title: "Off-ramp",
    description: "Convert crypto to fiat currency",
    icon: Banknote,
    color: "bg-green-500/10 text-green-500",
  },
]

// 🤖 Advanced - 高级功能
export const advancedProducts: ProductItem[] = [
  {
    href: "/agents",
    title: "AI Agents",
    description: "Autonomous payments with session keys",
    icon: Bot,
    color: "bg-yellow-500/10 text-yellow-500",
    badge: "New",
    badgeColor: "bg-yellow-500/20 text-yellow-500",
  },
  {
    href: "/omnichain",
    title: "Omnichain Vault",
    description: "Unified cross-chain asset management",
    icon: Globe,
    color: "bg-violet-500/10 text-violet-500",
    badge: "Beta",
    badgeColor: "bg-violet-500/20 text-violet-500",
  },
  {
    href: "/embed",
    title: "SDK / Embed",
    description: "Integrate payments into your app",
    icon: Code,
    color: "bg-slate-500/10 text-slate-500",
  },
]
