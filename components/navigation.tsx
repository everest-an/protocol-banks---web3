import { Home, CreditCard, Users, BarChart2, Receipt, FileText, HelpCircle, Shield } from "lucide-react"

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/pay", label: "Pay", icon: CreditCard },
  { href: "/batch-payment", label: "Batch Payment", icon: Receipt },
  { href: "/vendors", label: "Vendors", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/security", label: "Security", icon: Shield }, // Added Security nav item
  { href: "/whitepaper", label: "Whitepaper", icon: FileText },
  { href: "/help", label: "Help", icon: HelpCircle },
]
