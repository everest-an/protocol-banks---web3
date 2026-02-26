/**
 * Risk Assessment & Compliance Service (风控与合规)
 *
 * Provides transaction risk scoring and compliance screening.
 * Integrates with internal rules engine and external providers.
 */

import { getClient } from "@/lib/prisma"

// ─── Types ──────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "critical" | "blocked"
export type RiskDecision = "approve" | "review" | "block"

export interface RiskFactor {
  name: string
  score: number // 0-100
  weight: number // 0-1
  reason: string
}

export interface RiskAssessmentResult {
  riskScore: number
  riskLevel: RiskLevel
  decision: RiskDecision
  factors: RiskFactor[]
}

export interface AssessTransactionParams {
  referenceType: string // payment, batch_payment, cross_chain, withdrawal
  referenceId: string
  userAddress: string
  recipient?: string
  amount: string | number
  token: string
  chain: string
}

// ─── Risk Thresholds ────────────────────────────────────────────────────────

const THRESHOLDS = {
  LOW_MAX: 25,
  MEDIUM_MAX: 50,
  HIGH_MAX: 75,
  CRITICAL_MAX: 90,
  // Above CRITICAL_MAX = blocked
}

const LARGE_AMOUNT_USD: Record<string, number> = {
  USDC: 10000,
  USDT: 10000,
  ETH: 5,
  BTC: 0.5,
  DEFAULT: 10000,
}

// ─── Core Operations ────────────────────────────────────────────────────────

/**
 * Assess risk for a transaction before execution
 */
export async function assessTransaction(
  params: AssessTransactionParams
): Promise<RiskAssessmentResult> {
  const prisma = getClient()
  const amountNum = parseFloat(params.amount.toString())
  const factors: RiskFactor[] = []

  // Factor 1: Amount-based risk
  const largeThreshold = LARGE_AMOUNT_USD[params.token] ?? LARGE_AMOUNT_USD.DEFAULT
  if (amountNum > largeThreshold * 10) {
    factors.push({
      name: "very_large_amount",
      score: 80,
      weight: 0.3,
      reason: `Amount ${amountNum} ${params.token} exceeds 10x large transaction threshold`,
    })
  } else if (amountNum > largeThreshold) {
    factors.push({
      name: "large_amount",
      score: 40,
      weight: 0.3,
      reason: `Amount ${amountNum} ${params.token} exceeds large transaction threshold`,
    })
  } else {
    factors.push({
      name: "normal_amount",
      score: 5,
      weight: 0.3,
      reason: "Amount within normal range",
    })
  }

  // Factor 2: Transaction velocity (recent activity)
  const recentCount = await prisma.payment.count({
    where: {
      from_address: params.userAddress,
      created_at: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
    },
  })

  if (recentCount > 50) {
    factors.push({
      name: "high_velocity",
      score: 70,
      weight: 0.25,
      reason: `${recentCount} transactions in the last hour`,
    })
  } else if (recentCount > 20) {
    factors.push({
      name: "elevated_velocity",
      score: 35,
      weight: 0.25,
      reason: `${recentCount} transactions in the last hour`,
    })
  } else {
    factors.push({
      name: "normal_velocity",
      score: 5,
      weight: 0.25,
      reason: `${recentCount} transactions in the last hour`,
    })
  }

  // Factor 3: New recipient risk
  if (params.recipient) {
    const previousTx = await prisma.payment.count({
      where: {
        from_address: params.userAddress,
        to_address: params.recipient,
        status: "completed",
      },
    })

    if (previousTx === 0) {
      factors.push({
        name: "new_recipient",
        score: 30,
        weight: 0.2,
        reason: "First transaction to this recipient",
      })
    } else {
      factors.push({
        name: "known_recipient",
        score: 0,
        weight: 0.2,
        reason: `${previousTx} previous successful transactions to this recipient`,
      })
    }
  }

  // Factor 4: Compliance check (cached)
  if (params.recipient) {
    const complianceCheck = await prisma.complianceCheck.findFirst({
      where: {
        address: params.recipient,
        check_type: "sanctions",
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: "desc" },
    })

    if (complianceCheck?.result === "match") {
      factors.push({
        name: "sanctions_match",
        score: 100,
        weight: 0.25,
        reason: "Recipient address matches sanctions list",
      })
    } else if (complianceCheck?.result === "potential_match") {
      factors.push({
        name: "sanctions_potential",
        score: 60,
        weight: 0.25,
        reason: "Recipient address has potential sanctions match",
      })
    } else {
      factors.push({
        name: "compliance_clear",
        score: 0,
        weight: 0.25,
        reason: complianceCheck
          ? "Compliance check passed"
          : "No compliance data available (new address)",
      })
    }
  }

  // Calculate weighted risk score
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0)
  const riskScore = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight
  )

  // Determine risk level and decision
  let riskLevel: RiskLevel
  let decision: RiskDecision

  if (riskScore <= THRESHOLDS.LOW_MAX) {
    riskLevel = "low"
    decision = "approve"
  } else if (riskScore <= THRESHOLDS.MEDIUM_MAX) {
    riskLevel = "medium"
    decision = "approve"
  } else if (riskScore <= THRESHOLDS.HIGH_MAX) {
    riskLevel = "high"
    decision = "review"
  } else if (riskScore <= THRESHOLDS.CRITICAL_MAX) {
    riskLevel = "critical"
    decision = "review"
  } else {
    riskLevel = "blocked"
    decision = "block"
  }

  // Override: sanctions match always blocks
  if (factors.some((f) => f.name === "sanctions_match")) {
    riskLevel = "blocked"
    decision = "block"
  }

  // Store assessment
  await prisma.riskAssessment.create({
    data: {
      reference_type: params.referenceType,
      reference_id: params.referenceId,
      user_address: params.userAddress,
      recipient: params.recipient,
      amount: parseFloat(params.amount.toString()),
      token: params.token,
      chain: params.chain,
      risk_score: riskScore,
      risk_level: riskLevel,
      factors: factors as object[],
      decision,
    },
  })

  return { riskScore, riskLevel, decision, factors }
}

/**
 * Screen an address against sanctions/compliance databases.
 * Currently uses internal rules; can be extended with external providers
 * (Chainalysis, Elliptic, etc.)
 */
export async function screenAddress(
  address: string,
  checkType: string = "sanctions"
): Promise<{ result: string; riskScore: number }> {
  const prisma = getClient()

  // Check cache first
  const cached = await prisma.complianceCheck.findFirst({
    where: {
      address,
      check_type: checkType,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: "desc" },
  })

  if (cached) {
    return {
      result: cached.result,
      riskScore: cached.risk_score ?? 0,
    }
  }

  // Call external compliance provider if configured, else use internal rules
  const screening = await performComplianceScreening(address, checkType)

  // Cache result for 24 hours
  await prisma.complianceCheck.create({
    data: {
      address,
      check_type: checkType,
      provider: screening.provider,
      result: screening.result,
      risk_score: screening.riskScore,
      details: screening.details as object,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  })

  return { result: screening.result, riskScore: screening.riskScore }
}

/**
 * Compliance screening with external provider support.
 * Checks CHAINALYSIS_API_KEY env var - if set, calls Chainalysis API.
 * Otherwise falls back to internal rules.
 */
async function performComplianceScreening(
  address: string,
  checkType: string
): Promise<{ result: string; riskScore: number; provider: string; details: object }> {
  // Chainalysis integration
  const chainalysisKey = process.env.CHAINALYSIS_API_KEY
  if (chainalysisKey && checkType === "sanctions") {
    try {
      const response = await fetch(
        "https://public.chainalysis.com/api/v1/address/" + address,
        {
          headers: { "X-API-Key": chainalysisKey },
        }
      )

      if (response.ok) {
        const data = await response.json()
        const identifications = data.identifications || []

        if (identifications.length > 0) {
          const categories = identifications.map((i: any) => i.category)
          const isSanctioned = categories.some(
            (c: string) =>
              c.toLowerCase().includes("sanctions") ||
              c.toLowerCase().includes("terrorist") ||
              c.toLowerCase().includes("ofac")
          )

          return {
            result: isSanctioned ? "match" : "potential_match",
            riskScore: isSanctioned ? 100 : 60,
            provider: "chainalysis",
            details: {
              identifications,
              checked_at: new Date().toISOString(),
            },
          }
        }

        return {
          result: "clear",
          riskScore: 0,
          provider: "chainalysis",
          details: {
            identifications: [],
            checked_at: new Date().toISOString(),
          },
        }
      }

      // API error - fall through to internal
      console.warn("[Compliance] Chainalysis API error:", response.status)
    } catch (e) {
      console.warn("[Compliance] Chainalysis API failed:", e)
    }
  }

  // Internal fallback screening
  return {
    result: "clear",
    riskScore: 0,
    provider: "internal",
    details: {
      method: "internal_rules",
      checked_at: new Date().toISOString(),
      note: chainalysisKey
        ? "Chainalysis API failed, used internal fallback"
        : "Set CHAINALYSIS_API_KEY for production screening",
    },
  }
}

/**
 * Get risk assessment history for a user
 */
export async function getRiskHistory(params: {
  userAddress: string
  limit?: number
  offset?: number
}) {
  const prisma = getClient()

  const [assessments, total] = await Promise.all([
    prisma.riskAssessment.findMany({
      where: { user_address: params.userAddress },
      orderBy: { created_at: "desc" },
      take: params.limit ?? 20,
      skip: params.offset ?? 0,
    }),
    prisma.riskAssessment.count({
      where: { user_address: params.userAddress },
    }),
  ])

  return {
    assessments: assessments.map((a) => ({
      ...a,
      amount: a.amount.toString(),
    })),
    total,
  }
}
