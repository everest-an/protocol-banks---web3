/**
 * E2E Tests — Business Logic
 *
 * Tests transaction categorization, burn rate calculation,
 * runway estimation, and category distribution analysis.
 */

import {
  categorizeTransaction,
  calculateMonthlyBurnRate,
  calculateRunway,
  getTopCategories,
  CATEGORIES,
  CATEGORY_COLORS,
  type Category,
} from '@/lib/business-logic'

// ============================================
// Transaction Categorization
// ============================================

describe('Transaction Categorization', () => {
  describe('categorizeTransaction', () => {
    it('should categorize Infrastructure expenses', () => {
      expect(categorizeTransaction('AWS', '')).toBe('Infrastructure')
      expect(categorizeTransaction('', 'cloud hosting payment')).toBe('Infrastructure')
      expect(categorizeTransaction('DigitalOcean', 'server rental')).toBe('Infrastructure')
      expect(categorizeTransaction('Hosting Provider', '')).toBe('Infrastructure')
    })

    it('should categorize Payroll expenses', () => {
      expect(categorizeTransaction('', 'monthly salary')).toBe('Payroll')
      expect(categorizeTransaction('Employee Payroll', '')).toBe('Payroll')
      expect(categorizeTransaction('', 'Q4 bonus distribution')).toBe('Payroll')
      expect(categorizeTransaction('', 'wage payment')).toBe('Payroll')
    })

    it('should categorize Marketing expenses', () => {
      expect(categorizeTransaction('Google Ads', '')).toBe('Marketing')
      expect(categorizeTransaction('', 'marketing campaign')).toBe('Marketing')
      expect(categorizeTransaction('', 'promo budget')).toBe('Marketing')
      expect(categorizeTransaction('Ad Network', '')).toBe('Marketing')
    })

    it('should categorize Legal expenses', () => {
      expect(categorizeTransaction('Legal Firm LLP', '')).toBe('Legal')
      expect(categorizeTransaction('', 'lawyer retainer')).toBe('Legal')
      expect(categorizeTransaction('', 'compliance review')).toBe('Legal')
      expect(categorizeTransaction('', 'annual audit fee')).toBe('Legal')
    })

    it('should categorize Software expenses', () => {
      expect(categorizeTransaction('', 'software license')).toBe('Software')
      expect(categorizeTransaction('SaaS Provider', '')).toBe('Software')
      expect(categorizeTransaction('', 'annual subscription')).toBe('Software')
      expect(categorizeTransaction('DevTool Inc', '')).toBe('Software')
    })

    it('should categorize Office expenses', () => {
      expect(categorizeTransaction('', 'office supplies')).toBe('Office')
      expect(categorizeTransaction('', 'monthly rent')).toBe('Office')
      expect(categorizeTransaction('', 'utility bill')).toBe('Office')
    })

    it('should categorize Contractors expenses', () => {
      expect(categorizeTransaction('', 'contractor payment')).toBe('Contractors')
      expect(categorizeTransaction('Freelance Dev', '')).toBe('Contractors')
      expect(categorizeTransaction('', 'consultant fee')).toBe('Contractors')
    })

    it('should default to Uncategorized for unknown transactions', () => {
      expect(categorizeTransaction('', '')).toBe('Uncategorized')
      expect(categorizeTransaction(undefined, undefined)).toBe('Uncategorized')
      expect(categorizeTransaction('Random Vendor', 'misc payment')).toBe('Uncategorized')
    })

    it('should be case-insensitive', () => {
      expect(categorizeTransaction('AWS CLOUD', '')).toBe('Infrastructure')
      expect(categorizeTransaction('MARKETING', '')).toBe('Marketing')
      expect(categorizeTransaction('', 'SALARY payment')).toBe('Payroll')
    })

    it('should match on combined vendor name + notes', () => {
      // Vendor name alone doesn't match, but notes provide the category
      expect(categorizeTransaction('Acme Corp', 'for cloud hosting')).toBe('Infrastructure')
    })
  })

  describe('CATEGORIES constant', () => {
    it('should contain all 8 categories', () => {
      expect(CATEGORIES).toHaveLength(8)
      expect(CATEGORIES).toContain('Infrastructure')
      expect(CATEGORIES).toContain('Payroll')
      expect(CATEGORIES).toContain('Marketing')
      expect(CATEGORIES).toContain('Legal')
      expect(CATEGORIES).toContain('Software')
      expect(CATEGORIES).toContain('Office')
      expect(CATEGORIES).toContain('Contractors')
      expect(CATEGORIES).toContain('Uncategorized')
    })
  })

  describe('CATEGORY_COLORS', () => {
    it('should have a color for every category', () => {
      CATEGORIES.forEach((cat) => {
        expect(CATEGORY_COLORS[cat]).toBeDefined()
        expect(CATEGORY_COLORS[cat]).toMatch(/^#[0-9a-fA-F]{6}$/)
      })
    })

    it('should have unique colors', () => {
      const colors = Object.values(CATEGORY_COLORS)
      expect(new Set(colors).size).toBe(colors.length)
    })
  })
})

// ============================================
// Financial Calculations
// ============================================

describe('Financial Calculations', () => {
  describe('calculateMonthlyBurnRate', () => {
    it('should calculate burn rate from recent payments', () => {
      const now = new Date()
      const payments = [
        { timestamp: new Date(now.getTime() - 1 * 86400000).toISOString(), amount_usd: 1000 },
        { timestamp: new Date(now.getTime() - 5 * 86400000).toISOString(), amount_usd: 2000 },
        { timestamp: new Date(now.getTime() - 10 * 86400000).toISOString(), amount_usd: 3000 },
      ]

      const burnRate = calculateMonthlyBurnRate(payments)
      expect(burnRate).toBe(6000)
    })

    it('should exclude payments older than 30 days', () => {
      const now = new Date()
      const payments = [
        { timestamp: new Date(now.getTime() - 1 * 86400000).toISOString(), amount_usd: 1000 },
        { timestamp: new Date(now.getTime() - 60 * 86400000).toISOString(), amount_usd: 99999 },
      ]

      const burnRate = calculateMonthlyBurnRate(payments)
      expect(burnRate).toBe(1000)
    })

    it('should return 0 for empty payments', () => {
      expect(calculateMonthlyBurnRate([])).toBe(0)
    })

    it('should handle payments with no amount_usd', () => {
      const now = new Date()
      const payments = [
        { timestamp: new Date(now.getTime() - 1 * 86400000).toISOString(), amount_usd: 0 },
        { timestamp: new Date(now.getTime() - 2 * 86400000).toISOString() },
      ]

      const burnRate = calculateMonthlyBurnRate(payments as any)
      expect(burnRate).toBe(0)
    })
  })

  describe('calculateRunway', () => {
    it('should calculate months of runway', () => {
      expect(calculateRunway(12000, 3000)).toBe(4) // 4 months
      expect(calculateRunway(50000, 10000)).toBe(5) // 5 months
    })

    it('should return 999 for zero burn rate', () => {
      expect(calculateRunway(10000, 0)).toBe(999)
    })

    it('should return 999 for negative burn rate', () => {
      expect(calculateRunway(10000, -100)).toBe(999)
    })

    it('should handle zero balance', () => {
      expect(calculateRunway(0, 5000)).toBe(0)
    })

    it('should return fractional months', () => {
      const runway = calculateRunway(5000, 3000)
      expect(runway).toBeCloseTo(1.667, 2)
    })
  })
})

// ============================================
// Category Distribution Analysis
// ============================================

describe('Category Distribution Analysis', () => {
  describe('getTopCategories', () => {
    it('should calculate category distribution from payments', () => {
      const payments = [
        { vendor: { name: 'AWS' }, notes: 'cloud', amount_usd: 5000 },
        { vendor: { name: 'AWS' }, notes: 'server', amount_usd: 3000 },
        { vendor: { name: '' }, notes: 'salary', amount_usd: 10000 },
        { vendor: { name: '' }, notes: 'marketing campaign', amount_usd: 2000 },
      ]

      const categories = getTopCategories(payments)

      expect(categories.length).toBeGreaterThan(0)

      // Payroll should be the largest
      expect(categories[0].name).toBe('Payroll')
      expect(categories[0].value).toBe(10000)

      // Infrastructure second
      expect(categories[1].name).toBe('Infrastructure')
      expect(categories[1].value).toBe(8000)

      // Marketing third
      const marketing = categories.find((c) => c.name === 'Marketing')
      expect(marketing).toBeDefined()
      expect(marketing!.value).toBe(2000)
    })

    it('should include colors for each category', () => {
      const payments = [
        { vendor: { name: 'AWS' }, notes: '', amount_usd: 1000 },
        { vendor: { name: '' }, notes: 'salary', amount_usd: 2000 },
      ]

      const categories = getTopCategories(payments)
      categories.forEach((cat) => {
        expect(cat.color).toMatch(/^#[0-9a-fA-F]{6}$/)
      })
    })

    it('should sort categories by value descending', () => {
      const payments = [
        { vendor: { name: '' }, notes: 'salary', amount_usd: 1000 },
        { vendor: { name: 'AWS' }, notes: '', amount_usd: 5000 },
        { vendor: { name: '' }, notes: 'legal review', amount_usd: 3000 },
      ]

      const categories = getTopCategories(payments)
      for (let i = 1; i < categories.length; i++) {
        expect(categories[i - 1].value).toBeGreaterThanOrEqual(categories[i].value)
      }
    })

    it('should handle empty payments', () => {
      expect(getTopCategories([])).toEqual([])
    })

    it('should handle payments with no vendor or notes', () => {
      const payments = [
        { amount_usd: 500 },
        { vendor: null, notes: null, amount_usd: 300 },
      ]

      const categories = getTopCategories(payments as any)
      expect(categories).toHaveLength(1)
      expect(categories[0].name).toBe('Uncategorized')
      expect(categories[0].value).toBe(800)
    })
  })
})

// ============================================
// E2E: Treasury Health Analysis
// ============================================

describe('E2E: Treasury Health Analysis', () => {
  it('should compute full treasury health from payment stream', () => {
    const now = new Date()

    const payments = [
      // Infrastructure
      { vendor: { name: 'AWS' }, notes: 'hosting', amount_usd: 5000, timestamp: new Date(now.getTime() - 2 * 86400000).toISOString() },
      { vendor: { name: 'GCP' }, notes: 'cloud', amount_usd: 3000, timestamp: new Date(now.getTime() - 5 * 86400000).toISOString() },
      // Payroll
      { vendor: { name: '' }, notes: 'monthly salary', amount_usd: 50000, timestamp: new Date(now.getTime() - 1 * 86400000).toISOString() },
      // Marketing
      { vendor: { name: '' }, notes: 'ad campaign', amount_usd: 10000, timestamp: new Date(now.getTime() - 3 * 86400000).toISOString() },
      // Old payment (should not count in burn rate, but still categorized)
      { vendor: { name: '' }, notes: 'old server hosting', amount_usd: 100000, timestamp: new Date(now.getTime() - 90 * 86400000).toISOString() },
    ]

    // Step 1: Calculate burn rate (last 30 days only)
    const burnRate = calculateMonthlyBurnRate(payments)
    expect(burnRate).toBe(68000) // 5000 + 3000 + 50000 + 10000

    // Step 2: Calculate runway
    const treasuryBalance = 200000
    const runwayMonths = calculateRunway(treasuryBalance, burnRate)
    expect(runwayMonths).toBeCloseTo(2.94, 1) // ~2.94 months

    // Step 3: Categorize spending (includes ALL payments, not just recent)
    const categories = getTopCategories(payments)

    // Infrastructure should dominate (5000 + 3000 + 100000 = 108000)
    expect(categories[0].name).toBe('Infrastructure')

    // Step 4: Each category should have a proper color
    categories.forEach((cat) => {
      expect(CATEGORY_COLORS[cat.name as Category]).toBe(cat.color)
    })

    // Step 5: Verify all known payments are categorized
    const totalCategorized = categories.reduce((sum, c) => sum + c.value, 0)
    const totalPayments = payments.reduce((sum, p) => sum + p.amount_usd, 0)
    expect(totalCategorized).toBe(totalPayments)
  })
})
