"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Send, 
  CreditCard, 
  Users, 
  RefreshCw, 
  Link as LinkIcon,
  FileText,
  Monitor,
  Zap,
  Globe,
  LayoutGrid,
  Clock,
  Shield,
  Wallet,
  ArrowRightLeft,
  ChevronRight,
  Sparkles
} from "lucide-react"

interface ProductItem {
  href: string
  title: string
  description: string
  icon: React.ElementType
  color: string
  badge?: string
  badgeColor?: string
}

const paymentProducts: ProductItem[] = [
  {
    href: "/pay",
    title: "Send Payment",
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
    title: "Receive",
    description: "Generate QR codes and payment links",
    icon: LinkIcon,
    color: "bg-green-500/10 text-green-500",
  },
]

const commerceProducts: ProductItem[] = [
  {
    href: "/checkout",
    title: "Checkout",
    description: "Accept crypto payments on your website",
    icon: CreditCard,
    color: "bg-emerald-500/10 text-emerald-500",
    badge: "Popular",
    badgeColor: "bg-emerald-500/20 text-emerald-500",
  },
  {
    href: "/acquiring/payment-links",
    title: "Payment Links",
    description: "No-code payment links with branding and analytics",
    icon: LinkIcon,
    color: "bg-teal-500/10 text-teal-500",
    badge: "New",
    badgeColor: "bg-teal-500/20 text-teal-500",
  },
  {
    href: "/acquiring/invoices",
    title: "Invoicing",
    description: "Crypto invoices with dual-currency support",
    icon: FileText,
    color: "bg-indigo-500/10 text-indigo-500",
    badge: "New",
    badgeColor: "bg-indigo-500/20 text-indigo-500",
  },
  {
    href: "/embed",
    title: "Payment Button",
    description: "Embeddable payment widgets for any site",
    icon: LayoutGrid,
    color: "bg-violet-500/10 text-violet-500",
  },
  {
    href: "/subscriptions",
    title: "Subscriptions",
    description: "Recurring payment management",
    icon: Clock,
    color: "bg-purple-500/10 text-purple-500",
  },
  {
    href: "/terminal",
    title: "POS Terminal",
    description: "In-person crypto payments with QR codes",
    icon: Monitor,
    color: "bg-amber-500/10 text-amber-500",
    badge: "New",
    badgeColor: "bg-amber-500/20 text-amber-500",
  },
]

const defiProducts: ProductItem[] = [
  {
    href: "/swap",
    title: "Swap",
    description: "Exchange tokens at the best rates",
    icon: RefreshCw,
    color: "bg-pink-500/10 text-pink-500",
  },
  {
    href: "/offramp",
    title: "Off-Ramp",
    description: "Convert crypto to fiat with regulated providers",
    icon: Send,
    color: "bg-emerald-500/10 text-emerald-500",
    badge: "New",
    badgeColor: "bg-emerald-500/20 text-emerald-500",
  },
  {
    href: "/omnichain",
    title: "Omnichain Vault",
    description: "Cross-chain asset management",
    icon: Globe,
    color: "bg-cyan-500/10 text-cyan-500",
    badge: "Beta",
    badgeColor: "bg-cyan-500/20 text-cyan-500",
  },
]

const advancedProducts: ProductItem[] = [
  {
    href: "/agents",
    title: "AI Agents",
    description: "Automated payments with session keys",
    icon: Zap,
    color: "bg-yellow-500/10 text-yellow-500",
    badge: "New",
    badgeColor: "bg-yellow-500/20 text-yellow-500",
  },
  {
    href: "/acquiring",
    title: "Merchant Acquiring",
    description: "Enterprise payment processing",
    icon: Monitor,
    color: "bg-slate-500/10 text-slate-500",
  },
  {
    href: "/card",
    title: "Virtual Card",
    description: "Spend crypto anywhere cards are accepted",
    icon: CreditCard,
    color: "bg-rose-500/10 text-rose-500",
    badge: "Coming Soon",
    badgeColor: "bg-rose-500/20 text-rose-500",
  },
]

function ProductCard({ product }: { product: ProductItem }) {
  const isComingSoon = product.badge === "Coming Soon"
  
  const content = (
    <Card className={`h-full transition-all ${isComingSoon ? 'opacity-60' : 'hover:border-primary/50 hover:shadow-md cursor-pointer'}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-3 rounded-xl ${product.color}`}>
            <product.icon className="h-5 w-5" />
          </div>
          {product.badge && (
            <Badge variant="secondary" className={`text-xs ${product.badgeColor}`}>
              {product.badge}
            </Badge>
          )}
        </div>
        <h3 className="font-semibold mb-1">{product.title}</h3>
        <p className="text-sm text-muted-foreground">{product.description}</p>
      </CardContent>
    </Card>
  )

  if (isComingSoon) {
    return content
  }

  return (
    <Link href={product.href}>
      {content}
    </Link>
  )
}

function ProductSection({ 
  title, 
  description, 
  products,
  icon: Icon 
}: { 
  title: string
  description: string
  products: ProductItem[]
  icon: React.ElementType
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <ProductCard key={product.href} product={product} />
        ))}
      </div>
    </div>
  )
}

export default function ProductsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-6 px-4 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Products</h1>
            <p className="text-muted-foreground">
              Explore all Protocol Banks payment and DeFi products
            </p>
          </div>
          <Link href="/help">
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="h-4 w-4" />
              Documentation
            </Button>
          </Link>
        </div>

        {/* Featured Banner */}
        <Card className="bg-gradient-to-br from-primary/10 via-background to-purple-500/10 border-primary/20 overflow-hidden">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/20">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">AI-Powered Payments</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Enable autonomous payments with session keys. Perfect for AI agents, 
                    automated trading bots, and smart contract integrations.
                  </p>
                </div>
              </div>
              <Link href="/agents">
                <Button className="gap-2">
                  Try AI Agents
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Product Sections */}
        <ProductSection
          title="Payments"
          description="Send and receive crypto payments"
          products={paymentProducts}
          icon={Send}
        />

        <ProductSection
          title="Commerce"
          description="Accept payments and manage subscriptions"
          products={commerceProducts}
          icon={CreditCard}
        />

        <ProductSection
          title="DeFi"
          description="Swap tokens and manage cross-chain assets"
          products={defiProducts}
          icon={ArrowRightLeft}
        />

        <ProductSection
          title="Advanced"
          description="Enterprise and cutting-edge features"
          products={advancedProducts}
          icon={Shield}
        />

        {/* Developer Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Developer Resources</CardTitle>
            <CardDescription>Build on Protocol Banks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link href="/help">
                <div className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">API Docs</p>
                    <p className="text-xs text-muted-foreground">REST & GraphQL reference</p>
                  </div>
                </div>
              </Link>
              <Link href="/whitepaper">
                <div className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Whitepaper</p>
                    <p className="text-xs text-muted-foreground">Technical specifications</p>
                  </div>
                </div>
              </Link>
              <Link href="/embed">
                <div className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                  <LayoutGrid className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Embed SDK</p>
                    <p className="text-xs text-muted-foreground">Payment widgets</p>
                  </div>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
