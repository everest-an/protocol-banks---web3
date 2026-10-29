"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { authHeaders } from "@/lib/authenticated-fetch"
import { Key, Plus, Copy, Trash2, Eye, EyeOff, AlertTriangle, Pencil } from "lucide-react"

// Client-safe types and constants (avoid importing server-only lib/security/api-keys)
interface AgentPolicy {
  allowedOps: string[]
  maxNotionalUsd: number
  dailyCapUsd: number
  allowedCoins: string[]
}

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  owner_address: string
  permissions: string[]
  policy?: AgentPolicy | null
  rate_limit_per_minute: number
  rate_limit_per_day: number
  usage_count: number
  is_active: boolean
  created_at: string
}

interface BillingStatus {
  plan: string
  name: string
  status: string
  monthlyUsd: number
  currentPeriodEnd: string | null
  caps: { maxKeys: number; maxNotionalUsd: number; dailyCapUsd: number }
  feeBps: number
  keysUsed: number
  billingConfigured: boolean
}

// Must match VALID_PERMISSIONS in app/api/settings/api-keys/route.ts
const API_PERMISSIONS = ["read", "write", "payments", "webhooks", "admin"] as const

// The four operations the agent policy can grant (lib/agent/policy.ts).
const AGENT_OPS = [
  { value: "read", label: "read", hint: "GET /state" },
  { value: "trade", label: "trade", hint: "POST /orders" },
  { value: "pay", label: "pay", hint: "POST /pay, /invoice" },
  { value: "swap", label: "swap", hint: "POST /swap" },
] as const

const POLICY_HINT = "Enforced on the server. The agent cannot widen it, and values are clamped to the platform ranges."

export default function ApiKeysPage() {
  const { address } = useUnifiedWallet()
  const { toast } = useToast()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null)
  const [newSecretKey, setNewSecretKey] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  // Create form state
  const [keyName, setKeyName] = useState("")
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(["read", "write"])
  const [rateLimitMinute, setRateLimitMinute] = useState(60)
  const [rateLimitDay, setRateLimitDay] = useState(10000)
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined)
  const [policyOps, setPolicyOps] = useState<string[]>(["read"])
  const [policyMax, setPolicyMax] = useState(50)
  const [policyDaily, setPolicyDaily] = useState(200)
  const [policyCoins, setPolicyCoins] = useState("")

  // Edit-policy dialog
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)
  const [editOps, setEditOps] = useState<string[]>([])
  const [editMax, setEditMax] = useState(50)
  const [editDaily, setEditDaily] = useState(200)
  const [editCoins, setEditCoins] = useState("")
  const [savingPolicy, setSavingPolicy] = useState(false)

  useEffect(() => {
    if (address) {
      loadApiKeys()
      loadBilling()
    }
  }, [address])

  useEffect(() => {
    if (!address || typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("billing") !== "success") return

    toast({
      title: "Subscription active",
      description: "Stripe is confirming the plan. If the caps below still show the old values, reload in a moment.",
    })
    loadBilling(true)
    const url = new URL(window.location.href)
    url.searchParams.delete("billing")
    window.history.replaceState({}, "", url.toString())
  }, [address])

  const loadApiKeys = async () => {
    if (!address) return
    setLoading(true)
    try {
      const res = await fetch("/api/settings/api-keys", { headers: authHeaders(address) })
      if (res.ok) {
        const data = await res.json()
        setApiKeys(data.keys ?? [])
      } else {
        const data = await res.json().catch(() => ({}))
        toast({
          title: "Could not load API keys",
          description: data.message || "Sign in with your wallet and try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to load API keys:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadBilling = async (refresh = false) => {
    if (!address) return
    try {
      const res = await fetch(`/api/billing/status${refresh ? "?refresh=1" : ""}`, { headers: authHeaders(address) })
      if (res.ok) setBilling(await res.json())
    } catch (error) {
      console.error("Failed to load billing:", error)
    }
  }

  const openPortal = async () => {
    if (!address) return
    setPortalLoading(true)
    try {
      const res = await fetch("/api/billing/portal", { method: "POST", headers: authHeaders(address) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.message || data.error || "Could not open billing")
      window.location.href = data.url
    } catch (error) {
      toast({
        title: "Billing portal",
        description: error instanceof Error ? error.message : "Could not open billing",
        variant: "destructive",
      })
    } finally {
      setPortalLoading(false)
    }
  }

  const policyFromForm = () => ({
    allowedOps: policyOps,
    maxNotionalUsd: policyMax,
    dailyCapUsd: policyDaily,
    allowedCoins: policyCoins
      .split(",")
      .map((coin) => coin.trim())
      .filter(Boolean),
  })

  const handleCreateKey = async () => {
    if (!address || !keyName) return

    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: authHeaders(address, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: keyName,
          permissions: selectedPermissions,
          policy: policyFromForm(),
          rate_limit_per_minute: rateLimitMinute,
          rate_limit_per_day: rateLimitDay,
          expires_at: expiresInDays
            ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
            : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewSecretKey(data.secret)
        setApiKeys((prev) => [{ ...data.key, usage_count: 0, is_active: true } as ApiKey, ...prev])
        toast({
          title: "API Key Created",
          description: "Make sure to copy your secret key now. It won't be shown again.",
        })
        setKeyName("")
        setSelectedPermissions(["read", "write"])
        setPolicyOps(["read"])
        setPolicyMax(50)
        setPolicyDaily(200)
        setPolicyCoins("")
      } else {
        throw new Error((data.details && data.details.join("; ")) || data.message || "Failed to create API key")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create API key",
        variant: "destructive",
      })
    }
  }

  const openPolicyDialog = (key: ApiKey) => {
    setEditingKey(key)
    setEditOps(key.policy?.allowedOps ?? ["read", "trade", "pay", "swap"])
    setEditMax(key.policy?.maxNotionalUsd ?? 100)
    setEditDaily(key.policy?.dailyCapUsd ?? 500)
    setEditCoins((key.policy?.allowedCoins ?? []).join(", "))
  }

  const handleSavePolicy = async () => {
    if (!address || !editingKey) return
    setSavingPolicy(true)
    try {
      const res = await fetch(`/api/settings/api-keys/${editingKey.id}`, {
        method: "PATCH",
        headers: authHeaders(address, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          policy: {
            allowedOps: editOps,
            maxNotionalUsd: editMax,
            dailyCapUsd: editDaily,
            allowedCoins: editCoins
              .split(",")
              .map((coin) => coin.trim())
              .filter(Boolean),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error((data.details && data.details.join("; ")) || data.message || "Failed to save policy")
      }
      setApiKeys((prev) =>
        prev.map((key) => (key.id === editingKey.id ? { ...key, policy: data.policy as AgentPolicy } : key)),
      )
      toast({ title: "Policy updated", description: "The next API call is enforced with the new limits." })
      setEditingKey(null)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save policy",
        variant: "destructive",
      })
    } finally {
      setSavingPolicy(false)
    }
  }

  const handleDeleteKey = async () => {
    if (!address || !selectedKey) return

    try {
      const res = await fetch(`/api/settings/api-keys/${selectedKey.id}`, {
        method: "DELETE",
        headers: authHeaders(address),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || "Failed to delete API key")
      }
      setApiKeys((prev) => prev.filter((k) => k.id !== selectedKey.id))
      toast({ title: "API Key Deleted" })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete API key",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setSelectedKey(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard" })
  }

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

  const policySummary = (key: ApiKey) => {
    if (!key.policy) return null
    return `${key.policy.allowedOps.join(", ") || "no ops"} · $${key.policy.maxNotionalUsd}/call · $${key.policy.dailyCapUsd}/day`
  }

  if (!address) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Please connect your wallet to manage API keys
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">Manage API keys for programmatic access to Protocol Banks</p>
        </div>
        <Dialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open)
            if (!open) {
              setNewSecretKey(null)
              setShowSecret(false)
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                {newSecretKey
                  ? "Your API key has been created. Copy the secret key now - it won't be shown again."
                  : "Configure permissions, the agent policy and rate limits for your new key."}
              </DialogDescription>
            </DialogHeader>

            {newSecretKey ? (
              <div className="space-y-4">
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium text-yellow-500">Save your secret key</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This is the only time you will see this key. Store it securely.
                  </p>
                </div>
                <div className="relative">
                  <Input
                    value={showSecret ? newSecretKey : "•".repeat(40)}
                    readOnly
                    className="pr-20 font-mono text-sm"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowSecret(!showSecret)}>
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => copyToClipboard(newSecretKey)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setCreateDialogOpen(false)
                      setNewSecretKey(null)
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Key Name</Label>
                  <Input placeholder="My API Key" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
                </div>

                <div>
                  <Label className="mb-2 block">Permissions</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {API_PERMISSIONS.map((perm) => (
                      <label key={perm} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedPermissions.includes(perm)}
                          onCheckedChange={() => setSelectedPermissions((prev) => toggle(prev, perm))}
                        />
                        {perm}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    <code>read</code> covers GET /state; <code>write</code> covers orders, pay, swap and invoice.
                  </p>
                </div>

                <div className="rounded-lg border p-3 space-y-3">
                  <div>
                    <Label className="mb-1 block">Agent operations</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {AGENT_OPS.map((op) => (
                        <label key={op.value} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={policyOps.includes(op.value)}
                            onCheckedChange={() => setPolicyOps((prev) => toggle(prev, op.value))}
                          />
                          <span>
                            {op.label} <span className="text-xs text-muted-foreground">{op.hint}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Max per call (USD)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10000}
                        value={policyMax}
                        onChange={(e) => setPolicyMax(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Daily cap (USD)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100000}
                        value={policyDaily}
                        onChange={(e) => setPolicyDaily(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Coin allowlist (comma separated, empty = all)</Label>
                    <Input placeholder="BTC, ETH" value={policyCoins} onChange={(e) => setPolicyCoins(e.target.value)} />
                  </div>
                  <p className="text-xs text-muted-foreground">{POLICY_HINT}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Rate Limit (per minute)</Label>
                    <Input
                      type="number"
                      value={rateLimitMinute}
                      onChange={(e) => setRateLimitMinute(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Rate Limit (per day)</Label>
                    <Input
                      type="number"
                      value={rateLimitDay}
                      onChange={(e) => setRateLimitDay(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <Label>Expires In (days, optional)</Label>
                  <Input
                    type="number"
                    placeholder="Never"
                    value={expiresInDays || ""}
                    onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateKey} disabled={!keyName}>
                    Create Key
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Plan
            {billing ? <Badge variant="secondary">{billing.name}</Badge> : null}
          </CardTitle>
          <CardDescription>
            {billing
              ? `${billing.keysUsed}/${billing.caps.maxKeys} keys · $${billing.caps.maxNotionalUsd}/call · $${billing.caps.dailyCapUsd}/day · ${
                  billing.feeBps === 0 ? "no per-order fee" : `${billing.feeBps} bps per executed order`
                }`
              : "Loading plan…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button asChild size="sm" variant="outline">
            <Link href="/pricing">Upgrade plan</Link>
          </Button>
          {billing && billing.status !== "none" ? (
            <Button size="sm" variant="outline" onClick={openPortal} disabled={portalLoading}>
              {portalLoading ? "Opening…" : "Manage billing"}
            </Button>
          ) : null}
          {billing?.currentPeriodEnd ? (
            <span className="text-xs text-muted-foreground">
              Renews {new Date(billing.currentPeriodEnd).toLocaleDateString()}
            </span>
          ) : null}
          {billing && !billing.billingConfigured ? (
            <span className="text-xs text-muted-foreground">Billing is not connected on this deployment.</span>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Your API Keys
          </CardTitle>
          <CardDescription>
            Each key carries a policy the server enforces on every call. Editing it takes effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No API keys yet. Create one to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-sm">{key.key_prefix}...</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {key.permissions.slice(0, 2).map((p) => (
                          <Badge key={p} variant="secondary" className="text-xs">
                            {p}
                          </Badge>
                        ))}
                        {key.permissions.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{key.permissions.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {key.policy ? (
                        policySummary(key)
                      ) : (
                        <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600">
                          legacy defaults — edit to tighten
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{key.usage_count.toLocaleString()} requests</TableCell>
                    <TableCell>
                      <Badge variant={key.is_active ? "default" : "destructive"}>
                        {key.is_active ? "Active" : "Revoked"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openPolicyDialog(key)} title="Edit policy">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => {
                          setSelectedKey(key)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingKey)} onOpenChange={(open) => !open && setEditingKey(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Policy for “{editingKey?.name}”</DialogTitle>
            <DialogDescription>{POLICY_HINT}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1 block">Agent operations</Label>
              <div className="grid grid-cols-2 gap-2">
                {AGENT_OPS.map((op) => (
                  <label key={op.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={editOps.includes(op.value)}
                      onCheckedChange={() => setEditOps((prev) => toggle(prev, op.value))}
                    />
                    <span>
                      {op.label} <span className="text-xs text-muted-foreground">{op.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max per call (USD)</Label>
                <Input type="number" min={1} max={10000} value={editMax} onChange={(e) => setEditMax(Number(e.target.value))} />
              </div>
              <div>
                <Label>Daily cap (USD)</Label>
                <Input
                  type="number"
                  min={1}
                  max={100000}
                  value={editDaily}
                  onChange={(e) => setEditDaily(Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <Label>Coin allowlist (comma separated, empty = all)</Label>
              <Input placeholder="BTC, ETH" value={editCoins} onChange={(e) => setEditCoins(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingKey(null)}>
              Cancel
            </Button>
            <Button onClick={handleSavePolicy} disabled={savingPolicy}>
              {savingPolicy ? "Saving..." : "Save policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedKey?.name}"? This action cannot be undone and any applications
              using this key will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteKey} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
