/**
 * Subscription Management Endpoints
 * POST /api/subscriptions - Create a new subscription
 * GET /api/subscriptions - List all subscriptions for the authenticated user
 */

import { type NextRequest, NextResponse } from "next/server"
import { SubscriptionService, type SubscriptionFrequency } from "@/lib/services/subscription-service"
import { getSupabase } from "@/lib/supabase"
import {
  withErrorHandling,
  validateRequired,
  validateAddress,
  validatePositiveNumber,
  validateEnum,
  requireAuth,
} from "@/lib/errors/api-handler"
import { ApiError, ErrorCodes, successResponse } from "@/lib/errors"

const subscriptionService = new SubscriptionService()

const VALID_FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const
const VALID_TOKENS = ["USDC", "USDT", "DAI", "ETH", "WETH", "WBTC"] as const

/**
 * Get authenticated user's wallet address
 */
async function getAuthenticatedAddress(): Promise<string> {
  const supabase = getSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new ApiError({
      code: ErrorCodes.AUTH_REQUIRED,
    })
  }

  const ownerAddress = user.user_metadata?.wallet_address || user.email
  if (!ownerAddress) {
    throw new ApiError({
      code: ErrorCodes.AUTH_WALLET_NOT_CONNECTED,
      message: "No wallet address associated with account",
    })
  }

  return ownerAddress
}

/**
 * POST /api/subscriptions
 * Create a new subscription
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const ownerAddress = await getAuthenticatedAddress()

  const body = await request.json()

  // Validate required fields
  validateRequired(body, ["service_name", "wallet_address", "amount", "token", "frequency", "chain_id"])

  // Validate wallet address
  validateAddress(body.wallet_address, "wallet_address")

  // Validate amount
  const amount = validatePositiveNumber(body.amount, "amount")

  // Validate token
  const token = validateEnum(body.token, VALID_TOKENS, "token")

  // Validate frequency
  const frequency = validateEnum(body.frequency, VALID_FREQUENCIES, "frequency")

  // Validate chain_id
  if (typeof body.chain_id !== "number") {
    throw new ApiError({
      code: ErrorCodes.VALIDATION_INVALID_FORMAT,
      message: "chain_id must be a number",
      field: "chain_id",
    })
  }

  // Validate start_date if provided
  if (body.start_date) {
    const startDateObj = new Date(body.start_date)
    if (isNaN(startDateObj.getTime())) {
      throw new ApiError({
        code: ErrorCodes.VALIDATION_INVALID_FORMAT,
        message: "Invalid start_date format",
        field: "start_date",
      })
    }
  }

  const subscription = await subscriptionService.create({
    owner_address: ownerAddress,
    service_name: body.service_name.trim(),
    wallet_address: body.wallet_address,
    amount: amount.toFixed(2),
    token,
    frequency: frequency as SubscriptionFrequency,
    chain_id: body.chain_id,
    start_date: body.start_date,
    memo: body.memo,
  })

  return NextResponse.json(
    {
      success: true,
      data: {
        id: subscription.id,
        service_name: subscription.service_name,
        wallet_address: subscription.wallet_address,
        amount: subscription.amount,
        token: subscription.token,
        frequency: subscription.frequency,
        status: subscription.status,
        next_payment_date: subscription.next_payment_date,
        chain_id: subscription.chain_id,
        created_at: subscription.created_at,
      },
      message: "Subscription created successfully",
    },
    { status: 201 }
  )
})

/**
 * GET /api/subscriptions
 * List all subscriptions for the authenticated user
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const ownerAddress = await getAuthenticatedAddress()

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") as any

  const subscriptions = await subscriptionService.list(ownerAddress, { status })

  return successResponse({
    subscriptions: subscriptions.map((sub) => ({
      id: sub.id,
      service_name: sub.service_name,
      wallet_address: sub.wallet_address,
      amount: sub.amount,
      token: sub.token,
      frequency: sub.frequency,
      status: sub.status,
      next_payment_date: sub.next_payment_date,
      last_payment_date: sub.last_payment_date,
      total_paid: sub.total_paid,
      payment_count: sub.payment_count,
      chain_id: sub.chain_id,
      created_at: sub.created_at,
    })),
    count: subscriptions.length,
  })
})
