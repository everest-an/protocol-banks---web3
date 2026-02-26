/**
 * MCP Authentication Layer
 *
 * Verifies JWT tokens from AI agent sessions before allowing
 * access to authenticated MCP tools. Reuses the existing
 * AI JWT infrastructure from lib/auth/jwt.ts.
 *
 * @module lib/mcp/auth
 */

import { verifyJwt, type JwtPayload } from '@/lib/auth/jwt'

export interface McpAuthContext {
  /** Whether the caller is authenticated */
  authenticated: boolean
  /** Wallet address (lowercase) if authenticated */
  address?: string
  /** Full JWT payload */
  payload?: JwtPayload
}

/**
 * Authenticate an MCP request using a Bearer JWT token.
 * Returns auth context (never throws).
 */
export async function authenticateMcpRequest(
  authHeader?: string | null
): Promise<McpAuthContext> {
  if (!authHeader) {
    return { authenticated: false }
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader

  if (!token) {
    return { authenticated: false }
  }

  const payload = await verifyJwt(token)
  if (!payload) {
    return { authenticated: false }
  }

  return {
    authenticated: true,
    address: payload.sub,
    payload,
  }
}

/**
 * Require authentication — throws if not authenticated.
 * Used inside MCP tool handlers that need a wallet address.
 */
export function requireAuth(ctx: McpAuthContext): string {
  if (!ctx.authenticated || !ctx.address) {
    throw new Error('Authentication required. Provide a valid JWT Bearer token.')
  }
  return ctx.address
}
