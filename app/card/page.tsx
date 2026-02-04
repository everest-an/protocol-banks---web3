"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CreditCard,
  Shield,
  Globe,
  Zap,
  Check,
  ArrowRight,
  Smartphone,
  Lock,
  ChevronRight,
  Sparkles,
  Eye,
  EyeOff,
  Snowflake,
  RefreshCw,
} from "lucide-react"

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

function LiquidMetalCard({
  userCard,
  showDetails,
  isFlipped,
  onFlip,
}: {
  userCard: UserCard | null
  showDetails: boolean
  isFlipped: boolean
  onFlip: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 })
  const [isHovering, setIsHovering] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setMousePosition({ x, y })
  }

  const handleMouseEnter = () => setIsHovering(true)
  const handleMouseLeave = () => {
    setIsHovering(false)
    setMousePosition({ x: 0.5, y: 0.5 })
  }

  const rotateX = isHovering ? (mousePosition.y - 0.5) * -20 : 0
  const rotateY = isHovering ? (mousePosition.x - 0.5) * 20 : 0
  const lightX = mousePosition.x * 100
  const lightY = mousePosition.y * 100

  return (
    <div className="perspective-1000 cursor-pointer" style={{ perspective: "1000px" }} onClick={onFlip}>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative w-[420px] h-[265px] transition-all duration-500 ease-out"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotateX}deg) rotateY(${isFlipped ? 180 + rotateY : rotateY}deg)`,
        }}
      >
        {/* Front of card - Updated to dark indigo theme */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden" style={{ backfaceVisibility: "hidden" }}>
          {/* Base gradient - dark with subtle indigo */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0f0a1a] to-[#050510]" />

          {/* Metallic shimmer layer */}
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background: `
                radial-gradient(
                  ellipse 80% 50% at ${lightX}% ${lightY}%,
                  rgba(255,255,255,0.12) 0%,
                  transparent 50%
                ),
                linear-gradient(
                  135deg,
                  rgba(255,255,255,0.08) 0%,
                  transparent 50%,
                  rgba(255,255,255,0.04) 100%
                )
              `,
            }}
          />

          {/* Liquid metal reflection - indigo tones */}
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              opacity: isHovering ? 0.7 : 0.3,
              background: `
                radial-gradient(
                  circle at ${lightX}% ${lightY}%,
                  rgba(99,102,241,0.4) 0%,
                  rgba(139,92,246,0.2) 30%,
                  transparent 60%
                )
              `,
            }}
          />

          {/* Subtle holographic effect - muted */}
          <div
            className="absolute inset-0 opacity-20 mix-blend-overlay"
            style={{
              background: `
                linear-gradient(
                  ${45 + (mousePosition.x - 0.5) * 30}deg,
                  rgba(139,92,246,0.3) 0%,
                  rgba(99,102,241,0.3) 50%,
                  rgba(168,85,247,0.3) 100%
                )
              `,
            }}
          />

          {/* Card border */}
          <div className="absolute inset-0 rounded-3xl border border-white/10" />
          <div
            className="absolute inset-0 rounded-3xl transition-opacity duration-300"
            style={{
              opacity: isHovering ? 1 : 0,
              boxShadow: `
                inset 0 0 30px rgba(99,102,241,0.1),
                0 0 40px rgba(99,102,241,0.15)
              `,
            }}
          />

          {/* Card content */}
          <div className="relative h-full p-8 flex flex-col justify-between z-10">
            {/* Top row */}
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-white/90 tracking-tight">Protocol</span>
                <span className="text-sm text-primary/80 -mt-1">Bank</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white/60 text-[10px] uppercase tracking-wider"
                >
                  {userCard?.type || "Debit"}
                </Badge>
                {userCard?.status === "frozen" && <Snowflake className="w-4 h-4 text-primary" />}
              </div>
            </div>

            {/* Middle - Chip and contactless */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-14 h-11 rounded-lg bg-gradient-to-br from-[#d4af37] via-[#f4d03f] to-[#c9a227] shadow-lg overflow-hidden">
                  <div className="absolute inset-1 grid grid-cols-4 grid-rows-3 gap-[2px]">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="bg-[#8b7355]/40 rounded-[1px]" />
                    ))}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent" />
                </div>
              </div>

              <div className="w-10 h-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/50">
                  <path
                    fill="currentColor"
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8z"
                    opacity="0.3"
                  />
                  <path
                    fill="currentColor"
                    d="M7.5 12c0-2.48 2.02-4.5 4.5-4.5v-2c-3.58 0-6.5 2.92-6.5 6.5s2.92 6.5 6.5 6.5v-2c-2.48 0-4.5-2.02-4.5-4.5z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 8.5c1.93 0 3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5v2c3.04 0 5.5-2.46 5.5-5.5S15.04 6.5 12 6.5v2z"
                  />
                  <circle fill="currentColor" cx="12" cy="12" r="2" />
                </svg>
              </div>
            </div>

            {/* Card number */}
            <div className="space-y-1">
              <div className="font-mono text-2xl tracking-[0.25em] text-white/90 font-medium">
                {showDetails ? "4532 7891 2345" : "•••• •••• ••••"} {userCard?.last4 || "4289"}
              </div>
            </div>

            {/* Bottom row */}
            <div className="flex justify-between items-end">
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Card Holder</div>
                <div className="text-base text-white/90 font-medium tracking-wide">
                  {userCard?.cardholderName || "YOUR NAME"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Valid Thru</div>
                <div className="text-base text-white/90 font-mono">
                  {userCard?.expiryMonth || "12"}/{userCard?.expiryYear || "28"}
                </div>
              </div>
              <div className="text-white/70 font-bold text-xl italic tracking-tight">VISA</div>
            </div>
          </div>
        </div>

        {/* Back of card */}
        <div
          className="absolute inset-0 rounded-3xl overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#050510] via-[#0f0a1a] to-[#0a0a0f]" />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: `
                radial-gradient(
                  ellipse 80% 50% at ${100 - lightX}% ${lightY}%,
                  rgba(99,102,241,0.2) 0%,
                  transparent 50%
                )
              `,
            }}
          />

          <div className="relative h-full flex flex-col z-10">
            <div className="w-full h-14 bg-gradient-to-r from-[#1a1a1a] via-[#2a2a2a] to-[#1a1a1a] mt-8 shadow-inner" />

            <div className="flex-1 px-8 py-6 flex flex-col justify-between">
              <div className="flex items-center gap-4">
                <div className="flex-1 h-12 bg-gradient-to-r from-gray-200 via-white to-gray-200 rounded flex items-center px-4">
                  <span className="text-gray-400 italic text-sm">
                    {userCard?.cardholderName || "Authorized Signature"}
                  </span>
                </div>
                <div className="bg-white rounded px-4 py-2">
                  <div className="text-[8px] text-gray-500 uppercase">CVV</div>
                  <div className="font-mono text-lg text-gray-800 font-bold">
                    {showDetails ? userCard?.cvv || "742" : "•••"}
                  </div>
                </div>
              </div>

              <div className="text-[9px] text-white/30 leading-relaxed">
                This card is property of Protocol Bank. Use of this card is subject to the cardholder agreement. For
                customer service, visit protocolbank.io/support
              </div>

              <div className="flex justify-between items-center">
                <div className="text-white/50 text-sm">
                  <span className="font-bold">Protocol</span> Bank
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-5 rounded bg-gradient-to-r from-red-500 to-yellow-500" />
                  <div className="w-8 h-5 rounded bg-gradient-to-r from-blue-600 to-blue-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center mt-4 text-xs text-muted-foreground">Click card to flip • Hover for 3D effect</div>
    </div>
  )
}

export default function CardPage() {
  const { isConnected, wallet } = useWeb3()
  const [activeTab, setActiveTab] = useState<"overview" | "apply" | "manage">("overview")
  const [cardType, setCardType] = useState<CardType>("virtual")
  const [isApplying, setIsApplying] = useState(false)
  const [showCardDetails, setShowCardDetails] = useState(false)
  const [isCardFlipped, setIsCardFlipped] = useState(false)
  const [applicationStep, setApplicationStep] = useState(1)

  const [userCard, setUserCard] = useState<UserCard | null>({
    id: "card_demo_001",
    type: "virtual",
    status: "active",
    last4: "4289",
    expiryMonth: "12",
    expiryYear: "28",
    cvv: "742",
    balance: 2450.0,
    spendLimit: 10000,
    cardholderName: "TEST USER",
  })

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
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setUserCard({
      id: `card_${Date.now()}`,
      type: cardType,
      status: "active",
      last4: Math.floor(1000 + Math.random() * 9000).toString(),
      expiryMonth: "12",
      expiryYear: "28",
      cvv: Math.floor(100 + Math.random() * 900).toString(),
      balance: 0,
      spendLimit: cardType === "virtual" ? 5000 : 25000,
      cardholderName: formData.fullName.toUpperCase() || "CARDHOLDER",
    })
    setIsApplying(false)
    setActiveTab("manage")
  }

  const toggleCardFreeze = () => {
    if (userCard) {
      setUserCard({
        ...userCard,
        status: userCard.status === "frozen" ? "active" : "frozen",
      })
    }
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
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-[#0a0a1a]" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
          {/* Floating orbs - indigo/violet theme */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
                <Sparkles className="w-3 h-3 mr-1" />
                Next-Gen Digital Banking
              </Badge>

              <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
                Your Crypto,
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary via-violet-400 to-purple-400">
                  Liquid Metal Card
                </span>
              </h1>

              <p className="text-xl text-muted-foreground max-w-lg leading-relaxed">
                Experience the future of payments. Our liquid metal card converts your stablecoins to any currency
                instantly at point of sale.
              </p>

              <div className="flex flex-wrap gap-4">
                <Button
                  size="lg"
                  onClick={() => setActiveTab("apply")}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6 rounded-xl shadow-lg shadow-primary/20"
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  Get Your Card
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-border bg-card/50 backdrop-blur-sm text-lg px-8 py-6 rounded-xl hover:bg-card"
                >
                  Learn More
                </Button>
              </div>

              {/* Stats - updated colors */}
              <div className="flex gap-12 pt-6">
                <div>
                  <div className="text-3xl font-bold text-primary">150M+</div>
                  <div className="text-sm text-muted-foreground">Merchants</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-violet-400">150+</div>
                  <div className="text-sm text-muted-foreground">Countries</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-purple-400">0%</div>
                  <div className="text-sm text-muted-foreground">FX Markup</div>
                </div>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <LiquidMetalCard
                userCard={userCard}
                showDetails={showCardDetails}
                isFlipped={isCardFlipped}
                onFlip={() => setIsCardFlipped(!isCardFlipped)}
              />
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

          {/* Overview Tab - updated colors */}
          <TabsContent value="overview" className="space-y-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="bg-card/50 border-border hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5"
                >
                  <CardHeader>
                    <feature.icon className="w-10 h-10 text-primary mb-2" />
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Card Types */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card
                className={`cursor-pointer transition-all ${
                  cardType === "virtual" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                }`}
                onClick={() => setCardType("virtual")}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Smartphone className="w-5 h-5" />
                        Virtual Card
                      </CardTitle>
                      <CardDescription>Instant digital card</CardDescription>
                    </div>
                    {cardType === "virtual" && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {cardBenefits.virtual.map((benefit, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-emerald-500" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all ${
                  cardType === "physical" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                }`}
                onClick={() => setCardType("physical")}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Physical Card
                      </CardTitle>
                      <CardDescription>Premium metal card</CardDescription>
                    </div>
                    {cardType === "physical" && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {cardBenefits.physical.map((benefit, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-emerald-500" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-center">
              <Button size="lg" onClick={() => setActiveTab("apply")} className="bg-primary hover:bg-primary/90">
                Continue to Application
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </TabsContent>

          {/* Apply Tab */}
          <TabsContent value="apply" className="max-w-2xl mx-auto">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Apply for {cardType === "virtual" ? "Virtual" : "Physical"} Card</CardTitle>
                <CardDescription>Complete your application in 2 simple steps</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Progress indicator */}
                <div className="flex items-center gap-2 mb-6">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      applicationStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    1
                  </div>
                  <div className={`flex-1 h-1 ${applicationStep >= 2 ? "bg-primary" : "bg-muted"}`} />
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      applicationStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    2
                  </div>
                </div>

                {applicationStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                          id="fullName"
                          placeholder="John Doe"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
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
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        placeholder="+1 (555) 123-4567"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="bg-background"
                      />
                    </div>
                    <Button onClick={() => setApplicationStep(2)} className="w-full bg-primary hover:bg-primary/90">
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}

                {applicationStep === 2 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        placeholder="United States"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Street Address</Label>
                      <Input
                        id="address"
                        placeholder="123 Main St"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="bg-background"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          placeholder="New York"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
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
                    <div className="flex gap-4">
                      <Button variant="outline" onClick={() => setApplicationStep(1)} className="flex-1">
                        Back
                      </Button>
                      <Button
                        onClick={handleApply}
                        disabled={isApplying}
                        className="flex-1 bg-primary hover:bg-primary/90"
                      >
                        {isApplying ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            Submit Application
                            <Check className="ml-2 h-4 w-4" />
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
          <TabsContent value="manage" className="space-y-6">
            {userCard && (
              <>
                {/* Card Preview */}
                <div className="flex justify-center mb-8">
                  <LiquidMetalCard
                    userCard={userCard}
                    showDetails={showCardDetails}
                    isFlipped={isCardFlipped}
                    onFlip={() => setIsCardFlipped(!isCardFlipped)}
                  />
                </div>

                {/* Card Controls */}
                <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                  <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                      <div className="text-center space-y-2">
                        <div className="text-sm text-muted-foreground">Available Balance</div>
                        <div className="text-3xl font-bold">${userCard.balance.toLocaleString()}</div>
                        <Button variant="outline" size="sm" className="mt-2 bg-transparent">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Funds
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                      <div className="text-center space-y-2">
                        <div className="text-sm text-muted-foreground">Card Status</div>
                        <Badge
                          variant={userCard.status === "active" ? "default" : "secondary"}
                          className={
                            userCard.status === "active"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-amber-500/10 text-amber-500"
                          }
                        >
                          {userCard.status === "active" ? "Active" : "Frozen"}
                        </Badge>
                        <Button
                          variant={userCard.status === "frozen" ? "default" : "outline"}
                          size="sm"
                          onClick={toggleCardFreeze}
                          className="mt-2"
                        >
                          <Snowflake className="mr-2 h-4 w-4" />
                          {userCard.status === "frozen" ? "Unfreeze" : "Freeze"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                      <div className="text-center space-y-2">
                        <div className="text-sm text-muted-foreground">Card Details</div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCardDetails(!showCardDetails)}
                          className="mt-2"
                        >
                          {showCardDetails ? (
                            <>
                              <EyeOff className="mr-2 h-4 w-4" />
                              Hide Details
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              Show Details
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Transactions */}
                <Card className="max-w-3xl mx-auto bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Transactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { merchant: "Amazon", amount: -156.99, date: "Today", category: "Shopping" },
                        { merchant: "Starbucks", amount: -8.5, date: "Yesterday", category: "Food & Drink" },
                        { merchant: "Uber", amount: -24.0, date: "Dec 26", category: "Transport" },
                        { merchant: "Card Top-up", amount: 500.0, date: "Dec 25", category: "Deposit" },
                      ].map((tx, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center py-3 border-b border-border last:border-0"
                        >
                          <div>
                            <div className="font-medium">{tx.merchant}</div>
                            <div className="text-sm text-muted-foreground">
                              {tx.date} • {tx.category}
                            </div>
                          </div>
                          <div className={`font-mono font-medium ${tx.amount > 0 ? "text-emerald-500" : ""}`}>
                            {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

// Missing Plus icon import fix
function Plus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}
