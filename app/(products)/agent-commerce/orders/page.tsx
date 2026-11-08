"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bot, FileText, Loader2, Plus, RefreshCw, Send, ShoppingBag } from "lucide-react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useToast } from "@/hooks/use-toast"
import { authHeaders } from "@/lib/authenticated-fetch"
import { getTokenAddress } from "@/lib/web3"
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Service {
  id: string
  name: string
  description: string | null
  category: string | null
  priceUsd: number
  token: string
  chain: string
  active: boolean
}

interface Quote {
  id: string
  serviceId: string
  buyer: string
  seller: string
  amountUsd: number
  token: string
  chain: string
  scope: string
  status: string
  termsHash: string
  expiresAt: string
}

interface Order {
  id: string
  serviceId: string
  buyer: string
  seller: string
  amountUsd: number
  token: string
  chain: string
  scope: string
  status: string
  paymentId: string | null
  deliveryHash: string | null
  deliveryUri: string | null
  createdAt: string
  deliveredAt: string | null
  paidAt: string | null
}

const short = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`

function statusClass(status: string) {
  if (status === "completed") return "bg-green-500/10 text-green-600 border-green-500/20"
  if (status === "paid") return "bg-blue-500/10 text-blue-600 border-blue-500/20"
  if (status === "delivered" || status === "payment_pending") return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
  if (status === "failed" || status === "disputed") return "bg-red-500/10 text-red-600 border-red-500/20"
  if (status === "refunded") return "bg-purple-500/10 text-purple-600 border-purple-500/20"
  return "bg-muted text-muted-foreground"
}

export default function AgentCommerceOrdersPage() {
  const { address, isConnected, signERC3009Authorization } = useUnifiedWallet()
  const { toast } = useToast()
  const [services, setServices] = useState<Service[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [tab, setTab] = useState("orders")
  const [serviceOpen, setServiceOpen] = useState(false)
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [deliverOpen, setDeliverOpen] = useState<Order | null>(null)
  const [serviceForm, setServiceForm] = useState({ name: "", description: "", category: "", endpoint: "", priceUsd: "0.01", token: "USDC", chain: "base" })
  const [quoteForm, setQuoteForm] = useState({ serviceId: "", buyer: "", scope: "", amountUsd: "", deliveryDue: "" })
  const [deliverForm, setDeliverForm] = useState({ deliveryHash: "", deliveryUri: "" })

  const headers = useMemo(() => authHeaders(address ?? undefined, { "Content-Type": "application/json" }), [address])

  const load = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      const settled = await Promise.allSettled([
        fetch("/api/commerce/services", { headers }),
        fetch("/api/commerce/quotes", { headers }),
        fetch("/api/commerce/orders", { headers }),
      ])
      const payloads = await Promise.all(settled.map(async (result) => {
        if (result.status === "rejected") return null
        const response = result.value
        const data = await response.json().catch(() => ({}))
        return { ok: response.ok, data }
      }))
      const [servicesPayload, quotesPayload, ordersPayload] = payloads
      if (servicesPayload?.ok) setServices(Array.isArray(servicesPayload.data.services) ? servicesPayload.data.services : [])
      if (quotesPayload?.ok) setQuotes(Array.isArray(quotesPayload.data.quotes) ? quotesPayload.data.quotes : [])
      if (ordersPayload?.ok) setOrders(Array.isArray(ordersPayload.data.orders) ? ordersPayload.data.orders : [])
      if (payloads.some((payload) => !payload?.ok)) {
        toast({ title: "Some commerce data is unavailable", description: "Refresh to retry.", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Commerce unavailable", description: error instanceof Error ? error.message : "Try again", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [address, headers, toast])

  useEffect(() => { load() }, [load])

  const post = async (path: string, body: Record<string, unknown>) => {
    const response = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || data.message || `HTTP ${response.status}`)
    return data
  }

  const createService = async () => {
    setBusy("service")
    try {
      await post("/api/commerce/services", {
        ...serviceForm,
        priceUsd: Number(serviceForm.priceUsd),
      })
      setServiceOpen(false)
      setServiceForm({ name: "", description: "", category: "", endpoint: "", priceUsd: "0.01", token: "USDC", chain: "base" })
      toast({ title: "Service published" })
      await load()
    } catch (error) {
      toast({ title: "Could not create service", description: error instanceof Error ? error.message : "Try again", variant: "destructive" })
    } finally { setBusy(null) }
  }

  const createQuote = async () => {
    setBusy("quote")
    try {
      await post("/api/commerce/quotes", {
        ...quoteForm,
        amountUsd: quoteForm.amountUsd ? Number(quoteForm.amountUsd) : undefined,
        deliveryDue: quoteForm.deliveryDue || undefined,
      })
      setQuoteOpen(false)
      setQuoteForm({ serviceId: "", buyer: "", scope: "", amountUsd: "", deliveryDue: "" })
      toast({ title: "Quote sent" })
      await load()
    } catch (error) {
      toast({ title: "Could not create quote", description: error instanceof Error ? error.message : "Try again", variant: "destructive" })
    } finally { setBusy(null) }
  }

  const acceptQuote = async (quote: Quote) => {
    setBusy(quote.id)
    try {
      await post("/api/commerce/quotes/accept", { quoteId: quote.id })
      toast({ title: "Quote accepted", description: "Order created." })
      await load()
      setTab("orders")
    } catch (error) {
      toast({ title: "Could not accept quote", description: error instanceof Error ? error.message : "Try again", variant: "destructive" })
    } finally { setBusy(null) }
  }

  const payOrder = async (order: Order) => {
    if (!address || !signERC3009Authorization) {
      toast({ title: "Wallet signing unavailable", description: "Connect an EVM wallet to pay.", variant: "destructive" })
      return
    }
    setBusy(order.id)
    try {
      const intentResponse = await fetch("/api/commerce/orders/pay", { method: "POST", headers, body: JSON.stringify({ orderId: order.id }) })
      const intentData = await intentResponse.json()
      if (!intentResponse.ok || !intentData.intent?.typedData) throw new Error(intentData.error || "Could not prepare payment")
      const intent = intentData.intent
      const chainId = Number(intent.chainId)
      const tokenAddress = getTokenAddress(chainId, order.token)
      if (!tokenAddress || tokenAddress === "NATIVE") throw new Error(`${order.token} is not supported on this chain`)
      const auth = await signERC3009Authorization({
        tokenAddress,
        from: address,
        to: order.seller,
        amount: String(order.amountUsd),
        chainId,
        nonce: intent.authorization.nonce,
        validAfter: intent.authorization.validAfter,
        validBefore: intent.authorization.validBefore,
      })
      const response = await fetch("/api/commerce/orders/pay", {
        method: "POST",
        headers,
        body: JSON.stringify({
          orderId: order.id,
          authorization: { ...intent.authorization, v: auth.v, r: auth.r, s: auth.s },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || data.message || "Payment failed")
      toast({ title: data.payment?.status === "confirmed" ? "Order paid" : "Payment submitted", description: data.note })
      await load()
    } catch (error) {
      toast({ title: "Payment failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" })
    } finally { setBusy(null) }
  }

  const deliverOrder = async () => {
    if (!deliverOpen) return
    setBusy(deliverOpen.id)
    try {
      await post("/api/commerce/orders/deliver", { orderId: deliverOpen.id, ...deliverForm })
      setDeliverOpen(null)
      setDeliverForm({ deliveryHash: "", deliveryUri: "" })
      toast({ title: "Delivery recorded" })
      await load()
    } catch (error) {
      toast({ title: "Could not record delivery", description: error instanceof Error ? error.message : "Try again", variant: "destructive" })
    } finally { setBusy(null) }
  }

  const action = async (path: string, order: Order, body: Record<string, unknown> = {}) => {
    setBusy(order.id)
    try {
      await post(path, { orderId: order.id, ...body })
      toast({ title: "Order updated" })
      await load()
    } catch (error) {
      toast({ title: "Could not update order", description: error instanceof Error ? error.message : "Try again", variant: "destructive" })
    } finally { setBusy(null) }
  }

  const isSeller = (order: Order) => order.seller.toLowerCase() === address?.toLowerCase()
  const isBuyer = (order: Order) => order.buyer.toLowerCase() === address?.toLowerCase()

  if (!isConnected || !address) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16">
        <GlassCard className="border-dashed">
          <GlassCardContent className="flex flex-col items-center py-12 text-center">
            <Bot className="h-10 w-10 text-primary" />
            <h1 className="mt-4 text-2xl font-bold">Agent Commerce</h1>
            <p className="mt-2 text-sm text-muted-foreground">Connect a wallet to manage services, quotes and orders.</p>
            <Button className="mt-5" onClick={() => (window.location.href = "/agent-commerce")}>Browse the public directory</Button>
          </GlassCardContent>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Agent commerce</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Services, quotes and orders</h1>
          <p className="mt-2 text-sm text-muted-foreground">Buy and sell under the same server-enforced account.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/agent-commerce")}>
            <ShoppingBag className="mr-2 h-4 w-4" /> Directory
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="orders">Orders <span className="ml-1 text-xs text-muted-foreground">{orders.length}</span></TabsTrigger>
          <TabsTrigger value="quotes">Quotes <span className="ml-1 text-xs text-muted-foreground">{quotes.length}</span></TabsTrigger>
          <TabsTrigger value="services">Services <span className="ml-1 text-xs text-muted-foreground">{services.length}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          {orders.length === 0 ? (
            <GlassCard><GlassCardContent className="py-12 text-center text-sm text-muted-foreground">No orders yet. Accept a quote to create one.</GlassCardContent></GlassCard>
          ) : orders.map((order) => (
            <GlassCard key={order.id}>
              <GlassCardContent className="pt-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={statusClass(order.status)}>{order.status.replace("_", " ")}</Badge>
                      <span className="text-xs text-muted-foreground">{isSeller(order) ? "Selling" : "Buying"} · {order.token} on {order.chain}</span>
                    </div>
                    <p className="mt-2 text-lg font-semibold">${Number(order.amountUsd).toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{order.token}</span></p>
                    <p className="mt-1 text-sm text-muted-foreground">{order.scope}</p>
                    <p className="mt-2 font-mono text-[11px] text-muted-foreground">{short(order.buyer)} → {short(order.seller)}</p>
                    {order.deliveryHash ? <p className="mt-2 truncate text-xs text-muted-foreground">Delivery: {order.deliveryHash}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {isBuyer(order) && ["accepted", "delivered"].includes(order.status) ? (
                      <Button size="sm" onClick={() => payOrder(order)} disabled={busy === order.id}>
                        {busy === order.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Pay order
                      </Button>
                    ) : null}
                    {isSeller(order) && ["accepted", "paid", "payment_pending"].includes(order.status) ? (
                      <Button size="sm" variant="outline" onClick={() => setDeliverOpen(order)} disabled={busy === order.id}>Deliver</Button>
                    ) : null}
                    {isBuyer(order) && order.status === "delivered" && order.paymentId ? (
                      <Button size="sm" variant="outline" onClick={() => action("/api/commerce/orders/complete", order)} disabled={busy === order.id}>Complete</Button>
                    ) : null}
                    {["accepted"].includes(order.status) ? (
                      <Button size="sm" variant="ghost" onClick={() => action("/api/commerce/orders/cancel", order)} disabled={busy === order.id}>Cancel</Button>
                    ) : null}
                    {isSeller(order) && order.status === "paid" ? (
                      <Button size="sm" variant="ghost" onClick={() => {
                        const txHash = window.prompt("Refund transaction hash")
                        if (txHash) action("/api/commerce/orders/refund", order, { txHash })
                      }} disabled={busy === order.id}>Refund</Button>
                    ) : null}
                    {["accepted", "delivered", "paid"].includes(order.status) ? (
                      <Button size="sm" variant="ghost" onClick={() => {
                        const reason = window.prompt("Dispute reason")
                        if (reason) action("/api/commerce/orders/dispute", order, { reason })
                      }} disabled={busy === order.id}>Dispute</Button>
                    ) : null}
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>
          ))}
        </TabsContent>

        <TabsContent value="quotes" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> New quote</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Send a quote</DialogTitle><DialogDescription>Only the service owner can quote. The buyer accepts to create the order.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Service</Label><select className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={quoteForm.serviceId} onChange={(e) => setQuoteForm((f) => ({ ...f, serviceId: e.target.value }))}><option value="">Select a service</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name} · ${s.priceUsd}</option>)}</select></div>
                  <div><Label>Buyer address</Label><Input value={quoteForm.buyer} onChange={(e) => setQuoteForm((f) => ({ ...f, buyer: e.target.value }))} placeholder="0x..." /></div>
                  <div><Label>Scope</Label><Textarea value={quoteForm.scope} onChange={(e) => setQuoteForm((f) => ({ ...f, scope: e.target.value }))} placeholder="What will be delivered" /></div>
                  <div className="grid grid-cols-2 gap-3"><div><Label>Amount (optional)</Label><Input value={quoteForm.amountUsd} onChange={(e) => setQuoteForm((f) => ({ ...f, amountUsd: e.target.value }))} placeholder="Default service price" /></div><div><Label>Deliver by</Label><Input type="datetime-local" value={quoteForm.deliveryDue} onChange={(e) => setQuoteForm((f) => ({ ...f, deliveryDue: e.target.value }))} /></div></div>
                </div>
                <DialogFooter><Button onClick={createQuote} disabled={busy === "quote" || !quoteForm.serviceId || !quoteForm.buyer || !quoteForm.scope}>Send quote</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {quotes.length === 0 ? <GlassCard><GlassCardContent className="py-12 text-center text-sm text-muted-foreground">No quotes yet.</GlassCardContent></GlassCard> : quotes.map((quote) => (
            <GlassCard key={quote.id}>
              <GlassCardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 h-4 w-4 text-muted-foreground" />
                  <div><p className="text-sm font-medium">${Number(quote.amountUsd).toFixed(2)} {quote.token} · {quote.status}</p><p className="text-xs text-muted-foreground">{quote.scope}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{short(quote.buyer)} → {short(quote.seller)} · {quote.termsHash.slice(0, 12)}...</p></div>
                </div>
                {quote.buyer.toLowerCase() === address.toLowerCase() && quote.status === "open" ? <Button size="sm" onClick={() => acceptQuote(quote)} disabled={busy === quote.id}>Accept</Button> : null}
              </GlassCardContent>
            </GlassCard>
          ))}
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={serviceOpen} onOpenChange={setServiceOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Publish service</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Publish a service</DialogTitle><DialogDescription>Buyers can find it in the public directory.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={serviceForm.name} onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))} /></div>
                  <div><Label>Description</Label><Textarea value={serviceForm.description} onChange={(e) => setServiceForm((f) => ({ ...f, description: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-3"><div><Label>Category</Label><Input value={serviceForm.category} onChange={(e) => setServiceForm((f) => ({ ...f, category: e.target.value }))} placeholder="data" /></div><div><Label>Price (USD)</Label><Input value={serviceForm.priceUsd} onChange={(e) => setServiceForm((f) => ({ ...f, priceUsd: e.target.value }))} /></div></div>
                  <div><Label>Endpoint</Label><Input value={serviceForm.endpoint} onChange={(e) => setServiceForm((f) => ({ ...f, endpoint: e.target.value }))} placeholder="https://..." /></div>
                </div>
                <DialogFooter><Button onClick={createService} disabled={busy === "service" || !serviceForm.name}>Publish</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {services.length === 0 ? <GlassCard><GlassCardContent className="py-12 text-center text-sm text-muted-foreground">No services yet. Publish one, then quote a buyer.</GlassCardContent></GlassCard> : services.map((service) => (
            <GlassCard key={service.id}>
              <GlassCardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3"><ShoppingBag className="mt-1 h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-medium">{service.name}</p><p className="text-xs text-muted-foreground">{service.description || service.category || "Agent service"} · ${service.priceUsd} {service.token} / {service.chain}</p></div></div>
                <div className="flex items-center gap-2"><Badge variant="outline">{service.active ? "Active" : "Paused"}</Badge></div>
              </GlassCardContent>
            </GlassCard>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!deliverOpen} onOpenChange={(open) => !open && setDeliverOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record delivery</DialogTitle><DialogDescription>Submit a SHA-256 hash of the deliverable. The buyer will release/complete the order.</DialogDescription></DialogHeader>
          <div className="space-y-3"><div><Label>Delivery hash</Label><Input value={deliverForm.deliveryHash} onChange={(e) => setDeliverForm((f) => ({ ...f, deliveryHash: e.target.value }))} placeholder="sha256:..." /></div><div><Label>Delivery URI</Label><Input value={deliverForm.deliveryUri} onChange={(e) => setDeliverForm((f) => ({ ...f, deliveryUri: e.target.value }))} placeholder="https://..." /></div></div>
          <DialogFooter><Button onClick={deliverOrder} disabled={busy === deliverOpen?.id || !deliverForm.deliveryHash}>Record delivery</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}



