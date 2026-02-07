/**
 * Address Utils Test Suite
 * Tests for unified address validation and detection
 */

import {
  detectAddressType,
  validateAddress,
  isValidTronAddress,
  isValidEvmAddress,
  getNetworkForAddress,
  formatAddress,
  validateAddressBatch,
} from "../address-utils"

describe("Address Type Detection", () => {
  test("should detect EVM addresses", () => {
    const evmAddresses = [
      "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
      "0x1234567890123456789012345678901234567890",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    ]

    evmAddresses.forEach((address) => {
      expect(detectAddressType(address)).toBe("EVM")
    })
  })

  test("should detect TRON addresses", () => {
    const tronAddresses = [
      "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
      "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // USDT TRC20
      "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8", // USDC TRC20
    ]

    tronAddresses.forEach((address) => {
      expect(detectAddressType(address)).toBe("TRON")
    })
  })

  test("should detect invalid addresses", () => {
    const invalidAddresses = [
      "",
      "invalid",
      "0x123", // Too short
      "T123", // Too short
      "1234567890123456789012345678901234567890", // No 0x prefix
      "ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ", // Wrong prefix
    ]

    invalidAddresses.forEach((address) => {
      expect(detectAddressType(address)).toBe("INVALID")
    })
  })

  test("should handle whitespace", () => {
    expect(detectAddressType("  0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2  ")).toBe("EVM")
    expect(detectAddressType("  TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf  ")).toBe("TRON")
  })
})

describe("EVM Address Validation", () => {
  test("should validate correct EVM addresses", () => {
    const validAddresses = [
      "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    ]

    validAddresses.forEach((address) => {
      expect(isValidEvmAddress(address)).toBe(true)
    })
  })

  test("should reject invalid EVM addresses", () => {
    const invalidAddresses = [
      "0x123",
      "742d35Cc6634C0532925a3b844Bc9e7595f0bEb2", // No 0x
      "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf", // TRON address
    ]

    invalidAddresses.forEach((address) => {
      expect(isValidEvmAddress(address)).toBe(false)
    })
  })

  test("should handle checksum addresses", () => {
    // Mixed case (checksum)
    expect(isValidEvmAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2")).toBe(true)
    // All lowercase
    expect(isValidEvmAddress("0x742d35cc6634c0532925a3b844bc9e7595f0beb2")).toBe(true)
    // All uppercase (without 0x)
    expect(isValidEvmAddress("0x742D35CC6634C0532925A3B844BC9E7595F0BEB2")).toBe(true)
  })
})

describe("TRON Address Validation", () => {
  test("should validate correct TRON addresses", () => {
    const validAddresses = [
      "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
      "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8",
    ]

    validAddresses.forEach((address) => {
      expect(isValidTronAddress(address)).toBe(true)
    })
  })

  test("should reject invalid TRON addresses", () => {
    const invalidAddresses = [
      "T123", // Too short
      "TZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ", // Invalid Base58
      "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2", // EVM address
      "AXYZO pYRdj2D9XRtbG411XZZ3kM5VkAeBf", // Doesn't start with T
    ]

    invalidAddresses.forEach((address) => {
      expect(isValidTronAddress(address)).toBe(false)
    })
  })
})

describe("Unified Address Validation", () => {
  test("should validate EVM addresses with auto-detection", () => {
    const result = validateAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2")

    expect(result.isValid).toBe(true)
    expect(result.type).toBe("EVM")
    expect(result.checksumAddress).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2")
    expect(result.error).toBeUndefined()
  })

  test("should validate TRON addresses with auto-detection", () => {
    const result = validateAddress("TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf")

    expect(result.isValid).toBe(true)
    expect(result.type).toBe("TRON")
    expect(result.checksumAddress).toBe("TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf")
    expect(result.error).toBeUndefined()
  })

  test("should reject invalid addresses", () => {
    const result = validateAddress("invalid_address")

    expect(result.isValid).toBe(false)
    expect(result.type).toBe("INVALID")
    expect(result.checksumAddress).toBeUndefined()
    expect(result.error).toBeDefined()
  })

  test("should validate with explicit network type", () => {
    const evmResult = validateAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2", "EVM")
    expect(evmResult.isValid).toBe(true)

    const tronResult = validateAddress("TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf", "TRON")
    expect(tronResult.isValid).toBe(true)

    // Should fail when wrong type is specified
    const wrongType = validateAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2", "TRON")
    expect(wrongType.isValid).toBe(false)
  })
})

describe("Network Detection", () => {
  test("should get network for EVM addresses", () => {
    const network = getNetworkForAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2")
    expect(network).toBe("ethereum") // default
  })

  test("should get network for TRON addresses", () => {
    const network = getNetworkForAddress("TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf")
    expect(network).toBe("tron")
  })

  test("should use custom default network", () => {
    const network = getNetworkForAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2", "arbitrum")
    expect(network).toBe("arbitrum")
  })

  test("should throw error for invalid addresses", () => {
    expect(() => getNetworkForAddress("invalid")).toThrow("Invalid address format")
  })
})

describe("Address Formatting", () => {
  test("should format long addresses", () => {
    const address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"
    expect(formatAddress(address)).toBe("0x742d...0bEb2")
  })

  test("should format with custom lengths", () => {
    const address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"
    expect(formatAddress(address, 8, 6)).toBe("0x742d35...f0bEb2")
  })

  test("should not format short addresses", () => {
    const address = "0x123456"
    expect(formatAddress(address, 6, 4)).toBe("0x123456")
  })

  test("should handle empty addresses", () => {
    expect(formatAddress("")).toBe("")
  })
})

describe("Batch Address Validation", () => {
  test("should validate mixed addresses", () => {
    const addresses = [
      "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2", // EVM
      "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf", // TRON
      "0xdAC17F958D2ee523a2206206994597C13D831ec7", // EVM
      "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // TRON
      "invalid_address", // INVALID
    ]

    const result = validateAddressBatch(addresses)

    expect(result.valid.length).toBe(4)
    expect(result.invalid.length).toBe(1)
    expect(result.byType.EVM.length).toBe(2)
    expect(result.byType.TRON.length).toBe(2)
  })

  test("should handle all valid addresses", () => {
    const addresses = [
      "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    ]

    const result = validateAddressBatch(addresses)

    expect(result.valid.length).toBe(2)
    expect(result.invalid.length).toBe(0)
    expect(result.byType.EVM.length).toBe(2)
    expect(result.byType.TRON.length).toBe(0)
  })

  test("should handle all invalid addresses", () => {
    const addresses = ["invalid1", "invalid2", "invalid3"]

    const result = validateAddressBatch(addresses)

    expect(result.valid.length).toBe(0)
    expect(result.invalid.length).toBe(3)
  })

  test("should handle empty array", () => {
    const result = validateAddressBatch([])

    expect(result.valid.length).toBe(0)
    expect(result.invalid.length).toBe(0)
    expect(result.byType.EVM.length).toBe(0)
    expect(result.byType.TRON.length).toBe(0)
  })
})

describe("Real-world Address Examples", () => {
  test("should validate real USDT contract addresses", () => {
    // Ethereum USDT
    expect(isValidEvmAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7")).toBe(true)

    // TRON USDT (TRC20)
    expect(isValidTronAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(true)

    // Arbitrum USDT
    expect(isValidEvmAddress("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9")).toBe(true)
  })

  test("should validate real wallet addresses", () => {
    const walletAddresses = [
      { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2", type: "EVM" },
      { address: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf", type: "TRON" },
    ]

    walletAddresses.forEach(({ address, type }) => {
      const result = validateAddress(address)
      expect(result.isValid).toBe(true)
      expect(result.type).toBe(type)
    })
  })
})

describe("Edge Cases", () => {
  test("should handle null and undefined", () => {
    expect(detectAddressType(null as any)).toBe("INVALID")
    expect(detectAddressType(undefined as any)).toBe("INVALID")
    expect(isValidEvmAddress(null as any)).toBe(false)
    expect(isValidTronAddress(null as any)).toBe(false)
  })

  test("should handle non-string inputs", () => {
    expect(detectAddressType(12345 as any)).toBe("INVALID")
    expect(detectAddressType({} as any)).toBe("INVALID")
    expect(detectAddressType([] as any)).toBe("INVALID")
  })

  test("should handle addresses with special characters", () => {
    expect(detectAddressType("0x742d35Cc!@#$%^&*()")).toBe("INVALID")
    expect(detectAddressType("TXYZop!@#$%^&*()")).toBe("INVALID")
  })
})
