"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, Zap, Activity, AlertCircle } from "lucide-react"
import { getAccountResources, estimateTRC20Resources } from "@/lib/services/tron-payment"

interface TronResourcesProps {
  address: string
  className?: string
}

interface ResourceData {
  energy: { available: number; limit: number; used: number }
  bandwidth: { available: number; limit: number; used: number }
}

export function TronResources({ address, className }: TronResourcesProps) {
  const [resources, setResources] = useState<ResourceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadResources = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getAccountResources(address)
      setResources(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resources")
      console.error("[TronResources] Failed to load:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (address) {
      loadResources()
    }
  }, [address])

  const estimate = estimateTRC20Resources()
  const canPayWithEnergy = resources ? resources.energy.available >= estimate.energy : false
  const canPayWithBandwidth = resources ? resources.bandwidth.available >= estimate.bandwidth : false

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">TRON Resources</CardTitle>
          <CardDescription className="text-xs">Energy & Bandwidth for transactions</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={loadResources} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            <div className="h-16 animate-pulse rounded bg-muted" />
            <div className="h-16 animate-pulse rounded bg-muted" />
          </div>
        ) : resources ? (
          <div className="space-y-4">
            {/* Energy */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Energy</span>
                </div>
                <Badge variant={canPayWithEnergy ? "default" : "destructive"} className="text-xs">
                  {resources.energy.available.toLocaleString()} / {resources.energy.limit.toLocaleString()}
                </Badge>
              </div>
              <Progress
                value={resources.energy.limit > 0 ? (resources.energy.available / resources.energy.limit) * 100 : 0}
                className="h-2"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Used: {resources.energy.used.toLocaleString()}</span>
                <span>
                  {canPayWithEnergy ? (
                    <span className="text-green-600">✓ Sufficient for TRC20</span>
                  ) : (
                    <span className="text-destructive">⚠ Insufficient ({estimate.energy.toLocaleString()} needed)</span>
                  )}
                </span>
              </div>
            </div>

            {/* Bandwidth */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Bandwidth</span>
                </div>
                <Badge variant={canPayWithBandwidth ? "default" : "secondary"} className="text-xs">
                  {resources.bandwidth.available.toLocaleString()} / {resources.bandwidth.limit.toLocaleString()}
                </Badge>
              </div>
              <Progress
                value={
                  resources.bandwidth.limit > 0
                    ? (resources.bandwidth.available / resources.bandwidth.limit) * 100
                    : 0
                }
                className="h-2"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Used: {resources.bandwidth.used.toLocaleString()}</span>
                <span>
                  {canPayWithBandwidth ? (
                    <span className="text-green-600">✓ Sufficient</span>
                  ) : (
                    <span className="text-yellow-600">⚠ Limited ({estimate.bandwidth} bytes needed)</span>
                  )}
                </span>
              </div>
            </div>

            {/* Warning message if resources are low */}
            {(!canPayWithEnergy || !canPayWithBandwidth) && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium">Resources Low</p>
                    {!canPayWithEnergy && (
                      <p>
                        Energy is insufficient. Freeze TRX to gain energy or wait for regeneration. Transactions may
                        consume TRX for fees.
                      </p>
                    )}
                    {!canPayWithBandwidth && (
                      <p>Bandwidth is limited. Daily free bandwidth regenerates at midnight (UTC).</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Estimate info */}
            <div className="rounded-lg border bg-muted/50 p-3 text-xs">
              <p className="font-medium mb-1">Estimated TRC20 Transfer Cost:</p>
              <div className="space-y-0.5 text-muted-foreground">
                <p>• Energy: ~{estimate.energy.toLocaleString()}</p>
                <p>• Bandwidth: ~{estimate.bandwidth} bytes</p>
                <p>• Fee Limit: {(estimate.feeLimit / 1_000_000).toFixed(0)} TRX</p>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
