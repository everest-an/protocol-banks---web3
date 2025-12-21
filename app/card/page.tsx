"use client"

import { useState } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CreditCard,
  Shield,
  Globe,
  Zap,
  Check,
  ArrowRight,
  Smartphone,
  Lock,
  Wallet,
  Info,
  ChevronRight,
  Sparkles,
  Eye,
  EyeOff,
  Copy,
  Settings,
  Snowflake,
  RefreshCw,
} from "lucide-react"
import Image from "next/image"

type CardType = "virtual" | "physical"
type CardStatus = "none" | "pending" | "active" | "frozen"

interface UserCard {
  id: string
  type: CardType
  status: CardStatus
  last4: string
  expiryMonth: string
  expiryYear: string
  cvv: string
  balance: number
  spendLimit: number
  cardholderName: string
}

export default function CardPage() {
  const { isConnected, wallet } = useWeb3()
  const [activeTab, setActiveTab] = useState<"overview" | "apply" | "manage">("overview")
  const [cardType, setCardType] = useState<CardType>("virtual")
  const [isApplying, setIsApplying] = useState(false)
  const [showCardDetails, setShowCardDetails] = useState(false)
  const [applicationStep, setApplicationStep] = useState(1)

  // Demo card data
  const [userCard, setUserCard] = useState<UserCard | null>(
    isConnected
      ? null
      : {
          id: "card_demo_001",
          type: "virtual",
          status: "active",
          last4: "4289",
          expiryMonth: "12",
          expiryYear: "28",
          cvv: "***",
          balance: 2450.0,
          spendLimit: 10000,
          cardholderName: "DEMO USER",
        },
  )

  // Form state
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    country: "",
    address: "",
    city: "",
    postalCode: "",
  })

  const handleApply = async () => {
    setIsApplying(true)
    // Simulate application process
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setUserCard({
      id: `card_${Date.now()}`,
      type: cardType,
      status: "active",
      last4: Math.floor(1000 + Math.random() * 9000).toString(),
      expiryMonth: "12",
      expiryYear: "28",
      cvv: "***",
      balance: 0,
      spendLimit: cardType === "virtual" ? 5000 : 25000,
      cardholderName: formData.fullName.toUpperCase() || "CARDHOLDER",
    })
    setIsApplying(false)
    setActiveTab("manage")
  }

  const features = [
    {
      icon: Globe,
      title: "Global Acceptance",
      description: "Spend at 150M+ merchants worldwide with Visa/Mastercard network",
    },
    {
      icon: Zap,
      title: "Instant Funding",
      description: "Top up instantly from your USDC, USDT, or DAI balance",
    },
    {
      icon: Shield,
      title: "Non-Custodial Security",
      description: "Your crypto stays in your wallet until you spend",
    },
    {
      icon: Lock,
      title: "Advanced Controls",
      description: "Set spending limits, freeze/unfreeze, and real-time alerts",
    },
  ]

  const cardBenefits = {
    virtual: [
      "Instant issuance - use within seconds",
      "Perfect for online purchases",
      "No physical card to lose",
      "$5,000 monthly limit",
      "Free to issue",
    ],
    physical: [
      "Premium metal card design",
      "ATM withdrawals worldwide",
      "Contactless payments (NFC)",
      "$25,000 monthly limit",
      "Free shipping globally",
    ],
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />

        <div className="container mx-auto px-4 py-12 md:py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Content */}
            <div className="space-y-6">
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
                <Sparkles className="w-3 h-3 mr-1" />
                Global Payment Network
              </Badge>

              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                Spend Your Crypto
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                  Anywhere in the World
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg">
                Protocol Bank Card converts your stablecoins to local currency instantly at point of sale. No
                pre-loading required - your balance is always your crypto.
              </p>

              <div className="flex flex-wrap gap-4">
                <Button
                  size="lg"
                  onClick={() => setActiveTab("apply")}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  Get Your Card
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="border-border bg-transparent">
                  Learn More
                </Button>
              </div>

              {/* Stats */}
              <div className="flex gap-8 pt-4">
                <div>
                  <div className="text-2xl font-bold">150M+</div>
                  <div className="text-sm text-muted-foreground">Merchants</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">150+</div>
                  <div className="text-sm text-muted-foreground">Countries</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">0%</div>
                  <div className="text-sm text-muted-foreground">FX Markup</div>
                </div>
              </div>
            </div>

            {/* Right - Card Preview */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-3xl rounded-full scale-150" />

                {/* Card */}
                <div className="relative w-[380px] h-[240px] rounded-2xl overflow-hidden transform hover:scale-105 transition-transform duration-500 hover:rotate-1">
                  {/* Glass card background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 rounded-2xl" />

                  {/* Inner card content */}
                  <div className="relative h-full p-6 flex flex-col justify-between">
                    {/* Top row */}
                    <div className="flex justify-between items-start">
                      <div className="h-10 w-24 relative">
                        <Image
                          src="/logo-text-white.png"
                          alt="Protocol Bank"
                          fill
                          className="object-contain object-left opacity-90"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-white/30 text-white/80 text-[10px]">
                          DEBIT
                        </Badge>
                        <div className="text-white/60 text-xs">VISA</div>
                      </div>
                    </div>

                    {/* Chip */}
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-9 rounded-md bg-gradient-to-br from-yellow-400/80 to-yellow-600/80 flex items-center justify-center">
                        <div className="w-8 h-6 border border-yellow-700/50 rounded-sm grid grid-cols-3 gap-px p-0.5">
                          {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-yellow-700/30 rounded-[1px]" />
                          ))}
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center">
                        <Smartphone className="w-4 h-4 text-white/60" />
                      </div>
                    </div>

                    {/* Card number */}
                    <div className="font-mono text-xl tracking-[0.2em] text-white/90">
                      •••• •••• •••• {userCard?.last4 || "4289"}
                    </div>

                    {/* Bottom row */}
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Card Holder</div>
                        <div className="text-sm text-white/90 font-medium tracking-wide">
                          {userCard?.cardholderName || "YOUR NAME"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Expires</div>
                        <div className="text-sm text-white/90 font-mono">
                          {userCard?.expiryMonth || "12"}/{userCard?.expiryYear || "28"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Holographic effect overlay */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
                </div>

                {/* Second card (shadow) */}
                <div className="absolute -bottom-4 -right-4 w-[380px] h-[240px] rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-white/10 -z-10 transform rotate-6" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="apply">Apply</TabsTrigger>
            <TabsTrigger value="manage" disabled={!userCard}>
              Manage
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            {/* Features Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {features.map((feature, index) => (
                <Card key={index} className="bg-card/50 border-border hover:border-cyan-500/30 transition-colors">
                  <CardContent className="p-6">
                    <feature.icon className="h-10 w-10 text-cyan-500 mb-4" />
                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Card Types Comparison */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-card border-border relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-bl-full" />
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <Smartphone className="h-6 w-6 text-cyan-500" />
                    </div>
                    <div>
                      <CardTitle>Virtual Card</CardTitle>
                      <CardDescription>Instant digital card</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {cardBenefits.virtual.map((benefit, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-cyan-500" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full bg-transparent"
                    variant="outline"
                    onClick={() => {
                      setCardType("virtual")
                      setActiveTab("apply")
                    }}
                  >
                    Get Virtual Card
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card border-border relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full" />
                <Badge className="absolute top-4 right-4 bg-gradient-to-r from-cyan-500 to-blue-500">Popular</Badge>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <CreditCard className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle>Physical Card</CardTitle>
                      <CardDescription>Premium metal card</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {cardBenefits.physical.map((benefit, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-blue-500" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                    onClick={() => {
                      setCardType("physical")
                      setActiveTab("apply")
                    }}
                  >
                    Get Physical Card
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* How it Works */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
                <CardDescription>Simple, secure, and instant</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-6">
                  {[
                    { step: 1, title: "Connect Wallet", desc: "Link your crypto wallet to Protocol Bank" },
                    { step: 2, title: "Apply for Card", desc: "Quick KYC verification process" },
                    { step: 3, title: "Fund with Crypto", desc: "Add USDC, USDT, or DAI to your card" },
                    { step: 4, title: "Spend Anywhere", desc: "Use at any Visa-accepting merchant" },
                  ].map((item) => (
                    <div key={item.step} className="relative">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-sm font-bold text-white">
                          {item.step}
                        </div>
                        {item.step < 4 && (
                          <div className="hidden md:block flex-1 h-px bg-gradient-to-r from-cyan-500/50 to-transparent" />
                        )}
                      </div>
                      <h4 className="font-medium mb-1">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Apply Tab */}
          <TabsContent value="apply" className="max-w-2xl mx-auto">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Apply for {cardType === "virtual" ? "Virtual" : "Physical"} Card</CardTitle>
                    <CardDescription>Complete the form below to get your card</CardDescription>
                  </div>
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
                    Step {applicationStep} of 2
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {!isConnected && (
                  <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-500">
                    <Info className="h-4 w-4" />
                    <AlertDescription>Demo mode - Connect your wallet for real card application</AlertDescription>
                  </Alert>
                )}

                {/* Card Type Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setCardType("virtual")}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      cardType === "virtual"
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <Smartphone className="h-6 w-6 mb-2 text-cyan-500" />
                    <div className="font-medium">Virtual Card</div>
                    <div className="text-xs text-muted-foreground">Instant, free</div>
                  </button>
                  <button
                    onClick={() => setCardType("physical")}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      cardType === "physical"
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <CreditCard className="h-6 w-6 mb-2 text-blue-500" />
                    <div className="font-medium">Physical Card</div>
                    <div className="text-xs text-muted-foreground">Metal, premium</div>
                  </button>
                </div>

                {applicationStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor="fullName">Full Name (as on ID)</Label>
                        <Input
                          id="fullName"
                          placeholder="John Doe"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="john@example.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          placeholder="+1 234 567 8900"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="country">Country</Label>
                        <Select
                          value={formData.country}
                          onValueChange={(v) => setFormData({ ...formData, country: v })}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="us">United States</SelectItem>
                            <SelectItem value="uk">United Kingdom</SelectItem>
                            <SelectItem value="eu">European Union</SelectItem>
                            <SelectItem value="sg">Singapore</SelectItem>
                            <SelectItem value="hk">Hong Kong</SelectItem>
                            <SelectItem value="jp">Japan</SelectItem>
                            <SelectItem value="au">Australia</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => setApplicationStep(2)}>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}

                {applicationStep === 2 && (
                  <div className="space-y-4">
                    {cardType === "physical" && (
                      <>
                        <div>
                          <Label htmlFor="address">Shipping Address</Label>
                          <Input
                            id="address"
                            placeholder="123 Main Street"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="bg-background"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="city">City</Label>
                            <Input
                              id="city"
                              placeholder="New York"
                              value={formData.city}
                              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                              className="bg-background"
                            />
                          </div>
                          <div>
                            <Label htmlFor="postalCode">Postal Code</Label>
                            <Input
                              id="postalCode"
                              placeholder="10001"
                              value={formData.postalCode}
                              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                              className="bg-background"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Terms */}
                    <div className="p-4 rounded-lg bg-muted/30 border border-border text-sm text-muted-foreground">
                      <p className="mb-2">By applying, you agree to:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Protocol Bank Card Terms of Service</li>
                        <li>Rain Infrastructure Privacy Policy</li>
                        <li>KYC/AML verification requirements</li>
                      </ul>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setApplicationStep(1)} className="flex-1">
                        Back
                      </Button>
                      <Button
                        className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600"
                        onClick={handleApply}
                        disabled={isApplying}
                      >
                        {isApplying ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Apply Now
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manage Tab */}
          <TabsContent value="manage" className="max-w-4xl mx-auto">
            {userCard && (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Card Display */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Your Card</CardTitle>
                      <Badge
                        variant="outline"
                        className={
                          userCard.status === "active"
                            ? "border-green-500/30 text-green-400"
                            : userCard.status === "frozen"
                              ? "border-blue-500/30 text-blue-400"
                              : "border-amber-500/30 text-amber-400"
                        }
                      >
                        {userCard.status.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Mini Card Preview */}
                    <div className="relative w-full aspect-[1.6] max-w-[320px] mx-auto rounded-xl overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20" />
                      <div className="relative h-full p-4 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                          <div className="h-6 w-16 relative">
                            <Image
                              src="/logo-text-white.png"
                              alt="Protocol Bank"
                              fill
                              className="object-contain object-left opacity-80"
                            />
                          </div>
                          <div className="text-white/60 text-[10px]">
                            {userCard.type === "virtual" ? "VIRTUAL" : "PHYSICAL"}
                          </div>
                        </div>
                        <div className="font-mono text-base tracking-widest text-white/90">
                          {showCardDetails ? "4532 8721 9823" : "•••• •••• ••••"} {userCard.last4}
                        </div>
                        <div className="flex justify-between text-xs">
                          <div className="text-white/80">{userCard.cardholderName}</div>
                          <div className="text-white/60 font-mono">
                            {userCard.expiryMonth}/{userCard.expiryYear}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCardDetails(!showCardDetails)}
                        className="flex-1"
                      >
                        {showCardDetails ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                        {showCardDetails ? "Hide" : "Show"}
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Card Controls */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Card Controls</CardTitle>
                    <CardDescription>Manage your card settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Balance */}
                    <div className="p-4 rounded-lg bg-muted/30 border border-border">
                      <div className="text-sm text-muted-foreground mb-1">Card Balance</div>
                      <div className="text-2xl font-bold">${userCard.balance.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Limit: ${userCard.spendLimit.toLocaleString()}/month
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-3">
                      <Button className="bg-gradient-to-r from-cyan-500 to-blue-600">
                        <Wallet className="mr-2 h-4 w-4" />
                        Add Funds
                      </Button>
                      <Button variant="outline">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Button>
                      <Button
                        variant="outline"
                        className={userCard.status === "frozen" ? "border-green-500/30 text-green-400" : ""}
                      >
                        <Snowflake className="mr-2 h-4 w-4" />
                        {userCard.status === "frozen" ? "Unfreeze" : "Freeze"}
                      </Button>
                      <Button variant="outline">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Replace
                      </Button>
                    </div>

                    {/* Recent Transactions */}
                    <div>
                      <div className="text-sm font-medium mb-3">Recent Transactions</div>
                      <div className="space-y-2 text-sm">
                        {[
                          { merchant: "Amazon", amount: -89.99, date: "Today" },
                          { merchant: "Uber", amount: -24.5, date: "Yesterday" },
                          { merchant: "Card Top-up", amount: 500, date: "Dec 18" },
                        ].map((tx, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                            <div>
                              <div className="font-medium">{tx.merchant}</div>
                              <div className="text-xs text-muted-foreground">{tx.date}</div>
                            </div>
                            <div className={tx.amount > 0 ? "text-green-500" : ""}>
                              {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
