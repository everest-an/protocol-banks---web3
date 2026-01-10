import { Home, CreditCard, Users, BarChart2, Receipt, FileText, HelpCircle, Shield, DollarSign } from "lucide-react"

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/pay", label: "Pay", icon: CreditCard },
  { href: "/batch-payment", label: "Batch Payment", icon: Receipt },
  { href: "/vendors", label: "Vendors", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/fees", label: "Fees", icon: DollarSign }, // Added Fees nav item
  { href: "/security", label: "Security", icon: Shield },
  { href: "/whitepaper", label: "Whitepaper", icon: FileText },
  { href: "/help", label: "Help", icon: HelpCircle },
]
