/**
 * API Handler Wrapper
 * Provides automatic error handling for API routes
 */

import { type NextRequest, NextResponse } from "next/server"
import {
  ApiError,
  ErrorCodes,
  errorResponse,
  logError,
  type ErrorLogContext,
} from "./index"

// ============================================
// Types
// ============================================

export type ApiHandler<T = any> = (
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse<T> | T>

export interface ApiHandlerOptions {
  /** Enable request logging */
  logging?: boolean
  /** Custom error handler */
  onError?: (error: ApiError, context: ErrorLogContext) => void
  /** Locale for error messages */
  locale?: "en" | "zh"
}

// ============================================
// Request ID Generator
// ============================================

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// ============================================
// API Handler Wrapper
// ============================================

/**
 * Wraps an API handler with automatic error handling
 *
 * @example
 * ```ts
 * // Before
 * export async function GET(request: NextRequest) {
 *   try {
 *     // ... handler logic
 *   } catch (error) {
 *     return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
 *   }
 * }
 *
 * // After
 * export const GET = withErrorHandling(async (request: NextRequest) => {
 *   // ... handler logic
 *   // Errors are automatically caught and formatted
 * })
 * ```
 */
export function withErrorHandling<T = any>(
  handler: ApiHandler<T>,
  options: ApiHandlerOptions = {}
): ApiHandler<T> {
  const { logging = true, onError, locale = "en" } = options

  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    const requestId = generateRequestId()
    const startTime = Date.now()

    const logContext: ErrorLogContext = {
      requestId,
      path: request.nextUrl.pathname,
      method: request.method,
    }

    try {
      if (logging) {
        console.log(`[API] ${request.method} ${request.nextUrl.pathname} - Start`, { requestId })
      }

      const result = await handler(request, context)

      if (logging) {
        const duration = Date.now() - startTime
        console.log(`[API] ${request.method} ${request.nextUrl.pathname} - Complete`, {
          requestId,
          duration: `${duration}ms`,
        })
      }

      // If handler returns a NextResponse, use it directly
      if (result instanceof NextResponse) {
        return result
      }

      // Otherwise, wrap in a success response
      return NextResponse.json({
        success: true,
        data: result,
      }) as NextResponse<T>
    } catch (error) {
      const apiError = ApiError.from(error)

      // Log the error
      logError(apiError, logContext)

      // Call custom error handler if provided
      if (onError) {
        onError(apiError, logContext)
      }

      if (logging) {
        const duration = Date.now() - startTime
        console.error(`[API] ${request.method} ${request.nextUrl.pathname} - Error`, {
          requestId,
          duration: `${duration}ms`,
          code: apiError.code,
          message: apiError.message,
        })
      }

      return errorResponse(apiError, locale) as NextResponse<T>
    }
  }
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate required fields in request body
 */
export function validateRequired(
  body: Record<string, any>,
  fields: string[]
): void {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      throw new ApiError({
        code: ErrorCodes.VALIDATION_MISSING_FIELD,
        message: `Missing required field: ${field}`,
        field,
      })
    }
  }
}

/**
 * Validate wallet address
 */
export function validateAddress(address: string, fieldName = "address"): void {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new ApiError({
      code: ErrorCodes.VALIDATION_INVALID_ADDRESS,
      message: `Invalid Ethereum address: ${address}`,
      field: fieldName,
    })
  }
}

/**
 * Validate positive number
 */
export function validatePositiveNumber(
  value: number | string,
  fieldName = "amount"
): number {
  const num = typeof value === "string" ? parseFloat(value) : value

  if (isNaN(num) || num <= 0) {
    throw new ApiError({
      code: ErrorCodes.VALIDATION_INVALID_AMOUNT,
      message: `${fieldName} must be a positive number`,
      field: fieldName,
    })
  }

  return num
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: string,
  validValues: readonly T[],
  fieldName: string
): T {
  if (!validValues.includes(value as T)) {
    throw new ApiError({
      code: ErrorCodes.VALIDATION_INVALID_FORMAT,
      message: `Invalid ${fieldName}. Must be one of: ${validValues.join(", ")}`,
      field: fieldName,
      details: { validValues },
    })
  }

  return value as T
}

// ============================================
// Auth Helpers
// ============================================

/**
 * Require authentication
 */
export function requireAuth(userAddress: string | null | undefined): string {
  if (!userAddress) {
    throw new ApiError({
      code: ErrorCodes.AUTH_REQUIRED,
    })
  }
  return userAddress
}

/**
 * Verify ownership
 */
export function verifyOwnership(
  resourceOwner: string,
  userAddress: string,
  resourceName = "resource"
): void {
  if (resourceOwner.toLowerCase() !== userAddress.toLowerCase()) {
    throw new ApiError({
      code: ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS,
      message: `You don't have permission to access this ${resourceName}`,
    })
  }
}
