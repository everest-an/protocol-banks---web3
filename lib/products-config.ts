import {
  Send,
  Users,
  Link as LinkIcon,
  RefreshCw,
  Clock,
  Bot,
  ArrowRightLeft,
  CreditCard,
  ShoppingBag,
  Wallet,
  Code,
  Settings,
  BarChart3,
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

// Wallet (account-level â€” merged from dashboard + balances)
export const overviewItems: ProductItem[] = [
  {
    href: "/balances",
    title: "Wallet",
    description: "Balances, activity, and quick actions across chains",
    icon: CreditCard,
  },
  {
    href: "/agent-commerce/orders",
    title: "Agent Commerce",
    description: "Services, quotes, orders and agent payments",
    icon: ShoppingBag,
  },
  {
    href: "/agents/fleet",
    title: "Agent Fleet",
    description: "Budgets, caps, status and spend across every agent",
    icon: Users,
  },
  {
    href: "/card",
    title: "Card",
    description: "Virtual crypto debit card",
    icon: Wallet,
  },
  {
    href: "/agent-api",
    title: "Agent API",
    description: "Commerce, payments, cards and trading under one mandate",
    icon: Code,
  },
  {
    href: "/settings",
    title: "Settings",
    description: "API keys, webhooks, and preferences",
    icon: Settings,
  },
]

// Business (enterprise payments + analytics â€” consolidated, not hero)
export const businessItems: ProductItem[] = [
  {
    href: "/analytics",
    title: "Analytics",
    description: "Enterprise treasury reports and insights",
    icon: BarChart3,
  },
  {
    href: "/pay",
    title: "Payments",
    description: "Single, batch, split, auto-pay and collect",
    icon: Send,
  },
  {
    href: "/vendors",
    title: "Contacts",
    description: "Manage suppliers and partners",
    icon: ShoppingBag,
  },
  {
    href: "/history",
    title: "Transactions",
    description: "History, reconciliation, and analytics",
    icon: ArrowRightLeft,
  },
  {
    href: "/swap",
    title: "Swap",
    description: "Exchange tokens across chains via Rango",
    icon: RefreshCw,
  },
  {
    href: "/agents",
    title: "Payment Agents",
    description: "Agent budgets, wallets and cards",
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

