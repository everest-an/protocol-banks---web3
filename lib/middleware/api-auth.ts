/**
 * API Authentication Middleware
 *
 * Provides reusable authentication for API routes.
 * Validates wallet auth headers and optionally checks API keys.
 *
 * Usage:
 *   const auth = await requireAuth(request)
 *   if (auth.error) return auth.error
 *   const userAddress = auth.address
 */

import { NextRequest, NextResponse } from 'next/server'
import { userAddressHeaderSchema } from '@/lib/validations/yield'
import { logger } from '@/lib/logger/structured-logger'
import { verifyJwt } from '@/lib/auth/jwt'

export interface AuthResult {
  address: string
  error: null
}

export interface AuthError {
  address: null
  error: NextResponse
}

/**
 * Require authenticated user via x-wallet-address (or legacy x-user-address) header.
 * Returns the validated address or an error response.
 */
export async function requireAuth(
  request: NextRequest,
  options?: { component?: string }
): Promise<AuthResult | AuthError> {
  const component = options?.component || 'api-auth'
  const rawAddress = request.headers.get('x-wallet-address') || request.headers.get('x-user-address')

  if (!rawAddress) {
    // Fallback: check Bearer JWT token (AI agent authentication via SIWE)
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = await verifyJwt(authHeader.slice(7))
        if (payload?.sub) {
          const parsed = userAddressHeaderSchema.safeParse(payload.sub)
          if (parsed.success) {
            return { address: parsed.data, error: null }
          }
        }
      } catch {
        // JWT invalid — fall through to error
      }
    }

    logger.logSecurityEvent('missing_auth_header', 'medium', {
      path: request.nextUrl?.pathname ?? request.url,
      method: request.method,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    }, { component })

    return {
      address: null,
      error: NextResponse.json(
        { error: 'Authentication required: x-wallet-address header or Bearer token is missing' },
        { status: 401 }
      ),
    }
  }

  const parsed = userAddressHeaderSchema.safeParse(rawAddress)
  if (!parsed.success) {
    logger.logSecurityEvent('invalid_auth_header', 'high', {
      path: request.nextUrl?.pathname ?? request.url,
      method: request.method,
      rawAddress: rawAddress.substring(0, 10) + '...', // Don't log full invalid input
    }, { component })

    return {
      address: null,
      error: NextResponse.json(
        { error: 'Invalid wallet address header: must be a valid wallet address' },
        { status: 401 }
      ),
    }
  }

  return {
    address: parsed.data,
    error: null,
  }
}

/**
 * Wrapper to protect a GET handler with authentication.
 */
export function withAuth(
  handler: (request: NextRequest, address: string) => Promise<NextResponse>,
  options?: { component?: string }
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const auth = await requireAuth(request, options)
    if (auth.error) return auth.error
    return handler(request, auth.address)
  }
}
