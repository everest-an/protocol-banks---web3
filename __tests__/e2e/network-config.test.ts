/**
 * E2E Tests — Network Configuration
 *
 * Tests the unified network configuration layer covering EVM and TRON
 * networks, token addresses, and helper lookups.
 */

import {
  EVM_NETWORKS,
  TRON_NETWORKS,
  ALL_NETWORKS,
  NETWORK_TOKENS,
  getNetworkById,
  getNetworkByChainId,
  getSupportedTokens,
  getTokenAddress,
  isNetworkSupported,
  getMainnetNetworks,
  getTestnetNetworks,
  type NetworkConfig,
  type TokenConfig,
} from '@/lib/networks'

// ============================================
// Network Registry
// ============================================

describe('Network Registry', () => {
  describe('EVM_NETWORKS', () => {
    it('should contain all expected EVM networks', () => {
      const expectedKeys = ['ETHEREUM', 'SEPOLIA', 'BASE', 'ARBITRUM', 'POLYGON', 'OPTIMISM', 'BSC', 'HASHKEY']
      expectedKeys.forEach((key) => {
        expect(EVM_NETWORKS[key]).toBeDefined()
        expect(EVM_NETWORKS[key].type).toBe('EVM')
      })
    })

    it('should have valid chain IDs for all EVM networks', () => {
      Object.values(EVM_NETWORKS).forEach((network) => {
        expect(network.chainId).toBeDefined()
        expect(typeof network.chainId).toBe('number')
        expect(network.chainId).toBeGreaterThan(0)
      })
    })

    it('should have unique chain IDs', () => {
      const chainIds = Object.values(EVM_NETWORKS).map((n) => n.chainId)
      expect(new Set(chainIds).size).toBe(chainIds.length)
    })

    it('should have correct Ethereum mainnet config', () => {
      const eth = EVM_NETWORKS.ETHEREUM
      expect(eth.id).toBe('ethereum')
      expect(eth.chainId).toBe(1)
      expect(eth.nativeCurrency.symbol).toBe('ETH')
      expect(eth.nativeCurrency.decimals).toBe(18)
      expect(eth.isTestnet).toBe(false)
    })

    it('should mark Sepolia as testnet', () => {
      expect(EVM_NETWORKS.SEPOLIA.isTestnet).toBe(true)
      expect(EVM_NETWORKS.SEPOLIA.chainId).toBe(11155111)
    })

    it('should have correct HashKey Chain config', () => {
      const hsk = EVM_NETWORKS.HASHKEY
      expect(hsk.chainId).toBe(177)
      expect(hsk.nativeCurrency.symbol).toBe('HSK')
      expect(hsk.isTestnet).toBe(false)
    })
  })

  describe('TRON_NETWORKS', () => {
    it('should contain mainnet and testnet', () => {
      expect(TRON_NETWORKS.TRON_MAINNET).toBeDefined()
      expect(TRON_NETWORKS.TRON_NILE).toBeDefined()
    })

    it('should have correct TRON mainnet config', () => {
      const tron = TRON_NETWORKS.TRON_MAINNET
      expect(tron.id).toBe('tron')
      expect(tron.type).toBe('TRON')
      expect(tron.nativeCurrency.symbol).toBe('TRX')
      expect(tron.nativeCurrency.decimals).toBe(6)
      expect(tron.isTestnet).toBe(false)
      expect(tron.chainId).toBeUndefined()
    })

    it('should mark Nile as testnet', () => {
      expect(TRON_NETWORKS.TRON_NILE.isTestnet).toBe(true)
      expect(TRON_NETWORKS.TRON_NILE.id).toBe('tron-nile')
    })
  })

  describe('ALL_NETWORKS', () => {
    it('should contain all networks with lowercase keys', () => {
      const expectedKeys = ['ethereum', 'sepolia', 'polygon', 'optimism', 'base', 'arbitrum', 'bsc', 'hashkey', 'tron', 'tron-nile']
      expectedKeys.forEach((key) => {
        expect(ALL_NETWORKS[key]).toBeDefined()
      })
    })

    it('should have total of 10 networks', () => {
      expect(Object.keys(ALL_NETWORKS)).toHaveLength(10)
    })

    it('should have consistent data between sources', () => {
      expect(ALL_NETWORKS.ethereum).toBe(EVM_NETWORKS.ETHEREUM)
      expect(ALL_NETWORKS.tron).toBe(TRON_NETWORKS.TRON_MAINNET)
      expect(ALL_NETWORKS['tron-nile']).toBe(TRON_NETWORKS.TRON_NILE)
    })
  })
})

// ============================================
// Token Configuration
// ============================================

describe('Token Configuration', () => {
  describe('NETWORK_TOKENS', () => {
    it('should have tokens for all mainnets', () => {
      const mainnets = ['ethereum', 'arbitrum', 'base', 'bsc', 'tron']
      mainnets.forEach((network) => {
        expect(NETWORK_TOKENS[network]).toBeDefined()
        expect(NETWORK_TOKENS[network].length).toBeGreaterThan(0)
      })
    })

    it('should have USDT on all major networks', () => {
      const networksWithUsdt = ['ethereum', 'arbitrum', 'base', 'bsc', 'tron']
      networksWithUsdt.forEach((network) => {
        const usdt = NETWORK_TOKENS[network].find((t) => t.symbol === 'USDT')
        expect(usdt).toBeDefined()
        expect(usdt!.address).toBeDefined()
        expect(usdt!.decimals).toBeDefined()
      })
    })

    it('should have USDC on major EVM networks', () => {
      const networksWithUsdc = ['ethereum', 'arbitrum', 'base']
      networksWithUsdc.forEach((network) => {
        const usdc = NETWORK_TOKENS[network].find((t) => t.symbol === 'USDC')
        expect(usdc).toBeDefined()
        expect(usdc!.decimals).toBe(6)
      })
    })

    it('should have correct TRON USDT address (TRC20)', () => {
      const tronUsdt = NETWORK_TOKENS.tron.find((t) => t.symbol === 'USDT')
      expect(tronUsdt).toBeDefined()
      expect(tronUsdt!.address).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
      expect(tronUsdt!.decimals).toBe(6)
    })

    it('should have valid token addresses (EVM format for EVM, Base58 for TRON)', () => {
      // EVM tokens should start with 0x
      const evmNetworks = ['ethereum', 'arbitrum', 'base', 'bsc']
      evmNetworks.forEach((network) => {
        NETWORK_TOKENS[network].forEach((token) => {
          expect(token.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
        })
      })

      // TRON tokens should start with T
      NETWORK_TOKENS.tron.forEach((token) => {
        expect(token.address).toMatch(/^T/)
      })
    })

    it('should have testnet tokens for development', () => {
      expect(NETWORK_TOKENS.sepolia).toBeDefined()
      expect(NETWORK_TOKENS.sepolia.length).toBeGreaterThan(0)
      expect(NETWORK_TOKENS['tron-nile']).toBeDefined()
      expect(NETWORK_TOKENS['tron-nile'].length).toBeGreaterThan(0)
    })
  })
})

// ============================================
// Helper Functions
// ============================================

describe('Network Lookup Helpers', () => {
  describe('getNetworkById', () => {
    it('should find networks by ID', () => {
      expect(getNetworkById('ethereum')?.name).toBe('Ethereum')
      expect(getNetworkById('tron')?.name).toBe('TRON Mainnet')
      expect(getNetworkById('base')?.name).toBe('Base')
    })

    it('should return undefined for unknown networks', () => {
      expect(getNetworkById('solana')).toBeUndefined()
      expect(getNetworkById('')).toBeUndefined()
    })
  })

  describe('getNetworkByChainId', () => {
    it('should find EVM networks by chain ID', () => {
      expect(getNetworkByChainId(1)?.id).toBe('ethereum')
      expect(getNetworkByChainId(8453)?.id).toBe('base')
      expect(getNetworkByChainId(42161)?.id).toBe('arbitrum')
      expect(getNetworkByChainId(56)?.id).toBe('bsc')
      expect(getNetworkByChainId(177)?.id).toBe('hashkey')
    })

    it('should return undefined for unknown chain IDs', () => {
      expect(getNetworkByChainId(99999)).toBeUndefined()
      expect(getNetworkByChainId(0)).toBeUndefined()
    })
  })

  describe('getSupportedTokens', () => {
    it('should return tokens for known networks', () => {
      const ethTokens = getSupportedTokens('ethereum')
      expect(ethTokens.length).toBeGreaterThan(0)
      expect(ethTokens.some((t) => t.symbol === 'USDT')).toBe(true)
    })

    it('should return empty array for unknown networks', () => {
      expect(getSupportedTokens('solana')).toEqual([])
    })
  })

  describe('getTokenAddress', () => {
    it('should find token addresses by network and symbol', () => {
      const usdtAddr = getTokenAddress('ethereum', 'USDT')
      expect(usdtAddr).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7')

      const tronUsdt = getTokenAddress('tron', 'USDT')
      expect(tronUsdt).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
    })

    it('should return undefined for missing token', () => {
      expect(getTokenAddress('ethereum', 'SHIB')).toBeUndefined()
      expect(getTokenAddress('unknown', 'USDT')).toBeUndefined()
    })
  })

  describe('isNetworkSupported', () => {
    it('should return true for supported networks', () => {
      expect(isNetworkSupported('ethereum')).toBe(true)
      expect(isNetworkSupported('tron')).toBe(true)
      expect(isNetworkSupported('base')).toBe(true)
    })

    it('should return false for unsupported networks', () => {
      expect(isNetworkSupported('solana')).toBe(false)
      expect(isNetworkSupported('')).toBe(false)
    })
  })

  describe('getMainnetNetworks', () => {
    it('should return only mainnets', () => {
      const mainnets = getMainnetNetworks()
      expect(mainnets.every((n) => !n.isTestnet)).toBe(true)
      expect(mainnets.length).toBeGreaterThan(0)
    })

    it('should not include testnets', () => {
      const mainnets = getMainnetNetworks()
      expect(mainnets.some((n) => n.id === 'sepolia')).toBe(false)
      expect(mainnets.some((n) => n.id === 'tron-nile')).toBe(false)
    })
  })

  describe('getTestnetNetworks', () => {
    it('should return only testnets', () => {
      const testnets = getTestnetNetworks()
      expect(testnets.every((n) => n.isTestnet)).toBe(true)
      expect(testnets.length).toBe(2) // sepolia + tron-nile
    })
  })
})

// ============================================
// E2E: Full Network Resolution Scenario
// ============================================

describe('E2E: Network Resolution for Payment', () => {
  it('should resolve full context for an EVM payment', () => {
    const chainId = 8453 // Base

    // Step 1: Resolve network from chain ID
    const network = getNetworkByChainId(chainId)
    expect(network).toBeDefined()
    expect(network!.id).toBe('base')
    expect(network!.type).toBe('EVM')

    // Step 2: Get available tokens
    const tokens = getSupportedTokens(network!.id)
    expect(tokens.length).toBeGreaterThan(0)

    // Step 3: Find USDC address
    const usdcAddress = getTokenAddress(network!.id, 'USDC')
    expect(usdcAddress).toBeDefined()
    expect(usdcAddress).toMatch(/^0x/)

    // Step 4: Verify network is supported
    expect(isNetworkSupported(network!.id)).toBe(true)
  })

  it('should resolve full context for a TRON payment', () => {
    // Step 1: Get TRON network by ID
    const network = getNetworkById('tron')
    expect(network).toBeDefined()
    expect(network!.type).toBe('TRON')

    // Step 2: Get USDT on TRON
    const usdtAddress = getTokenAddress('tron', 'USDT')
    expect(usdtAddress).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')

    // Step 3: Verify native currency
    expect(network!.nativeCurrency.symbol).toBe('TRX')
    expect(network!.nativeCurrency.decimals).toBe(6)

    // Step 4: Confirm it's mainnet
    expect(network!.isTestnet).toBe(false)
  })

  it('should handle cross-chain token lookup', () => {
    // USDT exists on all networks but at different addresses
    const networks = ['ethereum', 'arbitrum', 'base', 'bsc', 'tron']
    const usdtAddresses = new Map<string, string>()

    networks.forEach((networkId) => {
      const addr = getTokenAddress(networkId, 'USDT')
      expect(addr).toBeDefined()
      usdtAddresses.set(networkId, addr!)
    })

    // All USDT addresses should be unique (different per chain)
    const uniqueAddresses = new Set(usdtAddresses.values())
    expect(uniqueAddresses.size).toBe(networks.length)
  })
})
