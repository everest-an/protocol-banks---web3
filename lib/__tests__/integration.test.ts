/**
 * Integration Test Suite
 * Tests the complete flow of multi-network support
 */

import { detectAddressType } from "../address-utils"
import { ALL_NETWORKS, getSupportedTokens, getTokenAddress } from "../networks"

describe("Multi-Network Integration Tests", () => {
  describe("Address Detection Integration", () => {
    test("should correctly identify TRON addresses", () => {
      const tronAddresses = [
        "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // USDT TRC20
        "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8", // USDC TRC20
        "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf", // Test address
      ]

      tronAddresses.forEach((address) => {
        const type = detectAddressType(address)
        expect(type).toBe("TRON")
      })
    })

    test("should reject invalid addresses", () => {
      const invalidAddresses = ["", "invalid", "T123", "ZZZZ"]

      invalidAddresses.forEach((address) => {
        const type = detectAddressType(address)
        expect(type).toBe("INVALID")
      })
    })
  })

  describe("Network Configuration Integration", () => {
    test("should have all required networks", () => {
      expect(ALL_NETWORKS.ethereum).toBeDefined()
      expect(ALL_NETWORKS.arbitrum).toBeDefined()
      expect(ALL_NETWORKS.base).toBeDefined()
      expect(ALL_NETWORKS.tron).toBeDefined()
    })

    test("should provide USDT for all networks", () => {
      const networks = ["ethereum", "arbitrum", "base", "tron"]

      networks.forEach((network) => {
        const usdtAddress = getTokenAddress(network, "USDT")
        expect(usdtAddress).toBeTruthy()
        expect(typeof usdtAddress).toBe("string")
      })
    })

    test("should have correct TRON USDT address", () => {
      const tronUsdt = getTokenAddress("tron", "USDT")
      expect(tronUsdt).toBe("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")
    })

    test("should differentiate between mainnet and testnet", () => {
      const tronMainnet = ALL_NETWORKS.tron
      const tronTestnet = ALL_NETWORKS["tron-nile"]

      expect(tronMainnet.isTestnet).toBe(false)
      expect(tronTestnet.isTestnet).toBe(true)
    })
  })

  describe("Token Configuration Integration", () => {
    test("should have correct token decimals for TRON USDT", () => {
      const tokens = getSupportedTokens("tron")
      const usdt = tokens.find((t) => t.symbol === "USDT")

      expect(usdt).toBeDefined()
      expect(usdt?.decimals).toBe(6)
    })

    test("should support multiple stablecoins on TRON", () => {
      const tokens = getSupportedTokens("tron")
      const symbols = tokens.map((t) => t.symbol)

      expect(symbols).toContain("USDT")
      expect(symbols).toContain("USDC")
    })
  })

  describe("Real-world Payment Routing Scenarios", () => {
    test("Scenario 1: User sends to TRON address", () => {
      const recipientAddress = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"

      // Step 1: Detect address type
      const addressType = detectAddressType(recipientAddress)
      expect(addressType).toBe("TRON")

      // Step 2: Get network
      const network = addressType === "TRON" ? "tron" : "ethereum"
      expect(network).toBe("tron")

      // Step 3: Get USDT address for TRON
      const tokenAddress = getTokenAddress(network, "USDT")
      expect(tokenAddress).toBe("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")
    })

    test("Scenario 2: Batch payment with mixed addresses", () => {
      const recipients = [
        { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", amount: "100" },
        { address: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf", amount: "200" },
      ]

      const results = recipients.map((r) => ({
        address: r.address,
        network: detectAddressType(r.address) === "TRON" ? "tron" : "ethereum",
        amount: r.amount,
      }))

      // All should be routed to TRON
      expect(results.every((r) => r.network === "tron")).toBe(true)
    })

    test("Scenario 3: Network selector in UI", () => {
      // User selects TRON from dropdown
      const selectedNetwork = "tron"
      const network = ALL_NETWORKS[selectedNetwork]

      expect(network).toBeDefined()
      expect(network.type).toBe("TRON")
      expect(network.blockExplorer).toBe("https://tronscan.org")

      // Get available tokens
      const tokens = getSupportedTokens(selectedNetwork)
      expect(tokens.length).toBeGreaterThan(0)
    })
  })

  describe("Multi-chain Dashboard Integration", () => {
    test("should aggregate balances across networks", () => {
      const supportedNetworks = ["ethereum", "arbitrum", "tron"]

      const balanceStructure = supportedNetworks.map((networkId) => ({
        network: networkId,
        networkInfo: ALL_NETWORKS[networkId],
        tokens: getSupportedTokens(networkId).map((token) => ({
          symbol: token.symbol,
          address: token.address,
          balance: "0", // Would be fetched from blockchain
        })),
      }))

      expect(balanceStructure.length).toBe(3)
      expect(balanceStructure[2].network).toBe("tron")
      expect(balanceStructure[2].networkInfo.type).toBe("TRON")
    })
  })

  describe("Explorer URL Generation", () => {
    test("should generate correct TRON explorer URL", () => {
      const network = ALL_NETWORKS.tron
      const txHash = "abc123def456"

      const explorerUrl = `${network.blockExplorer}/#/transaction/${txHash}`
      expect(explorerUrl).toBe("https://tronscan.org/#/transaction/abc123def456")
    })

    test("should generate correct address explorer URL for TRON", () => {
      const network = ALL_NETWORKS.tron
      const address = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"

      const explorerUrl = `${network.blockExplorer}/#/address/${address}`
      expect(explorerUrl).toBe("https://tronscan.org/#/address/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")
    })
  })
})

describe("Feature Parity Tests", () => {
  test("TRON should have feature parity with EVM networks", () => {
    const ethereum = ALL_NETWORKS.ethereum
    const tron = ALL_NETWORKS.tron

    // Both should have essential fields
    expect(tron.name).toBeTruthy()
    expect(tron.type).toBeTruthy()
    expect(tron.rpcUrl).toBeTruthy()
    expect(tron.blockExplorer).toBeTruthy()
    expect(tron.nativeCurrency).toBeDefined()

    // Both should support USDT
    const ethUsdt = getTokenAddress("ethereum", "USDT")
    const tronUsdt = getTokenAddress("tron", "USDT")

    expect(ethUsdt).toBeTruthy()
    expect(tronUsdt).toBeTruthy()
  })

  test("all networks should have consistent structure", () => {
    const allNetworkValues = Object.values(ALL_NETWORKS)

    allNetworkValues.forEach((network) => {
      expect(network).toHaveProperty("id")
      expect(network).toHaveProperty("name")
      expect(network).toHaveProperty("type")
      expect(network).toHaveProperty("nativeCurrency")
      expect(network).toHaveProperty("rpcUrl")
      expect(network).toHaveProperty("blockExplorer")
      expect(network).toHaveProperty("isTestnet")
    })
  })
})
