/**
 * Unified Yield Service Tests
 *
 * 测试统一收益服务的核心功能
 */

import { UnifiedYieldService } from '@/lib/services/yield/unified-yield.service'
import { yieldAggregatorService } from '@/lib/services/yield/yield-aggregator.service'
import { tronYieldService } from '@/lib/services/yield/tron-yield.service'

// Mock 依赖服务
jest.mock('@/lib/services/yield/yield-aggregator.service')
jest.mock('@/lib/services/yield/tron-yield.service')
jest.mock('@/lib/logger/structured-logger')

describe('UnifiedYieldService', () => {
  let service: UnifiedYieldService

  beforeEach(() => {
    service = new UnifiedYieldService()
    jest.clearAllMocks()
  })

  describe('getNetworkType', () => {
    it('should detect EVM networks', () => {
      const networks = ['ethereum', 'base', 'arbitrum']
      networks.forEach(network => {
        // @ts-ignore - accessing private method for testing
        expect(service.getNetworkType(network)).toBe('EVM')
      })
    })

    it('should detect TRON networks', () => {
      const networks = ['tron', 'tron-nile']
      networks.forEach(network => {
        // @ts-ignore - accessing private method for testing
        expect(service.getNetworkType(network)).toBe('TRON')
      })
    })
  })

  describe('getBalance', () => {
    const mockMerchant = '0x1234567890123456789012345678901234567890'

    it('should fetch balance from Aave for EVM networks', async () => {
      const mockBalance = {
        merchant: mockMerchant,
        network: 'base' as const,
        principal: '1000.00',
        interest: '50.00',
        totalBalance: '1050.00',
        apy: 5.0,
        lastOperationTime: new Date()
      }

      // @ts-ignore
      yieldAggregatorService.getMerchantBalance = jest.fn().mockResolvedValue(mockBalance)

      const result = await service.getBalance('base', mockMerchant)

      expect(result).toEqual({
        merchant: mockMerchant,
        network: 'base',
        networkType: 'EVM',
        principal: '1000.00',
        interest: '50.00',
        totalBalance: '1050.00',
        apy: 5.0,
        protocol: 'Aave V3'
      })

      expect(yieldAggregatorService.getMerchantBalance).toHaveBeenCalledWith('base', mockMerchant)
    })

    it('should fetch balance from JustLend for TRON network', async () => {
      const mockBalance = {
        merchant: mockMerchant,
        network: 'tron' as const,
        principal: '2000.00',
        interest: '100.00',
        totalBalance: '2100.00',
        jTokenBalance: '2100000000',
        exchangeRate: '1000000000000000000',
        apy: 5.0
      }

      // @ts-ignore
      tronYieldService.getMerchantBalance = jest.fn().mockResolvedValue(mockBalance)

      const result = await service.getBalance('tron', mockMerchant)

      expect(result).toEqual({
        merchant: mockMerchant,
        network: 'tron',
        networkType: 'TRON',
        principal: '2000.00',
        interest: '100.00',
        totalBalance: '2100.00',
        apy: 5.0,
        protocol: 'JustLend'
      })

      expect(tronYieldService.getMerchantBalance).toHaveBeenCalledWith(mockMerchant)
    })

    it('should handle errors gracefully', async () => {
      // @ts-ignore
      yieldAggregatorService.getMerchantBalance = jest.fn().mockRejectedValue(
        new Error('Network error')
      )

      await expect(service.getBalance('base', mockMerchant)).rejects.toThrow('Network error')
    })
  })

  describe('getCrossNetworkSummary', () => {
    const mockMerchant = '0x1234567890123456789012345678901234567890'

    it('should aggregate balances across multiple networks', async () => {
      const mockBalances = {
        base: {
          merchant: mockMerchant,
          network: 'base' as const,
          principal: '1000.00',
          interest: '50.00',
          totalBalance: '1050.00',
          apy: 5.0,
          lastOperationTime: new Date()
        },
        ethereum: {
          merchant: mockMerchant,
          network: 'ethereum' as const,
          principal: '2000.00',
          interest: '100.00',
          totalBalance: '2100.00',
          apy: 5.0,
          lastOperationTime: new Date()
        }
      }

      const mockTronBalance = {
        merchant: mockMerchant,
        network: 'tron' as const,
        principal: '3000.00',
        interest: '150.00',
        totalBalance: '3150.00',
        jTokenBalance: '3150000000',
        exchangeRate: '1000000000000000000',
        apy: 5.0
      }

      // @ts-ignore
      yieldAggregatorService.getMerchantBalance = jest.fn()
        .mockResolvedValueOnce(mockBalances.ethereum)
        .mockResolvedValueOnce(mockBalances.base)
        .mockResolvedValue(null)

      // @ts-ignore
      tronYieldService.getMerchantBalance = jest.fn().mockResolvedValue(mockTronBalance)

      const result = await service.getCrossNetworkSummary(mockMerchant)

      expect(result.totalPrincipal).toBe('6000.000000')
      expect(result.totalInterest).toBe('300.000000')
      expect(result.totalBalance).toBe('6300.000000')
      expect(result.averageAPY).toBe(5.0)
      expect(result.balances).toHaveLength(3)
    })

    it('should handle partial failures in network queries', async () => {
      const mockBalance = {
        merchant: mockMerchant,
        network: 'base' as const,
        principal: '1000.00',
        interest: '50.00',
        totalBalance: '1050.00',
        apy: 5.0,
        lastOperationTime: new Date()
      }

      // @ts-ignore
      yieldAggregatorService.getMerchantBalance = jest.fn()
        .mockResolvedValueOnce(mockBalance)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(null)

      // @ts-ignore
      tronYieldService.getMerchantBalance = jest.fn().mockRejectedValue(new Error('TRON error'))

      const result = await service.getCrossNetworkSummary(mockMerchant)

      // Should still return results for successful queries
      expect(result.balances.length).toBeGreaterThan(0)
      expect(parseFloat(result.totalBalance)).toBeGreaterThan(0)
    })

    it('should calculate weighted average APY correctly', async () => {
      const balances = [
        {
          merchant: mockMerchant,
          network: 'base' as const,
          principal: '1000.00',
          interest: '50.00',
          totalBalance: '1050.00',
          apy: 5.0,
          lastOperationTime: new Date()
        },
        {
          merchant: mockMerchant,
          network: 'ethereum' as const,
          principal: '3000.00',
          interest: '240.00',
          totalBalance: '3240.00',
          apy: 8.0,
          lastOperationTime: new Date()
        }
      ]

      // @ts-ignore
      yieldAggregatorService.getMerchantBalance = jest.fn()
        .mockResolvedValueOnce(balances[0])
        .mockResolvedValueOnce(balances[1])
        .mockResolvedValue(null)

      // @ts-ignore
      tronYieldService.getMerchantBalance = jest.fn().mockResolvedValue(null)

      const result = await service.getCrossNetworkSummary(mockMerchant)

      // Weighted average: (1000 * 5.0 + 3000 * 8.0) / 4000 = 7.25
      expect(result.averageAPY).toBeCloseTo(7.25, 1)
    })
  })

  describe('getSupportedNetworks', () => {
    it('should return all supported networks with metadata', () => {
      const networks = service.getSupportedNetworks()

      expect(networks).toHaveLength(5)

      // Check Ethereum
      const ethereum = networks.find(n => n.network === 'ethereum')
      expect(ethereum).toEqual({
        network: 'ethereum',
        type: 'EVM',
        protocol: 'Aave V3',
        chainId: 1,
        name: 'Ethereum Mainnet'
      })

      // Check TRON
      const tron = networks.find(n => n.network === 'tron')
      expect(tron).toEqual({
        network: 'tron',
        type: 'TRON',
        protocol: 'JustLend',
        chainId: null,
        name: 'TRON Mainnet'
      })
    })
  })

  describe('autoDepositHook', () => {
    const orderId = 'order_123'
    const merchantId = '0x1234567890123456789012345678901234567890'
    const amount = '1000.00'

    it('should route to Aave for EVM networks', async () => {
      // @ts-ignore
      yieldAggregatorService.autoDepositHook = jest.fn().mockResolvedValue(undefined)

      await service.autoDepositHook(orderId, merchantId, amount, 'base')

      expect(yieldAggregatorService.autoDepositHook).toHaveBeenCalledWith(
        orderId,
        merchantId,
        amount,
        'base'
      )
    })

    it('should route to JustLend for TRON network', async () => {
      // @ts-ignore
      tronYieldService.autoDepositHook = jest.fn().mockResolvedValue(undefined)

      await service.autoDepositHook(orderId, merchantId, amount, 'tron')

      expect(tronYieldService.autoDepositHook).toHaveBeenCalledWith(
        orderId,
        merchantId,
        amount
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid network types', async () => {
      const invalidNetwork = 'invalid-network' as any

      await expect(
        service.getBalance(invalidNetwork, '0x123')
      ).rejects.toThrow()
    })

    it('should handle empty merchant address', async () => {
      await expect(
        service.getBalance('base', '')
      ).rejects.toThrow()
    })
  })
})
