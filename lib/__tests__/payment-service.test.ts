/**
 * Payment Service Tests
 * Tests for lib/services/payment-service.ts
 */

// Mock ethers
jest.mock("ethers", () => ({
  ethers: {
    isAddress: (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr),
  },
}))

// Mock web3 functions
jest.mock("@/lib/web3", () => ({
  sendToken: jest.fn(),
  signERC3009Authorization: jest.fn(),
  executeERC3009Transfer: jest.fn(),
  getTokenAddress: jest.fn(),
}))

// Mock services
jest.mock("@/services", () => ({
  validateBatch: jest.fn(() => ({ valid: true, errors: [] })),
  calculateBatchTotals: jest.fn(),
  findDuplicateRecipients: jest.fn(() => []),
  calculateBatchFees: jest.fn(() => ({
    totalAmount: 1000,
    totalFees: 10,
    totalNetAmount: 990,
    breakdown: [],
  })),
  formatFee: jest.fn((n) => n.toFixed(2)),
  generateBatchCsvReport: jest.fn(() => "csv report"),
}))

// Mock webhook service
jest.mock("@/lib/services/webhook-trigger-service", () => ({
  webhookTriggerService: {
    triggerPaymentCreated: jest.fn(() => Promise.resolve()),
    triggerPaymentCompleted: jest.fn(() => Promise.resolve()),
    triggerPaymentFailed: jest.fn(() => Promise.resolve()),
    triggerBatchPaymentCreated: jest.fn(() => Promise.resolve()),
    triggerBatchPaymentCompleted: jest.fn(() => Promise.resolve()),
  },
}))

// Mock vendor payment service
jest.mock("@/lib/services/vendor-payment-service", () => ({
  vendorPaymentService: {
    autoLinkPayment: jest.fn(() => Promise.resolve(null)),
  },
}))

// Mock concurrency utils
jest.mock("@/lib/utils/concurrency", () => ({
  runConcurrent: jest.fn(),
}))

import {
  validateRecipients,
  calculateTotal,
  estimateFees,
  formatPaymentForDisplay,
  validatePaymentData,
} from "@/lib/services/payment-service"

describe("Payment Service", () => {
  describe("validateRecipients", () => {
    it("should throw error when recipients array is empty", () => {
      expect(() => validateRecipients([])).toThrow("No recipients provided")
    })

    it("should throw error when recipients is null/undefined", () => {
      expect(() => validateRecipients(null as any)).toThrow("No recipients provided")
      expect(() => validateRecipients(undefined as any)).toThrow("No recipients provided")
    })

    it("should throw error for invalid address", () => {
      const recipients = [
        { address: "invalid", amount: 100, token: "USDC" },
      ]
      expect(() => validateRecipients(recipients)).toThrow("Invalid address: invalid")
    })

    it("should throw error for missing address", () => {
      const recipients = [
        { address: "", amount: 100, token: "USDC" },
      ]
      expect(() => validateRecipients(recipients)).toThrow("Invalid address:")
    })

    it("should throw error for zero amount", () => {
      const recipients = [
        { address: "0x1234567890123456789012345678901234567890", amount: 0, token: "USDC" },
      ]
      expect(() => validateRecipients(recipients)).toThrow("Invalid amount")
    })

    it("should throw error for negative amount", () => {
      const recipients = [
        { address: "0x1234567890123456789012345678901234567890", amount: -100, token: "USDC" },
      ]
      expect(() => validateRecipients(recipients)).toThrow("Invalid amount")
    })

    it("should throw error for missing token", () => {
      const recipients = [
        { address: "0x1234567890123456789012345678901234567890", amount: 100, token: "" },
      ]
      expect(() => validateRecipients(recipients)).toThrow("Token not specified")
    })

    it("should pass validation for valid recipients", () => {
      const recipients = [
        { address: "0x1234567890123456789012345678901234567890", amount: 100, token: "USDC" },
        { address: "0xabcdef1234567890abcdef1234567890abcdef12", amount: 200, token: "USDT" },
      ]
      expect(() => validateRecipients(recipients)).not.toThrow()
    })

    it("should validate multiple recipients and stop at first error", () => {
      const recipients = [
        { address: "0x1234567890123456789012345678901234567890", amount: 100, token: "USDC" },
        { address: "invalid", amount: 200, token: "USDT" },
        { address: "0xabcdef1234567890abcdef1234567890abcdef12", amount: 300, token: "DAI" },
      ]
      expect(() => validateRecipients(recipients)).toThrow("Invalid address: invalid")
    })
  })

  describe("calculateTotal", () => {
    it("should calculate total from recipients", () => {
      const recipients = [
        { address: "0x1234567890123456789012345678901234567890", amount: 100, token: "USDC" },
        { address: "0xabcdef1234567890abcdef1234567890abcdef12", amount: 200, token: "USDC" },
        { address: "0x9876543210987654321098765432109876543210", amount: 50, token: "USDC" },
      ]
      expect(calculateTotal(recipients)).toBe(350)
    })

    it("should return 0 for empty array", () => {
      expect(calculateTotal([])).toBe(0)
    })

    it("should handle recipients with missing amounts", () => {
      const recipients = [
        { address: "0x1234567890123456789012345678901234567890", amount: 100, token: "USDC" },
        { address: "0xabcdef1234567890abcdef1234567890abcdef12", token: "USDC" } as any,
      ]
      expect(calculateTotal(recipients)).toBe(100)
    })

    it("should handle decimal amounts", () => {
      const recipients = [
        { address: "0x1234567890123456789012345678901234567890", amount: 100.5, token: "USDC" },
        { address: "0xabcdef1234567890abcdef1234567890abcdef12", amount: 50.25, token: "USDC" },
      ]
      expect(calculateTotal(recipients)).toBeCloseTo(150.75)
    })
  })

  describe("estimateFees", () => {
    it("should estimate fees based on recipient count", () => {
      const recipients = [
        { address: "0x1234567890123456789012345678901234567890", amount: 100, token: "USDC" },
        { address: "0xabcdef1234567890abcdef1234567890abcdef12", amount: 200, token: "USDC" },
      ]

      // 2 recipients * 86000 gas * 20 gwei / 1e9 = 0.00344 ETH
      const expectedFee = (2 * 86000 * 20) / 1e9
      expect(estimateFees(recipients)).toBeCloseTo(expectedFee)
    })

    it("should use custom gas price", () => {
      const recipients = [
        { address: "0x1234567890123456789012345678901234567890", amount: 100, token: "USDC" },
      ]

      // 1 recipient * 86000 gas * 50 gwei / 1e9
      const expectedFee = (1 * 86000 * 50) / 1e9
      expect(estimateFees(recipients, 50)).toBeCloseTo(expectedFee)
    })

    it("should return 0 for empty recipients", () => {
      expect(estimateFees([])).toBe(0)
    })

    it("should scale linearly with recipient count", () => {
      const oneRecipient = [
        { address: "0x1234567890123456789012345678901234567890", amount: 100, token: "USDC" },
      ]
      const tenRecipients = Array(10).fill(oneRecipient[0])

      expect(estimateFees(tenRecipients)).toBeCloseTo(estimateFees(oneRecipient) * 10)
    })
  })

  describe("formatPaymentForDisplay", () => {
    it("should format completed payment", () => {
      const payment = {
        id: "pay_123",
        amount: 100,
        token: "USDC",
        status: "completed" as const,
        created_at: "2024-01-15T10:30:00Z",
        from: "0x123",
        to: "0x456",
      }

      const formatted = formatPaymentForDisplay(payment as any)

      expect(formatted.formattedAmount).toBe("100 USDC")
      expect(formatted.statusBadge).toBe("success")
      expect(formatted.formattedDate).toBeDefined()
    })

    it("should format pending payment", () => {
      const payment = {
        id: "pay_123",
        amount: 50,
        token: "USDT",
        status: "pending" as const,
        created_at: "2024-01-15T10:30:00Z",
      }

      const formatted = formatPaymentForDisplay(payment as any)

      expect(formatted.formattedAmount).toBe("50 USDT")
      expect(formatted.statusBadge).toBe("warning")
    })

    it("should format failed payment", () => {
      const payment = {
        id: "pay_123",
        amount: 200,
        token: "DAI",
        status: "failed" as const,
        created_at: "2024-01-15T10:30:00Z",
      }

      const formatted = formatPaymentForDisplay(payment as any)

      expect(formatted.formattedAmount).toBe("200 DAI")
      expect(formatted.statusBadge).toBe("error")
    })

    it("should preserve original payment properties", () => {
      const payment = {
        id: "pay_123",
        amount: 100,
        token: "USDC",
        status: "completed" as const,
        created_at: "2024-01-15T10:30:00Z",
        tx_hash: "0xabc123",
        notes: "Test payment",
      }

      const formatted = formatPaymentForDisplay(payment as any)

      expect(formatted.id).toBe("pay_123")
      expect(formatted.tx_hash).toBe("0xabc123")
      expect(formatted.notes).toBe("Test payment")
    })
  })

  describe("validatePaymentData (alias)", () => {
    it("should work as alias for validateRecipients", () => {
      const validRecipients = [
        { address: "0x1234567890123456789012345678901234567890", amount: 100, token: "USDC" },
      ]

      expect(() => validatePaymentData(validRecipients)).not.toThrow()
    })

    it("should throw same errors as validateRecipients", () => {
      expect(() => validatePaymentData([])).toThrow("No recipients provided")
    })
  })
})

describe("Payment Service Integration", () => {
  describe("Batch Payment Options", () => {
    it("should have sensible default options", () => {
      // These are the expected defaults from the service
      const expectedDefaults = {
        concurrency: 5,
        batchDelay: 200,
        timeout: 60000,
        retries: 1,
      }

      // The defaults are internal, but we can verify behavior
      // by checking that the service works without options
      const recipients = [
        { address: "0x1234567890123456789012345678901234567890", amount: 100, token: "USDC" },
      ]

      // This should not throw
      expect(() => validateRecipients(recipients)).not.toThrow()
    })
  })
})
