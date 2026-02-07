/**
 * Networks Configuration Test Suite
 * Tests for unified network configuration
 */

import {
  ALL_NETWORKS,
  EVM_NETWORKS,
  TRON_NETWORKS,
  NETWORK_TOKENS,
  getNetworkById,
  getNetworkByChainId,
  getSupportedTokens,
  getTokenAddress,
  isNetworkSupported,
  getMainnetNetworks,
  getTestnetNetworks,
} from "../networks"

describe("Network Configuration", () => {
  test("should have all EVM networks", () => {
    expect(EVM_NETWORKS.ETHEREUM).toBeDefined()
    expect(EVM_NETWORKS.SEPOLIA).toBeDefined()
    expect(EVM_NETWORKS.BASE).toBeDefined()
    expect(EVM_NETWORKS.ARBITRUM).toBeDefined()
    expect(EVM_NETWORKS.BSC).toBeDefined()
  })

  test("should have all TRON networks", () => {
    expect(TRON_NETWORKS.TRON_MAINNET).toBeDefined()
    expect(TRON_NETWORKS.TRON_NILE).toBeDefined()
  })

  test("should merge EVM and TRON networks", () => {
    expect(ALL_NETWORKS.ethereum).toBeDefined()
    expect(ALL_NETWORKS.tron).toBeDefined()
    expect(ALL_NETWORKS.arbitrum).toBeDefined()
  })

  test("should have correct network types", () => {
    expect(EVM_NETWORKS.ETHEREUM.type).toBe("EVM")
    expect(TRON_NETWORKS.TRON_MAINNET.type).toBe("TRON")
  })

  test("should have correct chainId for EVM networks", () => {
    expect(EVM_NETWORKS.ETHEREUM.chainId).toBe(1)
    expect(EVM_NETWORKS.SEPOLIA.chainId).toBe(11155111)
    expect(EVM_NETWORKS.BASE.chainId).toBe(8453)
    expect(EVM_NETWORKS.ARBITRUM.chainId).toBe(42161)
    expect(EVM_NETWORKS.BSC.chainId).toBe(56)
  })

  test("should have correct RPC URLs", () => {
    expect(EVM_NETWORKS.ETHEREUM.rpcUrl).toBeTruthy()
    expect(TRON_NETWORKS.TRON_MAINNET.rpcUrl).toBe("https://api.trongrid.io")
  })

  test("should have correct block explorers", () => {
    expect(EVM_NETWORKS.ETHEREUM.blockExplorer).toBe("https://etherscan.io")
    expect(TRON_NETWORKS.TRON_MAINNET.blockExplorer).toBe("https://tronscan.org")
  })

  test("should correctly identify testnet vs mainnet", () => {
    expect(EVM_NETWORKS.ETHEREUM.isTestnet).toBe(false)
    expect(EVM_NETWORKS.SEPOLIA.isTestnet).toBe(true)
    expect(TRON_NETWORKS.TRON_MAINNET.isTestnet).toBe(false)
    expect(TRON_NETWORKS.TRON_NILE.isTestnet).toBe(true)
  })
})

describe("Network Lookup Functions", () => {
  test("should get network by ID", () => {
    const ethereum = getNetworkById("ethereum")
    expect(ethereum).toBeDefined()
    expect(ethereum?.name).toBe("Ethereum")

    const tron = getNetworkById("tron")
    expect(tron).toBeDefined()
    expect(tron?.name).toBe("TRON Mainnet")
  })

  test("should return undefined for invalid network ID", () => {
    expect(getNetworkById("invalid")).toBeUndefined()
  })

  test("should get network by chainId", () => {
    const ethereum = getNetworkByChainId(1)
    expect(ethereum).toBeDefined()
    expect(ethereum?.name).toBe("Ethereum")

    const arbitrum = getNetworkByChainId(42161)
    expect(arbitrum).toBeDefined()
    expect(arbitrum?.name).toBe("Arbitrum One")
  })

  test("should return undefined for invalid chainId", () => {
    expect(getNetworkByChainId(99999)).toBeUndefined()
  })

  test("should check if network is supported", () => {
    expect(isNetworkSupported("ethereum")).toBe(true)
    expect(isNetworkSupported("tron")).toBe(true)
    expect(isNetworkSupported("invalid")).toBe(false)
  })
})

describe("Token Configuration", () => {
  test("should have tokens for all mainnets", () => {
    expect(NETWORK_TOKENS.ethereum).toBeDefined()
    expect(NETWORK_TOKENS.arbitrum).toBeDefined()
    expect(NETWORK_TOKENS.base).toBeDefined()
    expect(NETWORK_TOKENS.bsc).toBeDefined()
    expect(NETWORK_TOKENS.tron).toBeDefined()
  })

  test("should have USDT for all networks", () => {
    const networks = ["ethereum", "arbitrum", "base", "bsc", "tron"]

    networks.forEach((network) => {
      const tokens = NETWORK_TOKENS[network]
      expect(tokens).toBeDefined()
      const usdt = tokens?.find((t) => t.symbol === "USDT")
      expect(usdt).toBeDefined()
    })
  })

  test("should have correct token decimals", () => {
    // Ethereum USDT is 6 decimals
    const ethTokens = NETWORK_TOKENS.ethereum
    const ethUsdt = ethTokens?.find((t) => t.symbol === "USDT")
    expect(ethUsdt?.decimals).toBe(6)

    // TRON USDT is 6 decimals
    const tronTokens = NETWORK_TOKENS.tron
    const tronUsdt = tronTokens?.find((t) => t.symbol === "USDT")
    expect(tronUsdt?.decimals).toBe(6)

    // DAI is usually 18 decimals
    const ethDai = ethTokens?.find((t) => t.symbol === "DAI")
    expect(ethDai?.decimals).toBe(18)
  })

  test("should have correct TRON USDT address", () => {
    const tronUsdt = getTokenAddress("tron", "USDT")
    expect(tronUsdt).toBe("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")
  })

  test("should have correct Ethereum USDT address", () => {
    const ethUsdt = getTokenAddress("ethereum", "USDT")
    expect(ethUsdt).toBe("0xdAC17F958D2ee523a2206206994597C13D831ec7")
  })
})

describe("Token Lookup Functions", () => {
  test("should get supported tokens for a network", () => {
    const tronTokens = getSupportedTokens("tron")
    expect(tronTokens.length).toBeGreaterThan(0)
    expect(tronTokens.some((t) => t.symbol === "USDT")).toBe(true)

    const ethTokens = getSupportedTokens("ethereum")
    expect(ethTokens.length).toBeGreaterThan(0)
    expect(ethTokens.some((t) => t.symbol === "USDT")).toBe(true)
  })

  test("should return empty array for unsupported network", () => {
    const tokens = getSupportedTokens("invalid_network")
    expect(tokens).toEqual([])
  })

  test("should get token address by symbol", () => {
    const usdtAddress = getTokenAddress("tron", "USDT")
    expect(usdtAddress).toBe("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")

    const usdcAddress = getTokenAddress("ethereum", "USDC")
    expect(usdcAddress).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
  })

  test("should return undefined for non-existent token", () => {
    expect(getTokenAddress("tron", "NONEXISTENT")).toBeUndefined()
  })
})

describe("Network Filtering", () => {
  test("should get mainnet networks only", () => {
    const mainnets = getMainnetNetworks()

    expect(mainnets.length).toBeGreaterThan(0)
    expect(mainnets.every((n) => !n.isTestnet)).toBe(true)
    expect(mainnets.some((n) => n.name === "Ethereum")).toBe(true)
    expect(mainnets.some((n) => n.name === "TRON Mainnet")).toBe(true)
    expect(mainnets.some((n) => n.name === "Sepolia Testnet")).toBe(false)
  })

  test("should get testnet networks only", () => {
    const testnets = getTestnetNetworks()

    expect(testnets.length).toBeGreaterThan(0)
    expect(testnets.every((n) => n.isTestnet)).toBe(true)
    expect(testnets.some((n) => n.name === "Sepolia Testnet")).toBe(true)
    expect(testnets.some((n) => n.name === "TRON Nile Testnet")).toBe(true)
    expect(testnets.some((n) => n.name === "Ethereum")).toBe(false)
  })
})

describe("Network Metadata", () => {
  test("should have native currency info", () => {
    const ethereum = getNetworkById("ethereum")
    expect(ethereum?.nativeCurrency.name).toBe("Ether")
    expect(ethereum?.nativeCurrency.symbol).toBe("ETH")
    expect(ethereum?.nativeCurrency.decimals).toBe(18)

    const tron = getNetworkById("tron")
    expect(tron?.nativeCurrency.name).toBe("TRX")
    expect(tron?.nativeCurrency.symbol).toBe("TRX")
    expect(tron?.nativeCurrency.decimals).toBe(6)
  })

  test("should have unique network IDs", () => {
    const ids = Object.keys(ALL_NETWORKS)
    const uniqueIds = new Set(ids)
    expect(ids.length).toBe(uniqueIds.size)
  })

  test("should have unique chainIds for EVM networks", () => {
    const chainIds = Object.values(EVM_NETWORKS)
      .map((n) => n.chainId)
      .filter((id): id is number => id !== undefined)

    const uniqueChainIds = new Set(chainIds)
    expect(chainIds.length).toBe(uniqueChainIds.size)
  })
})

describe("Real-world Scenarios", () => {
  test("should support multi-chain payment routing", () => {
    // User wants to send USDT, system should find it on both EVM and TRON
    const evmUsdt = getTokenAddress("ethereum", "USDT")
    const tronUsdt = getTokenAddress("tron", "USDT")

    expect(evmUsdt).toBeDefined()
    expect(tronUsdt).toBeDefined()
    expect(evmUsdt).not.toBe(tronUsdt) // Different addresses
  })

  test("should handle network switching in UI", () => {
    // Simulate user selecting a network
    const selectedNetworkId = "tron"
    const network = getNetworkById(selectedNetworkId)

    expect(network).toBeDefined()
    expect(network?.type).toBe("TRON")

    // Get available tokens for that network
    const tokens = getSupportedTokens(selectedNetworkId)
    expect(tokens.length).toBeGreaterThan(0)
  })

  test("should support batch payment validation", () => {
    // User uploads CSV with mixed EVM and TRON addresses
    const networks = ["ethereum", "arbitrum", "tron"]

    networks.forEach((networkId) => {
      expect(isNetworkSupported(networkId)).toBe(true)

      const tokens = getSupportedTokens(networkId)
      expect(tokens.some((t) => t.symbol === "USDT")).toBe(true)
    })
  })

  test("should provide correct explorer URLs", () => {
    const ethereum = getNetworkById("ethereum")
    expect(ethereum?.blockExplorer).toBe("https://etherscan.io")

    const tron = getNetworkById("tron")
    expect(tron?.blockExplorer).toBe("https://tronscan.org")

    const arbitrum = getNetworkById("arbitrum")
    expect(arbitrum?.blockExplorer).toBe("https://arbiscan.io")
  })
})

describe("Configuration Completeness", () => {
  test("all networks should have required fields", () => {
    Object.values(ALL_NETWORKS).forEach((network) => {
      expect(network.id).toBeTruthy()
      expect(network.name).toBeTruthy()
      expect(network.type).toBeTruthy()
      expect(network.nativeCurrency).toBeDefined()
      expect(network.rpcUrl).toBeTruthy()
      expect(network.blockExplorer).toBeTruthy()
      expect(typeof network.isTestnet).toBe("boolean")
    })
  })

  test("all tokens should have required fields", () => {
    Object.values(NETWORK_TOKENS).forEach((tokens) => {
      tokens.forEach((token) => {
        expect(token.address).toBeTruthy()
        expect(token.symbol).toBeTruthy()
        expect(typeof token.decimals).toBe("number")
        expect(token.decimals).toBeGreaterThan(0)
      })
    })
  })

  test("should have at least one mainnet and one testnet", () => {
    const mainnets = getMainnetNetworks()
    const testnets = getTestnetNetworks()

    expect(mainnets.length).toBeGreaterThan(0)
    expect(testnets.length).toBeGreaterThan(0)
  })
})
