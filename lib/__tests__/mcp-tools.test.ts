/**
 * MCP Tools Tests
 *
 * Tests for MCP tool handlers: token listing, payment quotes,
 * and MCP auth layer.
 *
 * @module lib/__tests__/mcp-tools.test.ts
 */

// ============================================
// Mocks
// ============================================

jest.mock('@/lib/prisma', () => ({
  prisma: {
    paymentProposal: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    invoice: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

// Mock networks module
jest.mock('@/lib/networks', () => ({
  ALL_NETWORKS: {
    ethereum: {
      name: 'Ethereum',
      type: 'EVM',
      chainId: 1,
      isTestnet: false,
      nativeCurrency: { symbol: 'ETH', decimals: 18 },
    },
    base: {
      name: 'Base',
      type: 'EVM',
      chainId: 8453,
      isTestnet: false,
      nativeCurrency: { symbol: 'ETH', decimals: 18 },
    },
    tron: {
      name: 'TRON',
      type: 'TRON',
      chainId: 728126428,
      isTestnet: false,
      nativeCurrency: { symbol: 'TRX', decimals: 6 },
    },
    sepolia: {
      name: 'Sepolia',
      type: 'EVM',
      chainId: 11155111,
      isTestnet: true,
      nativeCurrency: { symbol: 'ETH', decimals: 18 },
    },
  },
  NETWORK_TOKENS: {
    ethereum: [
      { symbol: 'USDC', address: '0xa0b8...', decimals: 6 },
      { symbol: 'USDT', address: '0xdac1...', decimals: 6 },
    ],
    base: [
      { symbol: 'USDC', address: '0x833...', decimals: 6 },
    ],
    tron: [
      { symbol: 'USDT', address: 'TR7Nh...', decimals: 6 },
    ],
    sepolia: [
      { symbol: 'USDC', address: '0xtest...', decimals: 6 },
    ],
  },
  getMainnetNetworks: () => ({}),
}))

jest.mock('@/lib/auth/jwt', () => ({
  verifyJwt: jest.fn(),
}))

import {
  handleListSupportedTokens,
  handleGetPaymentQuote,
} from '../mcp/tools/token-tools'

import { authenticateMcpRequest, requireAuth, type McpAuthContext } from '../mcp/auth'
import { verifyJwt } from '../auth/jwt'

const mockVerifyJwt = verifyJwt as jest.MockedFunction<typeof verifyJwt>

// ============================================
// Token Tools Tests
// ============================================

describe('MCP Token Tools', () => {
  describe('handleListSupportedTokens', () => {
    it('should list all mainnet networks by default', async () => {
      const result = await handleListSupportedTokens({}) as {
        networks: Array<{ network: string; is_testnet: boolean }>
        total_networks: number
      }

      expect(result.total_networks).toBe(3) // ethereum, base, tron (excludes sepolia)
      expect(result.networks.every((n) => !n.is_testnet)).toBe(true)
    })

    it('should include testnets when requested', async () => {
      const result = await handleListSupportedTokens({ include_testnets: true }) as {
        networks: Array<{ network: string }>
        total_networks: number
      }

      expect(result.total_networks).toBe(4) // all 4 including sepolia
    })

    it('should filter by specific network', async () => {
      const result = await handleListSupportedTokens({ network: 'tron' }) as {
        networks: Array<{ network: string; tokens: Array<{ symbol: string }> }>
      }

      expect(result.networks).toHaveLength(1)
      expect(result.networks[0].network).toBe('tron')
      expect(result.networks[0].tokens[0].symbol).toBe('USDT')
    })

    it('should return empty for unknown network', async () => {
      const result = await handleListSupportedTokens({ network: 'nonexistent' }) as {
        networks: unknown[]
        total_networks: number
      }

      expect(result.total_networks).toBe(0)
      expect(result.networks).toHaveLength(0)
    })

    it('should include token details', async () => {
      const result = await handleListSupportedTokens({ network: 'ethereum' }) as {
        networks: Array<{
          tokens: Array<{ symbol: string; address: string; decimals: number }>
        }>
      }

      const tokens = result.networks[0].tokens
      expect(tokens).toHaveLength(2)
      expect(tokens[0]).toHaveProperty('symbol')
      expect(tokens[0]).toHaveProperty('address')
      expect(tokens[0]).toHaveProperty('decimals')
    })

    it('should include network metadata', async () => {
      const result = await handleListSupportedTokens({ network: 'ethereum' }) as {
        networks: Array<{
          network: string
          name: string
          type: string
          chain_id: number
        }>
      }

      const net = result.networks[0]
      expect(net.name).toBe('Ethereum')
      expect(net.type).toBe('EVM')
      expect(net.chain_id).toBe(1)
    })
  })

  describe('handleGetPaymentQuote', () => {
    it('should return a fee quote with 0.5% fee', async () => {
      const result = await handleGetPaymentQuote({
        network: 'ethereum',
        token: 'USDC',
        amount: '1000',
      }) as {
        fee: string
        fee_percent: string
        total: string
        network: string
        token: string
      }

      expect(result.fee).toBe('5.00') // 0.5% of 1000
      expect(result.fee_percent).toBe('0.5%')
      expect(result.total).toBe('1005.00')
      expect(result.network).toBe('ethereum')
      expect(result.token).toBe('USDC')
    })

    it('should cap fee at $50', async () => {
      const result = await handleGetPaymentQuote({
        network: 'ethereum',
        token: 'USDC',
        amount: '100000', // 0.5% = 500, but capped at 50
      }) as { fee: string; total: string }

      expect(result.fee).toBe('50.00')
      expect(result.total).toBe('100050.00')
    })

    it('should throw for unsupported network', async () => {
      await expect(
        handleGetPaymentQuote({ network: 'solana', token: 'USDC', amount: '100' })
      ).rejects.toThrow('Unsupported network')
    })

    it('should throw for unsupported token on network', async () => {
      await expect(
        handleGetPaymentQuote({ network: 'tron', token: 'USDC', amount: '100' })
      ).rejects.toThrow('not supported on tron')
    })

    it('should throw for invalid amount', async () => {
      await expect(
        handleGetPaymentQuote({ network: 'ethereum', token: 'USDC', amount: '-50' })
      ).rejects.toThrow('positive number')

      await expect(
        handleGetPaymentQuote({ network: 'ethereum', token: 'USDC', amount: 'abc' })
      ).rejects.toThrow('positive number')
    })

    it('should match token case-insensitively', async () => {
      const result = await handleGetPaymentQuote({
        network: 'ethereum',
        token: 'usdc',
        amount: '100',
      }) as { token: string }

      expect(result.token).toBe('USDC')
    })

    it('should return TRON-specific confirmation time', async () => {
      const result = await handleGetPaymentQuote({
        network: 'tron',
        token: 'USDT',
        amount: '100',
      }) as { estimated_confirmation: string }

      expect(result.estimated_confirmation).toBe('~3 seconds')
    })

    it('should return EVM-specific confirmation time', async () => {
      const result = await handleGetPaymentQuote({
        network: 'ethereum',
        token: 'USDC',
        amount: '100',
      }) as { estimated_confirmation: string }

      expect(result.estimated_confirmation).toBe('~12 seconds')
    })
  })
})

// ============================================
// MCP Auth Tests
// ============================================

describe('MCP Auth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('authenticateMcpRequest', () => {
    it('should return unauthenticated for no header', async () => {
      const ctx = await authenticateMcpRequest(undefined)
      expect(ctx.authenticated).toBe(false)
      expect(ctx.address).toBeUndefined()
    })

    it('should return unauthenticated for null header', async () => {
      const ctx = await authenticateMcpRequest(null)
      expect(ctx.authenticated).toBe(false)
    })

    it('should strip Bearer prefix and verify JWT', async () => {
      mockVerifyJwt.mockResolvedValue({
        sub: '0xabc123',
        iat: 1000,
        exp: 9999999999,
        type: 'ai',
      })

      const ctx = await authenticateMcpRequest('Bearer my-jwt-token')
      expect(ctx.authenticated).toBe(true)
      expect(ctx.address).toBe('0xabc123')
      expect(mockVerifyJwt).toHaveBeenCalledWith('my-jwt-token')
    })

    it('should handle raw token without Bearer prefix', async () => {
      mockVerifyJwt.mockResolvedValue({
        sub: '0xabc123',
        iat: 1000,
        exp: 9999999999,
        type: 'ai',
      })

      const ctx = await authenticateMcpRequest('raw-jwt-token')
      expect(ctx.authenticated).toBe(true)
      expect(mockVerifyJwt).toHaveBeenCalledWith('raw-jwt-token')
    })

    it('should return unauthenticated for invalid JWT', async () => {
      mockVerifyJwt.mockResolvedValue(null)

      const ctx = await authenticateMcpRequest('Bearer invalid-token')
      expect(ctx.authenticated).toBe(false)
    })

    it('should return unauthenticated for empty Bearer', async () => {
      const ctx = await authenticateMcpRequest('Bearer ')
      expect(ctx.authenticated).toBe(false)
    })
  })

  describe('requireAuth', () => {
    it('should return address for authenticated context', () => {
      const ctx: McpAuthContext = {
        authenticated: true,
        address: '0xabc123',
      }
      expect(requireAuth(ctx)).toBe('0xabc123')
    })

    it('should throw for unauthenticated context', () => {
      const ctx: McpAuthContext = { authenticated: false }
      expect(() => requireAuth(ctx)).toThrow('Authentication required')
    })

    it('should throw if authenticated but no address', () => {
      const ctx: McpAuthContext = { authenticated: true }
      expect(() => requireAuth(ctx)).toThrow('Authentication required')
    })
  })
})
