import { Home, Wallet, ArrowLeftRight, Users, Grid3X3, Settings, HelpCircle, Store, FileText, Link2, Monitor, Banknote } from "lucide-react"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/balances", label: "Balances", icon: Wallet },
  { href: "/history", label: "Transactions", icon: ArrowLeftRight },
  { href: "/vendors", label: "Contacts", icon: Users },
  { href: "/products", label: "Products", icon: Grid3X3 },
  { href: "/acquiring", label: "Acquiring", icon: Store },
  { href: "/acquiring/payment-links", label: "Payment Links", icon: Link2 },
  { href: "/acquiring/invoices", label: "Invoices", icon: FileText },
  { href: "/terminal", label: "POS Terminal", icon: Monitor },
  { href: "/offramp", label: "Off-Ramp", icon: Banknote },
]

const secondaryNavItems = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help", icon: HelpCircle },
]
