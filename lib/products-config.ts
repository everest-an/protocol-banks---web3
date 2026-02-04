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
  Zap,
  Shield,
  ArrowRightLeft
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

// 💳 Payments - 支付相关
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
    href: "/receive",
    title: "Payment Links",
    description: "Generate QR codes and shareable payment links",
    icon: LinkIcon,
    color: "bg-green-500/10 text-green-500",
  },
]

// 🛒 Commerce - 商业收款
export const commerceProducts: ProductItem[] = [
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
    badge: "Coming Soon",
    badgeColor: "bg-gray-500/20 text-gray-500",
    disabled: true,
  },
  {
    href: "/terminal",
    title: "POS Terminal",
    description: "In-person payments with QR codes",
    icon: Monitor,
    color: "bg-amber-500/10 text-amber-500",
    badge: "Coming Soon",
    badgeColor: "bg-gray-500/20 text-gray-500",
    disabled: true,
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
    href: "/subscriptions",
    title: "Subscriptions",
    description: "Recurring payments with ERC-3009",
    icon: Clock,
    color: "bg-purple-500/10 text-purple-500",
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
]
