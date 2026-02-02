/**
 * Subscription Management Endpoints - Single Subscription Operations
 * GET /api/subscriptions/[id] - Get a specific subscription
 * PUT /api/subscriptions/[id] - Update a subscription
 * DELETE /api/subscriptions/[id] - Cancel a subscription
 */

import { type NextRequest, NextResponse } from "next/server"
import { SubscriptionService, type SubscriptionFrequency } from "@/lib/services/subscription-service"
import { getSupabase } from "@/lib/supabase"
import {
  withErrorHandling,
  validatePositiveNumber,
  validateEnum,
} from "@/lib/errors/api-handler"
import {
  ApiError,
  ErrorCodes,
  successResponse,
  notFoundError,
} from "@/lib/errors"

const subscriptionService = new SubscriptionService()

const VALID_FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const
const VALID_STATUSES = ["active", "paused"] as const

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
 * GET /api/subscriptions/[id]
 * Get a specific subscription by ID
 */
export const GET = withErrorHandling(
  async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    const { id } = (await context?.params) || {}
    if (!id) {
      throw new ApiError({
        code: ErrorCodes.VALIDATION_MISSING_FIELD,
        message: "Subscription ID is required",
        field: "id",
      })
    }

    const ownerAddress = await getAuthenticatedAddress()
    const subscription = await subscriptionService.getById(id, ownerAddress)

    if (!subscription) {
      throw notFoundError("Subscription", id)
    }

    return successResponse({
      subscription: {
        id: subscription.id,
        service_name: subscription.service_name,
        wallet_address: subscription.wallet_address,
        amount: subscription.amount,
        token: subscription.token,
        frequency: subscription.frequency,
        status: subscription.status,
        next_payment_date: subscription.next_payment_date,
        last_payment_date: subscription.last_payment_date,
        total_paid: subscription.total_paid,
        payment_count: subscription.payment_count,
        chain_id: subscription.chain_id,
        memo: subscription.memo,
        created_at: subscription.created_at,
        updated_at: subscription.updated_at,
      },
    })
  }
)

/**
 * PUT /api/subscriptions/[id]
 * Update a subscription
 */
export const PUT = withErrorHandling(
  async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    const { id } = (await context?.params) || {}
    if (!id) {
      throw new ApiError({
        code: ErrorCodes.VALIDATION_MISSING_FIELD,
        message: "Subscription ID is required",
        field: "id",
      })
    }

    const ownerAddress = await getAuthenticatedAddress()
    const existingSubscription = await subscriptionService.getById(id, ownerAddress)

    if (!existingSubscription) {
      throw notFoundError("Subscription", id)
    }

    const body = await request.json()
    const { service_name, amount, frequency, status, memo } = body

    // Validate fields if provided
    if (service_name !== undefined) {
      if (typeof service_name !== "string" || service_name.trim().length === 0) {
        throw new ApiError({
          code: ErrorCodes.VALIDATION_INVALID_FORMAT,
          message: "service_name must be a non-empty string",
          field: "service_name",
        })
      }
    }

    let parsedAmount: number | undefined
    if (amount !== undefined) {
      parsedAmount = validatePositiveNumber(amount, "amount")
    }

    let validatedFrequency: SubscriptionFrequency | undefined
    if (frequency !== undefined) {
      validatedFrequency = validateEnum(frequency, VALID_FREQUENCIES, "frequency") as SubscriptionFrequency
    }

    if (status !== undefined) {
      validateEnum(status, VALID_STATUSES, "status")
    }

    const updatedSubscription = await subscriptionService.update(id, ownerAddress, {
      service_name: service_name?.trim(),
      amount: parsedAmount ? parsedAmount.toFixed(2) : undefined,
      frequency: validatedFrequency,
      status,
      memo,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updatedSubscription.id,
        service_name: updatedSubscription.service_name,
        wallet_address: updatedSubscription.wallet_address,
        amount: updatedSubscription.amount,
        token: updatedSubscription.token,
        frequency: updatedSubscription.frequency,
        status: updatedSubscription.status,
        next_payment_date: updatedSubscription.next_payment_date,
        chain_id: updatedSubscription.chain_id,
        updated_at: updatedSubscription.updated_at,
      },
      message: "Subscription updated successfully",
    })
  }
)

/**
 * DELETE /api/subscriptions/[id]
 * Cancel a subscription
 */
export const DELETE = withErrorHandling(
  async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    const { id } = (await context?.params) || {}
    if (!id) {
      throw new ApiError({
        code: ErrorCodes.VALIDATION_MISSING_FIELD,
        message: "Subscription ID is required",
        field: "id",
      })
    }

    const ownerAddress = await getAuthenticatedAddress()
    const existingSubscription = await subscriptionService.getById(id, ownerAddress)

    if (!existingSubscription) {
      throw notFoundError("Subscription", id)
    }

    if (existingSubscription.status === "cancelled") {
      throw new ApiError({
        code: ErrorCodes.RESOURCE_CONFLICT,
        message: "Subscription is already cancelled",
      })
    }

    await subscriptionService.cancel(id, ownerAddress)

    return successResponse(undefined, "Subscription cancelled successfully")
  }
)
