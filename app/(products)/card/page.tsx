"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { authHeaders } from "@/lib/authenticated-fetch"
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
  CreditCard, Shield, Globe, Zap, Check, ArrowRight, Smartphone, Lock,
  ChevronRight, Sparkles, Eye, EyeOff, Snowflake, RefreshCw, Copy,
  Plus, AlertTriangle, Wallet, QrCode, X,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface VirtualCard {
  id: string
  provider: 'YATIVO'
  providerCardId: string
  last4: string | null
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED' | 'PENDING'
  balance: number
  currency: string
  label: string | null
  ownerAddress: string
  createdAt: string
  updatedAt: string
}

interface CardDetails extends VirtualCard {
  pan: string
  cvv: string
  expiryMonth: string
  expiryYear: string
}

interface DepositInfo {
  depositAddress: string
  network: string
  token: string
  memo?: string
  platformBalance: { available: number; currency: string }
}

// ─── LiquidMetalCard Component (preserved exactly as-is) ─────────────────────

function LiquidMetalCard({
  card,
  details,
  showDetails,
  isFlipped,
  onFlip,
}: {
  card: VirtualCard | null
  details: CardDetails | null
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
    setMousePosition({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    })
  }

  const rotateX = isHovering ? (mousePosition.y - 0.5) * -20 : 0
  const rotateY = isHovering ? (mousePosition.x - 0.5) * 20 : 0
  const lightX = mousePosition.x * 100
  const lightY = mousePosition.y * 100

  const displayLast4 = card?.last4 ?? (showDetails && details?.last4) ?? "••••"
  const displayCvv = showDetails && details ? details.cvv : "•••"
  const displayExpiry = showDetails && details
    ? `${details.expiryMonth}/${details.expiryYear.slice(-2)}`
    : "••/••"

  return (
    <div className="cursor-pointer" style={{ perspective: "1000px" }} onClick={onFlip}>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => { setIsHovering(false); setMousePosition({ x: 0.5, y: 0.5 }) }}
        className="relative w-[420px] h-[265px] transition-all duration-500 ease-out"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotateX}deg) rotateY(${isFlipped ? 180 + rotateY : rotateY}deg)`,
        }}
      >
        {/* Front */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden" style={{ backfaceVisibility: "hidden" }}>
          <div className="absolute inset-0" style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.06) 100%)",
            backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)",
          }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }} />
          <div className="absolute inset-0 transition-opacity duration-300" style={{
            opacity: isHovering ? 0.6 : 0.2,
            background: `radial-gradient(ellipse 60% 40% at ${lightX}% ${lightY}%, rgba(255,255,255,0.15) 0%, transparent 60%)`,
          }} />
          <div className="absolute inset-0 rounded-3xl transition-opacity duration-300" style={{
            border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: isHovering
              ? "inset 0 0 40px rgba(255,255,255,0.04), 0 8px 60px rgba(99,102,241,0.12)"
              : "inset 0 0 20px rgba(255,255,255,0.02)",
          }} />

          <div className="relative h-full p-8 flex flex-col justify-between z-10">
            <div className="flex items-start justify-between">
              <Image src="/logo-text-white.png" alt="Protocol Banks" width={160} height={40}
                className="opacity-80" style={{ objectFit: "contain", objectPosition: "left" }} />
              {card && (
                <Badge className={
                  card.status === 'ACTIVE' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                  card.status === 'FROZEN' ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                  "bg-amber-500/20 text-amber-400 border-amber-500/30"
                }>
                  {card.status}
                </Badge>
              )}
            </div>

            {/* Card number placeholder */}
            {card && (
              <div className="font-mono text-white/50 text-lg tracking-[0.3em]">
                •••• •••• •••• {displayLast4}
              </div>
            )}

            <div className="flex justify-between items-end">
              {card && (
                <div>
                  <div className="text-[10px] text-white/30 uppercase mb-1">Balance</div>
                  <div className="text-2xl font-bold text-white/80">
                    ${card.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}
              <svg width="56" height="36" viewBox="0 0 56 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="18" r="14" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" fill="none" />
                <circle cx="36" cy="18" r="14" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" fill="none" />
              </svg>
            </div>
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden" style={{
          backfaceVisibility: "hidden", transform: "rotateY(180deg)",
        }}>
          <div className="absolute inset-0" style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.08) 100%)",
            backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)",
          }} />
          <div className="absolute inset-0 transition-opacity duration-300" style={{
            opacity: isHovering ? 0.4 : 0.15,
            background: `radial-gradient(ellipse 60% 40% at ${100 - lightX}% ${lightY}%, rgba(255,255,255,0.12) 0%, transparent 60%)`,
          }} />
          <div className="absolute inset-0 rounded-3xl" style={{ border: "1px solid rgba(255,255,255,0.12)" }} />

          <div className="relative h-full flex flex-col z-10">
            <div className="w-full h-12 bg-white/[0.06] mt-8 border-y border-white/[0.08]" />
            <div className="flex-1 px-8 py-5 flex flex-col justify-between">
              <div className="flex items-center gap-4">
                <div className="flex-1 h-10 bg-white/[0.06] rounded border border-white/[0.08] flex items-center px-4">
                  <span className="text-white/20 italic text-sm">Authorized Signature</span>
                </div>
                <div className="bg-white/[0.08] rounded border border-white/[0.08] px-4 py-1.5">
                  <div className="text-[8px] text-white/30 uppercase">CVV</div>
                  <div className="font-mono text-lg text-white/60 font-bold">{displayCvv}</div>
                </div>
              </div>

              {showDetails && details && (
                <div className="font-mono text-white/50 text-sm tracking-[0.2em] text-center">
                  {details.pan.replace(/(.{4})/g, '$1 ').trim()}
                </div>
              )}

              <div className="text-[9px] text-white/15 leading-relaxed">
                This card is property of Protocol Banks. Use subject to the cardholder agreement.
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-[9px] text-white/30 uppercase mb-0.5">Valid Thru</div>
                  <div className="font-mono text-white/50 text-sm">{displayExpiry}</div>
                </div>
                <Image src="/logo-text-white.png" alt="Protocol Banks" width={100} height={24}
                  className="opacity-40" style={{ objectFit: "contain", objectPosition: "left" }} />
                <svg width="42" height="28" viewBox="0 0 56 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="20" cy="18" r="14" stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none" />
                  <circle cx="36" cy="18" r="14" stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="text-center mt-4 text-xs text-muted-foreground">Click card to flip • Hover for 3D effect</div>
    </div>
  )
}

// ─── Deposit Modal ────────────────────────────────────────────────────────────

function DepositModal({
  open,
  onClose,
  depositInfo,
}: {
  open: boolean
  onClose: () => void
  depositInfo: DepositInfo | null
}) {
  const { toast } = useToast()
  const copyAddress = () => {
    if (!depositInfo) return
    navigator.clipboard.writeText(depositInfo.depositAddress)
    toast({ title: "Copied!", description: "Deposit address copied to clipboard." })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Fund Your Card Balance
          </DialogTitle>
          <DialogDescription>
            Send USDC or USDT to this address to top up your card balance. Funds arrive in 1–3 minutes.
          </DialogDescription>
        </DialogHeader>

        {depositInfo ? (
          <div className="space-y-4">
            {/* Platform balance */}
            <div className="rounded-xl p-4" style={{
              background: "rgba(99,102,241,0.08)",
              border: "0.5px solid rgba(99,102,241,0.2)",
            }}>
              <div className="text-xs text-muted-foreground mb-1">Available Platform Balance</div>
              <div className="text-2xl font-bold text-primary">
                ${depositInfo.platformBalance.available.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Ready to issue or fund cards immediately
              </div>
            </div>

            {/* Deposit address */}
            <div className="space-y-2">
              <Label>Deposit Address ({depositInfo.token} on {depositInfo.network})</Label>
              <div className="flex gap-2">
                <div className="flex-1 font-mono text-xs bg-muted rounded-lg p-3 break-all">
                  {depositInfo.depositAddress}
                </div>
                <Button variant="outline" size="icon" onClick={copyAddress}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {depositInfo.memo && (
              <div className="space-y-2">
                <Label>Memo (required)</Label>
                <div className="font-mono text-xs bg-muted rounded-lg p-3">{depositInfo.memo}</div>
              </div>
            )}

            <div className="flex items-start gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Only send USDC or USDT on the {depositInfo.network} network. Other tokens will be lost.</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Fund Card Modal ──────────────────────────────────────────────────────────

function FundCardModal({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (amount: number) => void
  loading: boolean
}) {
  const [amount, setAmount] = useState("")
  const presets = [50, 100, 200, 500]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Funds to Card</DialogTitle>
          <DialogDescription>
            Transfer from your platform balance to this card.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {presets.map(p => (
              <Button key={p} variant="outline" size="sm" onClick={() => setAmount(String(p))}>
                ${p}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Custom Amount (USD)</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min={1}
              max={10000}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => onConfirm(parseFloat(amount))}
            disabled={!amount || parseFloat(amount) <= 0 || loading}
          >
            {loading ? <RefreshCw className="mr-2 w-4 h-4 animate-spin" /> : <Plus className="mr-2 w-4 h-4" />}
            Add ${amount || "0"} to Card
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Issue Card Modal ─────────────────────────────────────────────────────────

function IssueCardModal({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (amount: number, label: string) => void
  loading: boolean
}) {
  const [amount, setAmount] = useState("100")
  const [label, setLabel] = useState("")

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Issue New Virtual Card</DialogTitle>
          <DialogDescription>
            Create a Visa virtual card funded from your platform balance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Card Label (optional)</Label>
            <Input
              placeholder="e.g. AI Agent Card, Shopping Card..."
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Initial Balance (USD)</Label>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min={1}
              max={10000}
            />
            <p className="text-xs text-muted-foreground">Max $10,000 per card</p>
          </div>
          <Button
            className="w-full"
            onClick={() => onConfirm(parseFloat(amount), label)}
            disabled={!amount || parseFloat(amount) <= 0 || loading}
          >
            {loading ? <RefreshCw className="mr-2 w-4 h-4 animate-spin" /> : <CreditCard className="mr-2 w-4 h-4" />}
            Issue Card with ${amount}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CardPage() {
  const { isConnected, address } = useUnifiedWallet()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<"overview" | "cards" | "manage">("overview")
  const [cards, setCards] = useState<VirtualCard[]>([])
  const [selectedCard, setSelectedCard] = useState<VirtualCard | null>(null)
  const [cardDetails, setCardDetails] = useState<CardDetails | null>(null)
  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null)

  const [showDetails, setShowDetails] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingCards, setLoadingCards] = useState(false)

  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showFundModal, setShowFundModal] = useState(false)
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // ── Fetch cards ────────────────────────────────────────────────────────────

  const fetchCards = useCallback(async () => {
    if (!address) return
    setLoadingCards(true)
    try {
      const res = await fetch('/api/cards', { headers: authHeaders(address) })
      if (!res.ok) throw new Error('Failed to load cards')
      const data = await res.json()
      setCards(data.cards ?? [])
      if (data.cards?.length > 0 && !selectedCard) {
        setSelectedCard(data.cards[0])
      }
    } catch {
      toast({ title: "Error", description: "Could not load cards.", variant: "destructive" })
    } finally {
      setLoadingCards(false)
    }
  }, [address, selectedCard, toast])

  useEffect(() => {
    if (isConnected && address) fetchCards()
  }, [isConnected, address, fetchCards])

  // ── Fetch deposit info ─────────────────────────────────────────────────────

  const fetchDepositInfo = async () => {
    if (!address) return
    try {
      const res = await fetch('/api/cards/deposit', { headers: authHeaders(address) })
      if (!res.ok) throw new Error()
      setDepositInfo(await res.json())
    } catch {
      toast({ title: "Error", description: "Could not load deposit info.", variant: "destructive" })
    }
  }

  const handleOpenDeposit = () => {
    fetchDepositInfo()
    setShowDepositModal(true)
  }

  // ── Reveal card details ────────────────────────────────────────────────────

  const handleRevealDetails = async () => {
    if (!selectedCard || !address) return
    if (showDetails) { setShowDetails(false); setCardDetails(null); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/cards/${selectedCard.id}`, { headers: authHeaders(address) })
      if (!res.ok) throw new Error('Failed to fetch card details')
      const data: CardDetails = await res.json()
      setCardDetails(data)
      setShowDetails(true)
    } catch {
      toast({ title: "Error", description: "Could not reveal card details.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // ── Freeze / Unfreeze ──────────────────────────────────────────────────────

  const handleToggleFreeze = async () => {
    if (!selectedCard || !address) return
    const action = selectedCard.status === 'FROZEN' ? 'unfreeze' : 'freeze'
    setActionLoading(true)
    try {
      const res = await fetch(`/api/cards/${selectedCard.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(address), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error()
      const updated: VirtualCard = await res.json()
      setSelectedCard(updated)
      setCards(prev => prev.map(c => c.id === updated.id ? updated : c))
      toast({ title: action === 'freeze' ? "Card Frozen" : "Card Unfrozen" })
    } catch {
      toast({ title: "Error", description: "Action failed.", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  // ── Fund card ──────────────────────────────────────────────────────────────

  const handleFundCard = async (amount: number) => {
    if (!selectedCard || !address) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/cards/${selectedCard.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(address), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fund', amount }),
      })
      if (!res.ok) throw new Error()
      const updated: VirtualCard = await res.json()
      setSelectedCard(updated)
      setCards(prev => prev.map(c => c.id === updated.id ? updated : c))
      setShowFundModal(false)
      toast({ title: "Funded!", description: `$${amount} added to your card.` })
    } catch {
      toast({ title: "Error", description: "Could not fund card.", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  // ── Issue new card ─────────────────────────────────────────────────────────

  const handleIssueCard = async (amount: number, label: string) => {
    if (!address) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { ...authHeaders(address), 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialAmount: amount, label: label || undefined }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed')
      }
      const newCard: VirtualCard = await res.json()
      setCards(prev => [newCard, ...prev])
      setSelectedCard(newCard)
      setShowIssueModal(false)
      setActiveTab("manage")
      toast({ title: "Card Issued!", description: `Your new virtual card ending in ${newCard.last4} is ready.` })
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to issue card.", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  // ── Sync card ──────────────────────────────────────────────────────────────

  const handleSync = async () => {
    if (!selectedCard || !address) return
    setLoading(true)
    try {
      await fetch(`/api/cards/${selectedCard.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(address), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      })
      await fetchCards()
      toast({ title: "Synced", description: "Card balance updated." })
    } catch {
      toast({ title: "Error", description: "Sync failed.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // ─── Feature cards data ────────────────────────────────────────────────────

  const features = [
    { icon: Globe, title: "Global Acceptance", description: "Spend at 150M+ merchants worldwide with Visa network" },
    { icon: Zap, title: "Instant Funding", description: "Top up instantly from your USDC or USDT balance" },
    { icon: Shield, title: "Non-Custodial Security", description: "Your crypto stays in your wallet until you spend" },
    { icon: Lock, title: "Advanced Controls", description: "Set spending limits, freeze/unfreeze, and real-time alerts" },
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-violet-950/40" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/15 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl animate-pulse delay-500" />
        </div>

        <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
                <Sparkles className="w-3 h-3 mr-1" />
                Powered by Yativo · USDC Native
              </Badge>

              <h1 className="text-5xl md:text-6xl tracking-tight leading-tight">
                <span className="font-light">Your Crypto,</span>
                <span className="block font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary via-violet-400 to-purple-400">
                  Glass Card
                </span>
              </h1>

              <p className="text-xl text-muted-foreground max-w-lg leading-relaxed">
                Fund with USDC. Spend anywhere Visa is accepted. Issue virtual cards for yourself or your AI agents — instantly.
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => { isConnected ? setShowIssueModal(true) : setActiveTab("cards") }}
                  className="group relative rounded-xl px-8 py-4 text-lg font-medium transition-all duration-300 active:scale-[0.97] hover:scale-[1.02]"
                  style={{
                    background: "rgba(99,102,241,0.2)", backdropFilter: "blur(20px) saturate(1.4)",
                    WebkitBackdropFilter: "blur(20px) saturate(1.4)",
                    border: "0.5px solid rgba(99,102,241,0.3)", boxShadow: "0 8px 32px rgba(99,102,241,0.15)",
                  }}
                >
                  <div className="absolute inset-0 rounded-xl bg-white/[0.08] opacity-0 group-active:opacity-100 transition-opacity duration-150 pointer-events-none" />
                  <div className="absolute inset-x-0 top-0 h-[1px] rounded-t-xl"
                    style={{ background: "linear-gradient(90deg, transparent, rgba(165,170,255,0.35), transparent)" }} />
                  <span className="relative z-10 flex items-center text-white/90">
                    <CreditCard className="mr-2 h-5 w-5" />
                    Issue Card
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </span>
                </button>

                <button
                  onClick={handleOpenDeposit}
                  className="group relative rounded-xl px-8 py-4 text-lg font-medium transition-all duration-300 active:scale-[0.97] hover:scale-[1.02]"
                  style={{
                    background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px) saturate(1.3)",
                    WebkitBackdropFilter: "blur(20px) saturate(1.3)", border: "0.5px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div className="absolute inset-0 rounded-xl bg-white/[0.06] opacity-0 group-active:opacity-100 transition-opacity duration-150 pointer-events-none" />
                  <span className="relative z-10 flex items-center text-white/70">
                    <Wallet className="mr-2 h-5 w-5" />
                    Deposit USDC
                  </span>
                </button>
              </div>

              <div className="flex gap-12 pt-6">
                <div><div className="text-3xl font-bold text-primary">150M+</div><div className="text-sm text-muted-foreground">Merchants</div></div>
                <div><div className="text-3xl font-bold text-violet-400">150+</div><div className="text-sm text-muted-foreground">Countries</div></div>
                <div><div className="text-3xl font-bold text-purple-400">0%</div><div className="text-sm text-muted-foreground">FX Markup</div></div>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <LiquidMetalCard
                card={selectedCard}
                details={cardDetails}
                showDetails={showDetails}
                isFlipped={isFlipped}
                onFlip={() => setIsFlipped(!isFlipped)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cards">My Cards {cards.length > 0 && `(${cards.length})`}</TabsTrigger>
            <TabsTrigger value="manage" disabled={!selectedCard}>Manage</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {features.map((feature, index) => (
                <div key={index} className="group relative rounded-2xl p-[1px] transition-all duration-300 hover:scale-[1.02]">
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1), transparent)" }} />
                  <div className="relative h-full rounded-2xl p-6 overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px) saturate(1.4)",
                      WebkitBackdropFilter: "blur(20px) saturate(1.4)", border: "0.5px solid rgba(255,255,255,0.08)" }}>
                    <div className="absolute inset-x-0 top-0 h-[1px]"
                      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }} />
                    <feature.icon className="w-10 h-10 text-primary mb-3" />
                    <h3 className="text-lg font-semibold mb-1">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* How it works */}
            <GlassCard className="bg-card border-border">
              <GlassCardHeader>
                <GlassCardTitle>How It Works</GlassCardTitle>
                <GlassCardDescription>Three steps to spend your stablecoins anywhere</GlassCardDescription>
              </GlassCardHeader>
              <GlassCardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  {[
                    { step: "1", icon: Wallet, title: "Deposit USDC", desc: "Send USDC or USDT to your Protocol Banks deposit address. Funds are credited 1:1 as USD." },
                    { step: "2", icon: CreditCard, title: "Issue a Card", desc: "Create a virtual Visa card instantly. Set the balance from your deposited funds." },
                    { step: "3", icon: Globe, title: "Spend Globally", desc: "Use your card at any online merchant that accepts Visa. AI agents can use it too." },
                  ].map(({ step, icon: Icon, title, desc }) => (
                    <div key={step} className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary font-bold">
                        {step}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-semibold mb-1">
                          <Icon className="w-4 h-4 text-primary" />
                          {title}
                        </div>
                        <p className="text-sm text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCardContent>
            </GlassCard>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowIssueModal(true)}
                className="group relative rounded-xl px-8 py-4 text-lg font-medium transition-all duration-300 active:scale-[0.97]"
                style={{
                  background: "rgba(99,102,241,0.15)", backdropFilter: "blur(20px) saturate(1.4)",
                  WebkitBackdropFilter: "blur(20px) saturate(1.4)", border: "0.5px solid rgba(99,102,241,0.25)",
                  color: "rgb(165,170,255)",
                }}
              >
                <div className="absolute inset-0 rounded-xl bg-white/[0.08] opacity-0 group-active:opacity-100 transition-opacity duration-150 pointer-events-none" />
                <div className="absolute inset-x-0 top-0 h-[1px] rounded-t-xl"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(165,170,255,0.3), transparent)" }} />
                <span className="relative z-10 flex items-center">
                  Issue Your First Card
                  <ChevronRight className="ml-2 h-5 w-5" />
                </span>
              </button>
            </div>
          </TabsContent>

          {/* My Cards Tab */}
          <TabsContent value="cards" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Your Virtual Cards</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleOpenDeposit}>
                  <Wallet className="mr-2 w-4 h-4" />
                  Deposit USDC
                </Button>
                <Button size="sm" onClick={() => setShowIssueModal(true)}>
                  <Plus className="mr-2 w-4 h-4" />
                  New Card
                </Button>
              </div>
            </div>

            {loadingCards ? (
              <div className="flex justify-center py-16">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : cards.length === 0 ? (
              <GlassCard className="bg-card border-border">
                <GlassCardContent className="py-16 text-center space-y-4">
                  <CreditCard className="w-12 h-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-medium">No cards yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Deposit USDC first, then issue your first virtual card.
                    </p>
                  </div>
                  <div className="flex justify-center gap-3">
                    <Button variant="outline" onClick={handleOpenDeposit}>
                      <Wallet className="mr-2 w-4 h-4" />
                      Deposit USDC
                    </Button>
                    <Button onClick={() => setShowIssueModal(true)}>
                      <Plus className="mr-2 w-4 h-4" />
                      Issue Card
                    </Button>
                  </div>
                </GlassCardContent>
              </GlassCard>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map(card => (
                  <button
                    key={card.id}
                    onClick={() => { setSelectedCard(card); setActiveTab("manage"); setShowDetails(false); setCardDetails(null) }}
                    className="group relative rounded-2xl text-left transition-all duration-300 hover:scale-[1.02]"
                  >
                    <div className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.15))" }} />
                    <div className="relative rounded-2xl p-5 overflow-hidden"
                      style={{
                        background: selectedCard?.id === card.id ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.03)",
                        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
                        border: selectedCard?.id === card.id ? "0.5px solid rgba(99,102,241,0.3)" : "0.5px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="font-medium">{card.label ?? "Virtual Card"}</p>
                          <p className="text-sm text-muted-foreground font-mono">•••• {card.last4 ?? "••••"}</p>
                        </div>
                        <Badge className={
                          card.status === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-500" :
                          card.status === 'FROZEN' ? "bg-blue-500/10 text-blue-400" :
                          "bg-muted text-muted-foreground"
                        }>
                          {card.status}
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold">
                        ${card.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">USD Balance</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Manage Tab */}
          <TabsContent value="manage" className="space-y-6">
            {selectedCard && (
              <>
                <div className="flex justify-center mb-8">
                  <LiquidMetalCard
                    card={selectedCard}
                    details={cardDetails}
                    showDetails={showDetails}
                    isFlipped={isFlipped}
                    onFlip={() => setIsFlipped(!isFlipped)}
                  />
                </div>

                {/* Controls */}
                <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                  {/* Balance */}
                  <GlassCard className="bg-card border-border">
                    <GlassCardContent className="pt-6">
                      <div className="text-center space-y-2">
                        <div className="text-sm text-muted-foreground">Available Balance</div>
                        <div className="text-3xl font-bold">
                          ${selectedCard.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="flex gap-2 justify-center mt-2">
                          <Button variant="outline" size="sm" onClick={() => setShowFundModal(true)}>
                            <Plus className="mr-1 h-4 w-4" />
                            Add Funds
                          </Button>
                          <Button variant="ghost" size="sm" onClick={handleSync} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                          </Button>
                        </div>
                      </div>
                    </GlassCardContent>
                  </GlassCard>

                  {/* Status */}
                  <GlassCard className="bg-card border-border">
                    <GlassCardContent className="pt-6">
                      <div className="text-center space-y-2">
                        <div className="text-sm text-muted-foreground">Card Status</div>
                        <Badge className={
                          selectedCard.status === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-500" :
                          selectedCard.status === 'FROZEN' ? "bg-blue-500/10 text-blue-400" :
                          "bg-muted text-muted-foreground"
                        }>
                          {selectedCard.status}
                        </Badge>
                        {selectedCard.status !== 'CLOSED' && (
                          <Button
                            variant={selectedCard.status === 'FROZEN' ? "default" : "outline"}
                            size="sm"
                            onClick={handleToggleFreeze}
                            disabled={actionLoading}
                            className="mt-2 block mx-auto"
                          >
                            <Snowflake className="mr-2 h-4 w-4" />
                            {selectedCard.status === 'FROZEN' ? 'Unfreeze' : 'Freeze'}
                          </Button>
                        )}
                      </div>
                    </GlassCardContent>
                  </GlassCard>

                  {/* Card Details */}
                  <GlassCard className="bg-card border-border">
                    <GlassCardContent className="pt-6">
                      <div className="text-center space-y-2">
                        <div className="text-sm text-muted-foreground">Card Details</div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRevealDetails}
                          disabled={loading}
                          className="mt-2"
                        >
                          {loading ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          ) : showDetails ? (
                            <><EyeOff className="mr-2 h-4 w-4" />Hide Details</>
                          ) : (
                            <><Eye className="mr-2 h-4 w-4" />Show Details</>
                          )}
                        </Button>
                      </div>
                    </GlassCardContent>
                  </GlassCard>
                </div>

                {/* Sensitive details panel */}
                {showDetails && cardDetails && (
                  <GlassCard className="max-w-3xl mx-auto bg-card border-border">
                    <GlassCardHeader>
                      <GlassCardTitle className="text-base flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-500" />
                        Sensitive Card Information
                      </GlassCardTitle>
                    </GlassCardHeader>
                    <GlassCardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: "Card Number", value: cardDetails.pan.replace(/(.{4})/g, '$1 ').trim() },
                          { label: "CVV", value: cardDetails.cvv },
                          { label: "Expiry", value: `${cardDetails.expiryMonth}/${cardDetails.expiryYear.slice(-2)}` },
                          { label: "Last 4", value: cardDetails.last4 ?? "—" },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div className="text-xs text-muted-foreground mb-1">{label}</div>
                            <div className="font-mono font-medium text-sm flex items-center gap-2">
                              {value}
                              <button onClick={() => { navigator.clipboard.writeText(value); toast({ title: "Copied!" }) }}>
                                <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-lg p-3">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Never share your card details. This information is encrypted and logged for security.
                      </div>
                    </GlassCardContent>
                  </GlassCard>
                )}

                {/* Card info */}
                <GlassCard className="max-w-3xl mx-auto bg-card border-border">
                  <GlassCardHeader>
                    <GlassCardTitle className="text-base">Card Information</GlassCardTitle>
                  </GlassCardHeader>
                  <GlassCardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      {[
                        { label: "Card ID", value: selectedCard.id.slice(0, 8) + "…" },
                        { label: "Provider", value: selectedCard.provider },
                        { label: "Currency", value: selectedCard.currency },
                        { label: "Label", value: selectedCard.label ?? "—" },
                        { label: "Issued", value: new Date(selectedCard.createdAt).toLocaleDateString() },
                        { label: "Last Updated", value: new Date(selectedCard.updatedAt).toLocaleDateString() },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div className="text-xs text-muted-foreground">{label}</div>
                          <div className="font-medium mt-0.5">{value}</div>
                        </div>
                      ))}
                    </div>
                  </GlassCardContent>
                </GlassCard>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <DepositModal
        open={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        depositInfo={depositInfo}
      />
      <FundCardModal
        open={showFundModal}
        onClose={() => setShowFundModal(false)}
        onConfirm={handleFundCard}
        loading={actionLoading}
      />
      <IssueCardModal
        open={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        onConfirm={handleIssueCard}
        loading={actionLoading}
      />
    </main>
  )
}
