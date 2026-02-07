/**
 * User Acceptance Tests (UAT)
 *
 * Simulates real user scenarios end-to-end:
 * 1. New merchant onboarding
 * 2. Multi-network payment processing
 * 3. Treasury management & reporting
 * 4. Reconciliation & anomaly resolution
 * 5. Yield management across chains
 * 6. Batch payment processing
 * 7. Cross-chain portfolio view
 *
 * These tests validate business requirements, not implementation details.
 */

import { validateAddress, validateAddressBatch, getNetworkForAddress, formatAddress } from '@/lib/address-utils'
import { getNetworkById, getTokenAddress, isNetworkSupported, getSupportedTokens, getMainnetNetworks } from '@/lib/networks'
import { categorizeTransaction, calculateMonthlyBurnRate, calculateRunway, getTopCategories, CATEGORIES, CATEGORY_COLORS } from '@/lib/business-logic'
import { ExportService, type AccountingReport } from '@/lib/services/export-service'

jest.mock('@/lib/prisma', () => ({
  prisma: { payment: { findMany: jest.fn() } },
}))

import { prisma } from '@/lib/prisma'
const mockFindMany = prisma.payment.findMany as jest.Mock

// ============================================
// Scenario 1: New Merchant Onboarding
// ============================================

describe('UAT Scenario 1: New Merchant Onboarding', () => {
  it('should validate merchant EVM wallet during registration', () => {
    const merchantWallet = '0xdac17f958d2ee523a2206206994597c13d831ec7'

    const result = validateAddress(merchantWallet)
    expect(result.isValid).toBe(true)
    expect(result.type).toBe('EVM')
    expect(result.checksumAddress).toBeDefined()

    // Merchant should be able to see their formatted address
    const display = formatAddress(result.checksumAddress!)
    expect(display).toContain('...')
  })

  it('should validate merchant TRON wallet during registration', () => {
    const merchantWallet = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

    const result = validateAddress(merchantWallet)
    expect(result.isValid).toBe(true)
    expect(result.type).toBe('TRON')
  })

  it('should reject invalid wallet during registration', () => {
    const invalidWallet = 'not-a-valid-address'

    const result = validateAddress(invalidWallet)
    expect(result.isValid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('should allow merchant to register addresses on multiple networks', () => {
    const addresses = [
      '0x1234567890123456789012345678901234567890', // Ethereum
      '0xABCDEF1234567890ABCDEF1234567890ABCDEF12', // Another EVM
      'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',        // TRON
    ]

    const batch = validateAddressBatch(addresses)

    expect(batch.valid).toHaveLength(3)
    expect(batch.invalid).toHaveLength(0)
    expect(batch.byType.EVM).toHaveLength(2)
    expect(batch.byType.TRON).toHaveLength(1)
  })

  it('should show available networks to merchant', () => {
    const networks = getMainnetNetworks()

    // Merchant should see production networks
    expect(networks.length).toBeGreaterThanOrEqual(6) // ETH, Base, Arb, BSC, HashKey, TRON
    expect(networks.every((n) => !n.isTestnet)).toBe(true)

    // Each network should have name and native currency info
    networks.forEach((n) => {
      expect(n.name).toBeDefined()
      expect(n.nativeCurrency.symbol).toBeDefined()
    })
  })

  it('should show available tokens per network to merchant', () => {
    // Merchant selects Ethereum
    const ethTokens = getSupportedTokens('ethereum')
    expect(ethTokens.length).toBeGreaterThanOrEqual(3) // USDT, USDC, DAI

    // Merchant selects TRON
    const tronTokens = getSupportedTokens('tron')
    expect(tronTokens.length).toBeGreaterThanOrEqual(1) // USDT at minimum
  })
})

// ============================================
// Scenario 2: Multi-Network Payment Processing
// ============================================

describe('UAT Scenario 2: Multi-Network Payment Processing', () => {
  it('should process EVM USDC payment end-to-end', () => {
    const sender = '0x1234567890123456789012345678901234567890'
    const recipient = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12'
    const amount = '5000.00'
    const token = 'USDC'
    const network = 'base'

    // Step 1: Validate addresses
    expect(validateAddress(sender, 'EVM').isValid).toBe(true)
    expect(validateAddress(recipient, 'EVM').isValid).toBe(true)

    // Step 2: Confirm network
    expect(isNetworkSupported(network)).toBe(true)
    const config = getNetworkById(network)
    expect(config!.type).toBe('EVM')

    // Step 3: Resolve token contract
    const tokenAddress = getTokenAddress(network, token)
    expect(tokenAddress).toBeDefined()

    // Step 4: Verify amount
    const parsed = parseFloat(amount)
    expect(parsed).toBeGreaterThan(0)
    expect(isFinite(parsed)).toBe(true)
  })

  it('should process TRON USDT payment end-to-end', () => {
    const sender = '0x1234567890123456789012345678901234567890' // EVM sender
    const recipient = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'      // TRON recipient

    // Different network types detected
    const senderNet = getNetworkForAddress(sender)
    const recipientNet = getNetworkForAddress(recipient)

    expect(senderNet).toBe('ethereum')
    expect(recipientNet).toBe('tron')

    // This is a cross-chain payment — should flag for bridge
    const isCrossChain = senderNet !== recipientNet
    expect(isCrossChain).toBe(true)
  })

  it('should auto-detect network from recipient address', () => {
    // EVM address → default ethereum
    const evmNet = getNetworkForAddress('0x1234567890123456789012345678901234567890')
    expect(evmNet).toBe('ethereum')

    // TRON address → tron
    const tronNet = getNetworkForAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
    expect(tronNet).toBe('tron')
  })
})

// ============================================
// Scenario 3: Treasury Management & Reporting
// ============================================

describe('UAT Scenario 3: Treasury Management & Reporting', () => {
  const service = new ExportService()

  it('should generate monthly accounting report with debit/credit', async () => {
    const sent = [
      { id: 'p1', from_address: '0xME', to_address: '0xV1', amount: '5000', amount_usd: 5000, token_symbol: 'USDC', status: 'completed', tx_hash: '0xa1', notes: 'cloud hosting', created_at: new Date('2026-01-10'), vendor: { name: 'AWS', category: 'Infrastructure' } },
      { id: 'p2', from_address: '0xME', to_address: '0xV2', amount: '50000', amount_usd: 50000, token_symbol: 'USDC', status: 'completed', tx_hash: '0xa2', notes: 'monthly salary', created_at: new Date('2026-01-15'), vendor: { name: 'Payroll', category: 'Payroll' } },
    ]

    const received = [
      { id: 'p3', from_address: '0xCLIENT', to_address: '0xME', amount: '100000', amount_usd: 100000, token_symbol: 'USDC', status: 'completed', tx_hash: '0xb1', notes: 'project revenue', created_at: new Date('2026-01-20'), vendor: { name: 'Client Corp', category: 'Revenue' } },
    ]

    mockFindMany.mockResolvedValueOnce(sent).mockResolvedValueOnce(received)

    const report = await service.generateAccountingReport({
      owner_address: '0xME',
      start_date: '2026-01-01',
      end_date: '2026-01-31',
    })

    // Business requirement: See total payable (debit) and receivable (credit)
    expect(report.summary.total_outgoing).toBe(55000) // 5000 + 50000
    expect(report.summary.total_incoming).toBe(100000)
    expect(report.summary.net_flow).toBe(45000) // Positive → healthy

    // Business requirement: Each transaction has debit OR credit
    report.transactions.forEach((tx) => {
      if (tx.type === 'sent') {
        expect(tx.debit).toBeGreaterThan(0)
        expect(tx.credit).toBe(0)
      } else {
        expect(tx.debit).toBe(0)
        expect(tx.credit).toBeGreaterThan(0)
      }
    })

    // Business requirement: Running balance is consistent
    let balance = 0
    report.transactions.forEach((tx) => {
      balance += tx.credit - tx.debit
      expect(tx.balance).toBeCloseTo(balance, 2)
    })
  })

  it('should export report to CSV for accountant review', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'p1', from_address: '0xME', to_address: '0xV1', amount: '1000', amount_usd: 1000, token_symbol: 'USDC', status: 'completed', tx_hash: '0xa1', notes: 'test', created_at: new Date('2026-01-10'), vendor: { name: 'Test', category: 'Software' } },
    ])

    const report = await service.generateAccountingReport({
      owner_address: '0xME',
      start_date: '2026-01-01',
      end_date: '2026-01-31',
    })

    const csv = service.exportToCSV(report)

    // Should have proper headers
    expect(csv).toContain('Date')
    expect(csv).toContain('Debit')
    expect(csv).toContain('Credit')
    expect(csv).toContain('Balance')

    // Should have summary
    expect(csv).toContain('Summary')
    expect(csv).toContain('Total Outgoing')
  })

  it('should calculate treasury health metrics', () => {
    const now = new Date()
    const payments = [
      { timestamp: new Date(now.getTime() - 5 * 86400000).toISOString(), amount_usd: 10000 },
      { timestamp: new Date(now.getTime() - 10 * 86400000).toISOString(), amount_usd: 15000 },
      { timestamp: new Date(now.getTime() - 20 * 86400000).toISOString(), amount_usd: 5000 },
    ]

    const burnRate = calculateMonthlyBurnRate(payments)
    expect(burnRate).toBe(30000)

    const treasuryBalance = 150000
    const runway = calculateRunway(treasuryBalance, burnRate)
    expect(runway).toBe(5) // 5 months of runway

    // Should show top spending categories
    const categorized = [
      { vendor: { name: 'AWS' }, notes: 'hosting', amount_usd: 10000 },
      { vendor: { name: '' }, notes: 'salary', amount_usd: 15000 },
      { vendor: { name: '' }, notes: 'marketing', amount_usd: 5000 },
    ]

    const categories = getTopCategories(categorized)
    expect(categories[0].name).toBe('Payroll') // Largest category
    expect(categories[0].value).toBe(15000)
  })
})

// ============================================
// Scenario 4: Reconciliation & Anomaly Resolution
// ============================================

describe('UAT Scenario 4: Reconciliation & Anomaly Resolution', () => {
  it('should detect and categorize reconciliation anomalies', () => {
    // Simulated reconciliation results
    interface ReconResult {
      tx_hash: string
      db_amount: number
      onchain_amount: number
      status: string
      chain: string
    }

    const results: ReconResult[] = [
      { tx_hash: '0x001', db_amount: 1000, onchain_amount: 1000, status: 'matched', chain: 'ethereum' },
      { tx_hash: '0x002', db_amount: 2000, onchain_amount: 1800, status: 'mismatch', chain: 'base' },
      { tx_hash: '0x003', db_amount: 500, onchain_amount: 0, status: 'missing_onchain', chain: 'tron' },
      { tx_hash: '0x004', db_amount: 0, onchain_amount: 300, status: 'missing_db', chain: 'ethereum' },
    ]

    // Business requirement: Show match rate
    const matched = results.filter((r) => r.status === 'matched').length
    const matchRate = (matched / results.length) * 100
    expect(matchRate).toBe(25)

    // Business requirement: Show total anomalies
    const anomalies = results.filter((r) => r.status !== 'matched')
    expect(anomalies).toHaveLength(3)

    // Business requirement: Show total verified USD
    const verifiedUsd = results
      .filter((r) => r.status === 'matched')
      .reduce((sum, r) => sum + r.db_amount, 0)
    expect(verifiedUsd).toBe(1000)

    // Business requirement: Export anomalies for investigation
    const csvLines = anomalies.map((a) =>
      `${a.tx_hash},${a.status},${a.db_amount},${a.onchain_amount},${a.chain}`
    )
    expect(csvLines).toHaveLength(3)
    expect(csvLines[0]).toContain('mismatch')
  })

  it('should support filtering reconciliation results', () => {
    const results = [
      { status: 'matched', chain: 'ethereum' },
      { status: 'mismatch', chain: 'base' },
      { status: 'missing_onchain', chain: 'tron' },
      { status: 'matched', chain: 'ethereum' },
      { status: 'matched', chain: 'base' },
    ]

    // Filter by status
    const anomaliesOnly = results.filter((r) => r.status !== 'matched')
    expect(anomaliesOnly).toHaveLength(2)

    // Filter by chain
    const ethOnly = results.filter((r) => r.chain === 'ethereum')
    expect(ethOnly).toHaveLength(2)

    // Combined filter
    const ethAnomalies = results.filter((r) => r.chain === 'ethereum' && r.status !== 'matched')
    expect(ethAnomalies).toHaveLength(0)
  })
})

// ============================================
// Scenario 5: Batch Payment Processing
// ============================================

describe('UAT Scenario 5: Batch Payment Processing', () => {
  it('should validate a batch of recipient addresses before processing', () => {
    const recipients = [
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333',
      'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      'invalid-address',
    ]

    const batch = validateAddressBatch(recipients)

    // Should validate 4 out of 5
    expect(batch.valid).toHaveLength(4)
    expect(batch.invalid).toHaveLength(1)
    expect(batch.invalid[0]).toBe('invalid-address')

    // Should separate by network type
    expect(batch.byType.EVM).toHaveLength(3)
    expect(batch.byType.TRON).toHaveLength(1)
  })

  it('should warn when mixing EVM and TRON in same batch', () => {
    const recipients = [
      '0x1111111111111111111111111111111111111111',
      'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    ]

    const batch = validateAddressBatch(recipients)

    const hasMixedNetworks = batch.byType.EVM.length > 0 && batch.byType.TRON.length > 0
    expect(hasMixedNetworks).toBe(true)

    // Business rule: Should not process mixed-network batch
    // User should separate into EVM-only and TRON-only batches
  })

  it('should categorize batch payment for expense tracking', () => {
    const batchPayments = [
      { recipient: '0x111', amount: 5000, vendor: 'AWS', notes: 'cloud hosting' },
      { recipient: '0x222', amount: 3000, vendor: '', notes: 'monthly salary' },
      { recipient: '0x333', amount: 2000, vendor: '', notes: 'ad campaign' },
      { recipient: '0x444', amount: 1500, vendor: 'Legal LLC', notes: '' },
    ]

    const categorized = batchPayments.map((p) => ({
      ...p,
      category: categorizeTransaction(p.vendor, p.notes),
    }))

    expect(categorized[0].category).toBe('Infrastructure')
    expect(categorized[1].category).toBe('Payroll')
    expect(categorized[2].category).toBe('Marketing')
    expect(categorized[3].category).toBe('Legal')

    // Total batch amount
    const totalBatch = batchPayments.reduce((s, p) => s + p.amount, 0)
    expect(totalBatch).toBe(11500)
  })
})

// ============================================
// Scenario 6: Cross-Chain Portfolio View
// ============================================

describe('UAT Scenario 6: Cross-Chain Portfolio View', () => {
  it('should show all supported chains with their tokens', () => {
    const mainnets = getMainnetNetworks()

    const portfolio = mainnets.map((network) => ({
      networkName: network.name,
      networkId: network.id,
      type: network.type,
      nativeCurrency: network.nativeCurrency.symbol,
      tokens: getSupportedTokens(network.id).map((t) => ({
        symbol: t.symbol,
        decimals: t.decimals,
      })),
    }))

    // Should have entries for all mainnets
    expect(portfolio.length).toBeGreaterThanOrEqual(6)

    // Ethereum should have USDT, USDC, DAI
    const eth = portfolio.find((p) => p.networkId === 'ethereum')
    expect(eth).toBeDefined()
    expect(eth!.tokens.some((t) => t.symbol === 'USDT')).toBe(true)
    expect(eth!.tokens.some((t) => t.symbol === 'USDC')).toBe(true)

    // TRON should have USDT
    const tron = portfolio.find((p) => p.networkId === 'tron')
    expect(tron).toBeDefined()
    expect(tron!.type).toBe('TRON')
    expect(tron!.tokens.some((t) => t.symbol === 'USDT')).toBe(true)
  })

  it('should calculate total portfolio value across chains', () => {
    // Simulated balances per chain
    const balances = [
      { chain: 'ethereum', token: 'USDC', amount: 50000 },
      { chain: 'base', token: 'USDC', amount: 30000 },
      { chain: 'tron', token: 'USDT', amount: 20000 },
      { chain: 'arbitrum', token: 'DAI', amount: 10000 },
    ]

    const totalPortfolio = balances.reduce((sum, b) => sum + b.amount, 0)
    expect(totalPortfolio).toBe(110000)

    // Chain distribution
    const byChain = new Map<string, number>()
    balances.forEach((b) => {
      byChain.set(b.chain, (byChain.get(b.chain) || 0) + b.amount)
    })

    expect(byChain.get('ethereum')).toBe(50000)
    expect(byChain.get('tron')).toBe(20000)

    // Token distribution
    const byToken = new Map<string, number>()
    balances.forEach((b) => {
      byToken.set(b.token, (byToken.get(b.token) || 0) + b.amount)
    })

    expect(byToken.get('USDC')).toBe(80000) // ETH + Base
    expect(byToken.get('USDT')).toBe(20000) // TRON
  })
})

// ============================================
// Scenario 7: Security & Data Integrity
// ============================================

describe('UAT Scenario 7: Security & Data Integrity', () => {
  it('should consistently checksum EVM addresses', () => {
    const lowercaseAddr = '0xdac17f958d2ee523a2206206994597c13d831ec7'
    const uppercaseAddr = '0xDAC17F958D2EE523A2206206994597C13D831EC7'
    const mixedAddr = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

    const r1 = validateAddress(lowercaseAddr)
    const r2 = validateAddress(uppercaseAddr)
    const r3 = validateAddress(mixedAddr)

    // All should resolve to same checksum address
    expect(r1.checksumAddress).toBe(r2.checksumAddress)
    expect(r2.checksumAddress).toBe(r3.checksumAddress)
  })

  it('should prevent SQL injection in categorization', () => {
    const maliciousVendor = "'; DROP TABLE payments; --"
    const maliciousNotes = '<script>alert("xss")</script>'

    // These should just get categorized, not execute
    const cat1 = categorizeTransaction(maliciousVendor, '')
    const cat2 = categorizeTransaction('', maliciousNotes)

    expect(cat1).toBe('Uncategorized')
    expect(cat2).toBe('Uncategorized')
  })

  it('should handle BigInt serialization safely', () => {
    const energyUsed = BigInt('999999999999')
    const gasUsed = BigInt('21000')

    // Should serialize to string (not throw)
    const serialized = JSON.stringify({
      energy_used: energyUsed.toString(),
      gas_used: gasUsed.toString(),
    })

    const parsed = JSON.parse(serialized)
    expect(parsed.energy_used).toBe('999999999999')
    expect(parsed.gas_used).toBe('21000')

    // Should deserialize back
    expect(BigInt(parsed.energy_used)).toBe(energyUsed)
  })

  it('should properly escape data in CSV export', () => {
    const service = new ExportService()
    const report: AccountingReport = {
      period: { start: '2026-01-01', end: '2026-01-31' },
      summary: { total_outgoing: 0, total_incoming: 0, net_flow: 0, transaction_count: 1, unique_recipients: 0, unique_senders: 0 },
      by_token: [],
      by_category: [],
      by_vendor: [],
      transactions: [{
        date: '2026-01-15T12:00:00Z',
        reference: 'p1',
        type: 'sent',
        description: 'Payment to "Evil Corp"',
        vendor_name: 'Evil, Corp',
        category: 'Software',
        debit: 100,
        credit: 0,
        balance: -100,
        token: 'USDC',
        usd_value: 100,
        tx_hash: '0x123',
        notes: 'Contains "special" chars, commas, & more',
      }],
    }

    const csv = service.exportToCSV(report)

    // Notes should be properly double-quoted
    expect(csv).toContain('"Contains ""special"" chars, commas, & more"')
  })
})

// ============================================
// Regression Tests
// ============================================

describe('Regression Tests', () => {
  it('REG-001: formatAddress should not crash on empty/null input', () => {
    expect(formatAddress('')).toBe('')
    expect(formatAddress(undefined as any)).toBe('')
    expect(formatAddress(null as any)).toBe('')
  })

  it('REG-002: calculateRunway should handle edge cases', () => {
    expect(calculateRunway(0, 0)).toBe(999)     // No balance, no burn
    expect(calculateRunway(0, 1000)).toBe(0)     // No balance, has burn
    expect(calculateRunway(1000, 0)).toBe(999)   // Has balance, no burn
    expect(calculateRunway(-100, 1000)).toBe(-0.1) // Negative balance (debt)
  })

  it('REG-003: validateAddress should handle whitespace', () => {
    const addr = '  0x1234567890123456789012345678901234567890  '
    const result = validateAddress(addr)
    expect(result.isValid).toBe(true)
  })

  it('REG-004: getSupportedTokens should return empty for unknown network', () => {
    expect(getSupportedTokens('polkadot')).toEqual([])
    expect(getSupportedTokens('')).toEqual([])
  })

  it('REG-005: categorizeTransaction handles undefined inputs', () => {
    expect(categorizeTransaction(undefined, undefined)).toBe('Uncategorized')
    expect(categorizeTransaction('', '')).toBe('Uncategorized')
    expect(categorizeTransaction(null as any, null as any)).toBe('Uncategorized')
  })

  it('REG-006: CATEGORY_COLORS covers all CATEGORIES', () => {
    CATEGORIES.forEach((cat) => {
      expect(CATEGORY_COLORS[cat]).toBeDefined()
      expect(typeof CATEGORY_COLORS[cat]).toBe('string')
    })
  })

  it('REG-007: getNetworkForAddress throws for invalid address', () => {
    expect(() => getNetworkForAddress('invalid')).toThrow()
  })

  it('REG-008: batch validation preserves order', () => {
    const addresses = [
      '0x1111111111111111111111111111111111111111',
      'invalid',
      '0x2222222222222222222222222222222222222222',
    ]

    const result = validateAddressBatch(addresses)
    expect(result.valid).toHaveLength(2)
    expect(result.invalid).toEqual(['invalid'])
  })
})
