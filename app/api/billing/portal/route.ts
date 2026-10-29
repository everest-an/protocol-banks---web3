import { NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { appOrigin, findCustomerId, getPlanForWallet, getStripe } from "@/lib/billing/stripe"

/**
 * POST /api/billing/portal — a Stripe Customer Portal session (cancel, cards,
 * invoices). Requires the portal to be enabled in the Stripe dashboard.
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

    try {
      const state = await getPlanForWallet(wallet)
      const customerId = state.customerId ?? (await findCustomerId(stripe, wallet))
      if (!customerId) {
        return NextResponse.json({ error: "no billing account for this wallet" }, { status: 404 })
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appOrigin(request.url)}/settings/api-keys`,
      })
      return NextResponse.json({ url: session.url })
    } catch (error) {
      console.error("[billing] portal failed:", error)
      return NextResponse.json(
        {
          error: "billing portal unavailable",
          message: "Enable the Customer Portal in the Stripe dashboard, then retry.",
        },
        { status: 502 },
      )
    }
  },
  { component: "billing-portal" },
)
