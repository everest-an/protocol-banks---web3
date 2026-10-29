/**
 * Stripe is the source of truth for API plans: the account's subscription is
 * looked up by customer metadata (`wallet`), cached in memory for a few minutes.
 *
 * No local table: a webhook would only mirror what Stripe already knows, and a
 * stale mirror is worse than a short cache. On any Stripe error the plan falls
 * back to sandbox (fail closed: the smallest caps).
 */
import Stripe from "stripe"
import { planFromSubscription, type PlanId } from "./plans"

let client: Stripe | null | undefined

export function getStripe(): Stripe | null {
  if (client !== undefined) return client
  // Accept the legacy env name too: this deployment already carries the key as
  // STRIPE_API_KEY. Both are server-only.
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY
  client = key ? new Stripe(key) : null
  return client
}

export function appOrigin(requestUrl: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured && /^https?:\/\//i.test(configured)) return configured.replace(/\/+$/, "")
  return new URL(requestUrl).origin
}

export interface PlanState {
  plan: PlanId
  status: string
  customerId?: string
  currentPeriodEnd?: string
}

const SANDBOX: PlanState = { plan: "sandbox", status: "none" }
const CACHE_MS = 5 * 60_000
const cache = new Map<string, { value: PlanState; expiresAt: number }>()
/** Stripe search indexing can lag right after creation; remember what we made. */
const customerByWallet = new Map<string, string>()

export function invalidatePlanCache(wallet: string): void {
  cache.delete(wallet.toLowerCase())
}

export async function findCustomerId(stripe: Stripe, wallet: string): Promise<string | undefined> {
  const found = await stripe.customers.search({ query: `metadata['wallet']:'${wallet}'`, limit: 1 })
  if (found.data[0]) return found.data[0].id

  // Search indexing can lag right after creation: walk recent customers.
  let startingAfter: string | undefined
  for (let page = 0; page < 3; page++) {
    const list = await stripe.customers.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    const match = list.data.find((customer) => customer.metadata?.wallet === wallet)
    if (match) return match.id
    if (!list.has_more) break
    startingAfter = list.data[list.data.length - 1]?.id
  }
  return undefined
}

export async function getOrCreateCustomer(stripe: Stripe, wallet: string): Promise<string> {
  const existing = customerByWallet.get(wallet) ?? (await findCustomerId(stripe, wallet))
  if (existing) {
    customerByWallet.set(wallet, existing)
    return existing
  }
  const customer = await stripe.customers.create({ metadata: { wallet } })
  customerByWallet.set(wallet, customer.id)
  return customer.id
}

export async function getPlanForWallet(wallet: string): Promise<PlanState> {
  const key = wallet.toLowerCase()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value

  const stripe = getStripe()
  if (!stripe) return SANDBOX

  try {
    const customerId = customerByWallet.get(key) ?? (await findCustomerId(stripe, key))
    if (!customerId) {
      cache.set(key, { value: SANDBOX, expiresAt: Date.now() + 60_000 })
      return SANDBOX
    }
    customerByWallet.set(key, customerId)

    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 5 })
    const active = subscriptions.data.find(
      (subscription) => subscription.status === "active" || subscription.status === "trialing",
    )

    const value: PlanState = active
      ? {
          plan: planFromSubscription(active.status, active.metadata.plan),
          status: active.status,
          customerId,
          currentPeriodEnd: periodEnd(active),
        }
      : { plan: "sandbox", status: subscriptions.data[0]?.status ?? "none", customerId }

    cache.set(key, { value, expiresAt: Date.now() + CACHE_MS })
    return value
  } catch (error) {
    console.warn("[billing] plan lookup failed:", error)
    cache.set(key, { value: SANDBOX, expiresAt: Date.now() + 60_000 })
    return SANDBOX
  }
}

/** Stripe moved `current_period_end` between API versions; read it defensively. */
function periodEnd(subscription: Stripe.Subscription): string | undefined {
  const legacy = (subscription as unknown as { current_period_end?: number }).current_period_end
  const item = subscription.items?.data?.[0] as unknown as { current_period_end?: number } | undefined
  const seconds = typeof legacy === "number" ? legacy : item?.current_period_end
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : undefined
}
