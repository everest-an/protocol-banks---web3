/**
 * JWT Service Tests
 *
 * Tests for JWT signing, verification, token expiry, refresh token
 * generation, and edge cases.
 *
 * @module lib/__tests__/jwt.test.ts
 */

import * as fc from 'fast-check'

// ============================================
// Mock Setup — must be before imports
// ============================================

// Mock crypto module used by jwt.ts
jest.mock('@/lib/auth/crypto', () => ({
  generateRandomHex: (bytes: number) => {
    const chars = '0123456789abcdef'
    let result = ''
    for (let i = 0; i < bytes * 2; i++) {
      result += chars[Math.floor(Math.random() * 16)]
    }
    return result
  },
  sha256: (input: string) => {
    // Simple deterministic hash for testing
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0
    }
    return Math.abs(hash).toString(16).padStart(64, '0')
  },
}))

// Set env before importing jwt module
process.env.AI_JWT_SECRET = 'test-secret-key-for-unit-tests-minimum-32-chars'

import { signJwt, verifyJwt, generateRefreshToken, hashToken, getTokenExpiries } from '../auth/jwt'

// ============================================
// Helpers
// ============================================

const walletAddressArb = fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`)

// ============================================
// Unit Tests
// ============================================

describe('JWT Service', () => {
  describe('signJwt', () => {
    it('should produce a valid JWT with 3 parts', async () => {
      const result = await signJwt('0x1234567890abcdef1234567890abcdef12345678')

      expect(result.token).toBeDefined()
      expect(result.expiresAt).toBeDefined()

      const parts = result.token.split('.')
      expect(parts).toHaveLength(3)
    })

    it('should lowercase the wallet address in the token', async () => {
      const result = await signJwt('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')

      // Decode payload
      const payloadB64 = result.token.split('.')[1]
      const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4)
      const payload = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))

      expect(payload.sub).toBe('0xabcdef1234567890abcdef1234567890abcdef12')
    })

    it('should set type to "ai"', async () => {
      const result = await signJwt('0x1234567890abcdef1234567890abcdef12345678')

      const payloadB64 = result.token.split('.')[1]
      const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4)
      const payload = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))

      expect(payload.type).toBe('ai')
    })

    it('should set expiration ~1 hour in the future', async () => {
      const before = Math.floor(Date.now() / 1000)
      const result = await signJwt('0x1234567890abcdef1234567890abcdef12345678')
      const after = Math.floor(Date.now() / 1000)

      const payloadB64 = result.token.split('.')[1]
      const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4)
      const payload = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))

      // exp should be between now+3599 and now+3601
      expect(payload.exp).toBeGreaterThanOrEqual(before + 3600 - 1)
      expect(payload.exp).toBeLessThanOrEqual(after + 3600 + 1)
    })

    it('should return a valid ISO expiresAt string', async () => {
      const result = await signJwt('0x1234567890abcdef1234567890abcdef12345678')

      const date = new Date(result.expiresAt)
      expect(date.getTime()).not.toBeNaN()
      expect(date.getTime()).toBeGreaterThan(Date.now())
    })

    it('(property) should produce unique tokens for different addresses', () => {
      fc.assert(
        fc.asyncProperty(walletAddressArb, walletAddressArb, async (addr1, addr2) => {
          if (addr1 === addr2) return // skip identical
          const token1 = await signJwt(addr1)
          const token2 = await signJwt(addr2)
          return token1.token !== token2.token
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('verifyJwt', () => {
    it('should verify a token it just signed', async () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const { token } = await signJwt(address)

      const payload = await verifyJwt(token)

      expect(payload).not.toBeNull()
      expect(payload!.sub).toBe(address)
      expect(payload!.type).toBe('ai')
    })

    it('should reject a token with tampered payload', async () => {
      const { token } = await signJwt('0x1234567890abcdef1234567890abcdef12345678')
      const parts = token.split('.')
      // Tamper with the payload
      parts[1] = parts[1] + 'x'
      const tampered = parts.join('.')

      const payload = await verifyJwt(tampered)
      expect(payload).toBeNull()
    })

    it('should reject a token with tampered signature', async () => {
      const { token } = await signJwt('0x1234567890abcdef1234567890abcdef12345678')
      const parts = token.split('.')
      // Replace last char of signature
      const lastChar = parts[2].slice(-1)
      parts[2] = parts[2].slice(0, -1) + (lastChar === 'a' ? 'b' : 'a')
      const tampered = parts.join('.')

      const payload = await verifyJwt(tampered)
      expect(payload).toBeNull()
    })

    it('should reject malformed tokens', async () => {
      expect(await verifyJwt('')).toBeNull()
      expect(await verifyJwt('not.a.jwt.token')).toBeNull()
      expect(await verifyJwt('abc')).toBeNull()
      expect(await verifyJwt('a.b')).toBeNull()
    })

    it('should reject expired tokens', async () => {
      // Sign a token, then fast-forward time to make it expired
      const { token } = await signJwt('0x1234567890abcdef1234567890abcdef12345678')

      // Fast-forward time by 2 hours
      const realNow = Date.now
      Date.now = () => realNow() + 2 * 60 * 60 * 1000

      try {
        const payload = await verifyJwt(token)
        expect(payload).toBeNull()
      } finally {
        Date.now = realNow
      }
    })

    it('(property) round-trip: sign then verify recovers the address', () => {
      fc.assert(
        fc.asyncProperty(walletAddressArb, async (address) => {
          const { token } = await signJwt(address)
          const payload = await verifyJwt(token)
          return payload !== null && payload.sub === address.toLowerCase()
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('generateRefreshToken', () => {
    it('should generate a 64-char hex string', () => {
      const token = generateRefreshToken()
      expect(token).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should generate unique tokens', () => {
      const tokens = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const token = generateRefreshToken()
        expect(tokens.has(token)).toBe(false)
        tokens.add(token)
      }
    })
  })

  describe('hashToken', () => {
    it('should produce a deterministic hash', async () => {
      const token = 'test-refresh-token-12345'
      const hash1 = await hashToken(token)
      const hash2 = await hashToken(token)
      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different tokens', async () => {
      const hash1 = await hashToken('token-a')
      const hash2 = await hashToken('token-b')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('getTokenExpiries', () => {
    it('should return access expiry ~1h from now', () => {
      const { accessExpiresAt } = getTokenExpiries()
      const diff = accessExpiresAt.getTime() - Date.now()
      // Should be within 1 second of 1 hour
      expect(diff).toBeGreaterThan(3599 * 1000)
      expect(diff).toBeLessThan(3601 * 1000)
    })

    it('should return refresh expiry ~30 days from now', () => {
      const { refreshExpiresAt } = getTokenExpiries()
      const diff = refreshExpiresAt.getTime() - Date.now()
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      expect(diff).toBeGreaterThan(thirtyDays - 2000)
      expect(diff).toBeLessThan(thirtyDays + 2000)
    })
  })

  describe('missing secret', () => {
    it('should throw if AI_JWT_SECRET is not set', async () => {
      const original = process.env.AI_JWT_SECRET
      delete process.env.AI_JWT_SECRET

      try {
        await expect(signJwt('0x1234567890abcdef1234567890abcdef12345678'))
          .rejects.toThrow('AI_JWT_SECRET')
      } finally {
        process.env.AI_JWT_SECRET = original
      }
    })
  })
})
