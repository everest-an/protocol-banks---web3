/**
 * E2E Tests — Reconciliation Logic
 *
 * Tests the on-chain vs database record reconciliation pipeline
 * including anomaly detection, matching algorithms, and report generation.
 */

import { validateAddress, getNetworkForAddress } from '@/lib/address-utils'
import { getNetworkById } from '@/lib/networks'

// ============================================
// Reconciliation Types (mirrored from page)
// ============================================

type ReconciliationStatus = 'matched' | 'mismatch' | 'missing_onchain' | 'missing_db' | 'duplicate' | 'timeout' | 'unknown_sender'

interface ReconciliationRecord {
  id: string
  tx_hash: string
  db_amount: number
  onchain_amount: number
  status: ReconciliationStatus
  chain: string
  token: string
  timestamp: string
  from_address: string
  to_address: string
  details?: string
}

interface ReconciliationSummary {
  total_records: number
  matched: number
  anomalies: number
  match_rate: number
  total_verified_usd: number
  unmatched_usd: number
}

// ============================================
// Reconciliation Engine (pure logic)
// ============================================

function reconcileRecords(
  dbRecords: Array<{ tx_hash: string; amount: number; status: string; chain: string; token: string; timestamp: string; from_address: string; to_address: string }>,
  onchainRecords: Array<{ tx_hash: string; amount: number; block_number: number; timestamp: string }>
): ReconciliationRecord[] {
  const onchainMap = new Map(onchainRecords.map((r) => [r.tx_hash, r]))
  const matchedOnchain = new Set<string>()
  const results: ReconciliationRecord[] = []

  // Match DB records against on-chain
  for (const db of dbRecords) {
    const onchain = onchainMap.get(db.tx_hash)

    if (!onchain) {
      results.push({
        id: `recon_${results.length}`,
        tx_hash: db.tx_hash,
        db_amount: db.amount,
        onchain_amount: 0,
        status: 'missing_onchain',
        chain: db.chain,
        token: db.token,
        timestamp: db.timestamp,
        from_address: db.from_address,
        to_address: db.to_address,
        details: 'Transaction exists in database but not found on-chain',
      })
      continue
    }

    matchedOnchain.add(db.tx_hash)

    // Check for amount mismatch (tolerance: 0.01%)
    const tolerance = db.amount * 0.0001
    const amountDiff = Math.abs(db.amount - onchain.amount)

    if (amountDiff > tolerance) {
      results.push({
        id: `recon_${results.length}`,
        tx_hash: db.tx_hash,
        db_amount: db.amount,
        onchain_amount: onchain.amount,
        status: 'mismatch',
        chain: db.chain,
        token: db.token,
        timestamp: db.timestamp,
        from_address: db.from_address,
        to_address: db.to_address,
        details: `Amount mismatch: DB=$${db.amount.toFixed(2)} vs On-chain=$${onchain.amount.toFixed(2)} (diff: $${amountDiff.toFixed(2)})`,
      })
    } else {
      results.push({
        id: `recon_${results.length}`,
        tx_hash: db.tx_hash,
        db_amount: db.amount,
        onchain_amount: onchain.amount,
        status: 'matched',
        chain: db.chain,
        token: db.token,
        timestamp: db.timestamp,
        from_address: db.from_address,
        to_address: db.to_address,
      })
    }
  }

  // Find on-chain records not in DB (missing_db)
  for (const onchain of onchainRecords) {
    if (!matchedOnchain.has(onchain.tx_hash)) {
      results.push({
        id: `recon_${results.length}`,
        tx_hash: onchain.tx_hash,
        db_amount: 0,
        onchain_amount: onchain.amount,
        status: 'missing_db',
        chain: 'unknown',
        token: 'unknown',
        timestamp: onchain.timestamp,
        from_address: 'unknown',
        to_address: 'unknown',
        details: 'Transaction found on-chain but missing from database',
      })
    }
  }

  return results
}

function calculateSummary(records: ReconciliationRecord[]): ReconciliationSummary {
  const matched = records.filter((r) => r.status === 'matched').length
  const anomalies = records.filter((r) => r.status !== 'matched').length
  const totalVerified = records
    .filter((r) => r.status === 'matched')
    .reduce((sum, r) => sum + r.db_amount, 0)
  const unmatched = records
    .filter((r) => r.status !== 'matched')
    .reduce((sum, r) => sum + Math.max(r.db_amount, r.onchain_amount), 0)

  return {
    total_records: records.length,
    matched,
    anomalies,
    match_rate: records.length > 0 ? (matched / records.length) * 100 : 0,
    total_verified_usd: totalVerified,
    unmatched_usd: unmatched,
  }
}

function detectDuplicates(records: ReconciliationRecord[]): ReconciliationRecord[] {
  const txHashCount = new Map<string, number>()

  records.forEach((r) => {
    txHashCount.set(r.tx_hash, (txHashCount.get(r.tx_hash) || 0) + 1)
  })

  return records.map((r) => {
    if ((txHashCount.get(r.tx_hash) || 0) > 1) {
      return { ...r, status: 'duplicate' as ReconciliationStatus, details: 'Duplicate transaction hash detected' }
    }
    return r
  })
}

function exportAnomaliesCSV(records: ReconciliationRecord[]): string {
  const anomalies = records.filter((r) => r.status !== 'matched')
  if (anomalies.length === 0) return ''

  const headers = ['TX Hash', 'Status', 'DB Amount', 'On-chain Amount', 'Chain', 'Token', 'Timestamp', 'Details']
  const rows = anomalies.map((r) => [
    r.tx_hash,
    r.status,
    r.db_amount.toFixed(2),
    r.onchain_amount.toFixed(2),
    r.chain,
    r.token,
    r.timestamp,
    `"${(r.details || '').replace(/"/g, '""')}"`,
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

// ============================================
// Tests
// ============================================

describe('Reconciliation Engine', () => {
  describe('reconcileRecords', () => {
    it('should match identical records', () => {
      const dbRecords = [
        {
          tx_hash: '0x' + 'a'.repeat(64),
          amount: 1000,
          status: 'completed',
          chain: 'ethereum',
          token: 'USDC',
          timestamp: '2026-01-15T12:00:00Z',
          from_address: '0x1234567890123456789012345678901234567890',
          to_address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        },
      ]

      const onchainRecords = [
        {
          tx_hash: '0x' + 'a'.repeat(64),
          amount: 1000,
          block_number: 12345678,
          timestamp: '2026-01-15T12:00:00Z',
        },
      ]

      const results = reconcileRecords(dbRecords, onchainRecords)
      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('matched')
      expect(results[0].db_amount).toBe(1000)
      expect(results[0].onchain_amount).toBe(1000)
    })

    it('should detect amount mismatches', () => {
      const dbRecords = [
        {
          tx_hash: '0x' + 'b'.repeat(64),
          amount: 1000,
          status: 'completed',
          chain: 'ethereum',
          token: 'USDC',
          timestamp: '2026-01-15T12:00:00Z',
          from_address: '0x1234567890123456789012345678901234567890',
          to_address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        },
      ]

      const onchainRecords = [
        {
          tx_hash: '0x' + 'b'.repeat(64),
          amount: 950, // Different amount
          block_number: 12345678,
          timestamp: '2026-01-15T12:00:00Z',
        },
      ]

      const results = reconcileRecords(dbRecords, onchainRecords)
      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('mismatch')
      expect(results[0].details).toContain('Amount mismatch')
      expect(results[0].details).toContain('$50.00')
    })

    it('should allow tiny amount differences within tolerance', () => {
      const dbRecords = [
        {
          tx_hash: '0x' + 'c'.repeat(64),
          amount: 10000,
          status: 'completed',
          chain: 'ethereum',
          token: 'USDC',
          timestamp: '2026-01-15T12:00:00Z',
          from_address: '0x1234567890123456789012345678901234567890',
          to_address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        },
      ]

      const onchainRecords = [
        {
          tx_hash: '0x' + 'c'.repeat(64),
          amount: 10000.5, // Within 0.01% tolerance of 10000 ($1)
          block_number: 12345678,
          timestamp: '2026-01-15T12:00:00Z',
        },
      ]

      const results = reconcileRecords(dbRecords, onchainRecords)
      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('matched')
    })

    it('should detect missing on-chain records', () => {
      const dbRecords = [
        {
          tx_hash: '0x' + 'd'.repeat(64),
          amount: 500,
          status: 'completed',
          chain: 'ethereum',
          token: 'USDC',
          timestamp: '2026-01-15T12:00:00Z',
          from_address: '0x1234567890123456789012345678901234567890',
          to_address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        },
      ]

      const results = reconcileRecords(dbRecords, [])
      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('missing_onchain')
      expect(results[0].details).toContain('not found on-chain')
    })

    it('should detect on-chain records missing from DB', () => {
      const onchainRecords = [
        {
          tx_hash: '0x' + 'e'.repeat(64),
          amount: 2000,
          block_number: 12345678,
          timestamp: '2026-01-15T12:00:00Z',
        },
      ]

      const results = reconcileRecords([], onchainRecords)
      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('missing_db')
      expect(results[0].details).toContain('missing from database')
    })

    it('should handle mixed results', () => {
      const dbRecords = [
        {
          tx_hash: '0x' + '1'.repeat(64),
          amount: 1000,
          status: 'completed',
          chain: 'ethereum',
          token: 'USDC',
          timestamp: '2026-01-10T12:00:00Z',
          from_address: '0x1234567890123456789012345678901234567890',
          to_address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        },
        {
          tx_hash: '0x' + '2'.repeat(64),
          amount: 2000,
          status: 'completed',
          chain: 'base',
          token: 'USDC',
          timestamp: '2026-01-12T12:00:00Z',
          from_address: '0x1234567890123456789012345678901234567890',
          to_address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        },
        {
          tx_hash: '0x' + '3'.repeat(64),
          amount: 3000,
          status: 'completed',
          chain: 'tron',
          token: 'USDT',
          timestamp: '2026-01-15T12:00:00Z',
          from_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          to_address: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
        },
      ]

      const onchainRecords = [
        { tx_hash: '0x' + '1'.repeat(64), amount: 1000, block_number: 100, timestamp: '2026-01-10T12:00:00Z' },
        { tx_hash: '0x' + '2'.repeat(64), amount: 1800, block_number: 101, timestamp: '2026-01-12T12:00:00Z' }, // mismatch
        // tx_hash 3 is missing
        { tx_hash: '0x' + '4'.repeat(64), amount: 500, block_number: 102, timestamp: '2026-01-18T12:00:00Z' }, // extra
      ]

      const results = reconcileRecords(dbRecords, onchainRecords)
      expect(results).toHaveLength(4)

      const matched = results.filter((r) => r.status === 'matched')
      const mismatched = results.filter((r) => r.status === 'mismatch')
      const missingOnchain = results.filter((r) => r.status === 'missing_onchain')
      const missingDb = results.filter((r) => r.status === 'missing_db')

      expect(matched).toHaveLength(1)
      expect(mismatched).toHaveLength(1)
      expect(missingOnchain).toHaveLength(1)
      expect(missingDb).toHaveLength(1)
    })

    it('should handle empty inputs', () => {
      expect(reconcileRecords([], [])).toHaveLength(0)
    })
  })
})

// ============================================
// Summary Calculation
// ============================================

describe('Reconciliation Summary', () => {
  describe('calculateSummary', () => {
    it('should calculate correct summary for mixed results', () => {
      const records: ReconciliationRecord[] = [
        { id: '1', tx_hash: '0x1', db_amount: 1000, onchain_amount: 1000, status: 'matched', chain: 'ethereum', token: 'USDC', timestamp: '', from_address: '', to_address: '' },
        { id: '2', tx_hash: '0x2', db_amount: 2000, onchain_amount: 2000, status: 'matched', chain: 'ethereum', token: 'USDC', timestamp: '', from_address: '', to_address: '' },
        { id: '3', tx_hash: '0x3', db_amount: 500, onchain_amount: 400, status: 'mismatch', chain: 'base', token: 'USDC', timestamp: '', from_address: '', to_address: '' },
        { id: '4', tx_hash: '0x4', db_amount: 300, onchain_amount: 0, status: 'missing_onchain', chain: 'tron', token: 'USDT', timestamp: '', from_address: '', to_address: '' },
      ]

      const summary = calculateSummary(records)

      expect(summary.total_records).toBe(4)
      expect(summary.matched).toBe(2)
      expect(summary.anomalies).toBe(2)
      expect(summary.match_rate).toBe(50)
      expect(summary.total_verified_usd).toBe(3000)
      expect(summary.unmatched_usd).toBe(800) // 500 + 300
    })

    it('should handle 100% match rate', () => {
      const records: ReconciliationRecord[] = [
        { id: '1', tx_hash: '0x1', db_amount: 1000, onchain_amount: 1000, status: 'matched', chain: 'ethereum', token: 'USDC', timestamp: '', from_address: '', to_address: '' },
        { id: '2', tx_hash: '0x2', db_amount: 2000, onchain_amount: 2000, status: 'matched', chain: 'base', token: 'USDC', timestamp: '', from_address: '', to_address: '' },
      ]

      const summary = calculateSummary(records)
      expect(summary.match_rate).toBe(100)
      expect(summary.anomalies).toBe(0)
    })

    it('should handle 0% match rate', () => {
      const records: ReconciliationRecord[] = [
        { id: '1', tx_hash: '0x1', db_amount: 1000, onchain_amount: 0, status: 'missing_onchain', chain: 'ethereum', token: 'USDC', timestamp: '', from_address: '', to_address: '' },
      ]

      const summary = calculateSummary(records)
      expect(summary.match_rate).toBe(0)
      expect(summary.total_verified_usd).toBe(0)
    })

    it('should handle empty records', () => {
      const summary = calculateSummary([])
      expect(summary.total_records).toBe(0)
      expect(summary.match_rate).toBe(0)
      expect(summary.total_verified_usd).toBe(0)
    })
  })
})

// ============================================
// Duplicate Detection
// ============================================

describe('Duplicate Detection', () => {
  describe('detectDuplicates', () => {
    it('should mark duplicate tx hashes', () => {
      const records: ReconciliationRecord[] = [
        { id: '1', tx_hash: '0x' + 'a'.repeat(64), db_amount: 1000, onchain_amount: 1000, status: 'matched', chain: 'ethereum', token: 'USDC', timestamp: '', from_address: '', to_address: '' },
        { id: '2', tx_hash: '0x' + 'a'.repeat(64), db_amount: 1000, onchain_amount: 1000, status: 'matched', chain: 'ethereum', token: 'USDC', timestamp: '', from_address: '', to_address: '' },
        { id: '3', tx_hash: '0x' + 'b'.repeat(64), db_amount: 2000, onchain_amount: 2000, status: 'matched', chain: 'base', token: 'USDC', timestamp: '', from_address: '', to_address: '' },
      ]

      const result = detectDuplicates(records)
      expect(result[0].status).toBe('duplicate')
      expect(result[1].status).toBe('duplicate')
      expect(result[2].status).toBe('matched') // unique hash, stays matched
    })

    it('should not flag unique tx hashes', () => {
      const records: ReconciliationRecord[] = [
        { id: '1', tx_hash: '0x' + 'a'.repeat(64), db_amount: 1000, onchain_amount: 1000, status: 'matched', chain: 'ethereum', token: 'USDC', timestamp: '', from_address: '', to_address: '' },
        { id: '2', tx_hash: '0x' + 'b'.repeat(64), db_amount: 2000, onchain_amount: 2000, status: 'matched', chain: 'base', token: 'USDC', timestamp: '', from_address: '', to_address: '' },
      ]

      const result = detectDuplicates(records)
      expect(result.every((r) => r.status === 'matched')).toBe(true)
    })
  })
})

// ============================================
// Anomaly Export
// ============================================

describe('Anomaly Export', () => {
  describe('exportAnomaliesCSV', () => {
    it('should generate CSV for anomalies only', () => {
      const records: ReconciliationRecord[] = [
        { id: '1', tx_hash: '0xaaa', db_amount: 1000, onchain_amount: 1000, status: 'matched', chain: 'ethereum', token: 'USDC', timestamp: '2026-01-15', from_address: '0x1', to_address: '0x2' },
        { id: '2', tx_hash: '0xbbb', db_amount: 500, onchain_amount: 400, status: 'mismatch', chain: 'base', token: 'USDC', timestamp: '2026-01-16', from_address: '0x3', to_address: '0x4', details: 'Amount mismatch' },
        { id: '3', tx_hash: '0xccc', db_amount: 300, onchain_amount: 0, status: 'missing_onchain', chain: 'tron', token: 'USDT', timestamp: '2026-01-17', from_address: 'T1', to_address: 'T2', details: 'Not found on-chain' },
      ]

      const csv = exportAnomaliesCSV(records)
      const lines = csv.split('\n')

      // Header + 2 anomaly rows (matched is excluded)
      expect(lines).toHaveLength(3)
      expect(lines[0]).toContain('TX Hash')
      expect(lines[0]).toContain('Status')
      expect(lines[1]).toContain('0xbbb')
      expect(lines[1]).toContain('mismatch')
      expect(lines[2]).toContain('0xccc')
      expect(lines[2]).toContain('missing_onchain')
    })

    it('should return empty string when no anomalies', () => {
      const records: ReconciliationRecord[] = [
        { id: '1', tx_hash: '0xaaa', db_amount: 1000, onchain_amount: 1000, status: 'matched', chain: 'ethereum', token: 'USDC', timestamp: '', from_address: '', to_address: '' },
      ]

      expect(exportAnomaliesCSV(records)).toBe('')
    })

    it('should handle special characters in details', () => {
      const records: ReconciliationRecord[] = [
        {
          id: '1',
          tx_hash: '0xaaa',
          db_amount: 100,
          onchain_amount: 0,
          status: 'missing_onchain',
          chain: 'ethereum',
          token: 'USDC',
          timestamp: '2026-01-15',
          from_address: '0x1',
          to_address: '0x2',
          details: 'Contains "quotes" and, commas',
        },
      ]

      const csv = exportAnomaliesCSV(records)
      expect(csv).toContain('"Contains ""quotes"" and, commas"')
    })
  })
})

// ============================================
// E2E: Full Reconciliation Scenario
// ============================================

describe('E2E: Full Reconciliation Pipeline', () => {
  it('should run complete reconciliation for multi-chain payments', () => {
    // Simulate DB records from multiple chains
    const dbRecords = [
      // Ethereum USDC payments
      { tx_hash: '0x' + '1'.repeat(64), amount: 10000, status: 'completed', chain: 'ethereum', token: 'USDC', timestamp: '2026-01-10T10:00:00Z', from_address: '0x1234567890123456789012345678901234567890', to_address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12' },
      { tx_hash: '0x' + '2'.repeat(64), amount: 5000, status: 'completed', chain: 'ethereum', token: 'USDC', timestamp: '2026-01-11T10:00:00Z', from_address: '0x1234567890123456789012345678901234567890', to_address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12' },
      // Base USDC payment
      { tx_hash: '0x' + '3'.repeat(64), amount: 3000, status: 'completed', chain: 'base', token: 'USDC', timestamp: '2026-01-12T10:00:00Z', from_address: '0x1234567890123456789012345678901234567890', to_address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12' },
      // TRON USDT payment
      { tx_hash: '0x' + '4'.repeat(64), amount: 8000, status: 'completed', chain: 'tron', token: 'USDT', timestamp: '2026-01-13T10:00:00Z', from_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', to_address: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8' },
      // Missing from on-chain
      { tx_hash: '0x' + '5'.repeat(64), amount: 1500, status: 'completed', chain: 'arbitrum', token: 'DAI', timestamp: '2026-01-14T10:00:00Z', from_address: '0x1234567890123456789012345678901234567890', to_address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12' },
    ]

    const onchainRecords = [
      { tx_hash: '0x' + '1'.repeat(64), amount: 10000, block_number: 100, timestamp: '2026-01-10T10:00:00Z' },
      { tx_hash: '0x' + '2'.repeat(64), amount: 5000, block_number: 101, timestamp: '2026-01-11T10:00:00Z' },
      { tx_hash: '0x' + '3'.repeat(64), amount: 2800, block_number: 102, timestamp: '2026-01-12T10:00:00Z' }, // mismatch
      { tx_hash: '0x' + '4'.repeat(64), amount: 8000, block_number: 103, timestamp: '2026-01-13T10:00:00Z' },
      // tx_hash 5 is missing (not on-chain)
      { tx_hash: '0x' + '6'.repeat(64), amount: 999, block_number: 104, timestamp: '2026-01-15T10:00:00Z' }, // extra on-chain
    ]

    // Step 1: Reconcile
    const results = reconcileRecords(dbRecords, onchainRecords)
    expect(results).toHaveLength(6)

    // Step 2: Check results
    const matched = results.filter((r) => r.status === 'matched')
    const mismatched = results.filter((r) => r.status === 'mismatch')
    const missingOnchain = results.filter((r) => r.status === 'missing_onchain')
    const missingDb = results.filter((r) => r.status === 'missing_db')

    expect(matched).toHaveLength(3) // tx 1, 2, 4
    expect(mismatched).toHaveLength(1) // tx 3 (3000 vs 2800)
    expect(missingOnchain).toHaveLength(1) // tx 5
    expect(missingDb).toHaveLength(1) // tx 6

    // Step 3: Calculate summary
    const summary = calculateSummary(results)
    expect(summary.total_records).toBe(6)
    expect(summary.matched).toBe(3)
    expect(summary.anomalies).toBe(3)
    expect(summary.match_rate).toBe(50)
    expect(summary.total_verified_usd).toBe(23000) // 10000 + 5000 + 8000
    expect(summary.unmatched_usd).toBe(3000 + 1500 + 999) // mismatch + missing_onchain + missing_db

    // Step 4: Detect duplicates (none in this case)
    const withDuplicates = detectDuplicates(results)
    expect(withDuplicates.filter((r) => r.status === 'duplicate')).toHaveLength(0)

    // Step 5: Export anomalies
    const csv = exportAnomaliesCSV(results)
    expect(csv).toContain('mismatch')
    expect(csv).toContain('missing_onchain')
    expect(csv).toContain('missing_db')

    // Step 6: Verify addresses in anomalies are valid
    const evmAddr = '0x1234567890123456789012345678901234567890'
    expect(validateAddress(evmAddr).isValid).toBe(true)
    expect(getNetworkForAddress(evmAddr)).toBe('ethereum')

    const tronAddr = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
    expect(validateAddress(tronAddr).isValid).toBe(true)
    expect(getNetworkForAddress(tronAddr)).toBe('tron')
  })
})
