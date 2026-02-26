"use client"

import { useState, useEffect } from "react"
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
import { Key, Plus, Copy, Trash2, Eye, EyeOff, AlertTriangle } from "lucide-react"

// Client-safe types and constants (avoid importing server-only lib/security/api-keys)
interface ApiKey {
  id: string
  name: string
  key_prefix: string
  owner_address: string
  permissions: string[]
  rate_limit_per_minute: number
  rate_limit_per_day: number
  usage_count: number
  is_active: boolean
  created_at: string
}

const API_PERMISSIONS = [
  "read",
  "write",
  "payments.create",
  "payments.read",
  "vendors.manage",
  "analytics.read",
  "webhooks.manage",
] as const

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

  // Form state
  const [keyName, setKeyName] = useState("")
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(["read"])
  const [rateLimitMinute, setRateLimitMinute] = useState(60)
  const [rateLimitDay, setRateLimitDay] = useState(10000)
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (address) {
      loadApiKeys()
    }
  }, [address])

  const loadApiKeys = async () => {
    if (!address) return
    setLoading(true)
    try {
      const res = await fetch("/api/settings/api-keys", {
        headers: { "x-wallet-address": address },
      })
      if (res.ok) {
        const data = await res.json()
        setApiKeys(data.keys ?? [])
      }
    } catch (error) {
      console.error("Failed to load API keys:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateKey = async () => {
    if (!address || !keyName) return

    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": address,
        },
        body: JSON.stringify({
          name: keyName,
          permissions: selectedPermissions,
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
        setSelectedPermissions(["read"])
      } else {
        throw new Error(data.message || "Failed to create API key")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      })
    }
  }

  const handleDeleteKey = async () => {
    if (!address || !selectedKey) return

    try {
      await fetch(`/api/settings/api-keys/${selectedKey.id}`, {
        method: "DELETE",
        headers: { "x-wallet-address": address },
      })
      setApiKeys((prev) => prev.filter((k) => k.id !== selectedKey.id))
      toast({ title: "API Key Deleted" })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete API key",
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                {newSecretKey
                  ? "Your API key has been created. Copy the secret key now - it won't be shown again."
                  : "Configure permissions and rate limits for your new API key."}
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
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPermissions((prev) => [...prev, perm])
                            } else {
                              setSelectedPermissions((prev) => prev.filter((p) => p !== perm))
                            }
                          }}
                        />
                        {perm}
                      </label>
                    ))}
                  </div>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Your API Keys
          </CardTitle>
          <CardDescription>Use these keys to authenticate API requests from your applications</CardDescription>
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
                    <TableCell>{key.usage_count.toLocaleString()} requests</TableCell>
                    <TableCell>
                      <Badge variant={key.is_active ? "default" : "destructive"}>
                        {key.is_active ? "Active" : "Revoked"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
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
