import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { evaluatePolicy } from "@/lib/agent/policy"
import { budgetService } from "@/lib/services/budget-service"
import { agentActivityService } from "@/lib/services/agent-activity-service"
import { recordEvent } from "@/lib/analytics/events"
import {
  callDeepSeek,
  callOpenRouter,
  callPriceUsd,
  normalizeMaxTokens,
  normalizeMessages,
  normalizeModel,
  OpenRouterError,
} from "@/lib/agent/openrouter"

/**
 * POST /api/v1/agent/llm
 *
 * A paid model call. The key's `pay` operation and caps are checked first; an
 * agent-scoped credential also needs an active USDC budget. The provider call
 * happens after the budget reservation, and the reservation is refunded if the
 * provider rejects or times out.
 *
 * This is a platform-brokered OpenRouter gateway, not a card charge. The
 * receipt is recorded in the agent budget and in the policy's daily spend.
 */
export const dynamic = "force-dynamic"
export const maxDuration = 60

async function handler(request: AgentRequest) {
  const policy = request.agentPolicy!
  const spent = request.spentTodayUsd ?? 0
  const priceUsd = callPriceUsd()

  let body: {
    model?: unknown
    messages?: unknown
    max_tokens?: unknown
    temperature?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  let messages
  let model
  let maxTokens
  try {
    messages = normalizeMessages(body.messages)
    model = normalizeModel(body.model)
    maxTokens = normalizeMaxTokens(body.max_tokens)
  } catch (error) {
    if (error instanceof OpenRouterError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    throw error
  }

  const temperature = body.temperature === undefined ? 0.2 : Number(body.temperature)
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    return NextResponse.json({ error: "temperature must be between 0 and 2" }, { status: 400 })
  }

  const allowed = evaluatePolicy(policy, { op: "pay", notionalUsd: priceUsd, coin: "USDC" }, spent)
  if (!allowed.ok) {
    return NextResponse.json({ ok: false, error: allowed.reason }, { status: 403 })
  }

  const agentId = request.agentId
  let budgetId: string | undefined
  let budgetRemaining: string | undefined

  if (agentId) {
    const availability = await budgetService.checkAvailability(agentId, priceUsd.toFixed(6), "USDC")
    if (!availability.available || !availability.budget) {
      return NextResponse.json(
        {
          ok: false,
          error: availability.reason || "This agent has no active USDC budget for model calls.",
          code: "budget_required",
          priceUsd,
        },
        { status: 402 },
      )
    }
    budgetId = availability.budget.id
  }

  try {
    let result
    try {
      result = await callOpenRouter({ model, messages, maxTokens, temperature })
    } catch (providerError) {
      const canFallback =
        providerError instanceof OpenRouterError &&
        process.env.DEEPSEEK_API_KEY &&
        ["provider_error", "provider_not_configured", "provider_timeout", "empty_completion"].includes(providerError.code)
      if (!canFallback) throw providerError
      console.warn("[agent/llm] OpenRouter unavailable; using DeepSeek fallback:", providerError.message)
      result = await callDeepSeek({ messages, maxTokens, temperature })
    }

    if (budgetId) {
      const charged = await budgetService.deductBudget(budgetId, priceUsd.toFixed(6))
      budgetRemaining = charged.remaining_amount
    }

    const remainingTodayUsd = Number(Math.max(0, policy.dailyCapUsd - spent - priceUsd).toFixed(2))

    await recordEvent({
      name: "agent_op",
      wallet: request.ownerAddress as string,
      path: "/api/v1/agent/llm",
      props: {
        op: "llm",
        kind: "openrouter",
        notionalUsd: priceUsd,
        model: result.model,
        provider: result.provider,
        usage: result.usage,
        budgetId,
      },
    })

    if (agentId) {
      await agentActivityService
        .log(agentId, request.ownerAddress as string, "payment_executed", {
          kind: "paid_llm_call",
          provider: result.provider,
          model: result.model,
          amountUsd: priceUsd,
          budgetId,
          usage: result.usage,
        })
        .catch((error) => console.warn("[agent/llm] activity log failed:", error))
    }

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      model: result.model,
      content: result.content,
      usage: result.usage,
      charge: {
        amountUsd: priceUsd,
        currency: "USDC",
        kind: budgetId ? "agent_budget" : "policy_metered",
        budgetId,
        budgetRemaining,
      },
      policy: {
        spentTodayUsd: Number((spent + priceUsd).toFixed(2)),
        remainingTodayUsd,
      },
    })
  } catch (error) {
    if (error instanceof OpenRouterError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status })
    }
    console.error("[agent/llm] failed:", error)
    return NextResponse.json({ ok: false, error: "model call failed" }, { status: 502 })
  }
}

export const POST = withAgentAuth(handler, "pay")
