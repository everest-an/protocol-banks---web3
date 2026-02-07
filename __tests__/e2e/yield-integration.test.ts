/**
 * E2E Tests — Yield Integration
 *
 * Tests the unified yield service integration across EVM (Aave V3)
 * and TRON (JustLend), including cross-network summary and auto-deposit hooks.
 */

import { UnifiedYieldService } from '@/lib/services/yield/unified-yield.service'
import { yieldAggregatorService } from '@/lib/services/yield/yield-aggregator.service'
import { tronYieldService } from '@/lib/services/yield/tron-yield.service'
import { validateAddress, getNetworkForAddress } from '@/lib/address-utils'
import { getNetworkById, isNetworkSupported } from '@/lib/networks'

// Mock dependencies
jest.mock('@/lib/services/yield/yield-aggregator.service')
jest.mock('@/lib/services/yield/tron-yield.service')
jest.mock('@/lib/logger/structured-logger')

// ============================================
// Test Constants
// ============================================

const EVM_MERCHANT = '0x1234567890123456789012345678901234567890'
const TRON_MERCHANT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

// ============================================
// Unified Yield Service
// ============================================

describe('Unified Yield Service', () => {
  let service: UnifiedYieldService

  beforeEach(() => {
    service = new UnifiedYieldService()
    jest.clearAllMocks()
  })

  describe('Network Type Detection', () => {
    it('should identify EVM yield networks', () => {
      const evmNetworks = ['ethereum', 'base', 'arbitrum']
      evmNetworks.forEach((network) => {
        // @ts-ignore - accessing private method
        expect(service.getNetworkType(network)).toBe('EVM')
      })
    })

    it('should identify TRON yield networks', () => {
      // @ts-ignore
      expect(service.getNetworkType('tron')).toBe('TRON')
      // @ts-ignore
      expect(service.getNetworkType('tron-nile')).toBe('TRON')
    })

    it('should fallback to EVM for unknown networks (no throw)', () => {
      // getNetworkType uses startsWith('tron') check — anything else becomes EVM
      // @ts-ignore
      expect(service.getNetworkType('solana')).toBe('EVM')
    })
  })

  describe('EVM Balance (Aave V3)', () => {
    it('should fetch balance from Aave for EVM networks', async () => {
      const mockBalance = {
        merchant: EVM_MERCHANT,
        network: 'base' as const,
        principal: '10000.00',
        interest: '250.00',
        totalBalance: '10250.00',
        apy: 4.5,
        lastOperationTime: new Date(),
      }

      // @ts-ignore
      yieldAggregatorService.getMerchantBalance = jest.fn().mockResolvedValue(mockBalance)

      const result = await service.getBalance('base', EVM_MERCHANT)

      expect(result).toMatchObject({
        merchant: EVM_MERCHANT,
        network: 'base',
        networkType: 'EVM',
        principal: '10000.00',
        interest: '250.00',
        totalBalance: '10250.00',
        apy: 4.5,
        protocol: 'Aave V3',
      })
    })

    it('should fetch balance from multiple EVM networks', async () => {
      const networks = ['ethereum', 'base', 'arbitrum']

      for (const network of networks) {
        const mockBalance = {
          merchant: EVM_MERCHANT,
          network: network as any,
          principal: '1000.00',
          interest: '50.00',
          totalBalance: '1050.00',
          apy: 5.0,
          lastOperationTime: new Date(),
        }

        // @ts-ignore
        yieldAggregatorService.getMerchantBalance = jest.fn().mockResolvedValue(mockBalance)

        const result = await service.getBalance(network, EVM_MERCHANT)
        expect(result.networkType).toBe('EVM')
        expect(result.protocol).toBe('Aave V3')
      }
    })
  })

  describe('TRON Balance (JustLend)', () => {
    it('should fetch balance from JustLend for TRON', async () => {
      const mockBalance = {
        merchant: EVM_MERCHANT,
        network: 'tron' as const,
        principal: '5000.00',
        interest: '200.00',
        totalBalance: '5200.00',
        jTokenBalance: '5200000000',
        exchangeRate: '1000000000000000000',
        apy: 4.0,
      }

      // @ts-ignore
      tronYieldService.getMerchantBalance = jest.fn().mockResolvedValue(mockBalance)

      const result = await service.getBalance('tron', EVM_MERCHANT)

      expect(result).toMatchObject({
        networkType: 'TRON',
        principal: '5000.00',
        interest: '200.00',
        totalBalance: '5200.00',
        apy: 4.0,
        protocol: 'JustLend',
      })
    })
  })

  describe('Cross-Network Summary', () => {
    it('should aggregate balances across all networks', async () => {
      // Mock EVM balances
      const evmBalances = [
        { merchant: EVM_MERCHANT, network: 'ethereum', principal: '5000.00', interest: '100.00', totalBalance: '5100.00', apy: 4.0, lastOperationTime: new Date() },
        { merchant: EVM_MERCHANT, network: 'base', principal: '3000.00', interest: '150.00', totalBalance: '3150.00', apy: 5.0, lastOperationTime: new Date() },
      ]

      // @ts-ignore
      yieldAggregatorService.getMerchantBalance = jest.fn()
        .mockResolvedValueOnce(evmBalances[0])
        .mockResolvedValueOnce(evmBalances[1])
        .mockResolvedValue(null)

      // Mock TRON balance
      const tronBalance = {
        merchant: EVM_MERCHANT,
        network: 'tron',
        principal: '2000.00',
        interest: '80.00',
        totalBalance: '2080.00',
        jTokenBalance: '2080000000',
        exchangeRate: '1000000000000000000',
        apy: 4.0,
      }

      // @ts-ignore
      tronYieldService.getMerchantBalance = jest.fn().mockResolvedValue(tronBalance)

      const summary = await service.getCrossNetworkSummary(EVM_MERCHANT)

      // Total: 5000 + 3000 + 2000 = 10000 principal
      expect(parseFloat(summary.totalPrincipal)).toBeCloseTo(10000, 0)
      // Total interest: 100 + 150 + 80 = 330
      expect(parseFloat(summary.totalInterest)).toBeCloseTo(330, 0)
      // Total balance: 5100 + 3150 + 2080 = 10330
      expect(parseFloat(summary.totalBalance)).toBeCloseTo(10330, 0)

      // Should have entries for successful networks
      expect(summary.balances.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle network failures gracefully', async () => {
      // @ts-ignore
      yieldAggregatorService.getMerchantBalance = jest.fn()
        .mockRejectedValueOnce(new Error('Ethereum RPC timeout'))
        .mockResolvedValueOnce({
          merchant: EVM_MERCHANT,
          network: 'base',
          principal: '1000.00',
          interest: '50.00',
          totalBalance: '1050.00',
          apy: 5.0,
          lastOperationTime: new Date(),
        })
        .mockResolvedValue(null)

      // @ts-ignore
      tronYieldService.getMerchantBalance = jest.fn().mockRejectedValue(new Error('TRON error'))

      const summary = await service.getCrossNetworkSummary(EVM_MERCHANT)

      // Should still return data from successful queries
      expect(summary.balances.length).toBeGreaterThan(0)
      expect(parseFloat(summary.totalBalance)).toBeGreaterThan(0)
    })

    it('should calculate weighted average APY', async () => {
      // @ts-ignore
      yieldAggregatorService.getMerchantBalance = jest.fn()
        .mockResolvedValueOnce({
          merchant: EVM_MERCHANT, network: 'ethereum',
          principal: '10000.00', interest: '400.00', totalBalance: '10400.00',
          apy: 4.0, lastOperationTime: new Date(),
        })
        .mockResolvedValueOnce({
          merchant: EVM_MERCHANT, network: 'base',
          principal: '10000.00', interest: '800.00', totalBalance: '10800.00',
          apy: 8.0, lastOperationTime: new Date(),
        })
        .mockResolvedValue(null)

      // @ts-ignore
      tronYieldService.getMerchantBalance = jest.fn().mockResolvedValue(null)

      const summary = await service.getCrossNetworkSummary(EVM_MERCHANT)

      // Weighted average: (10000 * 4.0 + 10000 * 8.0) / 20000 = 6.0
      expect(summary.averageAPY).toBeCloseTo(6.0, 1)
    })
  })

  describe('Auto-Deposit Hook', () => {
    it('should route deposits to Aave for EVM payments', async () => {
      // @ts-ignore
      yieldAggregatorService.autoDepositHook = jest.fn().mockResolvedValue(undefined)

      await service.autoDepositHook('order_001', EVM_MERCHANT, '5000.00', 'base')

      expect(yieldAggregatorService.autoDepositHook).toHaveBeenCalledWith(
        'order_001', EVM_MERCHANT, '5000.00', 'base'
      )
    })

    it('should route deposits to JustLend for TRON payments', async () => {
      // @ts-ignore
      tronYieldService.autoDepositHook = jest.fn().mockResolvedValue(undefined)

      await service.autoDepositHook('order_002', EVM_MERCHANT, '3000.00', 'tron')

      expect(tronYieldService.autoDepositHook).toHaveBeenCalledWith(
        'order_002', EVM_MERCHANT, '3000.00'
      )
    })
  })

  describe('Supported Networks', () => {
    it('should list all supported yield networks', () => {
      const networks = service.getSupportedNetworks()

      expect(networks.length).toBeGreaterThanOrEqual(3)

      // Should include Ethereum
      const eth = networks.find((n) => n.network === 'ethereum')
      expect(eth).toBeDefined()
      expect(eth!.type).toBe('EVM')
      expect(eth!.protocol).toBe('Aave V3')

      // Should include TRON
      const tron = networks.find((n) => n.network === 'tron')
      expect(tron).toBeDefined()
      expect(tron!.type).toBe('TRON')
      expect(tron!.protocol).toBe('JustLend')
    })
  })
})

// ============================================
// E2E: Payment → Auto-Deposit → Balance Check
// ============================================

describe('E2E: Payment to Yield Pipeline', () => {
  let service: UnifiedYieldService

  beforeEach(() => {
    service = new UnifiedYieldService()
    jest.clearAllMocks()
  })

  it('should simulate full payment → yield deposit → balance query flow (EVM)', async () => {
    // Step 1: Validate merchant address
    const merchantAddr = EVM_MERCHANT
    const addrResult = validateAddress(merchantAddr)
    expect(addrResult.isValid).toBe(true)
    expect(addrResult.type).toBe('EVM')

    // Step 2: Resolve network
    const network = 'base'
    expect(isNetworkSupported(network)).toBe(true)

    const networkConfig = getNetworkById(network)
    expect(networkConfig!.type).toBe('EVM')

    // Step 3: Payment received → auto-deposit triggered
    // @ts-ignore
    yieldAggregatorService.autoDepositHook = jest.fn().mockResolvedValue(undefined)

    await service.autoDepositHook('order_100', merchantAddr, '10000.00', network)
    expect(yieldAggregatorService.autoDepositHook).toHaveBeenCalled()

    // Step 4: Check balance after deposit
    // @ts-ignore
    yieldAggregatorService.getMerchantBalance = jest.fn().mockResolvedValue({
      merchant: merchantAddr,
      network: 'base',
      principal: '10000.00',
      interest: '0.00',
      totalBalance: '10000.00',
      apy: 5.2,
      lastOperationTime: new Date(),
    })

    const balance = await service.getBalance(network, merchantAddr)
    expect(balance.principal).toBe('10000.00')
    expect(balance.protocol).toBe('Aave V3')
    expect(balance.networkType).toBe('EVM')
  })

  it('should simulate full payment → yield deposit → balance query flow (TRON)', async () => {
    // Step 1: Validate TRON address
    const tronAddr = TRON_MERCHANT
    const addrResult = validateAddress(tronAddr)
    expect(addrResult.isValid).toBe(true)
    expect(addrResult.type).toBe('TRON')

    // Step 2: Network detection
    const network = getNetworkForAddress(tronAddr)
    expect(network).toBe('tron')

    // Step 3: Auto-deposit to JustLend
    // @ts-ignore
    tronYieldService.autoDepositHook = jest.fn().mockResolvedValue(undefined)

    await service.autoDepositHook('order_200', tronAddr, '5000.00', 'tron')
    expect(tronYieldService.autoDepositHook).toHaveBeenCalledWith(
      'order_200', tronAddr, '5000.00'
    )

    // Step 4: Query balance
    // @ts-ignore
    tronYieldService.getMerchantBalance = jest.fn().mockResolvedValue({
      merchant: tronAddr,
      network: 'tron',
      principal: '5000.00',
      interest: '0.00',
      totalBalance: '5000.00',
      jTokenBalance: '5000000000',
      exchangeRate: '1000000000000000000',
      apy: 3.8,
    })

    const balance = await service.getBalance('tron', tronAddr)
    expect(balance.principal).toBe('5000.00')
    expect(balance.protocol).toBe('JustLend')
    expect(balance.networkType).toBe('TRON')
  })

  it('should simulate cross-network portfolio view after multiple deposits', async () => {
    // Mock multiple network balances
    // @ts-ignore
    yieldAggregatorService.getMerchantBalance = jest.fn()
      .mockResolvedValueOnce({
        merchant: EVM_MERCHANT, network: 'ethereum',
        principal: '20000.00', interest: '500.00', totalBalance: '20500.00',
        apy: 3.5, lastOperationTime: new Date(),
      })
      .mockResolvedValueOnce({
        merchant: EVM_MERCHANT, network: 'base',
        principal: '15000.00', interest: '750.00', totalBalance: '15750.00',
        apy: 5.0, lastOperationTime: new Date(),
      })
      .mockResolvedValue(null) // Other networks return null

    // @ts-ignore
    tronYieldService.getMerchantBalance = jest.fn().mockResolvedValue({
      merchant: EVM_MERCHANT, network: 'tron',
      principal: '10000.00', interest: '400.00', totalBalance: '10400.00',
      jTokenBalance: '10400000000', exchangeRate: '1000000000000000000',
      apy: 4.0,
    })

    const portfolio = await service.getCrossNetworkSummary(EVM_MERCHANT)

    // Total principal: 20000 + 15000 + 10000 = 45000
    expect(parseFloat(portfolio.totalPrincipal)).toBeCloseTo(45000, 0)

    // Total interest: 500 + 750 + 400 = 1650
    expect(parseFloat(portfolio.totalInterest)).toBeCloseTo(1650, 0)

    // Total balance: 20500 + 15750 + 10400 = 46650
    expect(parseFloat(portfolio.totalBalance)).toBeCloseTo(46650, 0)

    // Weighted APY: (20000*3.5 + 15000*5.0 + 10000*4.0) / 45000 ≈ 4.0
    expect(portfolio.averageAPY).toBeCloseTo(4.0, 0)

    // Should have 3 network entries
    expect(portfolio.balances).toHaveLength(3)
  })
})
