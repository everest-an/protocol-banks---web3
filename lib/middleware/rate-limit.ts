/**
 * API Rate Limiting Middleware
 *
 * In-memory sliding window rate limiter for API routes.
 * Uses per-address tracking to prevent abuse.
 *
 * Usage:
 *   const limiter = createRateLimiter({ maxRequests: 60, windowMs: 60000 })
 *   const result = limiter.check(request)
 *   if (result.error) return result.error
 */

import { NextRequest, NextResponse } from 'next/server'

interface RateLimitConfig {
  maxRequests: number  // Max requests per window
  windowMs: number     // Window duration in ms
}

interface WindowEntry {
  count: number
  resetAt: number
}

const windows = new Map<string, WindowEntry>()

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of windows) {
    if (now > entry.resetAt) {
      windows.delete(key)
    }
  }
}, 300000)

/**
 * Create a rate limiter for a specific endpoint group
 */
export function createRateLimiter(config: RateLimitConfig) {
  return {
    check(request: NextRequest): { error: NextResponse | null; remaining: number } {
      const identifier = request.headers.get('x-wallet-address')
        || request.headers.get('x-user-address')
        || request.headers.get('x-forwarded-for')
        || 'anonymous'

      const key = `${request.nextUrl.pathname}:${identifier}`
      const now = Date.now()
      const entry = windows.get(key)

      if (!entry || now > entry.resetAt) {
        // New window
        windows.set(key, { count: 1, resetAt: now + config.windowMs })
        return { error: null, remaining: config.maxRequests - 1 }
      }

      if (entry.count >= config.maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
        return {
          error: NextResponse.json(
            { error: 'Rate limit exceeded', retryAfter },
            {
              status: 429,
              headers: {
                'Retry-After': String(retryAfter),
                'X-RateLimit-Limit': String(config.maxRequests),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
              },
            }
          ),
          remaining: 0,
        }
      }

      entry.count++
      const remaining = config.maxRequests - entry.count
      return { error: null, remaining }
    },
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const yieldApiLimiter = createRateLimiter({
  maxRequests: 30,   // 30 requests per minute
  windowMs: 60000,
})

export const paymentApiLimiter = createRateLimiter({
  maxRequests: 10,   // 10 requests per minute (more restrictive for mutations)
  windowMs: 60000,
})

export const defaultApiLimiter = createRateLimiter({
  maxRequests: 60,   // 60 requests per minute
  windowMs: 60000,
})
