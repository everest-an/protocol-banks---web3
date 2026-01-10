"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Globe, Plus, CheckCircle, XCircle, Trash2, Loader2, ExternalLink, Info } from "lucide-react"
import { getSupabase } from "@/lib/supabase"
import { toast } from "sonner"

export const dynamic = "force-dynamic"

interface DomainEntry {
  id: string
  domain: string
  service_type: string
  is_active: boolean
  environment: string
  notes: string | null
  created_at: string
  verified_at: string | null
}

const SERVICE_TYPES = [
  { value: "reown", label: "Reown AppKit", configUrl: "https://cloud.reown.com" },
  { value: "stripe", label: "Stripe Payments", configUrl: "https://dashboard.stripe.com/settings/domains" },
  { value: "resend", label: "Resend Email", configUrl: "https://resend.com/domains" },
  { value: "api", label: "API Access", configUrl: null },
]

const ENVIRONMENTS = [
  { value: "development", label: "Development" },
  { value: "staging", label: "Staging" },
  { value: "production", label: "Production" },
]

export default function DomainsPage() {
  const [domains, setDomains] = useState<DomainEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [domain, setDomain] = useState("")
  const [serviceType, setServiceType] = useState("")
  const [environment, setEnvironment] = useState("production")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    fetchDomains()
  }, [])

  async function fetchDomains() {
    setLoading(true)
    const supabase = getSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("domain_whitelist")
      .select("*")
      .order("service_type", { ascending: true })

    if (!error && data) {
      setDomains(data)
    }
    setLoading(false)
  }

  async function addDomain() {
    if (!domain || !serviceType) {
      toast.error("Please fill required fields")
      return
    }

    setSaving(true)
    const supabase = getSupabase()
    if (!supabase) {
      setSaving(false)
      return
    }

    const { error } = await supabase.from("domain_whitelist").insert({
      domain,
      service_type: serviceType,
      environment,
      notes: notes || null,
      is_active: true,
    })

    if (error) {
      if (error.code === "23505") {
        toast.error("Domain already exists")
      } else {
        toast.error("Failed to add domain")
      }
    } else {
      toast.success("Domain added successfully")
      setDialogOpen(false)
      setDomain("")
      setServiceType("")
      setEnvironment("production")
      setNotes("")
      fetchDomains()
    }
    setSaving(false)
  }

  async function deleteDomain(id: string) {
    const supabase = getSupabase()
    if (!supabase) return

    const { error } = await supabase.from("domain_whitelist").delete().eq("id", id)

    if (!error) {
      toast.success("Domain removed")
      fetchDomains()
    }
  }

  async function verifyDomain(id: string) {
    const supabase = getSupabase()
    if (!supabase) return

    const { error } = await supabase
      .from("domain_whitelist")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", id)

    if (!error) {
      toast.success("Domain marked as verified")
      fetchDomains()
    }
  }

  function getServiceConfig(type: string) {
    return SERVICE_TYPES.find((s) => s.value === type)
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Domain Whitelist</h1>
          <p className="text-muted-foreground mt-2">Configure allowed domains for third-party services</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Domain</DialogTitle>
              <DialogDescription>Register a domain for service integration</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Domain</Label>
                <Input
                  placeholder="e.g., protocolbanks.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENVIRONMENTS.map((env) => (
                      <SelectItem key={env.value} value={env.value}>
                        {env.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input placeholder="Additional notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button onClick={addDomain} className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Domain
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Alert className="mb-8">
        <Info className="h-4 w-4" />
        <AlertTitle>Important</AlertTitle>
        <AlertDescription>
          After adding domains here, you must also configure them in each service's dashboard:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              Reown:{" "}
              <a href="https://cloud.reown.com" target="_blank" rel="noopener noreferrer" className="underline">
                cloud.reown.com
              </a>
            </li>
            <li>
              Stripe:{" "}
              <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="underline">
                dashboard.stripe.com
              </a>
            </li>
            <li>
              Resend:{" "}
              <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline">
                resend.com/domains
              </a>
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Registered Domains</CardTitle>
          <CardDescription>Domains configured for service integration</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : domains.length === 0 ? (
            <Alert>
              <Globe className="h-4 w-4" />
              <AlertDescription>
                No domains registered yet. Add your production domain to enable integrations.
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.domain}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getServiceConfig(entry.service_type)?.label || entry.service_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          entry.environment === "production"
                            ? "bg-green-500"
                            : entry.environment === "staging"
                              ? "bg-yellow-500"
                              : "bg-blue-500"
                        }
                      >
                        {entry.environment}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.verified_at ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getServiceConfig(entry.service_type)?.configUrl && (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={getServiceConfig(entry.service_type)?.configUrl || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Configure
                              <ExternalLink className="ml-2 h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {!entry.verified_at && (
                          <Button variant="outline" size="sm" onClick={() => verifyDomain(entry.id)}>
                            Mark Verified
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteDomain(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
