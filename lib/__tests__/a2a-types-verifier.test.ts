/**
 * A2A Types & Verifier Tests
 *
 * Tests for DID generation/extraction, message canonicalization,
 * timestamp validation, and signature verification.
 *
 * @module lib/__tests__/a2a-types-verifier.test.ts
 */

import * as fc from 'fast-check'

// ============================================
// Mocks
// ============================================

const mockVerifyMessage = jest.fn()
jest.mock('viem', () => ({
  verifyMessage: (...args: unknown[]) => mockVerifyMessage(...args),
}))

const mockPrisma = {
  a2AMessage: {
    findUnique: jest.fn(),
  },
}
jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

jest.mock('@/lib/logger/structured-logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

import {
  generateDid,
  extractAddressFromDid,
  extractChainIdFromDid,
  getPlatformAgentCard,
  didSchema,
  agentCardSchema,
} from '../a2a/types'

import {
  verifyA2ASignature,
  checkTimestamp,
  isNonceUsed,
  canonicalizePayload,
} from '../a2a/message-verifier'

// ============================================
// Helpers
// ============================================

const validAddress = '0x1234567890abcdef1234567890abcdef12345678'

// ============================================
// DID Utility Tests
// ============================================

describe('DID Utilities', () => {
  describe('generateDid', () => {
    it('should generate a valid PKH DID', () => {
      const did = generateDid(validAddress, 1)
      expect(did).toBe(`did:pkh:eip155:1:${validAddress}`)
    })

    it('should lowercase the address', () => {
      const did = generateDid('0xABCDEF1234567890ABCDEF1234567890ABCDEF12', 1)
      expect(did).toBe('did:pkh:eip155:1:0xabcdef1234567890abcdef1234567890abcdef12')
    })

    it('should default to chain ID 1', () => {
      const did = generateDid(validAddress)
      expect(did).toContain(':1:')
    })

    it('should use custom chain ID', () => {
      const did = generateDid(validAddress, 137)
      expect(did).toContain(':137:')
    })

    it('(property) generated DIDs pass the schema validation', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          fc.integer({ min: 1, max: 100000 }),
          (hex, chainId) => {
            const address = `0x${hex}`
            const did = generateDid(address, chainId)
            return didSchema.safeParse(did).success
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('extractAddressFromDid', () => {
    it('should extract address from valid DID', () => {
      const did = `did:pkh:eip155:1:${validAddress}`
      expect(extractAddressFromDid(did)).toBe(validAddress)
    })

    it('should return null for invalid DIDs', () => {
      expect(extractAddressFromDid('')).toBeNull()
      expect(extractAddressFromDid('not-a-did')).toBeNull()
      expect(extractAddressFromDid('did:pkh:eip155:1:invalid')).toBeNull()
      expect(extractAddressFromDid('did:pkh:eip155:1:0x123')).toBeNull()
    })

    it('(property) round-trip: generate then extract recovers address', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          fc.integer({ min: 1, max: 100000 }),
          (hex, chainId) => {
            const address = `0x${hex}`
            const did = generateDid(address, chainId)
            const extracted = extractAddressFromDid(did)
            return extracted === address.toLowerCase()
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('extractChainIdFromDid', () => {
    it('should extract chain ID from valid DID', () => {
      expect(extractChainIdFromDid(`did:pkh:eip155:137:${validAddress}`)).toBe(137)
      expect(extractChainIdFromDid(`did:pkh:eip155:1:${validAddress}`)).toBe(1)
    })

    it('should return null for invalid DIDs', () => {
      expect(extractChainIdFromDid('invalid')).toBeNull()
    })
  })

  describe('didSchema', () => {
    it('should accept valid DIDs', () => {
      expect(didSchema.safeParse(`did:pkh:eip155:1:${validAddress}`).success).toBe(true)
      expect(didSchema.safeParse(`did:pkh:eip155:137:${validAddress}`).success).toBe(true)
    })

    it('should reject invalid DIDs', () => {
      expect(didSchema.safeParse('').success).toBe(false)
      expect(didSchema.safeParse('did:web:example.com').success).toBe(false)
      expect(didSchema.safeParse('did:pkh:eip155:1:0x123').success).toBe(false)
    })
  })
})

// ============================================
// Platform Agent Card Tests
// ============================================

describe('getPlatformAgentCard', () => {
  it('should return a valid Agent Card', () => {
    const card = getPlatformAgentCard('https://app.protocolbanks.com')

    expect(card.name).toBe('Protocol Banks Payment Agent')
    expect(card.capabilities.skills).toHaveLength(4)
    expect(card.capabilities.supported_protocols).toContain('a2a')
    expect(card.capabilities.supported_protocols).toContain('mcp')
    expect(card.supported_tokens).toContain('USDC')
    expect(card.supported_chains).toContain('ethereum')
    expect(card.a2a_endpoint).toBe('https://app.protocolbanks.com/api/a2a')
    expect(card.mcp_endpoint).toBe('https://app.protocolbanks.com/api/mcp')
  })

  it('should pass the agentCardSchema validation', () => {
    const card = getPlatformAgentCard('https://app.protocolbanks.com')
    const result = agentCardSchema.safeParse(card)
    expect(result.success).toBe(true)
  })

  it('should use the provided base URL', () => {
    const card = getPlatformAgentCard('https://custom.example.com')
    expect(card.url).toBe('https://custom.example.com')
    expect(card.a2a_endpoint).toBe('https://custom.example.com/api/a2a')
  })
})

// ============================================
// Message Verifier Tests
// ============================================

describe('A2A Message Verifier', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('canonicalizePayload', () => {
    it('should sort keys alphabetically', () => {
      const result = canonicalizePayload({ z: 1, a: 2, m: 3 })
      expect(result).toBe('{"a":2,"m":3,"z":1}')
    })

    it('should exclude the signature field', () => {
      const result = canonicalizePayload({
        amount: '100',
        signature: '0xsig...',
        token: 'USDT',
      })
      expect(result).toBe('{"amount":"100","token":"USDT"}')
      expect(result).not.toContain('signature')
    })

    it('should produce deterministic output', () => {
      const params = { b: 2, a: 1 }
      expect(canonicalizePayload(params)).toBe(canonicalizePayload(params))
    })

    it('(property) never includes signature key', () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.string(), fc.jsonValue()),
          (obj) => {
            const withSig = { ...obj, signature: '0xabc' }
            const result = canonicalizePayload(withSig)
            return !result.includes('"signature"')
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  describe('checkTimestamp', () => {
    it('should accept a timestamp within the window', () => {
      const now = new Date().toISOString()
      expect(checkTimestamp(now)).toBeNull()
    })

    it('should reject a timestamp too old', () => {
      const old = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 min ago
      const result = checkTimestamp(old, 300)
      expect(result).toContain('replay window')
    })

    it('should reject a timestamp too far in the future', () => {
      const future = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min ahead
      const result = checkTimestamp(future, 300)
      expect(result).toContain('replay window')
    })

    it('should reject invalid timestamp format', () => {
      const result = checkTimestamp('not-a-date')
      expect(result).toBe('Invalid timestamp format')
    })

    it('should use custom window size', () => {
      const justOutside = new Date(Date.now() - 61 * 1000).toISOString() // 61s ago
      expect(checkTimestamp(justOutside, 60)).not.toBeNull() // outside 60s window
      expect(checkTimestamp(justOutside, 120)).toBeNull() // inside 120s window
    })
  })

  describe('isNonceUsed', () => {
    it('should return false for new nonce', async () => {
      mockPrisma.a2AMessage.findUnique.mockResolvedValue(null)

      const result = await isNonceUsed('new-nonce-123')
      expect(result).toBe(false)
    })

    it('should return true for existing nonce', async () => {
      mockPrisma.a2AMessage.findUnique.mockResolvedValue({ id: 'msg-1' })

      const result = await isNonceUsed('used-nonce')
      expect(result).toBe(true)
    })
  })

  describe('verifyA2ASignature', () => {
    const did = `did:pkh:eip155:1:${validAddress}`

    it('should verify valid signature and return address', async () => {
      mockVerifyMessage.mockResolvedValue(true)

      const params = {
        from_did: did,
        amount: '100',
        token: 'USDT',
        signature: '0xvalidsig',
      }

      const result = await verifyA2ASignature(params, did)
      expect(result).toBe(validAddress)
    })

    it('should return null for invalid signature', async () => {
      mockVerifyMessage.mockResolvedValue(false)

      const params = {
        from_did: did,
        amount: '100',
        signature: '0xbadsig',
      }

      const result = await verifyA2ASignature(params, did)
      expect(result).toBeNull()
    })

    it('should return null when no signature in params', async () => {
      const params = { from_did: did, amount: '100' }
      const result = await verifyA2ASignature(params, did)
      expect(result).toBeNull()
    })

    it('should return null for invalid DID', async () => {
      const params = { from_did: 'bad-did', signature: '0xsig' }
      const result = await verifyA2ASignature(params, 'bad-did')
      expect(result).toBeNull()
    })

    it('should sign the canonicalized payload (without signature)', async () => {
      mockVerifyMessage.mockResolvedValue(true)

      const params = {
        amount: '100',
        from_did: did,
        signature: '0xsig',
        token: 'USDT',
      }

      await verifyA2ASignature(params, did)

      // The message passed to verifyMessage should be canonicalized without signature
      expect(mockVerifyMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '{"amount":"100","from_did":"did:pkh:eip155:1:0x1234567890abcdef1234567890abcdef12345678","token":"USDT"}',
        })
      )
    })

    it('should return null when verifyMessage throws', async () => {
      mockVerifyMessage.mockRejectedValue(new Error('crypto error'))

      const params = { from_did: did, signature: '0xsig' }
      const result = await verifyA2ASignature(params, did)
      expect(result).toBeNull()
    })
  })
})
