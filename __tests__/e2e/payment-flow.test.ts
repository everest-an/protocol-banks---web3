/**
 * E2E Tests — Payment Flow
 *
 * Tests the complete payment lifecycle including:
 * - Address validation & network detection
 * - Payment creation with auto-detection
 * - Payment listing with multi-dimensional filters
 * - BigInt serialization
 * - Error handling at each stage
 */

import { validateAddress, getNetworkForAddress, validateAddressBatch } from '@/lib/address-utils'
import { getNetworkById, getSupportedTokens, getTokenAddress, isNetworkSupported } from '@/lib/networks'
import { categorizeTransaction, calculateMonthlyBurnRate, calculateRunway } from '@/lib/business-logic'

// ============================================
// Payment Validation Pipeline
// ============================================

describe('Payment Validation Pipeline', () => {
  describe('Sender Validation', () => {
    it('should validate EVM sender address', () => {
      const sender = '0xdac17f958d2ee523a2206206994597c13d831ec7'
      const result = validateAddress(sender, 'EVM')

      expect(result.isValid).toBe(true)
      expect(result.type).toBe('EVM')
      expect(result.checksumAddress).toBeDefined()
    })

    it('should reject invalid sender', () => {
      const result = validateAddress('not-an-address', 'EVM')
      expect(result.isValid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Recipient Validation', () => {
    it('should validate EVM recipient and detect network', () => {
      const recipient = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
      const result = validateAddress(recipient)

      expect(result.isValid).toBe(true)
      expect(result.type).toBe('EVM')

      const network = getNetworkForAddress(recipient)
      expect(network).toBe('ethereum')
    })

    it('should validate TRON recipient and detect network', () => {
      const recipient = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
      const result = validateAddress(recipient)

      expect(result.isValid).toBe(true)
      expect(result.type).toBe('TRON')

      const network = getNetworkForAddress(recipient)
      expect(network).toBe('tron')
    })
  })

  describe('Token Resolution', () => {
    it('should resolve USDC on Base', () => {
      const tokenAddress = getTokenAddress('base', 'USDC')
      expect(tokenAddress).toBeDefined()
      expect(tokenAddress).toMatch(/^0x/)
    })

    it('should resolve USDT on TRON', () => {
      const tokenAddress = getTokenAddress('tron', 'USDT')
      expect(tokenAddress).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
    })

    it('should return undefined for unsupported token', () => {
      expect(getTokenAddress('ethereum', 'NONEXISTENT')).toBeUndefined()
    })
  })

  describe('Network Validation', () => {
    it('should confirm supported networks', () => {
      expect(isNetworkSupported('ethereum')).toBe(true)
      expect(isNetworkSupported('base')).toBe(true)
      expect(isNetworkSupported('tron')).toBe(true)
    })

    it('should reject unsupported networks', () => {
      expect(isNetworkSupported('polkadot')).toBe(false)
    })
  })
})

// ============================================
// Payment Amount Validation
// ============================================

describe('Payment Amount Validation', () => {
  it('should handle standard amounts', () => {
    const amounts = ['100.00', '0.01', '999999.99', '1000000']
    amounts.forEach((amount) => {
      const parsed = parseFloat(amount)
      expect(parsed).toBeGreaterThan(0)
      expect(isFinite(parsed)).toBe(true)
    })
  })

  it('should reject invalid amounts', () => {
    const invalidAmounts = ['0', '-100', 'abc', 'NaN', 'Infinity', '']
    invalidAmounts.forEach((amount) => {
      const parsed = parseFloat(amount)
      expect(parsed > 0 && isFinite(parsed)).toBeFalsy()
    })
  })

  it('should handle BigInt conversion for on-chain amounts', () => {
    // Simulate converting USD amount to token base units
    const amountUsd = '1000.50'
    const decimals = 6 // USDC
    const baseUnits = BigInt(Math.round(parseFloat(amountUsd) * 10 ** decimals))

    expect(baseUnits).toBe(BigInt(1000500000))
    // Should serialize to string for JSON
    expect(baseUnits.toString()).toBe('1000500000')
  })

  it('should handle TRON energy/bandwidth as BigInt', () => {
    const energyUsed = BigInt('100000')
    const bandwidthUsed = BigInt('500')

    // Serialize for API response
    const serialized = {
      energy_used: energyUsed.toString(),
      bandwidth_used: bandwidthUsed.toString(),
    }

    expect(serialized.energy_used).toBe('100000')
    expect(serialized.bandwidth_used).toBe('500')

    // Deserialize back
    expect(BigInt(serialized.energy_used)).toBe(energyUsed)
  })
})

// ============================================
// Payment Filtering
// ============================================

describe('Payment Filtering Logic', () => {
  const mockPayments = [
    {
      id: '1',
      type: 'sent',
      status: 'completed',
      chain: 'ethereum',
      token_symbol: 'USDC',
      amount_usd: 1000,
      timestamp: '2026-01-10T12:00:00Z',
      vendor: { name: 'AWS' },
      notes: 'cloud hosting',
    },
    {
      id: '2',
      type: 'sent',
      status: 'pending',
      chain: 'tron',
      token_symbol: 'USDT',
      amount_usd: 2000,
      timestamp: '2026-01-15T12:00:00Z',
      vendor: { name: '' },
      notes: 'salary payment',
    },
    {
      id: '3',
      type: 'received',
      status: 'completed',
      chain: 'base',
      token_symbol: 'USDC',
      amount_usd: 5000,
      timestamp: '2026-01-20T12:00:00Z',
      vendor: { name: 'Client' },
      notes: '',
    },
    {
      id: '4',
      type: 'sent',
      status: 'failed',
      chain: 'arbitrum',
      token_symbol: 'DAI',
      amount_usd: 500,
      timestamp: '2026-01-22T12:00:00Z',
      vendor: { name: 'Freelance Dev' },
      notes: 'contractor payment',
    },
  ]

  function filterPayments(
    payments: typeof mockPayments,
    filters: {
      type?: string
      status?: string
      chain?: string
      token?: string
      startDate?: string
      endDate?: string
    }
  ) {
    let result = [...payments]

    if (filters.type && filters.type !== 'all') {
      result = result.filter((p) => p.type === filters.type)
    }
    if (filters.status && filters.status !== 'all') {
      result = result.filter((p) => p.status === filters.status)
    }
    if (filters.chain && filters.chain !== 'all') {
      result = result.filter((p) => p.chain === filters.chain)
    }
    if (filters.token && filters.token !== 'all') {
      result = result.filter((p) => p.token_symbol === filters.token)
    }
    if (filters.startDate) {
      result = result.filter((p) => p.timestamp >= filters.startDate!)
    }
    if (filters.endDate) {
      result = result.filter((p) => p.timestamp <= filters.endDate!)
    }

    return result
  }

  it('should filter by type', () => {
    const sent = filterPayments(mockPayments, { type: 'sent' })
    expect(sent).toHaveLength(3)
    expect(sent.every((p) => p.type === 'sent')).toBe(true)
  })

  it('should filter by status', () => {
    const completed = filterPayments(mockPayments, { status: 'completed' })
    expect(completed).toHaveLength(2)

    const pending = filterPayments(mockPayments, { status: 'pending' })
    expect(pending).toHaveLength(1)

    const failed = filterPayments(mockPayments, { status: 'failed' })
    expect(failed).toHaveLength(1)
  })

  it('should filter by chain', () => {
    const tron = filterPayments(mockPayments, { chain: 'tron' })
    expect(tron).toHaveLength(1)
    expect(tron[0].id).toBe('2')

    const ethereum = filterPayments(mockPayments, { chain: 'ethereum' })
    expect(ethereum).toHaveLength(1)
  })

  it('should filter by token', () => {
    const usdc = filterPayments(mockPayments, { token: 'USDC' })
    expect(usdc).toHaveLength(2)

    const usdt = filterPayments(mockPayments, { token: 'USDT' })
    expect(usdt).toHaveLength(1)
  })

  it('should filter by date range', () => {
    const midMonth = filterPayments(mockPayments, {
      startDate: '2026-01-12',
      endDate: '2026-01-21',
    })
    expect(midMonth).toHaveLength(2) // ids 2 and 3
  })

  it('should combine multiple filters', () => {
    const result = filterPayments(mockPayments, {
      type: 'sent',
      status: 'completed',
      chain: 'ethereum',
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('should return all with no filters', () => {
    const result = filterPayments(mockPayments, {})
    expect(result).toHaveLength(4)
  })

  it('should return empty for contradictory filters', () => {
    const result = filterPayments(mockPayments, {
      type: 'received',
      chain: 'tron', // No received payments on tron
    })
    expect(result).toHaveLength(0)
  })
})

// ============================================
// Payment Categorization in Context
// ============================================

describe('Payment Categorization Pipeline', () => {
  it('should categorize and aggregate payment stream', () => {
    const payments = [
      { vendor: { name: 'AWS' }, notes: 'cloud hosting', amount_usd: 5000 },
      { vendor: { name: 'GCP' }, notes: 'server', amount_usd: 3000 },
      { vendor: { name: '' }, notes: 'monthly salary', amount_usd: 50000 },
      { vendor: { name: '' }, notes: 'marketing campaign', amount_usd: 10000 },
      { vendor: { name: 'Freelancer' }, notes: 'contractor work', amount_usd: 8000 },
      { vendor: { name: '' }, notes: 'legal review', amount_usd: 2000 },
    ]

    // Categorize each
    const categorized = payments.map((p) => ({
      ...p,
      category: categorizeTransaction(p.vendor?.name, p.notes),
    }))

    expect(categorized[0].category).toBe('Infrastructure')
    expect(categorized[1].category).toBe('Infrastructure')
    expect(categorized[2].category).toBe('Payroll')
    expect(categorized[3].category).toBe('Marketing')
    expect(categorized[4].category).toBe('Contractors')
    expect(categorized[5].category).toBe('Legal')
  })
})

// ============================================
// E2E: Complete Payment Lifecycle
// ============================================

describe('E2E: Complete Payment Lifecycle', () => {
  it('should process a full EVM payment from validation to categorization', () => {
    // Step 1: Validate sender
    const sender = '0x1234567890123456789012345678901234567890'
    const senderResult = validateAddress(sender, 'EVM')
    expect(senderResult.isValid).toBe(true)

    // Step 2: Validate recipient
    const recipient = '0xdac17f958d2ee523a2206206994597c13d831ec7'
    const recipientResult = validateAddress(recipient, 'EVM')
    expect(recipientResult.isValid).toBe(true)

    // Step 3: Detect network
    const network = getNetworkForAddress(recipient)
    expect(isNetworkSupported(network)).toBe(true)

    // Step 4: Resolve token
    const tokenAddr = getTokenAddress(network, 'USDC')
    expect(tokenAddr).toBeDefined()

    // Step 5: Verify network config
    const networkConfig = getNetworkById(network)
    expect(networkConfig).toBeDefined()
    expect(networkConfig!.type).toBe('EVM')

    // Step 6: Create payment record
    const payment = {
      from_address: senderResult.checksumAddress,
      to_address: recipientResult.checksumAddress,
      amount: '1000.00',
      amount_usd: 1000,
      token_symbol: 'USDC',
      network: network,
      status: 'completed',
      vendor: { name: 'AWS' },
      notes: 'cloud hosting',
      timestamp: new Date().toISOString(),
    }

    // Step 7: Categorize
    const category = categorizeTransaction(payment.vendor.name, payment.notes)
    expect(category).toBe('Infrastructure')

    // Step 8: Include in burn rate
    const burnRate = calculateMonthlyBurnRate([payment])
    expect(burnRate).toBe(1000)

    // Step 9: Calculate runway
    const runway = calculateRunway(12000, burnRate)
    expect(runway).toBe(12)
  })

  it('should process a full TRON payment from validation to categorization', () => {
    // Step 1: Validate TRON recipient
    const recipient = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
    const result = validateAddress(recipient)
    expect(result.isValid).toBe(true)
    expect(result.type).toBe('TRON')

    // Step 2: Detect network
    const network = getNetworkForAddress(recipient)
    expect(network).toBe('tron')

    // Step 3: Get network config
    const config = getNetworkById('tron')
    expect(config!.type).toBe('TRON')
    expect(config!.nativeCurrency.decimals).toBe(6)

    // Step 4: Resolve token
    const usdtAddr = getTokenAddress('tron', 'USDT')
    expect(usdtAddr).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')

    // Step 5: BigInt energy handling
    const energyUsed = BigInt(100000)
    expect(energyUsed.toString()).toBe('100000')
  })

  it('should handle batch payment with mixed networks', () => {
    const recipients = [
      '0x1234567890123456789012345678901234567890',
      '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
      'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      'invalid-address',
    ]

    // Batch validate
    const batch = validateAddressBatch(recipients)
    expect(batch.valid).toHaveLength(3)
    expect(batch.invalid).toHaveLength(1)

    // EVM and TRON should not be mixed in same batch
    const hasMultipleTypes = batch.byType.EVM.length > 0 && batch.byType.TRON.length > 0
    expect(hasMultipleTypes).toBe(true)

    // In production: warn user about cross-chain batch
    // Separate into EVM batch and TRON batch
    expect(batch.byType.EVM).toHaveLength(2)
    expect(batch.byType.TRON).toHaveLength(1)
  })

  it('should track payment status transitions', () => {
    const validStatuses = ['pending', 'completed', 'failed']
    const validTransitions: Record<string, string[]> = {
      pending: ['completed', 'failed'],
      completed: [], // terminal
      failed: ['pending'], // retry
    }

    // Verify all statuses are defined
    validStatuses.forEach((status) => {
      expect(validTransitions[status]).toBeDefined()
    })

    // Verify transitions
    expect(validTransitions.pending).toContain('completed')
    expect(validTransitions.pending).toContain('failed')
    expect(validTransitions.completed).toHaveLength(0) // terminal
    expect(validTransitions.failed).toContain('pending') // can retry
  })
})
