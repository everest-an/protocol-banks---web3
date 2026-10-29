import { NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { PLANS, PAID_PLANS, isPlanId } from "@/lib/billing/plans"
import { appOrigin, getOrCreateCustomer, getStripe, invalidatePlanCache } from "@/lib/billing/stripe"

/**
 * POST /api/billing/checkout — start a Stripe Checkout session for an API plan.
 *
 * Body: { plan: "builder" | "growth" | "scale" }
 * Auth: wallet session (withAuth). Returns { url } to redirect to.
 */
export const runtime = "nodejs"

export const POST = withAuth(
  async (request, wallet) => {
    const stripe = getStripe()
    if (!stripe) {
      return NextResponse.json(
        { error: "billing is not configured", message: "STRIPE_SECRET_KEY is missing" },
        { status: 503 },
      )
    }

    let body: { plan?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
    }

    if (!isPlanId(body.plan) || !PAID_PLANS.includes(body.plan)) {
      return NextResponse.json(
        { error: "plan must be builder, growth or scale" },
        { status: 400 },
      )
    }

    const plan = PLANS[body.plan]
    const priceId = plan.priceEnv ? process.env[plan.priceEnv] : undefined
    if (!priceId) {
      return NextResponse.json(
        { error: "billing is not configured", message: `${plan.priceEnv} is missing` },
        { status: 503 },
      )
    }

    try {
      const customerId = await getOrCreateCustomer(stripe, wallet)
      // A status read may have cached "sandbox, no customer" moments ago.
      invalidatePlanCache(wallet)
      const origin = appOrigin(request.url)
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${origin}/settings/api-keys?billing=success`,
        cancel_url: `${origin}/pricing?billing=cancelled`,
        client_reference_id: wallet,
        metadata: { wallet, plan: plan.id },
        subscription_data: { metadata: { wallet, plan: plan.id } },
      })

      if (!session.url) {
        return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 })
      }
      return NextResponse.json({ url: session.url })
    } catch (error) {
      console.error("[billing] checkout failed:", error)
      return NextResponse.json(
        { error: "checkout failed", message: error instanceof Error ? error.message : "unknown error" },
        { status: 502 },
      )
    }
  },
  { component: "billing-checkout" },
)
