/**
 * Double Spend Prevention Service Tests
 *
 * 测试防双花验证服务的所有层级
 */

import { DoubleSpendPreventionService } from '@/lib/services/security/double-spend-prevention.service'
import { prisma } from '@/lib/prisma'
import { getTronTransaction, getConfirmationInfo } from '@/lib/services/tron-payment'

// Mock 依赖
jest.mock('@/lib/prisma')
jest.mock('@/lib/services/tron-payment')
jest.mock('@/lib/logger/structured-logger')

describe('DoubleSpendPreventionService', () => {
  let service: DoubleSpendPreventionService

  beforeEach(() => {
    service = new DoubleSpendPreventionService()
    jest.clearAllMocks()
  })

  describe('verifyPayment - Layer 1: Transaction Hash Uniqueness', () => {
    const txHash = '0xabcdef1234567890'
    const orderId = 'order_123'
    const expectedAmount = '100.00'
    const expectedAddress = 'TYourAddressHere'

    it('should reject if transaction hash is already used by another order', async () => {
      // Mock: txHash 已被其他订单使用
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'payment_1',
        tx_hash: txHash,
        order_id: 'order_999', // 不同的订单
        amount: 100
      })

      const result = await service.verifyPayment(txHash, orderId, expectedAmount, expectedAddress)

      expect(result.valid).toBe(false)
      expect(result.reason).toContain('already used')
      expect(result.reason).toContain('order_999')
    })

    it('should allow if transaction hash belongs to the same order', async () => {
      // Mock: txHash 属于当前订单（重复验证情况）
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'payment_1',
        tx_hash: txHash,
        order_id: orderId, // 相同订单
        amount: 100
      })

      // Mock 链上验证
      ;(getTronTransaction as jest.Mock).mockResolvedValue({
        txid: txHash,
        amount: expectedAmount,
        to_address: expectedAddress,
        from_address: 'TSenderAddress',
        token_symbol: 'USDT',
        block_number: 12345
      })

      ;(getConfirmationInfo as jest.Mock).mockResolvedValue({
        confirmations: 5,
        blockNumber: 12345
      })

      // Mock 区块信息（不在重组窗口）
      ;(prisma.blockInfo.findUnique as jest.Mock).mockResolvedValue({
        block_number: 12345,
        block_hash: '0xblockhash',
        timestamp: new Date(Date.now() - 120000) // 2 分钟前
      })

      const result = await service.verifyPayment(txHash, orderId, expectedAmount, expectedAddress)

      // 应该通过验证
      expect(result.valid).toBe(true)
    })
  })

  describe('verifyPayment - Layer 2: On-Chain Transaction Verification', () => {
    const txHash = '0xfaketx'
    const orderId = 'order_456'
    const expectedAmount = '100.00'
    const expectedAddress = 'TAddress'

    it('should reject if transaction not found on blockchain', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null)
      ;(getTronTransaction as jest.Mock).mockResolvedValue(null) // 链上不存在

      const result = await service.verifyPayment(txHash, orderId, expectedAmount, expectedAddress)

      expect(result.valid).toBe(false)
      expect(result.reason).toContain('not found on blockchain')
      expect(result.details?.txExists).toBe(false)
    })

    it('should pass if transaction exists on blockchain', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null)
      ;(getTronTransaction as jest.Mock).mockResolvedValue({
        txid: txHash,
        amount: expectedAmount,
        to_address: expectedAddress,
        from_address: 'TSender',
        token_symbol: 'USDT',
        block_number: 12345
      })

      ;(getConfirmationInfo as jest.Mock).mockResolvedValue({
        confirmations: 5,
        blockNumber: 12345
      })

      ;(prisma.blockInfo.findUnique as jest.Mock).mockResolvedValue({
        block_number: 12345,
        block_hash: '0xhash',
        timestamp: new Date(Date.now() - 120000)
      })

      const result = await service.verifyPayment(txHash, orderId, expectedAmount, expectedAddress)

      expect(result.valid).toBe(true)
      expect(result.details?.txExists).toBe(true)
    })
  })

  describe('verifyPayment - Layer 3: Amount Matching', () => {
    const txHash = '0xtx'
    const orderId = 'order_789'
    const expectedAddress = 'TAddr'

    beforeEach(() => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null)
    })

    it('should reject if amount does not match', async () => {
      ;(getTronTransaction as jest.Mock).mockResolvedValue({
        txid: txHash,
        amount: '99.00', // 不匹配
        to_address: expectedAddress,
        from_address: 'TSender',
        token_symbol: 'USDT'
      })

      const result = await service.verifyPayment(txHash, orderId, '100.00', expectedAddress)

      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Amount mismatch')
      expect(result.details?.amountMatches).toBe(false)
    })

    it('should allow small floating point differences', async () => {
      ;(getTronTransaction as jest.Mock).mockResolvedValue({
        txid: txHash,
        amount: '100.005', // 在 0.01 误差范围内
        to_address: expectedAddress,
        from_address: 'TSender',
        token_symbol: 'USDT',
        block_number: 12345
      })

      ;(getConfirmationInfo as jest.Mock).mockResolvedValue({
        confirmations: 5,
        blockNumber: 12345
      })

      ;(prisma.blockInfo.findUnique as jest.Mock).mockResolvedValue({
        block_number: 12345,
        block_hash: '0xhash',
        timestamp: new Date(Date.now() - 120000)
      })

      const result = await service.verifyPayment(txHash, orderId, '100.00', expectedAddress)

      expect(result.valid).toBe(true)
      expect(result.details?.amountMatches).toBe(true)
    })
  })

  describe('verifyPayment - Layer 4: Address Matching', () => {
    const txHash = '0xtx'
    const orderId = 'order_abc'

    beforeEach(() => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null)
    })

    it('should reject if recipient address does not match', async () => {
      ;(getTronTransaction as jest.Mock).mockResolvedValue({
        txid: txHash,
        amount: '100.00',
        to_address: 'TWrongAddress',
        from_address: 'TSender',
        token_symbol: 'USDT'
      })

      const result = await service.verifyPayment(txHash, orderId, '100.00', 'TCorrectAddress')

      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Recipient address mismatch')
      expect(result.details?.addressMatches).toBe(false)
    })

    it('should be case-insensitive for address matching', async () => {
      const address = 'TAddressHere'

      ;(getTronTransaction as jest.Mock).mockResolvedValue({
        txid: txHash,
        amount: '100.00',
        to_address: address.toLowerCase(),
        from_address: 'TSender',
        token_symbol: 'USDT',
        block_number: 12345
      })

      ;(getConfirmationInfo as jest.Mock).mockResolvedValue({
        confirmations: 5,
        blockNumber: 12345
      })

      ;(prisma.blockInfo.findUnique as jest.Mock).mockResolvedValue({
        block_number: 12345,
        block_hash: '0xhash',
        timestamp: new Date(Date.now() - 120000)
      })

      const result = await service.verifyPayment(txHash, orderId, '100.00', address.toUpperCase())

      expect(result.valid).toBe(true)
      expect(result.details?.addressMatches).toBe(true)
    })
  })

  describe('verifyPayment - Layer 5: Confirmation Depth', () => {
    const txHash = '0xtx'
    const orderId = 'order_conf'
    const expectedAmount = '100.00'
    const expectedAddress = 'TAddr'

    beforeEach(() => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null)
      ;(getTronTransaction as jest.Mock).mockResolvedValue({
        txid: txHash,
        amount: expectedAmount,
        to_address: expectedAddress,
        from_address: 'TSender',
        token_symbol: 'USDT',
        block_number: 12345
      })
    })

    it('should reject if confirmations are insufficient (< 3 for small amounts)', async () => {
      // Override amount to match the expected 50.00
      ;(getTronTransaction as jest.Mock).mockResolvedValue({
        txid: txHash,
        amount: '50.00',
        to_address: expectedAddress,
        from_address: 'TSender',
        token_symbol: 'USDT',
        block_number: 12345
      })
      ;(getConfirmationInfo as jest.Mock).mockResolvedValue({
        confirmations: 2, // 不足 3 个确认
        blockNumber: 12345
      })

      const result = await service.verifyPayment(txHash, orderId, '50.00', expectedAddress)

      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Insufficient confirmations: 2/3')
    })

    it('should require 5 confirmations for medium amounts (>= 100)', async () => {
      // Override amount to match the expected 150.00
      ;(getTronTransaction as jest.Mock).mockResolvedValue({
        txid: txHash,
        amount: '150.00',
        to_address: expectedAddress,
        from_address: 'TSender',
        token_symbol: 'USDT',
        block_number: 12345
      })
      ;(getConfirmationInfo as jest.Mock).mockResolvedValue({
        confirmations: 4, // 不足 5 个
        blockNumber: 12345
      })

      const result = await service.verifyPayment(txHash, orderId, '150.00', expectedAddress)

      expect(result.valid).toBe(false)
      expect(result.details?.requiredConfirmations).toBe(5)
    })

    it('should require 10 confirmations for large amounts (>= 1000)', async () => {
      // Override amount to match the expected 5000.00
      ;(getTronTransaction as jest.Mock).mockResolvedValue({
        txid: txHash,
        amount: '5000.00',
        to_address: expectedAddress,
        from_address: 'TSender',
        token_symbol: 'USDT',
        block_number: 12345
      })
      ;(getConfirmationInfo as jest.Mock).mockResolvedValue({
        confirmations: 9,
        blockNumber: 12345
      })

      const result = await service.verifyPayment(txHash, orderId, '5000.00', expectedAddress)

      expect(result.valid).toBe(false)
      expect(result.details?.requiredConfirmations).toBe(10)
    })

    it('should require 19 confirmations for very large amounts (>= 10000)', async () => {
      // Override amount to match the expected 50000.00
      ;(getTronTransaction as jest.Mock).mockResolvedValue({
        txid: txHash,
        amount: '50000.00',
        to_address: expectedAddress,
        from_address: 'TSender',
        token_symbol: 'USDT',
        block_number: 12345
      })
      ;(getConfirmationInfo as jest.Mock).mockResolvedValue({
        confirmations: 18,
        blockNumber: 12345
      })

      const result = await service.verifyPayment(txHash, orderId, '50000.00', expectedAddress)

      expect(result.valid).toBe(false)
      expect(result.details?.requiredConfirmations).toBe(19)
    })

    it('should pass if confirmations meet the requirement', async () => {
      ;(getConfirmationInfo as jest.Mock).mockResolvedValue({
        confirmations: 5,
        blockNumber: 12345
      })

      ;(prisma.blockInfo.findUnique as jest.Mock).mockResolvedValue({
        block_number: 12345,
        block_hash: '0xhash',
        timestamp: new Date(Date.now() - 120000) // 2 分钟前，不在重组窗口
      })

      const result = await service.verifyPayment(txHash, orderId, '100.00', expectedAddress)

      expect(result.valid).toBe(true)
    })
  })

  describe('verifyPayment - Layer 6: Block Reorganization Detection', () => {
    const txHash = '0xtx'
    const orderId = 'order_reorg'
    const expectedAmount = '100.00'
    const expectedAddress = 'TAddr'

    beforeEach(() => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null)
      ;(getTronTransaction as jest.Mock).mockResolvedValue({
        txid: txHash,
        amount: expectedAmount,
        to_address: expectedAddress,
        from_address: 'TSender',
        token_symbol: 'USDT',
        block_number: 12345
      })
      ;(getConfirmationInfo as jest.Mock).mockResolvedValue({
        confirmations: 5,
        blockNumber: 12345
      })
    })

    it('should reject if block is within reorg window (< 1 minute)', async () => {
      ;(prisma.blockInfo.findUnique as jest.Mock).mockResolvedValue({
        block_number: 12345,
        block_hash: '0xhash',
        timestamp: new Date(Date.now() - 30000) // 30 秒前，在重组窗口内
      })

      const result = await service.verifyPayment(txHash, orderId, expectedAmount, expectedAddress)

      expect(result.valid).toBe(false)
      expect(result.reason).toContain('reorganization')
      expect(result.details?.isReorg).toBe(true)
    })

    it('should pass if block is outside reorg window (> 1 minute)', async () => {
      ;(prisma.blockInfo.findUnique as jest.Mock).mockResolvedValue({
        block_number: 12345,
        block_hash: '0xhash',
        timestamp: new Date(Date.now() - 120000) // 2 分钟前
      })

      const result = await service.verifyPayment(txHash, orderId, expectedAmount, expectedAddress)

      expect(result.valid).toBe(true)
      expect(result.details?.isReorg).toBe(false)
    })

    it('should be conservative and reject on reorg check error', async () => {
      ;(prisma.blockInfo.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error')
      )

      const result = await service.verifyPayment(txHash, orderId, expectedAmount, expectedAddress)

      expect(result.valid).toBe(false)
      expect(result.details?.isReorg).toBe(true)
    })
  })

  describe('verifyPayments - Batch Verification', () => {
    it('should verify multiple payments in parallel', async () => {
      const payments = [
        {
          txHash: '0xtx1',
          orderId: 'order_1',
          amount: '100.00',
          address: 'TAddr1'
        },
        {
          txHash: '0xtx2',
          orderId: 'order_2',
          amount: '200.00',
          address: 'TAddr2'
        }
      ]

      // Mock 所有验证通过
      ;(prisma.payment.findFirst as jest.Mock).mockResolvedValue(null)
      ;(getTronTransaction as jest.Mock).mockImplementation((txHash) => ({
        txid: txHash,
        amount: txHash === '0xtx1' ? '100.00' : '200.00',
        to_address: txHash === '0xtx1' ? 'TAddr1' : 'TAddr2',
        from_address: 'TSender',
        token_symbol: 'USDT',
        block_number: 12345
      }))
      ;(getConfirmationInfo as jest.Mock).mockResolvedValue({
        confirmations: 5,
        blockNumber: 12345
      })
      ;(prisma.blockInfo.findUnique as jest.Mock).mockResolvedValue({
        block_number: 12345,
        block_hash: '0xhash',
        timestamp: new Date(Date.now() - 120000)
      })

      const results = await service.verifyPayments(payments)

      expect(results).toHaveLength(2)
      expect(results[0].valid).toBe(true)
      expect(results[0].txHash).toBe('0xtx1')
      expect(results[1].valid).toBe(true)
      expect(results[1].txHash).toBe('0xtx2')
    })

    it('should handle mixed success/failure results', async () => {
      const payments = [
        {
          txHash: '0xtx1',
          orderId: 'order_1',
          amount: '100.00',
          address: 'TAddr1'
        },
        {
          txHash: '0xfake',
          orderId: 'order_2',
          amount: '200.00',
          address: 'TAddr2'
        }
      ]

      ;(prisma.payment.findFirst as jest.Mock).mockResolvedValue(null)
      ;(getTronTransaction as jest.Mock).mockImplementation((txHash) => {
        if (txHash === '0xtx1') {
          return {
            txid: txHash,
            amount: '100.00',
            to_address: 'TAddr1',
            from_address: 'TSender',
            token_symbol: 'USDT',
            block_number: 12345
          }
        }
        return null // 第二笔不存在
      })
      ;(getConfirmationInfo as jest.Mock).mockResolvedValue({
        confirmations: 5,
        blockNumber: 12345
      })
      ;(prisma.blockInfo.findUnique as jest.Mock).mockResolvedValue({
        block_number: 12345,
        block_hash: '0xhash',
        timestamp: new Date(Date.now() - 120000)
      })

      const results = await service.verifyPayments(payments)

      expect(results[0].valid).toBe(true)
      expect(results[1].valid).toBe(false)
      expect(results[1].reason).toContain('not found')
    })
  })

  describe('isTransactionUsed', () => {
    it('should return true if transaction is already used', async () => {
      ;(prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'payment_1',
        tx_hash: '0xtx',
        order_id: 'order_1'
      })

      const result = await service.isTransactionUsed('0xtx')

      expect(result).toBe(true)
    })

    it('should return false if transaction is not used', async () => {
      ;(prisma.payment.findFirst as jest.Mock).mockResolvedValue(null)

      const result = await service.isTransactionUsed('0xtx')

      expect(result).toBe(false)
    })
  })

  describe('getTransactionHistory', () => {
    it('should return all payments using the same transaction hash', async () => {
      const mockPayments = [
        {
          id: 'payment_1',
          tx_hash: '0xtx',
          order_id: 'order_1',
          order: {
            id: 'order_1',
            order_number: 'ORD-001',
            amount: 100,
            status: 'completed',
            created_at: new Date()
          }
        }
      ]

      ;(prisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments)

      const result = await service.getTransactionHistory('0xtx')

      expect(result).toEqual(mockPayments)
      expect(prisma.payment.findMany).toHaveBeenCalledWith({
        where: { tx_hash: '0xtx' },
        include: {
          order: {
            select: {
              id: true,
              order_number: true,
              amount: true,
              status: true,
              created_at: true
            }
          }
        }
      })
    })
  })
})
