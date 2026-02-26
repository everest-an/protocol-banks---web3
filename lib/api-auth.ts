/**
 * Shared API Route Authentication
 * Extracts owner/wallet address from request using:
 * 0. Authorization: Bearer <JWT> header (AI agents via SIWE)
 * 1. x-wallet-address header (primary – set by client-side authenticated fetch)
 * 2. Wallet query parameter (secondary – for simple GET requests)
 *
 * Access policy:
 * - Logged-in (wallet present): real mode
 * - Guest (no wallet): demo/test mode
 */

import { type NextRequest } from 'next/server'
import { verifyJwt } from '@/lib/auth/jwt'

function isEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(address)
}

function isTronAddress(address: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)
}

function isSupportedAddress(address: string | null): address is string {
  if (!address) return false
  return isEvmAddress(address) || isTronAddress(address)
}

function normalizeAddress(address: string): string {
  return isEvmAddress(address) ? address.toLowerCase() : address
}

export function isTestModeRequest(request: NextRequest): boolean {
  return request.headers.get('x-test-mode') === 'true'
}

export async function getRequestAccessMode(request: NextRequest): Promise<'demo' | 'real'> {
  const walletAddress = await getAuthenticatedAddress(request)
  return walletAddress ? 'real' : 'demo'
}

export async function getAuthenticatedAddress(request: NextRequest): Promise<string | null> {
  // Priority 0: Bearer JWT token (AI agents authenticated via SIWE)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7)
      const payload = await verifyJwt(token)
      if (payload?.sub && isSupportedAddress(payload.sub)) {
        return normalizeAddress(payload.sub)
      }
    } catch {
      // JWT verification failed — fall through to other methods
    }
  }

  // Primary: x-wallet-address header (set by createAuthenticatedFetch / authHeaders)
  const walletHeader = request.headers.get('x-wallet-address')
  if (isSupportedAddress(walletHeader)) {
    return normalizeAddress(walletHeader)
  }

  // Backward compatibility: legacy x-user-address header used by older routes
  const legacyUserHeader = request.headers.get('x-user-address')
  if (isSupportedAddress(legacyUserHeader)) {
    return normalizeAddress(legacyUserHeader)
  }

  // Secondary: wallet query parameter (for GET requests that pass ?wallet=...)
  const { searchParams } = new URL(request.url)
  const walletParam = searchParams.get('wallet')
  if (isSupportedAddress(walletParam)) {
    return normalizeAddress(walletParam)
  }

  return null
}
