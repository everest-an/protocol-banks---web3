/**
 * SIWE Service Tests
 *
 * Tests for EIP-4361 message building, parsing, and verification.
 * Nonce management is tested with mocked Prisma.
 *
 * @module lib/__tests__/siwe.test.ts
 */

import * as fc from 'fast-check'

// ============================================
// Mocks
// ============================================

// Mock viem
const mockVerifyMessage = jest.fn()
jest.mock('viem', () => ({
  verifyMessage: (...args: unknown[]) => mockVerifyMessage(...args),
}))

// Mock prisma
const mockPrisma = {
  siweNonce: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
}
jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

jest.mock('@/lib/auth/crypto', () => ({
  generateRandomHex: (bytes: number) => {
    const chars = '0123456789abcdef'
    let result = ''
    for (let i = 0; i < bytes * 2; i++) {
      result += chars[Math.floor(Math.random() * 16)]
    }
    return result
  },
}))

import {
  buildSiweMessage,
  parseSiweMessage,
  verifySiweSignature,
  generateSiweNonce,
  consumeNonce,
  type SiweMessageParams,
} from '../auth/siwe'

// ============================================
// Helpers
// ============================================

const validAddress = '0x1234567890AbcdEF1234567890aBcDeF12345678'

function makeParams(overrides?: Partial<SiweMessageParams>): SiweMessageParams {
  return {
    domain: 'app.protocolbanks.com',
    address: validAddress,
    uri: 'https://app.protocolbanks.com',
    nonce: 'abc123def456',
    chainId: 1,
    statement: 'Sign in to Protocol Banks',
    issuedAt: '2026-02-27T10:00:00.000Z',
    ...overrides,
  }
}

// ============================================
// Tests
// ============================================

describe('SIWE (Sign-In with Ethereum)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('buildSiweMessage', () => {
    it('should build a valid EIP-4361 message', () => {
      const msg = buildSiweMessage(makeParams())

      expect(msg).toContain('app.protocolbanks.com wants you to sign in with your Ethereum account:')
      expect(msg).toContain(validAddress)
      expect(msg).toContain('Sign in to Protocol Banks')
      expect(msg).toContain('URI: https://app.protocolbanks.com')
      expect(msg).toContain('Version: 1')
      expect(msg).toContain('Chain ID: 1')
      expect(msg).toContain('Nonce: abc123def456')
      expect(msg).toContain('Issued At: 2026-02-27T10:00:00.000Z')
    })

    it('should include expiration time when provided', () => {
      const msg = buildSiweMessage(makeParams({
        expirationTime: '2026-02-27T11:00:00.000Z',
      }))

      expect(msg).toContain('Expiration Time: 2026-02-27T11:00:00.000Z')
    })

    it('should not include expiration time when omitted', () => {
      const msg = buildSiweMessage(makeParams())

      expect(msg).not.toContain('Expiration Time')
    })

    it('should use default chain ID 1 when not specified', () => {
      const msg = buildSiweMessage(makeParams({ chainId: undefined }))

      expect(msg).toContain('Chain ID: 1')
    })

    it('should use custom chain ID', () => {
      const msg = buildSiweMessage(makeParams({ chainId: 137 }))

      expect(msg).toContain('Chain ID: 137')
    })

    it('(property) domain always appears in first line', () => {
      fc.assert(
        fc.property(
          fc.webAuthority(),
          (domain) => {
            const msg = buildSiweMessage(makeParams({ domain }))
            return msg.startsWith(`${domain} wants you to sign in`)
          }
        ),
        { numRuns: 20 }
      )
    })
  })

  describe('parseSiweMessage', () => {
    it('should round-trip: build then parse recovers params', () => {
      const params = makeParams()
      const msg = buildSiweMessage(params)
      const parsed = parseSiweMessage(msg)

      expect(parsed).not.toBeNull()
      expect(parsed!.domain).toBe(params.domain)
      expect(parsed!.address).toBe(params.address)
      expect(parsed!.nonce).toBe(params.nonce)
      expect(parsed!.chainId).toBe(params.chainId)
      expect(parsed!.statement).toBe(params.statement)
      expect(parsed!.uri).toBe(params.uri)
    })

    it('should return null for empty string', () => {
      expect(parseSiweMessage('')).toBeNull()
    })

    it('should return null for non-SIWE messages', () => {
      expect(parseSiweMessage('Hello world')).toBeNull()
      expect(parseSiweMessage('Some random\nmultiline\ntext')).toBeNull()
    })

    it('should return null for invalid address in message', () => {
      const msg = buildSiweMessage(makeParams()).replace(validAddress, 'not-an-address')
      expect(parseSiweMessage(msg)).toBeNull()
    })

    it('should parse expiration time when present', () => {
      const msg = buildSiweMessage(makeParams({
        expirationTime: '2026-02-27T11:00:00.000Z',
      }))
      const parsed = parseSiweMessage(msg)

      expect(parsed).not.toBeNull()
      expect(parsed!.expirationTime).toBe('2026-02-27T11:00:00.000Z')
    })

    it('(property) round-trip is lossless for key fields', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 8, maxLength: 32 }),
          fc.constantFrom(1, 10, 137, 42161, 8453),
          (nonce, chainId) => {
            const params = makeParams({ nonce, chainId })
            const msg = buildSiweMessage(params)
            const parsed = parseSiweMessage(msg)
            return parsed !== null &&
              parsed.nonce === nonce &&
              parsed.chainId === chainId
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  describe('verifySiweSignature', () => {
    it('should verify a valid signature and return lowercase address', async () => {
      mockVerifyMessage.mockResolvedValue(true)

      const msg = buildSiweMessage(makeParams())
      const result = await verifySiweSignature(msg, '0xvalidsignature' as `0x${string}`)

      expect(result).toBe(validAddress.toLowerCase())
      expect(mockVerifyMessage).toHaveBeenCalledWith({
        address: validAddress,
        message: msg,
        signature: '0xvalidsignature',
      })
    })

    it('should return null for invalid signature', async () => {
      mockVerifyMessage.mockResolvedValue(false)

      const msg = buildSiweMessage(makeParams())
      const result = await verifySiweSignature(msg, '0xbadsig' as `0x${string}`)

      expect(result).toBeNull()
    })

    it('should return null for non-SIWE message', async () => {
      const result = await verifySiweSignature('not a siwe message', '0xsig' as `0x${string}`)
      expect(result).toBeNull()
      expect(mockVerifyMessage).not.toHaveBeenCalled()
    })

    it('should reject if domain does not match expected', async () => {
      mockVerifyMessage.mockResolvedValue(true)

      const msg = buildSiweMessage(makeParams({ domain: 'evil.com' }))
      const result = await verifySiweSignature(
        msg,
        '0xsig' as `0x${string}`,
        'app.protocolbanks.com' // expected domain
      )

      expect(result).toBeNull()
    })

    it('should accept when domain matches expected', async () => {
      mockVerifyMessage.mockResolvedValue(true)

      const msg = buildSiweMessage(makeParams({ domain: 'app.protocolbanks.com' }))
      const result = await verifySiweSignature(
        msg,
        '0xsig' as `0x${string}`,
        'app.protocolbanks.com'
      )

      expect(result).toBe(validAddress.toLowerCase())
    })

    it('should reject expired messages', async () => {
      const msg = buildSiweMessage(makeParams({
        expirationTime: '2020-01-01T00:00:00.000Z', // past
      }))
      const result = await verifySiweSignature(msg, '0xsig' as `0x${string}`)

      expect(result).toBeNull()
    })

    it('should return null when verifyMessage throws', async () => {
      mockVerifyMessage.mockRejectedValue(new Error('crypto error'))

      const msg = buildSiweMessage(makeParams())
      const result = await verifySiweSignature(msg, '0xsig' as `0x${string}`)

      expect(result).toBeNull()
    })
  })

  describe('generateSiweNonce', () => {
    it('should create a nonce in the database and return it', async () => {
      mockPrisma.siweNonce.create.mockResolvedValue({ nonce: 'abc', expires_at: new Date() })

      const result = await generateSiweNonce()

      expect(result.nonce).toBeDefined()
      expect(result.nonce).toMatch(/^[a-f0-9]{32}$/) // 16 bytes = 32 hex chars
      expect(result.expiresAt).toBeDefined()
      expect(mockPrisma.siweNonce.create).toHaveBeenCalledTimes(1)
    })

    it('should set expiry ~5 minutes in the future', async () => {
      mockPrisma.siweNonce.create.mockResolvedValue({ nonce: 'abc', expires_at: new Date() })

      const before = Date.now()
      const result = await generateSiweNonce()
      const after = Date.now()

      const expiresAt = new Date(result.expiresAt).getTime()
      expect(expiresAt).toBeGreaterThanOrEqual(before + 5 * 60 * 1000 - 1000)
      expect(expiresAt).toBeLessThanOrEqual(after + 5 * 60 * 1000 + 1000)
    })
  })

  describe('consumeNonce', () => {
    it('should return true for valid unused nonce', async () => {
      mockPrisma.siweNonce.findUnique.mockResolvedValue({
        nonce: 'test',
        used: false,
        expires_at: new Date(Date.now() + 60000), // 1 min from now
      })
      mockPrisma.siweNonce.update.mockResolvedValue({})

      const result = await consumeNonce('test')
      expect(result).toBe(true)
      expect(mockPrisma.siweNonce.update).toHaveBeenCalledWith({
        where: { nonce: 'test' },
        data: { used: true },
      })
    })

    it('should return false for already-used nonce', async () => {
      mockPrisma.siweNonce.findUnique.mockResolvedValue({
        nonce: 'test',
        used: true,
        expires_at: new Date(Date.now() + 60000),
      })

      const result = await consumeNonce('test')
      expect(result).toBe(false)
    })

    it('should return false for expired nonce', async () => {
      mockPrisma.siweNonce.findUnique.mockResolvedValue({
        nonce: 'test',
        used: false,
        expires_at: new Date(Date.now() - 60000), // expired
      })

      const result = await consumeNonce('test')
      expect(result).toBe(false)
    })

    it('should return false for non-existent nonce', async () => {
      mockPrisma.siweNonce.findUnique.mockResolvedValue(null)

      const result = await consumeNonce('nonexistent')
      expect(result).toBe(false)
    })

    it('should return false when database throws', async () => {
      mockPrisma.siweNonce.findUnique.mockRejectedValue(new Error('DB error'))

      const result = await consumeNonce('test')
      expect(result).toBe(false)
    })
  })
})
