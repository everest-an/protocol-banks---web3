/**
 * API Authentication Middleware
 *
 * Identity is established ONLY from verifiable credentials:
 *   1. `Authorization: Bearer <jwt>` — SIWE-issued JWT (wallet users + AI agents)
 *   2. httpOnly session cookie — email / OAuth users (embedded wallet)
 *
 * SECURITY: the legacy `x-wallet-address` / `x-user-address` header NO LONGER
 * authenticates by itself (it allowed trivial impersonation of any address).
 * When present it is only cross-checked against the verified identity; a
 * mismatch is rejected with 403.
 *
 * Local-development escape hatch:
 *   ALLOW_INSECURE_HEADER_AUTH=true restores the old header-trust behaviour.
 *   Every use is logged as a high-severity security event. NEVER enable in
 *   production.
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
import { verifySession } from '@/lib/auth/session'

export interface AuthResult {
  address: string
  error: null
}

export interface AuthError {
  address: null
  error: NextResponse
}

/**
 * Resolve the caller's wallet address from a verifiable credential.
 * Returns null when no valid credential is present.
 */
async function verifiedAddressFromRequest(request: NextRequest): Promise<string | null> {
  // 1. Bearer JWT (SIWE-issued)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = await verifyJwt(authHeader.slice(7))
      if (payload?.sub) {
        const parsed = userAddressHeaderSchema.safeParse(payload.sub)
        if (parsed.success) return parsed.data
      }
    } catch {
      // Invalid/expired JWT — fall through to session cookie
    }
  }

  // 2. httpOnly session cookie (email / OAuth users with embedded wallet)
  try {
    const session = await verifySession()
    if (session?.walletAddress) {
      const parsed = userAddressHeaderSchema.safeParse(session.walletAddress)
      if (parsed.success) return parsed.data
    }
  } catch {
    // cookies() unavailable outside a request scope (e.g. unit tests) — treat as no session
  }

  return null
}

/**
 * Require an authenticated user. Returns the verified address or an error response.
 */
export async function requireAuth(
  request: NextRequest,
  options?: { component?: string }
): Promise<AuthResult | AuthError> {
  const component = options?.component || 'api-auth'
  const rawAddress = request.headers.get('x-wallet-address') || request.headers.get('x-user-address')

  const verified = await verifiedAddressFromRequest(request)

  if (verified) {
    // Cross-check: a client-supplied address header must match the verified identity.
    if (rawAddress) {
      const parsedHeader = userAddressHeaderSchema.safeParse(rawAddress)
      if (parsedHeader.success && parsedHeader.data.toLowerCase() !== verified.toLowerCase()) {
        logger.logSecurityEvent('auth_identity_mismatch', 'high', {
          path: request.nextUrl?.pathname ?? request.url,
          method: request.method,
          verified: verified.substring(0, 10) + '...',
          claimed: parsedHeader.data.substring(0, 10) + '...',
        }, { component })

        return {
          address: null,
          error: NextResponse.json(
            { error: 'x-wallet-address header does not match the authenticated identity' },
            { status: 403 }
          ),
        }
      }
    }
    return { address: verified, error: null }
  }

  // Legacy insecure mode — local development only. Trusts the raw header.
  if (process.env.ALLOW_INSECURE_HEADER_AUTH === 'true' && rawAddress) {
    const parsed = userAddressHeaderSchema.safeParse(rawAddress)
    if (parsed.success) {
      logger.logSecurityEvent('insecure_header_auth_used', 'high', {
        path: request.nextUrl?.pathname ?? request.url,
        method: request.method,
        address: parsed.data.substring(0, 10) + '...',
      }, { component })
      return { address: parsed.data, error: null }
    }
  }

  logger.logSecurityEvent('missing_auth_credentials', 'medium', {
    path: request.nextUrl?.pathname ?? request.url,
    method: request.method,
    hadAddressHeader: Boolean(rawAddress),
    ip: request.headers.get('x-forwarded-for') || 'unknown',
  }, { component })

  return {
    address: null,
    error: NextResponse.json(
      {
        error:
          'Authentication required: provide an Authorization: Bearer token (via SIWE — GET /api/auth/siwe/nonce then POST /api/auth/siwe/verify) or a session cookie. The x-wallet-address header alone is not accepted.',
      },
      { status: 401 }
    ),
  }
}

/**
 * Wrapper to protect a route handler with authentication.
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
