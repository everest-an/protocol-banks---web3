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

// Wallet (account-level — merged from dashboard + balances)
export const overviewItems: ProductItem[] = [
  {
    href: "/balances",
    title: "Wallet",
    description: "Balances, activity, and quick actions across chains",
    icon: CreditCard,
  },
  {
    href: "/settings",
    title: "Settings",
    description: "API keys, webhooks, and preferences",
    icon: Settings,
  },
]

// Business (enterprise payments + analytics — consolidated, not hero)
export const businessItems: ProductItem[] = [
  {
    href: "/analytics",
    title: "Analytics",
    description: "Enterprise treasury reports and insights",
    icon: BarChart3,
  },
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
