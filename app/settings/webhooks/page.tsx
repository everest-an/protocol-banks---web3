"use client"

import { useState, useEffect } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"
import { useWebhooks, WEBHOOK_EVENTS, type WebhookDelivery } from "@/hooks/use-webhooks"
import { WebhookIcon, Plus, Copy, Trash2, ChevronDown, AlertTriangle, CheckCircle, XCircle, Clock, Play } from "lucide-react"

export default function WebhooksPage() {
  const { wallets } = useWeb3()
  const address = wallets.EVM
  const { toast } = useToast()
  
  // Use the new useWebhooks Hook
  const {
    webhooks,
    loading,
    error,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    testWebhook,
    getDeliveries,
  } = useWebhooks()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null)
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDelivery[]>>({})
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null)

  // Form state
  const [webhookName, setWebhookName] = useState("")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  // Show error toast if hook has error
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      })
    }
  }, [error, toast])

  const loadDeliveries = async (webhookId: string) => {
    try {
      const data = await getDeliveries(webhookId)
      setDeliveries((prev) => ({ ...prev, [webhookId]: data }))
    } catch (err) {
      console.error("Failed to load deliveries:", err)
    }
  }

  const handleCreateWebhook = async () => {
    if (!webhookName || !webhookUrl || selectedEvents.length === 0) return

    setCreating(true)
    try {
      const result = await createWebhook({
        name: webhookName,
        url: webhookUrl,
        events: selectedEvents,
      })

      setNewSecret(result.secret)
      toast({
        title: "Webhook Created",
        description: "Copy your signing secret now - it won't be shown again.",
      })

      setWebhookName("")
      setWebhookUrl("")
      setSelectedEvents([])
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create webhook",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const handleToggleWebhook = async (webhookId: string, currentActive: boolean) => {
    try {
      await updateWebhook(webhookId, { is_active: !currentActive })
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update webhook",
        variant: "destructive",
      })
    }
  }

  const handleDeleteWebhook = async (webhookId: string) => {
    try {
      await deleteWebhook(webhookId)
      toast({ title: "Webhook Deleted" })
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete webhook",
        variant: "destructive",
      })
    }
  }

  const handleTestWebhook = async (webhookId: string) => {
    setTestingWebhook(webhookId)
    try {
      const result = await testWebhook(webhookId)
      if (result.success) {
        toast({
          title: "Test Successful",
          description: `Response: ${result.status_code} (${result.response_time_ms}ms)`,
        })
      } else {
        toast({
          title: "Test Failed",
          description: result.error || "Webhook endpoint did not respond successfully",
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({
        title: "Test Error",
        description: err instanceof Error ? err.message : "Failed to test webhook",
        variant: "destructive",
      })
    } finally {
      setTestingWebhook(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard" })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  if (!address) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Please connect your wallet to manage webhooks
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground">Receive real-time notifications when events happen in your account</p>
        </div>
        <Dialog
          open={createDialogOpen}
          onOpenChange={(open: boolean) => {
            setCreateDialogOpen(open)
            if (!open) setNewSecret(null)
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>
                {newSecret
                  ? "Your webhook has been created. Copy the signing secret to verify webhook deliveries."
                  : "Configure the endpoint URL and events to listen for."}
              </DialogDescription>
            </DialogHeader>

            {newSecret ? (
              <div className="space-y-4">
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium text-yellow-500">Save your signing secret</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Use this secret to verify that webhook payloads were sent by Protocol Banks.
                  </p>
                </div>
                <div className="relative">
                  <Input value={newSecret} readOnly className="pr-10 font-mono text-sm" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => copyToClipboard(newSecret)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setCreateDialogOpen(false)
                      setNewSecret(null)
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Webhook Name</Label>
                  <Input
                    placeholder="Payment notifications"
                    value={webhookName}
                    onChange={(e) => setWebhookName(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Endpoint URL</Label>
                  <Input
                    placeholder="https://your-server.com/webhooks"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Events to Listen For</Label>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {WEBHOOK_EVENTS.map((event) => (
                      <label key={event} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedEvents.includes(event)}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setSelectedEvents((prev) => [...prev, event])
                            } else {
                              setSelectedEvents((prev) => prev.filter((e) => e !== event))
                            }
                          }}
                        />
                        {event}
                      </label>
                    ))}
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateWebhook}
                    disabled={!webhookName || !webhookUrl || selectedEvents.length === 0 || creating}
                  >
                    {creating ? "Creating..." : "Create Webhook"}
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
            <WebhookIcon className="h-5 w-5" />
            Your Webhooks
          </CardTitle>
          <CardDescription>Webhook endpoints that receive event notifications</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No webhooks yet. Add one to receive real-time notifications.
            </div>
          ) : (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <Collapsible
                  key={webhook.id}
                  open={expandedWebhook === webhook.id}
                  onOpenChange={(open: boolean) => {
                    setExpandedWebhook(open ? webhook.id : null)
                    if (open && !deliveries[webhook.id]) {
                      loadDeliveries(webhook.id)
                    }
                  }}
                >
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{webhook.name}</span>
                          <Badge variant={webhook.is_active ? "default" : "secondary"}>
                            {webhook.is_active ? "Active" : "Paused"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground font-mono mt-1">{webhook.url}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {webhook.events.map((event) => (
                            <Badge key={event} variant="outline" className="text-xs">
                              {event}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>✓ {webhook.success_count} delivered</span>
                          <span>✗ {webhook.failure_count} failed</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTestWebhook(webhook.id)}
                          disabled={testingWebhook === webhook.id}
                          title="Test webhook"
                        >
                          <Play className={`h-4 w-4 ${testingWebhook === webhook.id ? "animate-pulse" : ""}`} />
                        </Button>
                        <Switch 
                          checked={webhook.is_active} 
                          onCheckedChange={() => handleToggleWebhook(webhook.id, webhook.is_active)} 
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDeleteWebhook(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${expandedWebhook === webhook.id ? "rotate-180" : ""}`}
                            />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="font-medium mb-2">Recent Deliveries</h4>
                        {!deliveries[webhook.id] ? (
                          <p className="text-sm text-muted-foreground">Loading...</p>
                        ) : deliveries[webhook.id].length === 0 ? (
                          <p className="text-sm text-muted-foreground">No deliveries yet</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>Event</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Response</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {deliveries[webhook.id].slice(0, 10).map((delivery) => (
                                <TableRow key={delivery.id}>
                                  <TableCell>{getStatusIcon(delivery.status)}</TableCell>
                                  <TableCell className="font-mono text-sm">{delivery.event_type}</TableCell>
                                  <TableCell className="text-sm">
                                    {new Date(delivery.created_at).toLocaleString()}
                                  </TableCell>
                                  <TableCell>
                                    {delivery.response_status ? (
                                      <Badge variant={delivery.response_status < 400 ? "default" : "destructive"}>
                                        {delivery.response_status}
                                      </Badge>
                                    ) : delivery.error_message ? (
                                      <span className="text-sm text-red-500">
                                        {delivery.error_message.slice(0, 30)}...
                                      </span>
                                    ) : (
                                      "-"
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
