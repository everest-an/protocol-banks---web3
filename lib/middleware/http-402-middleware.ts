/**
 * HTTP 402 Payment Required Middleware
 *
 * This middleware intercepts API requests and validates payment channels
 * before allowing access to protected resources.
 *
 * Usage in Next.js API routes:
 *
 * ```typescript
 * import { withPaymentRequired } from "@/lib/middleware/http-402-middleware"
 *
 * export const GET = withPaymentRequired({
 *   providerId: "provider_xxx",
 *   pricePerRequest: "0.001",
 * })(async (request, paymentContext) => {
 *   // Your API logic here
 *   return NextResponse.json({ data: "..." })
 * })
 * ```
 */

import { NextRequest, NextResponse } from "next/server"
import {
  checkPaymentRequired,
  processMicropayment,
  generatePaymentRequiredResponse,
  PaymentChannel,
} from "@/lib/services/pb-stream-service"

// ============================================================================
// Types
// ============================================================================

export interface PaymentMiddlewareConfig {
  providerId: string
  pricePerRequest?: string
  pricingFunction?: (request: NextRequest) => Promise<string>
  skipPaymentCheck?: (request: NextRequest) => boolean
  onPaymentSuccess?: (channelId: string, amount: string) => void
  onPaymentFailure?: (error: string) => void
}

export interface PaymentContext {
  channelId: string
  channel: PaymentChannel
  paymentId?: string
  amountPaid: string
  remainingBalance: string
}

type ApiHandler = (
  request: NextRequest,
  paymentContext: PaymentContext,
) => Promise<NextResponse>

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create a payment-required middleware wrapper
 */
export function withPaymentRequired(config: PaymentMiddlewareConfig) {
  return function (handler: ApiHandler) {
    return async function (request: NextRequest): Promise<NextResponse> {
      // Check if payment should be skipped
      if (config.skipPaymentCheck?.(request)) {
        // @ts-ignore - paymentContext is optional when skipped
        return handler(request, null)
      }

      // Extract payment credentials from request
      const channelId = request.headers.get("x-payment-channel-id")
      const sessionKey = request.headers.get("x-session-key")
      const authHeader = request.headers.get("authorization")

      // Parse session key from Authorization header if present
      let paymentIdentifier = channelId || sessionKey
      if (!paymentIdentifier && authHeader?.startsWith("PB-Stream ")) {
        paymentIdentifier = authHeader.slice(10)
      }

      // No payment credentials provided
      if (!paymentIdentifier) {
        return NextResponse.json(
          generatePaymentRequiredResponse({
            amount: config.pricePerRequest || "0",
            recipient: config.providerId,
            message: "Payment credentials required. Provide X-Payment-Channel-Id or X-Session-Key header.",
          }),
          { status: 402 },
        )
      }

      // Calculate price for this request
      let amount = config.pricePerRequest || "0"
      if (config.pricingFunction) {
        amount = await config.pricingFunction(request)
      }

      // Check if channel has sufficient balance
      const check = await checkPaymentRequired(config.providerId, paymentIdentifier, amount)

      if (check.required) {
        config.onPaymentFailure?.(check.error || "Payment required")

        return NextResponse.json(
          {
            ...generatePaymentRequiredResponse({
              amount,
              recipient: config.providerId,
              channelId: check.channel?.id,
              message: check.error || "Insufficient balance",
            }),
            availableBalance: check.channel
              ? (
                  parseFloat(check.channel.depositAmount) -
                  parseFloat(check.channel.spentAmount) -
                  parseFloat(check.channel.pendingAmount)
                ).toString()
              : "0",
          },
          { status: 402 },
        )
      }

      // Process the payment
      const paymentResult = await processMicropayment({
        channelId: check.channel!.id,
        amount,
        resource: request.url,
        metadata: {
          method: request.method,
          userAgent: request.headers.get("user-agent"),
        },
      })

      if (!paymentResult.success) {
        config.onPaymentFailure?.(paymentResult.error || "Payment failed")

        return NextResponse.json(
          {
            ...generatePaymentRequiredResponse({
              amount,
              recipient: config.providerId,
              channelId: check.channel!.id,
              message: paymentResult.error,
            }),
            remainingBalance: paymentResult.remainingBalance,
          },
          { status: 402 },
        )
      }

      // Payment successful - call the handler
      config.onPaymentSuccess?.(check.channel!.id, amount)

      const paymentContext: PaymentContext = {
        channelId: check.channel!.id,
        channel: check.channel!,
        paymentId: paymentResult.paymentId,
        amountPaid: amount,
        remainingBalance: paymentResult.remainingBalance || "0",
      }

      // Add payment info to response headers
      const response = await handler(request, paymentContext)

      response.headers.set("X-Payment-Id", paymentResult.paymentId || "")
      response.headers.set("X-Payment-Amount", amount)
      response.headers.set("X-Remaining-Balance", paymentResult.remainingBalance || "0")

      return response
    }
  }
}

// ============================================================================
// Express-style Middleware (for Edge Runtime)
// ============================================================================

/**
 * Middleware function for use in middleware.ts
 */
export async function paymentMiddleware(
  request: NextRequest,
  config: PaymentMiddlewareConfig,
): Promise<NextResponse | null> {
  // Check if this path requires payment
  const channelId = request.headers.get("x-payment-channel-id")
  const sessionKey = request.headers.get("x-session-key")

  if (!channelId && !sessionKey) {
    return NextResponse.json(
      generatePaymentRequiredResponse({
        amount: config.pricePerRequest || "0",
        recipient: config.providerId,
        message: "Payment credentials required",
      }),
      { status: 402 },
    )
  }

  const identifier = channelId || sessionKey!
  const amount = config.pricePerRequest || "0"

  const check = await checkPaymentRequired(config.providerId, identifier, amount)

  if (check.required) {
    return NextResponse.json(
      generatePaymentRequiredResponse({
        amount,
        recipient: config.providerId,
        channelId: check.channel?.id,
        message: check.error,
      }),
      { status: 402 },
    )
  }

  // Payment check passed, continue to handler
  return null
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse payment info from request headers
 */
export function getPaymentInfo(request: NextRequest): {
  channelId?: string
  sessionKey?: string
  hasCredentials: boolean
} {
  const channelId = request.headers.get("x-payment-channel-id") || undefined
  const sessionKey = request.headers.get("x-session-key") || undefined
  const authHeader = request.headers.get("authorization")

  let parsedSessionKey = sessionKey
  if (!parsedSessionKey && authHeader?.startsWith("PB-Stream ")) {
    parsedSessionKey = authHeader.slice(10)
  }

  return {
    channelId,
    sessionKey: parsedSessionKey,
    hasCredentials: !!(channelId || parsedSessionKey),
  }
}

/**
 * Create 402 response helper
 */
export function createPaymentRequiredResponse(
  amount: string,
  providerId: string,
  message?: string,
): NextResponse {
  return NextResponse.json(
    generatePaymentRequiredResponse({
      amount,
      recipient: providerId,
      message,
    }),
    { status: 402 },
  )
}
