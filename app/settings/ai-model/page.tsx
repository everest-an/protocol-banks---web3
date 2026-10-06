"use client"

import { useCallback, useEffect, useState } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { authHeaders } from "@/lib/authenticated-fetch"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Brain, Loader2, Trash2, ShieldCheck } from "lucide-react"

/**
 * AI model settings — the review model for the trading agent.
 *
 * Default: the platform's free-tier channel answers every review, so users
 * configure nothing. Power users can paste their own key (OpenRouter or
 * DeepSeek); it is verified against the provider before being stored sealed.
 * A stored key wins over the platform default; removing it falls back again.
 */
interface LlmKeyStatus {
  configured: boolean
  provider: string | null
  model: string | null
  platformDefault: { provider: string; model: string; available: boolean }
  encryptionAvailable: boolean
}

export default function AiModelSettingsPage() {
  const { isConnected, address } = useUnifiedWallet()
  const { toast } = useToast()

  const [status, setStatus] = useState<LlmKeyStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [provider, setProvider] = useState<"openrouter" | "deepseek">("openrouter")
  const [model, setModel] = useState("")

  const load = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      const res = await fetch("/api/trading/llm-key", { headers: authHeaders(address) })
      if (!res.ok) throw new Error()
      const data: LlmKeyStatus = await res.json()
      setStatus(data)
      if (data.provider === "deepseek" || data.provider === "openrouter") {
        setProvider(data.provider)
      }
      setModel(data.model ?? "")
    } catch {
      toast({ title: "Error", description: "Could not load the AI model settings.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [address, toast])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!address || !apiKey.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/trading/llm-key", {
        method: "PUT",
        headers: { ...authHeaders(address), "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), provider, model: model.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Could not save the key")
      setApiKey("")
      toast({ title: "Saved", description: "Your key was verified and stored encrypted." })
      load()
    } catch (error) {
      toast({
        title: "Key rejected",
        description: error instanceof Error ? error.message : "Could not save the key.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!address) return
    setSaving(true)
    try {
      await fetch("/api/trading/llm-key", { method: "DELETE", headers: authHeaders(address) })
      toast({ title: "Removed", description: "The platform default model takes over again." })
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">AI Model</h1>
        <p className="text-muted-foreground">
          The model that reviews every trade before it goes out. It can only veto — sizing, stop-loss
          and circuit breakers are enforced by the platform regardless of what the model says.
        </p>
      </div>

      {!isConnected || !address ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect your wallet</CardTitle>
            <CardDescription>Connect the wallet that runs your agent to manage its model.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Current model
              </CardTitle>
              <CardDescription>
                A key you add here is used for your account only. Otherwise the platform default runs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading || !status ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Your key</span>
                    {status.configured ? (
                      <span className="flex items-center gap-2">
                        <Badge variant="default">{status.provider}</Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {status.model ?? "provider default"}
                        </span>
                      </span>
                    ) : (
                      <Badge variant="secondary">Not set — using the platform default</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Platform default</span>
                    <span className="font-mono text-xs">
                      {status.platformDefault.provider} · {status.platformDefault.model}{" "}
                      {status.platformDefault.available ? "" : "(unavailable)"}
                    </span>
                  </div>
                  {status.configured && (
                    <Button variant="outline" size="sm" onClick={remove} disabled={saving}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove my key
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Bring your own key
              </CardTitle>
              <CardDescription>
                Verified against the provider before saving, then encrypted at rest. OpenRouter keys work
                with almost every model (DeepSeek, Qwen, Claude, GPT…).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value === "deepseek" ? "deepseek" : "openrouter")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="openrouter">OpenRouter (recommended — free tiers available)</option>
                  <option value="deepseek">DeepSeek (direct)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>API key</Label>
                <Input
                  type="password"
                  placeholder={provider === "openrouter" ? "sk-or-v1-…" : "sk-…"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label>Model (optional)</Label>
                <Input
                  placeholder={provider === "openrouter" ? "deepseek/deepseek-v4-flash" : "deepseek-flash"}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for the provider's default. The key is tested live before it is saved.
                </p>
              </div>
              <Button onClick={save} disabled={saving || !apiKey.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify &amp; save
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
