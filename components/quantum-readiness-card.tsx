"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Shield, Clock, AlertTriangle, CheckCircle2, Info, ExternalLink } from "lucide-react"
import { assessQuantumReadiness, type QuantumReadinessReport } from "@/lib/security/future-attack-protection"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface QuantumReadinessCardProps {
  addressAge: number // days
  totalValue: number // USD
  transactionCount: number
}

export function QuantumReadinessCard({ addressAge, totalValue, transactionCount }: QuantumReadinessCardProps) {
  const [report, setReport] = useState<QuantumReadinessReport | null>(null)

  useEffect(() => {
    const result = assessQuantumReadiness(addressAge, totalValue, transactionCount)
    setReport(result)
  }, [addressAge, totalValue, transactionCount])

  if (!report) return null

  const riskColorMap = {
    low: "text-green-500 bg-green-500/10 border-green-500/20",
    medium: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
    high: "text-red-500 bg-red-500/10 border-red-500/20",
  }

  const riskIconMap = {
    low: <CheckCircle2 className="h-4 w-4" />,
    medium: <AlertTriangle className="h-4 w-4" />,
    high: <Shield className="h-4 w-4" />,
  }

  // Calculate timeline progress (0-100%)
  const yearsElapsed = 2 // Years since quantum threat became notable
  const totalTimeline = report.estimatedYearsUntilThreat + yearsElapsed
  const progressPercent = Math.min((yearsElapsed / totalTimeline) * 100, 100)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Quantum Readiness
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Info className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Assessment of your address security against future quantum computing attacks.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>Protection against future quantum attacks</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Risk Level */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Current Risk Level</span>
          <Badge variant="outline" className={riskColorMap[report.currentRiskLevel]}>
            {riskIconMap[report.currentRiskLevel]}
            <span className="ml-1 capitalize">{report.currentRiskLevel}</span>
          </Badge>
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Estimated Timeline
            </span>
            <span className="font-medium">~{report.estimatedYearsUntilThreat} years</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Now</span>
            <span>Quantum Threat</span>
          </div>
        </div>

        {/* Mitigations */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Security Measures</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-xs">
              <p className="text-muted-foreground mb-1">Implemented</p>
              <ul className="space-y-0.5">
                {report.mitigations.implemented.slice(0, 3).map((m, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{m}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-xs">
              <p className="text-muted-foreground mb-1">Planned</p>
              <ul className="space-y-0.5">
                {report.mitigations.pending.slice(0, 3).map((m, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <Clock className="h-3 w-3 text-yellow-500 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Address Rotation Advisory */}
        {report.addressRotationAdvised && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-600 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Recommendation:</strong> Consider rotating your primary address to reduce long-term quantum risk
                exposure.
              </span>
            </p>
          </div>
        )}

        {/* Top Recommendations */}
        {report.recommendations.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium mb-2">Top Recommendations</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {report.recommendations.slice(0, 2).map((rec, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-primary">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button variant="outline" size="sm" className="w-full bg-transparent" asChild>
          <a href="https://csrc.nist.gov/projects/post-quantum-cryptography" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-3 w-3" />
            Learn About Post-Quantum Standards
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
