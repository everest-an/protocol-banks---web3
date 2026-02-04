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
  Clock,
  Shield,
  ArrowRightLeft,
  ChevronRight,
  Sparkles,
  ShoppingCart,
  Bot,
  Layers
} from "lucide-react"

import { 
  paymentProducts, 
  commerceProducts, 
  defiProducts, 
  advancedProducts,
  type ProductItem 
} from "@/lib/products-config"

function ProductCard({ product }: { product: ProductItem }) {
  const isDisabled = product.disabled || product.badge === "Coming Soon"
  
  const content = (
    <Card className={`h-full transition-all ${
      isDisabled 
        ? 'opacity-50 cursor-not-allowed' 
        : 'hover:border-primary/50 hover:shadow-md cursor-pointer group'
    }`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-3 rounded-xl ${product.color} transition-transform ${!isDisabled && 'group-hover:scale-110'}`}>
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

  if (isDisabled) {
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
          <ProductCard key={product.href + product.title} product={product} />
        ))}
      </div>
    </div>
  )
}

export default function ProductsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-6 px-4 space-y-8 pb-24 md:pb-6">
        
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

        {/* Featured: AI Agents */}
        <Card className="bg-gradient-to-br from-yellow-500/10 via-background to-purple-500/10 border-yellow-500/20 overflow-hidden">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-yellow-500/20">
                  <Bot className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">AI-Powered Payments</h3>
                    <Badge className="bg-yellow-500/20 text-yellow-600">New</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Enable autonomous payments with session keys. Perfect for AI agents, 
                    automated trading bots, and smart contract integrations.
                  </p>
                </div>
              </div>
              <Link href="/agents">
                <Button className="gap-2 bg-yellow-500 hover:bg-yellow-600 text-black">
                  <Zap className="h-4 w-4" />
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
          description="Accept payments for your business"
          products={commerceProducts}
          icon={ShoppingCart}
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
                    <p className="text-xs text-muted-foreground">REST & x402 reference</p>
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
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
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
