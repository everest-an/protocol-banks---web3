/**
 * E2E Tests — Export Service
 *
 * Tests accounting report generation, CSV export, and Excel XML export.
 * Uses mocked Prisma client to simulate database responses.
 */

import {
  ExportService,
  type AccountingReport,
  type AccountingTransaction,
  type ReportParams,
} from '@/lib/services/export-service'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findMany: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
const mockFindMany = prisma.payment.findMany as jest.Mock

// ============================================
// Test Data
// ============================================

const OWNER = '0x1234567890123456789012345678901234567890'

function createMockPayment(overrides: Record<string, any> = {}) {
  return {
    id: `pay_${Math.random().toString(36).slice(2)}`,
    from_address: OWNER,
    to_address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
    amount: '1000.00',
    amount_usd: 1000,
    token_symbol: 'USDC',
    status: 'completed',
    tx_hash: '0x' + 'a'.repeat(64),
    notes: '',
    created_at: new Date('2026-01-15T12:00:00Z'),
    vendor: { name: 'Test Vendor', category: 'Software' },
    ...overrides,
  }
}

// ============================================
// Report Generation
// ============================================

describe('ExportService', () => {
  let service: ExportService

  beforeEach(() => {
    service = new ExportService()
    jest.clearAllMocks()
  })

  describe('generateAccountingReport', () => {
    it('should generate a complete accounting report', async () => {
      const sentPayments = [
        createMockPayment({ amount_usd: 1000, notes: 'software license' }),
        createMockPayment({ amount_usd: 2000, notes: 'cloud hosting', to_address: '0x9999999999999999999999999999999999999999', vendor: { name: 'AWS', category: 'Infrastructure' } }),
      ]

      const receivedPayments = [
        createMockPayment({
          from_address: '0xOTHER',
          to_address: OWNER,
          amount_usd: 5000,
          notes: 'client payment',
          vendor: { name: 'Client A', category: 'Revenue' },
        }),
      ]

      mockFindMany
        .mockResolvedValueOnce(sentPayments)
        .mockResolvedValueOnce(receivedPayments)

      const params: ReportParams = {
        owner_address: OWNER,
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      }

      const report = await service.generateAccountingReport(params)

      // Summary
      expect(report.period.start).toBe('2026-01-01')
      expect(report.period.end).toBe('2026-01-31')
      expect(report.summary.total_outgoing).toBe(3000) // 1000 + 2000
      expect(report.summary.total_incoming).toBe(5000)
      expect(report.summary.net_flow).toBe(2000) // 5000 - 3000
      expect(report.summary.transaction_count).toBe(3)
      expect(report.summary.unique_recipients).toBe(2) // Two different recipients
      expect(report.summary.unique_senders).toBe(1)

      // Token breakdown
      expect(report.by_token.length).toBeGreaterThan(0)
      const usdcBreakdown = report.by_token.find((t) => t.token === 'USDC')
      expect(usdcBreakdown).toBeDefined()
      expect(usdcBreakdown!.transaction_count).toBe(3)

      // Vendor breakdown
      expect(report.by_vendor.length).toBe(2) // Test Vendor + AWS

      // Transactions (sorted by date)
      expect(report.transactions).toHaveLength(3)
    })

    it('should compute running balance correctly', async () => {
      const sent = [
        createMockPayment({ amount_usd: 100, created_at: new Date('2026-01-10T10:00:00Z') }),
        createMockPayment({ amount_usd: 200, created_at: new Date('2026-01-12T10:00:00Z') }),
      ]
      const received = [
        createMockPayment({
          from_address: '0xOTHER',
          to_address: OWNER,
          amount_usd: 500,
          created_at: new Date('2026-01-11T10:00:00Z'),
        }),
      ]

      mockFindMany
        .mockResolvedValueOnce(sent)
        .mockResolvedValueOnce(received)

      const report = await service.generateAccountingReport({
        owner_address: OWNER,
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      })

      // Sorted by date: sent(-100), received(+500), sent(-200)
      // Balances: -100, +400, +200
      expect(report.transactions[0].debit).toBe(100)
      expect(report.transactions[0].balance).toBe(-100)

      expect(report.transactions[1].credit).toBe(500)
      expect(report.transactions[1].balance).toBe(400)

      expect(report.transactions[2].debit).toBe(200)
      expect(report.transactions[2].balance).toBe(200)
    })

    it('should mark sent as debit, received as credit', async () => {
      mockFindMany
        .mockResolvedValueOnce([createMockPayment({ amount_usd: 1000 })])
        .mockResolvedValueOnce([
          createMockPayment({ from_address: '0xOTHER', to_address: OWNER, amount_usd: 2000 }),
        ])

      const report = await service.generateAccountingReport({
        owner_address: OWNER,
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      })

      const sentTx = report.transactions.find((t) => t.type === 'sent')
      const receivedTx = report.transactions.find((t) => t.type === 'received')

      expect(sentTx!.debit).toBe(1000)
      expect(sentTx!.credit).toBe(0)

      expect(receivedTx!.debit).toBe(0)
      expect(receivedTx!.credit).toBe(2000)
    })

    it('should handle empty payment lists', async () => {
      mockFindMany.mockResolvedValue([])

      const report = await service.generateAccountingReport({
        owner_address: OWNER,
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      })

      expect(report.summary.total_outgoing).toBe(0)
      expect(report.summary.total_incoming).toBe(0)
      expect(report.summary.net_flow).toBe(0)
      expect(report.summary.transaction_count).toBe(0)
      expect(report.transactions).toHaveLength(0)
    })

    it('should filter by include_pending', async () => {
      mockFindMany.mockResolvedValue([])

      await service.generateAccountingReport({
        owner_address: OWNER,
        start_date: '2026-01-01',
        end_date: '2026-01-31',
        include_pending: false,
      })

      // Both calls should include status: 'completed'
      expect(mockFindMany).toHaveBeenCalledTimes(2)
      const firstCall = mockFindMany.mock.calls[0][0]
      expect(firstCall.where.status).toBe('completed')
    })

    it('should aggregate category breakdown from sent payments', async () => {
      const sent = [
        createMockPayment({ amount_usd: 1000, vendor: { name: 'AWS', category: 'Infrastructure' } }),
        createMockPayment({ amount_usd: 2000, vendor: { name: 'GCP', category: 'Infrastructure' } }),
        createMockPayment({ amount_usd: 500, vendor: { name: 'Figma', category: 'Software' } }),
      ]

      mockFindMany
        .mockResolvedValueOnce(sent)
        .mockResolvedValueOnce([])

      const report = await service.generateAccountingReport({
        owner_address: OWNER,
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      })

      const infraCat = report.by_category.find((c) => c.category === 'Infrastructure')
      expect(infraCat).toBeDefined()
      expect(infraCat!.total_amount).toBe(3000)
      expect(infraCat!.transaction_count).toBe(2)

      const softwareCat = report.by_category.find((c) => c.category === 'Software')
      expect(softwareCat).toBeDefined()
      expect(softwareCat!.total_amount).toBe(500)
    })
  })

  // ============================================
  // CSV Export
  // ============================================

  describe('exportToCSV', () => {
    function createTestReport(): AccountingReport {
      return {
        period: { start: '2026-01-01', end: '2026-01-31' },
        summary: {
          total_outgoing: 3000,
          total_incoming: 5000,
          net_flow: 2000,
          transaction_count: 2,
          unique_recipients: 1,
          unique_senders: 1,
        },
        by_token: [{ token: 'USDC', total_amount: 8000, transaction_count: 2 }],
        by_category: [{ category: 'Software', total_amount: 3000, transaction_count: 1 }],
        by_vendor: [{ vendor_name: 'Test', vendor_address: '0x123', total_amount: 3000, transaction_count: 1 }],
        transactions: [
          {
            date: '2026-01-15T12:00:00Z',
            reference: 'pay_001',
            type: 'sent',
            description: 'Payment to Test',
            vendor_name: 'Test',
            category: 'Software',
            debit: 3000,
            credit: 0,
            balance: -3000,
            token: 'USDC',
            usd_value: 3000,
            tx_hash: '0x' + 'a'.repeat(64),
            notes: 'license fee',
          },
          {
            date: '2026-01-20T12:00:00Z',
            reference: 'pay_002',
            type: 'received',
            description: 'Received from Client',
            vendor_name: 'Client A',
            category: 'Revenue',
            debit: 0,
            credit: 5000,
            balance: 2000,
            token: 'USDC',
            usd_value: 5000,
            tx_hash: '0x' + 'b'.repeat(64),
            notes: '',
          },
        ],
      }
    }

    it('should generate valid CSV with headers', () => {
      const csv = service.exportToCSV(createTestReport())
      const lines = csv.split('\n')

      // First line should be headers
      const headers = lines[0].split(',')
      expect(headers).toContain('Date')
      expect(headers).toContain('Debit')
      expect(headers).toContain('Credit')
      expect(headers).toContain('Balance')
      expect(headers).toContain('Vendor')
      expect(headers).toContain('Category')
      expect(headers).toContain('TX Hash')
    })

    it('should include transaction data rows', () => {
      const csv = service.exportToCSV(createTestReport())
      const lines = csv.split('\n')

      // Should have header + 2 transactions + blank + summary rows
      expect(lines.length).toBeGreaterThan(3)

      // Second line should be first transaction
      expect(lines[1]).toContain('2026-01-15')
      expect(lines[1]).toContain('3000.00')
      expect(lines[1]).toContain('Software')
    })

    it('should include summary section', () => {
      const csv = service.exportToCSV(createTestReport())

      expect(csv).toContain('Summary')
      expect(csv).toContain('Total Outgoing')
      expect(csv).toContain('3000.00')
      expect(csv).toContain('Total Incoming')
      expect(csv).toContain('5000.00')
      expect(csv).toContain('Net Flow')
      expect(csv).toContain('2000.00')
    })

    it('should properly escape notes with commas and quotes', () => {
      const report = createTestReport()
      report.transactions[0].notes = 'note with "quotes" and, commas'

      const csv = service.exportToCSV(report)
      // CSV should properly double-quote the notes
      expect(csv).toContain('"note with ""quotes"" and, commas"')
    })

    it('should handle empty transactions', () => {
      const report = createTestReport()
      report.transactions = []

      const csv = service.exportToCSV(report)
      expect(csv).toContain('Summary')
      // Should still have headers
      const lines = csv.split('\n')
      expect(lines[0]).toContain('Date')
    })
  })

  // ============================================
  // Excel Export
  // ============================================

  describe('exportToExcel', () => {
    it('should generate valid Excel XML', async () => {
      const report: AccountingReport = {
        period: { start: '2026-01-01', end: '2026-01-31' },
        summary: {
          total_outgoing: 1000,
          total_incoming: 2000,
          net_flow: 1000,
          transaction_count: 1,
          unique_recipients: 1,
          unique_senders: 0,
        },
        by_token: [],
        by_category: [],
        by_vendor: [],
        transactions: [
          {
            date: '2026-01-15T12:00:00Z',
            reference: 'pay_001',
            type: 'sent',
            description: 'Test payment',
            vendor_name: 'Test',
            category: 'Software',
            debit: 1000,
            credit: 0,
            balance: -1000,
            token: 'USDC',
            usd_value: 1000,
            tx_hash: '0xabc',
            notes: 'test',
          },
        ],
      }

      const blob = await service.exportToExcel(report)
      expect(blob).toBeInstanceOf(Blob)

      // Read blob as text
      const text = await blob.text()

      // Should be valid XML
      expect(text).toContain('<?xml version="1.0"?>')
      expect(text).toContain('<Workbook')
      expect(text).toContain('Transactions')
      expect(text).toContain('Summary')

      // Should contain data
      expect(text).toContain('Test payment')
      expect(text).toContain('1000.00')
      expect(text).toContain('USDC')
    })

    it('should escape XML special characters', async () => {
      const report: AccountingReport = {
        period: { start: '2026-01-01', end: '2026-01-31' },
        summary: {
          total_outgoing: 0,
          total_incoming: 0,
          net_flow: 0,
          transaction_count: 1,
          unique_recipients: 0,
          unique_senders: 0,
        },
        by_token: [],
        by_category: [],
        by_vendor: [],
        transactions: [
          {
            date: '2026-01-15T12:00:00Z',
            reference: 'pay_001',
            type: 'sent',
            description: 'Payment to A&B <Corp>',
            vendor_name: 'A&B "Corp"',
            category: 'Software',
            debit: 0,
            credit: 0,
            balance: 0,
            token: 'USDC',
            usd_value: 0,
            tx_hash: '',
            notes: '<script>alert("xss")</script>',
          },
        ],
      }

      const blob = await service.exportToExcel(report)
      const text = await blob.text()

      // XML special chars should be escaped
      expect(text).toContain('A&amp;B')
      expect(text).toContain('&lt;Corp&gt;')
      expect(text).toContain('&lt;script&gt;')
      expect(text).not.toContain('<script>')
    })
  })

  // ============================================
  // Quick Summary
  // ============================================

  describe('getQuickSummary', () => {
    it('should return a summary for the given period', async () => {
      mockFindMany
        .mockResolvedValueOnce([
          createMockPayment({ amount_usd: 500 }),
          createMockPayment({ amount_usd: 1500 }),
        ])
        .mockResolvedValueOnce([
          createMockPayment({ from_address: '0xOTHER', to_address: OWNER, amount_usd: 3000 }),
        ])

      const summary = await service.getQuickSummary(OWNER, 30)

      expect(summary.total_outgoing).toBe(2000)
      expect(summary.total_incoming).toBe(3000)
      expect(summary.transaction_count).toBe(3)
      expect(summary.period).toBe('Last 30 days')
    })

    it('should default to 30 days', async () => {
      mockFindMany.mockResolvedValue([])

      const summary = await service.getQuickSummary(OWNER)

      expect(summary.period).toBe('Last 30 days')
      expect(summary.transaction_count).toBe(0)
    })
  })
})

// ============================================
// E2E: Full Report Pipeline
// ============================================

describe('E2E: Accounting Report Pipeline', () => {
  let service: ExportService

  beforeEach(() => {
    service = new ExportService()
    jest.clearAllMocks()
  })

  it('should generate report → export CSV → verify consistency', async () => {
    const sent = [
      createMockPayment({
        amount_usd: 1500,
        vendor: { name: 'AWS', category: 'Infrastructure' },
        notes: 'cloud hosting',
        created_at: new Date('2026-01-10'),
      }),
      createMockPayment({
        amount_usd: 500,
        vendor: { name: 'Slack', category: 'Software' },
        notes: 'subscription',
        created_at: new Date('2026-01-15'),
      }),
    ]

    const received = [
      createMockPayment({
        from_address: '0xCLIENT',
        to_address: OWNER,
        amount_usd: 10000,
        vendor: { name: 'Client Corp', category: 'Revenue' },
        notes: 'project payment',
        created_at: new Date('2026-01-20'),
      }),
    ]

    mockFindMany
      .mockResolvedValueOnce(sent)
      .mockResolvedValueOnce(received)

    // Step 1: Generate report
    const report = await service.generateAccountingReport({
      owner_address: OWNER,
      start_date: '2026-01-01',
      end_date: '2026-01-31',
    })

    // Step 2: Verify debit/credit balance
    const totalDebit = report.transactions.reduce((s, t) => s + t.debit, 0)
    const totalCredit = report.transactions.reduce((s, t) => s + t.credit, 0)
    expect(totalDebit).toBe(report.summary.total_outgoing)
    expect(totalCredit).toBe(report.summary.total_incoming)
    expect(report.summary.net_flow).toBe(totalCredit - totalDebit)

    // Step 3: Export to CSV
    const csv = service.exportToCSV(report)
    expect(csv).toContain('AWS')
    expect(csv).toContain('Slack')
    expect(csv).toContain('Client Corp')
    expect(csv).toContain('1500.00')
    expect(csv).toContain('10000.00')

    // Step 4: Export to Excel
    const blob = await service.exportToExcel(report)
    const xml = await blob.text()
    expect(xml).toContain('AWS')
    expect(xml).toContain('10000.00')

    // Step 5: Verify running balance consistency
    let expectedBalance = 0
    report.transactions.forEach((tx) => {
      expectedBalance += tx.credit - tx.debit
      expect(tx.balance).toBeCloseTo(expectedBalance, 2)
    })
  })
})
