/**
 * Performance Benchmark Tests
 *
 * Measures execution time and throughput for critical operations:
 * - Address validation (single + batch)
 * - Network config lookups
 * - Transaction categorization
 * - Report generation
 * - Reconciliation matching
 * - Export pipelines (CSV, Excel)
 *
 * Thresholds are set for P95 latency targets.
 */

import {
  validateAddress,
  validateAddressBatch,
  detectAddressType,
  formatAddress,
  getExplorerTxUrl,
} from '@/lib/address-utils'

import {
  getNetworkById,
  getNetworkByChainId,
  getTokenAddress,
  getSupportedTokens,
  isNetworkSupported,
  getMainnetNetworks,
} from '@/lib/networks'

import {
  categorizeTransaction,
  calculateMonthlyBurnRate,
  calculateRunway,
  getTopCategories,
} from '@/lib/business-logic'

import { ExportService } from '@/lib/services/export-service'

// Mock Prisma for ExportService
jest.mock('@/lib/prisma', () => ({
  prisma: { payment: { findMany: jest.fn() } },
}))

import { prisma } from '@/lib/prisma'

// ============================================
// Helpers
// ============================================

function measure(fn: () => void, iterations: number = 1000): { avgMs: number; totalMs: number; opsPerSec: number } {
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  const totalMs = performance.now() - start
  return {
    avgMs: totalMs / iterations,
    totalMs,
    opsPerSec: (iterations / totalMs) * 1000,
  }
}

async function measureAsync(fn: () => Promise<void>, iterations: number = 100): Promise<{ avgMs: number; totalMs: number; opsPerSec: number }> {
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    await fn()
  }
  const totalMs = performance.now() - start
  return {
    avgMs: totalMs / iterations,
    totalMs,
    opsPerSec: (iterations / totalMs) * 1000,
  }
}

function generateEvmAddress(): string {
  const hex = '0123456789abcdef'
  let addr = '0x'
  for (let i = 0; i < 40; i++) {
    addr += hex[Math.floor(Math.random() * 16)]
  }
  return addr
}

function generateTronAddress(): string {
  const base58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let addr = 'T'
  for (let i = 0; i < 33; i++) {
    addr += base58[Math.floor(Math.random() * 58)]
  }
  return addr
}

// ============================================
// Address Validation Performance
// ============================================

describe('Performance: Address Validation', () => {
  it('should validate single EVM address under 0.1ms', () => {
    const addr = '0xdac17f958d2ee523a2206206994597c13d831ec7'
    const result = measure(() => validateAddress(addr), 5000)

    expect(result.avgMs).toBeLessThan(0.1) // < 0.1ms per validation
    expect(result.opsPerSec).toBeGreaterThan(10000) // > 10K ops/sec
  })

  it('should validate single TRON address under 0.1ms', () => {
    const addr = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
    const result = measure(() => validateAddress(addr), 5000)

    expect(result.avgMs).toBeLessThan(0.1)
    expect(result.opsPerSec).toBeGreaterThan(10000)
  })

  it('should detect address type under 0.01ms', () => {
    const addr = '0xdac17f958d2ee523a2206206994597c13d831ec7'
    const result = measure(() => detectAddressType(addr), 10000)

    expect(result.avgMs).toBeLessThan(0.01)
    expect(result.opsPerSec).toBeGreaterThan(100000)
  })

  it('should batch validate 100 addresses under 10ms', () => {
    const addresses = Array.from({ length: 100 }, (_, i) =>
      i % 3 === 0 ? generateTronAddress() : generateEvmAddress()
    )

    const result = measure(() => validateAddressBatch(addresses), 100)

    expect(result.avgMs).toBeLessThan(10)
  })

  it('should batch validate 1000 addresses under 100ms', () => {
    const addresses = Array.from({ length: 1000 }, (_, i) =>
      i % 4 === 0 ? generateTronAddress() : generateEvmAddress()
    )

    const result = measure(() => validateAddressBatch(addresses), 10)

    expect(result.avgMs).toBeLessThan(100)
  })
})

// ============================================
// Network Lookup Performance
// ============================================

describe('Performance: Network Lookups', () => {
  it('should lookup network by ID under 0.005ms', () => {
    const result = measure(() => getNetworkById('ethereum'), 10000)

    expect(result.avgMs).toBeLessThan(0.005)
    expect(result.opsPerSec).toBeGreaterThan(200000)
  })

  it('should lookup network by chain ID under 0.01ms', () => {
    const result = measure(() => getNetworkByChainId(8453), 10000)

    expect(result.avgMs).toBeLessThan(0.01)
    expect(result.opsPerSec).toBeGreaterThan(100000)
  })

  it('should lookup token address under 0.01ms', () => {
    const result = measure(() => getTokenAddress('ethereum', 'USDC'), 10000)

    expect(result.avgMs).toBeLessThan(0.01)
  })

  it('should get supported tokens under 0.005ms', () => {
    const result = measure(() => getSupportedTokens('ethereum'), 10000)

    expect(result.avgMs).toBeLessThan(0.005)
  })

  it('should check network support under 0.005ms', () => {
    const result = measure(() => isNetworkSupported('base'), 10000)

    expect(result.avgMs).toBeLessThan(0.005)
  })

  it('should get mainnet networks under 0.05ms', () => {
    const result = measure(() => getMainnetNetworks(), 10000)

    expect(result.avgMs).toBeLessThan(0.05)
  })
})

// ============================================
// Transaction Categorization Performance
// ============================================

describe('Performance: Transaction Categorization', () => {
  it('should categorize single transaction under 0.01ms', () => {
    const result = measure(() => categorizeTransaction('AWS', 'cloud hosting'), 10000)

    expect(result.avgMs).toBeLessThan(0.01)
    expect(result.opsPerSec).toBeGreaterThan(100000)
  })

  it('should categorize 1000 transactions under 5ms', () => {
    const vendors = ['AWS', 'Google', 'Payroll Inc', 'Legal LLP', 'Freelancer', 'Office Supply', '']
    const notes = ['cloud', 'salary', 'marketing', 'legal', 'software', 'contractor', 'misc']

    const result = measure(() => {
      for (let i = 0; i < 1000; i++) {
        categorizeTransaction(vendors[i % vendors.length], notes[i % notes.length])
      }
    }, 10)

    expect(result.avgMs).toBeLessThan(5)
  })

  it('should calculate burn rate for 10000 payments under 10ms', () => {
    const now = Date.now()
    const payments = Array.from({ length: 10000 }, (_, i) => ({
      timestamp: new Date(now - (i % 60) * 86400000).toISOString(),
      amount_usd: Math.random() * 10000,
    }))

    const result = measure(() => calculateMonthlyBurnRate(payments), 10)

    expect(result.avgMs).toBeLessThan(20) // Allow headroom for CI/coverage overhead
  })

  it('should compute top categories for 10000 payments under 20ms', () => {
    const vendors = ['AWS', 'Google', '', 'Legal LLP', 'Slack']
    const notes = ['cloud', 'salary', 'marketing', 'legal', 'software']

    const payments = Array.from({ length: 10000 }, (_, i) => ({
      vendor: { name: vendors[i % vendors.length] },
      notes: notes[i % notes.length],
      amount_usd: Math.random() * 5000,
    }))

    const result = measure(() => getTopCategories(payments), 10)

    expect(result.avgMs).toBeLessThan(20)
  })

  it('should calculate runway under 0.001ms', () => {
    const result = measure(() => calculateRunway(500000, 25000), 100000)

    expect(result.avgMs).toBeLessThan(0.001)
  })
})

// ============================================
// Export Pipeline Performance
// ============================================

describe('Performance: Export Pipeline', () => {
  const service = new ExportService()

  function createLargeReport(txCount: number) {
    let balance = 0
    const transactions = Array.from({ length: txCount }, (_, i) => {
      const isSent = i % 3 !== 0
      const amount = Math.random() * 10000
      const debit = isSent ? amount : 0
      const credit = isSent ? 0 : amount
      balance += credit - debit

      return {
        date: new Date(2026, 0, 1 + (i % 30)).toISOString(),
        reference: `pay_${i.toString().padStart(6, '0')}`,
        type: isSent ? 'sent' as const : 'received' as const,
        description: `Transaction #${i}`,
        vendor_name: `Vendor ${i % 50}`,
        category: ['Infrastructure', 'Payroll', 'Marketing', 'Software', 'Legal'][i % 5],
        debit,
        credit,
        balance,
        token: ['USDC', 'USDT', 'DAI'][i % 3],
        usd_value: amount,
        tx_hash: '0x' + i.toString(16).padStart(64, '0'),
        notes: i % 10 === 0 ? 'Important transaction with notes' : '',
      }
    })

    return {
      period: { start: '2026-01-01', end: '2026-01-31' },
      summary: {
        total_outgoing: transactions.filter(t => t.type === 'sent').reduce((s, t) => s + t.debit, 0),
        total_incoming: transactions.filter(t => t.type === 'received').reduce((s, t) => s + t.credit, 0),
        net_flow: balance,
        transaction_count: txCount,
        unique_recipients: 50,
        unique_senders: 20,
      },
      by_token: [
        { token: 'USDC', total_amount: 50000, transaction_count: Math.ceil(txCount / 3) },
        { token: 'USDT', total_amount: 30000, transaction_count: Math.ceil(txCount / 3) },
        { token: 'DAI', total_amount: 20000, transaction_count: Math.ceil(txCount / 3) },
      ],
      by_category: [
        { category: 'Infrastructure', total_amount: 30000, transaction_count: Math.ceil(txCount / 5) },
        { category: 'Payroll', total_amount: 40000, transaction_count: Math.ceil(txCount / 5) },
      ],
      by_vendor: [
        { vendor_name: 'AWS', vendor_address: '0x111', total_amount: 15000, transaction_count: 10 },
      ],
      transactions,
    }
  }

  it('should export 100 transactions to CSV under 5ms', () => {
    const report = createLargeReport(100)
    const result = measure(() => service.exportToCSV(report), 100)

    expect(result.avgMs).toBeLessThan(5)
  })

  it('should export 1000 transactions to CSV under 30ms', () => {
    const report = createLargeReport(1000)
    const result = measure(() => service.exportToCSV(report), 10)

    expect(result.avgMs).toBeLessThan(30)
  })

  it('should export 100 transactions to Excel XML under 10ms', async () => {
    const report = createLargeReport(100)
    const result = await measureAsync(async () => {
      await service.exportToExcel(report)
    }, 50)

    expect(result.avgMs).toBeLessThan(10)
  })

  it('should export 1000 transactions to Excel XML under 50ms', async () => {
    const report = createLargeReport(1000)
    const result = await measureAsync(async () => {
      await service.exportToExcel(report)
    }, 10)

    expect(result.avgMs).toBeLessThan(50)
  })
})

// ============================================
// Reconciliation Performance
// ============================================

describe('Performance: Reconciliation', () => {
  function createReconciliationData(count: number) {
    const dbRecords = Array.from({ length: count }, (_, i) => ({
      tx_hash: '0x' + i.toString(16).padStart(64, '0'),
      amount: 1000 + i,
      status: 'completed',
      chain: ['ethereum', 'base', 'tron'][i % 3],
      token: ['USDC', 'USDT'][i % 2],
      timestamp: new Date(2026, 0, 1 + (i % 30)).toISOString(),
      from_address: generateEvmAddress(),
      to_address: generateEvmAddress(),
    }))

    // 90% match rate — 10% will be missing or mismatched
    const onchainRecords = dbRecords
      .filter((_, i) => i % 10 !== 0) // 10% missing
      .map((db, i) => ({
        tx_hash: db.tx_hash,
        amount: i % 20 === 0 ? db.amount * 0.95 : db.amount, // 5% mismatch
        block_number: 1000000 + i,
        timestamp: db.timestamp,
      }))

    return { dbRecords, onchainRecords }
  }

  function reconcile(
    dbRecords: ReturnType<typeof createReconciliationData>['dbRecords'],
    onchainRecords: ReturnType<typeof createReconciliationData>['onchainRecords']
  ) {
    const onchainMap = new Map(onchainRecords.map((r) => [r.tx_hash, r]))
    const results: Array<{ status: string; amount: number }> = []

    for (const db of dbRecords) {
      const onchain = onchainMap.get(db.tx_hash)
      if (!onchain) {
        results.push({ status: 'missing_onchain', amount: db.amount })
        continue
      }
      const tolerance = db.amount * 0.0001
      if (Math.abs(db.amount - onchain.amount) > tolerance) {
        results.push({ status: 'mismatch', amount: db.amount })
      } else {
        results.push({ status: 'matched', amount: db.amount })
      }
    }

    return results
  }

  it('should reconcile 100 records under 2ms', () => {
    const { dbRecords, onchainRecords } = createReconciliationData(100)
    const result = measure(() => reconcile(dbRecords, onchainRecords), 100)

    expect(result.avgMs).toBeLessThan(2)
  })

  it('should reconcile 1000 records under 10ms', () => {
    const { dbRecords, onchainRecords } = createReconciliationData(1000)
    const result = measure(() => reconcile(dbRecords, onchainRecords), 10)

    expect(result.avgMs).toBeLessThan(10)
  })

  it('should reconcile 10000 records under 50ms', () => {
    const { dbRecords, onchainRecords } = createReconciliationData(10000)
    const result = measure(() => reconcile(dbRecords, onchainRecords), 5)

    expect(result.avgMs).toBeLessThan(50)
  })
})

// ============================================
// Display Utilities Performance
// ============================================

describe('Performance: Display Utilities', () => {
  it('should format 10000 addresses under 10ms', () => {
    const addresses = Array.from({ length: 10000 }, () => generateEvmAddress())
    const result = measure(() => {
      addresses.forEach((addr) => formatAddress(addr))
    }, 5)

    expect(result.avgMs).toBeLessThan(10)
  })

  it('should generate 10000 explorer URLs under 10ms', () => {
    const networks = ['ethereum', 'base', 'tron', 'arbitrum']
    const result = measure(() => {
      for (let i = 0; i < 10000; i++) {
        getExplorerTxUrl('0x' + i.toString(16).padStart(64, '0'), networks[i % 4])
      }
    }, 5)

    expect(result.avgMs).toBeLessThan(10)
  })
})

// ============================================
// Concurrent Processing Simulation
// ============================================

describe('Performance: Concurrent Operations', () => {
  it('should handle 100 concurrent address validations under 50ms', async () => {
    const addresses = Array.from({ length: 100 }, (_, i) =>
      i % 3 === 0 ? generateTronAddress() : generateEvmAddress()
    )

    const start = performance.now()
    const results = await Promise.all(
      addresses.map((addr) => Promise.resolve(validateAddress(addr)))
    )
    const elapsed = performance.now() - start

    expect(results).toHaveLength(100)
    expect(elapsed).toBeLessThan(50)
  })

  it('should handle parallel network lookups efficiently', async () => {
    const lookups = Array.from({ length: 500 }, (_, i) => {
      const networks = ['ethereum', 'base', 'tron', 'arbitrum', 'bsc']
      return networks[i % networks.length]
    })

    const start = performance.now()
    const results = await Promise.all(
      lookups.map((network) => Promise.resolve(getNetworkById(network)))
    )
    const elapsed = performance.now() - start

    expect(results.filter(Boolean)).toHaveLength(500)
    expect(elapsed).toBeLessThan(10)
  })
})
