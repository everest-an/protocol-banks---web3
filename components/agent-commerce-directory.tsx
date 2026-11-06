"use client"

import { useEffect, useState } from "react"

interface Service {
  id: string
  ownerAddress: string
  name: string
  description: string | null
  category: string | null
  endpoint: string | null
  priceUsd: number
  token: string
  chain: string
}

export function AgentCommerceDirectory() {
  const [services, setServices] = useState<Service[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/v1/agent/commerce/directory?limit=100${query ? `&q=${encodeURIComponent(query)}` : ""}`)
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
        return data
      })
      .then((data) => {
        if (!cancelled) setServices(Array.isArray(data.services) ? data.services : [])
      })
      .catch((error) => {
        if (!cancelled) setError(error instanceof Error ? error.message : "Could not load services")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [query])

  return (
    <div className="space-y-6">
      <div className="max-w-xl">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search agent services..."
          className="w-full rounded-xl border border-black/10 bg-white/70 px-4 py-3 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-black/30"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading services...</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 p-10 text-center text-sm text-muted-foreground dark:border-white/10">
          No public services yet. A seller can publish one with
          <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 dark:bg-white/10">POST /api/v1/agent/commerce/services</code>.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <article key={service.id} className="rounded-2xl border border-black/10 bg-white/60 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{service.category || "General"}</p>
                  <h2 className="mt-1 text-lg font-semibold">{service.name}</h2>
                </div>
                <span className="rounded-full border border-black/10 px-2 py-1 text-xs dark:border-white/15">
                  {service.token} · {service.chain}
                </span>
              </div>
              <p className="mt-3 min-h-12 text-sm text-muted-foreground">{service.description || "Agent service"}</p>
              <div className="mt-5 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="text-xl font-semibold">${service.priceUsd} <span className="text-sm font-normal text-muted-foreground">{service.token}</span></p>
                </div>
                <p className="max-w-[45%] truncate font-mono text-[10px] text-muted-foreground" title={service.ownerAddress}>
                  {service.ownerAddress}
                </p>
              </div>
              {service.endpoint ? (
                <p className="mt-3 truncate text-xs text-muted-foreground" title={service.endpoint}>{service.endpoint}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
