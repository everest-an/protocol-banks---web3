"use client"

import { useState, useEffect } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useDemo } from "@/contexts/demo-context"
import { authHeaders } from "@/lib/authenticated-fetch"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Key, Plus, Trash2, Shield, Clock, DollarSign, Wallet, RefreshCw } from "lucide-react"

interface SessionKey {
  id: string
  session_key_address: string
  chain_id: number
  is_active: boolean
  max_amount_per_tx: string | null
  max_daily_amount: string | null
  allowed_tokens: string[]
  expires_at: string
  created_at: string
  last_used_at: string | null
  daily_used_amount: string
  total_transactions: number
}

// Demo data
const demoSessionKeys: SessionKey[] = [
  {
    id: "sk_1",
    session_key_address: "0x1234...5678",
    chain_id: 8453,
    is_active: true,
    max_amount_per_tx: "100",
    max_daily_amount: "1000",
    allowed_tokens: ["USDC", "USDT"],
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    last_used_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    daily_used_amount: "245.50",
    total_transactions: 12,
  },
  {
    id: "sk_2",
    session_key_address: "0xabcd...efgh",
    chain_id: 1,
    is_active: false,
    max_amount_per_tx: "50",
    max_daily_amount: "500",
    allowed_tokens: ["USDC"],
    expires_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    last_used_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    daily_used_amount: "0",
    total_transactions: 45,
  },
]

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  11155111: "Sepolia",
}

export default function SessionKeysPage() {
  const { address, chainId } = useUnifiedWallet()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  const [sessionKeys, setSessionKeys] = useState<SessionKey[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<SessionKey | null>(null)

  // Form state
  const [maxAmountPerTx, setMaxAmountPerTx] = useState("100")
  const [maxDailyAmount, setMaxDailyAmount] = useState("1000")
  const [selectedChain, setSelectedChain] = useState<string>(String(chainId || 8453))
  const [allowedTokens, setAllowedTokens] = useState<string[]>(["USDC"])
  const [expiresInDays, setExpiresInDays] = useState(30)

  useEffect(() => {
    loadSessionKeys()
  }, [address, isDemoMode])

  const loadSessionKeys = async () => {
    setLoading(true)
    try {
      if (isDemoMode) {
        setSessionKeys(demoSessionKeys)
      } else if (address) {
        const response = await fetch(`/api/session-keys?owner=${address}`, {
          headers: authHeaders(address, undefined, { isDemoMode }),
        })
        const data = await response.json()
        if (data.success) {
          setSessionKeys(data.sessionKeys || [])
        }
      }
    } catch (error) {
      console.error("Failed to load session keys:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateKey = async () => {
    if (isDemoMode) {
      const newKey: SessionKey = {
        id: `sk_${Date.now()}`,
        session_key_address: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
        chain_id: Number(selectedChain),
        is_active: true,
        max_amount_per_tx: maxAmountPerTx,
        max_daily_amount: maxDailyAmount,
        allowed_tokens: allowedTokens,
        expires_at: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        last_used_at: null,
        daily_used_amount: "0",
        total_transactions: 0,
      }
      setSessionKeys((prev) => [newKey, ...prev])
      toast({ title: "Success", description: "Session key created (Test)" })
      setCreateDialogOpen(false)
      return
    }

    try {
      const response = await fetch("/api/session-keys", {
        method: "POST",
        headers: authHeaders(address, { "Content-Type": "application/json" }, { isDemoMode }),
        body: JSON.stringify({
          owner_address: address,
          chain_id: Number(selectedChain),
          max_amount_per_tx: maxAmountPerTx,
          max_daily_amount: maxDailyAmount,
          allowed_tokens: allowedTokens,
          expires_in_days: expiresInDays,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setSessionKeys((prev) => [data.sessionKey, ...prev])
        toast({ title: "Success", description: "Session key created successfully" })
        setCreateDialogOpen(false)
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create session key", variant: "destructive" })
    }
  }

  const handleToggleActive = async (key: SessionKey) => {
    if (isDemoMode) {
      setSessionKeys((prev) =>
        prev.map((k) => (k.id === key.id ? { ...k, is_active: !k.is_active } : k))
      )
      toast({ title: "Success", description: `Session key ${key.is_active ? "deactivated" : "activated"} (Test)` })
      return
    }

    try {
      const response = await fetch(`/api/session-keys/${key.id}`, {
        method: "PATCH",
        headers: authHeaders(address, { "Content-Type": "application/json" }, { isDemoMode }),
        body: JSON.stringify({ is_active: !key.is_active }),
      })

      if (response.ok) {
        setSessionKeys((prev) =>
          prev.map((k) => (k.id === key.id ? { ...k, is_active: !k.is_active } : k))
        )
        toast({ title: "Success", description: `Session key ${key.is_active ? "deactivated" : "activated"}` })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update session key", variant: "destructive" })
    }
  }

  const handleDeleteKey = async () => {
    if (!selectedKey) return

    if (isDemoMode) {
      setSessionKeys((prev) => prev.filter((k) => k.id !== selectedKey.id))
      toast({ title: "Success", description: "Session key deleted (Test)" })
      setDeleteDialogOpen(false)
      setSelectedKey(null)
      return
    }

    try {
      const response = await fetch(`/api/session-keys/${selectedKey.id}`, {
        method: "DELETE",
        headers: authHeaders(address, undefined, { isDemoMode }),
      })
      if (response.ok) {
        setSessionKeys((prev) => prev.filter((k) => k.id !== selectedKey.id))
        toast({ title: "Success", description: "Session key deleted" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete session key", variant: "destructive" })
    } finally {
      setDeleteDialogOpen(false)
      setSelectedKey(null)
    }
  }

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date()

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatRelativeTime = (date: string | null) => {
    if (!date) return "Never"
    const diff = Date.now() - new Date(date).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return "Just now"
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Session Keys</h1>
            <p className="text-muted-foreground">
              Manage delegated signing keys for automated payments
            </p>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Session Key
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create Session Key</DialogTitle>
                <DialogDescription>
                  Create a new session key for automated payments. This key will have limited permissions.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Network</Label>
                  <Select value={selectedChain} onValueChange={setSelectedChain}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8453">Base</SelectItem>
                      <SelectItem value="1">Ethereum</SelectItem>
                      <SelectItem value="42161">Arbitrum</SelectItem>
                      <SelectItem value="11155111">Sepolia (Testnet)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Per Transaction ($)</Label>
                    <Input
                      type="number"
                      value={maxAmountPerTx}
                      onChange={(e) => setMaxAmountPerTx(e.target.value)}
                      placeholder="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Daily ($)</Label>
                    <Input
                      type="number"
                      value={maxDailyAmount}
                      onChange={(e) => setMaxDailyAmount(e.target.value)}
                      placeholder="1000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Allowed Tokens</Label>
                  <div className="flex gap-2">
                    {["USDC", "USDT", "DAI"].map((token) => (
                      <Button
                        key={token}
                        variant={allowedTokens.includes(token) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setAllowedTokens((prev) =>
                            prev.includes(token)
                              ? prev.filter((t) => t !== token)
                              : [...prev, token]
                          )
                        }}
                      >
                        {token}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Expires In (Days)</Label>
                  <Select value={String(expiresInDays)} onValueChange={(v) => setExpiresInDays(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateKey}>Create Session Key</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info Card */}
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="flex items-start gap-4 p-4">
            <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-medium text-blue-500">What are Session Keys?</p>
              <p className="text-sm text-muted-foreground mt-1">
                Session keys are temporary signing keys with limited permissions. They enable automated
                payments (like subscriptions) without requiring your main wallet signature each time.
                You control the spending limits and can revoke them anytime.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Key className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Keys</p>
                <p className="text-2xl font-bold">
                  {sessionKeys.filter((k) => k.is_active && !isExpired(k.expires_at)).length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-500/10 p-2">
                <DollarSign className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today&apos;s Spend</p>
                <p className="text-2xl font-bold">
                  ${sessionKeys.reduce((sum, k) => sum + Number(k.daily_used_amount || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-500/10 p-2">
                <RefreshCw className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold">
                  {sessionKeys.reduce((sum, k) => sum + k.total_transactions, 0)}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-500/10 p-2">
                <Clock className="h-4 w-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expiring Soon</p>
                <p className="text-2xl font-bold">
                  {sessionKeys.filter((k) => {
                    const daysUntilExpiry = (new Date(k.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    return daysUntilExpiry > 0 && daysUntilExpiry <= 7
                  }).length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Session Keys Table */}
        <Card>
          <CardHeader>
            <CardTitle>Your Session Keys</CardTitle>
            <CardDescription>
              Manage your delegated signing keys for automated payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sessionKeys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No session keys yet</p>
                <p className="text-sm">Create a session key to enable automated payments</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key Address</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Limits</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-mono text-sm">
                        {key.session_key_address}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {CHAIN_NAMES[key.chain_id] || `Chain ${key.chain_id}`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>${key.max_amount_per_tx}/tx</div>
                          <div className="text-muted-foreground">${key.max_daily_amount}/day</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {key.allowed_tokens.map((token) => (
                            <Badge key={token} variant="secondary" className="text-xs">
                              {token}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>${key.daily_used_amount} today</div>
                          <div className="text-muted-foreground">{key.total_transactions} txs</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(key.expires_at)}
                          {isExpired(key.expires_at) && (
                            <Badge variant="destructive" className="ml-2 text-xs">Expired</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={key.is_active}
                          onCheckedChange={() => handleToggleActive(key)}
                          disabled={isExpired(key.expires_at)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedKey(key)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Session Key?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this session key. Any automated payments using this key will stop working.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteKey} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
