/**
 * Centralized API Error Handling
 *
 * Sanitizes error messages before sending to clients to prevent
 * information disclosure of internal details (DB errors, env vars, stack traces).
 */

import { NextResponse } from 'next/server'

/**
 * Patterns that indicate internal error details that should NOT be exposed
 */
const INTERNAL_ERROR_PATTERNS = [
  /prisma/i,
  /database/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /postgresql/i,
  /postgres/i,
  /connection.*refused/i,
  /must be configured/i,
  /environment variable/i,
  /process\.env/i,
  /NEXT_PUBLIC_/i,
  /secret/i,
  /api.?key/i,
  /stack.*at\s/i,
  /node_modules/i,
  /internal server/i,
  /\.ts:\d+/i,
  /\.js:\d+/i,
]

/**
 * User-friendly generic error messages by category
 */
const GENERIC_MESSAGES: Record<string, string> = {
  default: 'An unexpected error occurred. Please try again later.',
  database: 'Service temporarily unavailable. Please try again.',
  network: 'Network error. Please check your connection.',
  auth: 'Authentication failed.',
  validation: 'Invalid request parameters.',
  notFound: 'Resource not found.',
}

/**
 * Sanitize an error message for client consumption.
 * Returns a safe, generic message if the original contains internal details.
 */
export function sanitizeErrorMessage(error: unknown, fallback?: string): string {
  const message = error instanceof Error ? error.message : String(error || '')

  // Check if message contains internal details
  for (const pattern of INTERNAL_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return fallback || GENERIC_MESSAGES.default
    }
  }

  // If message is very long (likely a stack trace), truncate
  if (message.length > 200) {
    return fallback || GENERIC_MESSAGES.default
  }

  // Allow short, non-sensitive messages through
  return message || fallback || GENERIC_MESSAGES.default
}

/**
 * Create a standardized error JSON response with sanitized message.
 * Always logs the real error server-side for debugging.
 */
export function apiErrorResponse(
  error: unknown,
  options: {
    status?: number
    fallback?: string
    logPrefix?: string
  } = {}
): NextResponse {
  const { status = 500, fallback, logPrefix = '[API]' } = options

  // Always log the real error server-side
  console.error(`${logPrefix} Error:`, error)

  return NextResponse.json(
    {
      error: status === 500 ? 'Internal Server Error' : 'Error',
      message: sanitizeErrorMessage(error, fallback),
    },
    { status }
  )
}
