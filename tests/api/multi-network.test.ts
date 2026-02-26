/**
 * Multi-Network API Integration Tests
 *
 * These tests verify the API endpoints work correctly with multi-network support.
 * Requires a running database and development server.
 *
 * Run with: pnpm test tests/api/multi-network.test.ts
 */

import { describe, test, expect, beforeAll } from '@jest/globals'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'
const TEST_USER_ADDRESS = process.env.TEST_USER_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2'

// Helper function to make authenticated API calls
async function apiCall(
  endpoint: string,
  options: RequestInit = {},
  userAddress: string = TEST_USER_ADDRESS
) {
  const headers = {
    'Content-Type': 'application/json',
    'x-wallet-address': userAddress,
    ...options.headers,
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  const data = await response.json()
  return { response, data }
}

describe('Multi-Network Vendor API', () => {
  let testVendorId: string

  test('should create vendor with multiple network addresses', async () => {
    const { response, data } = await apiCall('/api/vendors/multi-network', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Multi-Network Vendor',
        addresses: [
          {
            network: 'ethereum',
            address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2',
            label: 'Main ETH wallet',
            isPrimary: true,
          },
          {
            network: 'tron',
            address: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
            label: 'Main TRON wallet',
            isPrimary: true,
          },
        ],
        companyName: 'Test Company',
        email: 'test@example.com',
      }),
    })

    expect(response.status).toBe(201)
    expect(data.vendor).toBeDefined()
    expect(data.vendor.addresses).toHaveLength(2)
    expect(data.vendor.name).toBe('Test Multi-Network Vendor')

    testVendorId = data.vendor.id
  })

  test('should list vendors with addresses', async () => {
    const { response, data } = await apiCall('/api/vendors/multi-network')

    expect(response.status).toBe(200)
    expect(data.vendors).toBeDefined()
    expect(Array.isArray(data.vendors)).toBe(true)
  })

  test('should get single vendor with addresses', async () => {
    if (!testVendorId) {
      console.warn('Skipping test: testVendorId not set')
      return
    }

    const { response, data } = await apiCall(
      `/api/vendors/${testVendorId}/multi-network`
    )

    expect(response.status).toBe(200)
    expect(data.vendor).toBeDefined()
    expect(data.vendor.addresses).toBeDefined()
  })

  test('should add address to existing vendor', async () => {
    if (!testVendorId) {
      console.warn('Skipping test: testVendorId not set')
      return
    }

    const { response, data } = await apiCall(
      `/api/vendors/${testVendorId}/addresses`,
      {
        method: 'POST',
        body: JSON.stringify({
          network: 'base',
          address: '0x1234567890123456789012345678901234567890',
          label: 'Base wallet',
          isPrimary: true,
        }),
      }
    )

    expect(response.status).toBe(201)
    expect(data.address).toBeDefined()
    expect(data.address.network).toBe('base')
  })

  test('should reject duplicate network address', async () => {
    if (!testVendorId) {
      console.warn('Skipping test: testVendorId not set')
      return
    }

    const { response, data } = await apiCall(
      `/api/vendors/${testVendorId}/addresses`,
      {
        method: 'POST',
        body: JSON.stringify({
          network: 'ethereum',
          address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          isPrimary: true,
        }),
      }
    )

    expect(response.status).toBe(409)
    expect(data.error).toContain('already exists')
  })

  test('should validate address format', async () => {
    if (!testVendorId) {
      console.warn('Skipping test: testVendorId not set')
      return
    }

    const { response, data } = await apiCall(
      `/api/vendors/${testVendorId}/addresses`,
      {
        method: 'POST',
        body: JSON.stringify({
          network: 'ethereum',
          address: 'invalid-address',
          isPrimary: true,
        }),
      }
    )

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid address')
  })
})

describe('Multi-Network Payment API', () => {
  test('should create payment with TRON address (auto-detect)', async () => {
    const { response, data } = await apiCall('/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        from_address: TEST_USER_ADDRESS,
        to_address: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
        amount: '100.00',
        token: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        token_symbol: 'USDT',
        type: 'sent',
        energy_used: '28000',
        bandwidth_used: '345',
      }),
    })

    expect(response.status).toBe(200)
    expect(data.payment).toBeDefined()
    expect(data.payment.network_type).toBe('TRON')
    expect(data.payment.chain).toBe('tron')
    expect(data.payment.energy_used).toBe('28000')
  })

  test('should create payment with EVM address (auto-detect)', async () => {
    const { response, data } = await apiCall('/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        from_address: TEST_USER_ADDRESS,
        to_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2',
        amount: '50.00',
        token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        token_symbol: 'USDC',
        type: 'sent',
        gas_used: '21000',
        gas_price: '50000000000',
      }),
    })

    expect(response.status).toBe(200)
    expect(data.payment).toBeDefined()
    expect(data.payment.network_type).toBe('EVM')
    expect(data.payment.gas_used).toBe('21000')
  })

  test('should filter payments by network', async () => {
    const { response, data } = await apiCall('/api/payments?network=tron&limit=10')

    expect(response.status).toBe(200)
    expect(data.payments).toBeDefined()
    expect(Array.isArray(data.payments)).toBe(true)

    // All returned payments should be TRON
    data.payments.forEach((payment: any) => {
      expect(payment.chain).toBe('tron')
    })
  })

  test('should filter payments by network type', async () => {
    const { response, data } = await apiCall('/api/payments?network_type=EVM&limit=10')

    expect(response.status).toBe(200)
    expect(data.payments).toBeDefined()

    // All returned payments should be EVM
    data.payments.forEach((payment: any) => {
      expect(payment.network_type).toBe('EVM')
    })
  })

  test('should filter payments by status', async () => {
    const { response, data } = await apiCall(
      '/api/payments?status=completed&limit=10'
    )

    expect(response.status).toBe(200)
    expect(data.payments).toBeDefined()

    // All returned payments should be completed
    data.payments.forEach((payment: any) => {
      expect(payment.status).toBe('completed')
    })
  })

  test('should support pagination', async () => {
    const { response, data } = await apiCall('/api/payments?limit=5&offset=0')

    expect(response.status).toBe(200)
    expect(data.payments).toBeDefined()
    expect(data.total).toBeDefined()
    expect(data.limit).toBe(5)
    expect(data.offset).toBe(0)
    expect(data.hasMore).toBeDefined()
  })
})

describe('Payment Statistics API', () => {
  test('should get overall payment statistics', async () => {
    const { response, data } = await apiCall('/api/payments/stats')

    expect(response.status).toBe(200)
    expect(data.summary).toBeDefined()
    expect(data.summary.totalPayments).toBeGreaterThanOrEqual(0)
    expect(data.byNetwork).toBeDefined()
    expect(Array.isArray(data.byNetwork)).toBe(true)
    expect(data.byNetworkType).toBeDefined()
    expect(data.byStatus).toBeDefined()
  })

  test('should get TRON-only statistics', async () => {
    const { response, data } = await apiCall('/api/payments/stats?network_type=TRON')

    expect(response.status).toBe(200)
    expect(data.summary).toBeDefined()

    // Should only have TRON data
    data.byNetworkType.forEach((item: any) => {
      expect(item.networkType).toBe('TRON')
    })
  })

  test('should filter statistics by date range', async () => {
    const startDate = '2026-01-01'
    const endDate = '2026-12-31'

    const { response, data } = await apiCall(
      `/api/payments/stats?start_date=${startDate}&end_date=${endDate}`
    )

    expect(response.status).toBe(200)
    expect(data.summary).toBeDefined()
  })
})

describe('Batch Payment Multi-Network API', () => {
  test('should create batch with EVM addresses (auto-detect)', async () => {
    const { response, data } = await apiCall('/api/batch-payment', {
      method: 'POST',
      body: JSON.stringify({
        recipients: [
          { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2', amount: '10.00' },
          { address: '0x1234567890123456789012345678901234567890', amount: '20.00' },
        ],
        token: 'USDC',
      }),
    })

    expect(response.status).toBe(200)
    expect(data.batchId).toBeDefined()
    expect(data.chain).toBeDefined()
    expect(data.networkType).toBe('EVM')
  })

  test('should create batch with TRON addresses (auto-detect)', async () => {
    const { response, data } = await apiCall('/api/batch-payment', {
      method: 'POST',
      body: JSON.stringify({
        recipients: [
          { address: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', amount: '50.00' },
          { address: 'TAjQx2VkFLiQPSKCEKqHBWGWPWNQqKQw2h', amount: '75.00' },
        ],
        token: 'USDT',
      }),
    })

    expect(response.status).toBe(200)
    expect(data.batchId).toBeDefined()
    expect(data.chain).toBe('tron')
    expect(data.networkType).toBe('TRON')
  })

  test('should filter batches by network', async () => {
    const { response, data } = await apiCall('/api/batch-payment?network=tron')

    expect(response.status).toBe(200)
    expect(data.batches).toBeDefined()
    expect(Array.isArray(data.batches)).toBe(true)
  })

  test('should get batch payment statistics', async () => {
    const { response, data } = await apiCall('/api/batch-payment/stats')

    expect(response.status).toBe(200)
    expect(data.summary).toBeDefined()
    expect(data.summary.totalBatches).toBeGreaterThanOrEqual(0)
    expect(data.byNetwork).toBeDefined()
    expect(data.byNetworkType).toBeDefined()
  })
})

describe('Error Handling', () => {
  test('should require authentication', async () => {
    const response = await fetch(`${BASE_URL}/api/vendors/multi-network`, {
      headers: {
        'Content-Type': 'application/json',
        // No x-wallet-address header
      },
    })

    expect(response.status).toBe(401)
  })

  test('should validate required fields', async () => {
    const { response, data } = await apiCall('/api/vendors/multi-network', {
      method: 'POST',
      body: JSON.stringify({
        // Missing name
        addresses: [],
      }),
    })

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  test('should validate address format in payments', async () => {
    const { response, data } = await apiCall('/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        from_address: TEST_USER_ADDRESS,
        to_address: 'invalid-address',
        amount: '100',
        token: 'USDT',
        type: 'sent',
      }),
    })

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid')
  })
})
