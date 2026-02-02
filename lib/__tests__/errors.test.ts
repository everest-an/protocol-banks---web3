/**
 * Error Handling System Tests
 * Tests for lib/errors/index.ts
 */

import {
  ApiError,
  ErrorCodes,
  ErrorMessages,
  ErrorHttpStatus,
  validationError,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  rateLimitError,
  logError,
} from "@/lib/errors"

describe("Error Handling System", () => {
  describe("ErrorCodes", () => {
    it("should have unique error codes", () => {
      const codes = Object.values(ErrorCodes)
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(codes.length)
    })

    it("should have correct prefix format", () => {
      Object.entries(ErrorCodes).forEach(([key, code]) => {
        expect(code).toMatch(/^[A-Z]+_\d{4}$/)
      })
    })

    it("should have authentication codes in 1xxx range", () => {
      expect(ErrorCodes.AUTH_REQUIRED).toBe("AUTH_1001")
      expect(ErrorCodes.AUTH_INVALID_TOKEN).toBe("AUTH_1002")
      expect(ErrorCodes.AUTH_EXPIRED).toBe("AUTH_1003")
    })

    it("should have validation codes in 2xxx range", () => {
      expect(ErrorCodes.VALIDATION_FAILED).toBe("VAL_2001")
      expect(ErrorCodes.VALIDATION_INVALID_ADDRESS).toBe("VAL_2002")
    })

    it("should have payment codes in 4xxx range", () => {
      expect(ErrorCodes.PAYMENT_INSUFFICIENT_BALANCE).toBe("PAY_4001")
      expect(ErrorCodes.PAYMENT_TRANSACTION_FAILED).toBe("PAY_4003")
    })
  })

  describe("ErrorMessages", () => {
    it("should have messages for all error codes", () => {
      Object.values(ErrorCodes).forEach((code) => {
        expect(ErrorMessages[code]).toBeDefined()
        expect(ErrorMessages[code].en).toBeTruthy()
        expect(ErrorMessages[code].zh).toBeTruthy()
      })
    })

    it("should have bilingual messages", () => {
      expect(ErrorMessages[ErrorCodes.AUTH_REQUIRED].en).toBe(
        "Authentication required"
      )
      expect(ErrorMessages[ErrorCodes.AUTH_REQUIRED].zh).toBe("需要身份验证")
    })
  })

  describe("ErrorHttpStatus", () => {
    it("should map auth errors to 401/403", () => {
      expect(ErrorHttpStatus[ErrorCodes.AUTH_REQUIRED]).toBe(401)
      expect(ErrorHttpStatus[ErrorCodes.AUTH_INVALID_TOKEN]).toBe(401)
      expect(ErrorHttpStatus[ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS]).toBe(403)
    })

    it("should map validation errors to 400", () => {
      expect(ErrorHttpStatus[ErrorCodes.VALIDATION_FAILED]).toBe(400)
      expect(ErrorHttpStatus[ErrorCodes.VALIDATION_INVALID_ADDRESS]).toBe(400)
    })

    it("should map not found to 404", () => {
      expect(ErrorHttpStatus[ErrorCodes.RESOURCE_NOT_FOUND]).toBe(404)
    })

    it("should map rate limit to 429", () => {
      expect(ErrorHttpStatus[ErrorCodes.RATE_LIMIT_EXCEEDED]).toBe(429)
    })

    it("should map internal errors to 500", () => {
      expect(ErrorHttpStatus[ErrorCodes.INTERNAL_ERROR]).toBe(500)
    })
  })

  describe("ApiError", () => {
    it("should create error with default message", () => {
      const error = new ApiError({ code: ErrorCodes.AUTH_REQUIRED })
      expect(error.message).toBe("Authentication required")
      expect(error.code).toBe(ErrorCodes.AUTH_REQUIRED)
      expect(error.httpStatus).toBe(401)
    })

    it("should create error with custom message", () => {
      const error = new ApiError({
        code: ErrorCodes.AUTH_REQUIRED,
        message: "Custom message",
      })
      expect(error.message).toBe("Custom message")
    })

    it("should include field information", () => {
      const error = new ApiError({
        code: ErrorCodes.VALIDATION_FAILED,
        field: "email",
      })
      expect(error.field).toBe("email")
    })

    it("should include details", () => {
      const error = new ApiError({
        code: ErrorCodes.PAYMENT_LIMIT_EXCEEDED,
        details: { limit: 10000, requested: 15000 },
      })
      expect(error.details).toEqual({ limit: 10000, requested: 15000 })
    })

    it("should set timestamp", () => {
      const before = new Date().toISOString()
      const error = new ApiError({ code: ErrorCodes.INTERNAL_ERROR })
      const after = new Date().toISOString()

      expect(error.timestamp).toBeDefined()
      expect(error.timestamp >= before).toBe(true)
      expect(error.timestamp <= after).toBe(true)
    })

    describe("toJSON", () => {
      it("should convert to JSON with English locale", () => {
        const error = new ApiError({
          code: ErrorCodes.AUTH_REQUIRED,
          message: "Please login",
        })

        const json = error.toJSON("en")

        expect(json.success).toBe(false)
        expect(json.error.code).toBe(ErrorCodes.AUTH_REQUIRED)
        expect(json.error.message).toBe("Please login")
        expect(json.error.localizedMessage).toBe("Authentication required")
      })

      it("should convert to JSON with Chinese locale", () => {
        const error = new ApiError({ code: ErrorCodes.AUTH_REQUIRED })

        const json = error.toJSON("zh")

        expect(json.error.localizedMessage).toBe("需要身份验证")
      })
    })

    describe("from", () => {
      it("should return same ApiError if passed ApiError", () => {
        const original = new ApiError({ code: ErrorCodes.AUTH_REQUIRED })
        const result = ApiError.from(original)

        expect(result).toBe(original)
      })

      it("should detect insufficient funds error", () => {
        const error = new Error("insufficient funds for gas")
        const result = ApiError.from(error)

        expect(result.code).toBe(ErrorCodes.PAYMENT_INSUFFICIENT_BALANCE)
      })

      it("should detect nonce error", () => {
        const error = new Error("nonce too low")
        const result = ApiError.from(error)

        expect(result.code).toBe(ErrorCodes.PAYMENT_NONCE_EXPIRED)
      })

      it("should detect reverted transaction", () => {
        const error = new Error("transaction reverted: ERC20 transfer failed")
        const result = ApiError.from(error)

        expect(result.code).toBe(ErrorCodes.BLOCKCHAIN_TRANSACTION_REVERTED)
      })

      it("should detect timeout error", () => {
        const error = new Error("request timeout exceeded")
        const result = ApiError.from(error)

        expect(result.code).toBe(ErrorCodes.BLOCKCHAIN_TIMEOUT)
      })

      it("should use default code for unknown errors", () => {
        const error = new Error("something went wrong")
        const result = ApiError.from(error, ErrorCodes.INTERNAL_ERROR)

        expect(result.code).toBe(ErrorCodes.INTERNAL_ERROR)
        expect(result.message).toBe("something went wrong")
      })

      it("should handle non-Error values", () => {
        const result = ApiError.from("string error")

        expect(result.code).toBe(ErrorCodes.INTERNAL_ERROR)
        expect(result.message).toBe("string error")
      })
    })
  })

  describe("Helper Functions", () => {
    describe("validationError", () => {
      it("should create validation error with field", () => {
        const error = validationError("email")

        expect(error.code).toBe(ErrorCodes.VALIDATION_FAILED)
        expect(error.field).toBe("email")
        expect(error.httpStatus).toBe(400)
      })

      it("should include custom message", () => {
        const error = validationError("email", "Invalid email format")

        expect(error.message).toBe("Invalid email format")
      })
    })

    describe("notFoundError", () => {
      it("should create not found error for resource", () => {
        const error = notFoundError("User")

        expect(error.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND)
        expect(error.message).toBe("User not found")
        expect(error.httpStatus).toBe(404)
      })

      it("should include resource ID in message", () => {
        const error = notFoundError("User", "123")

        expect(error.message).toBe("User with id '123' not found")
        expect(error.details).toEqual({ resource: "User", id: "123" })
      })
    })

    describe("unauthorizedError", () => {
      it("should create unauthorized error", () => {
        const error = unauthorizedError()

        expect(error.code).toBe(ErrorCodes.AUTH_REQUIRED)
        expect(error.httpStatus).toBe(401)
      })

      it("should include custom message", () => {
        const error = unauthorizedError("Token expired")

        expect(error.message).toBe("Token expired")
      })
    })

    describe("forbiddenError", () => {
      it("should create forbidden error", () => {
        const error = forbiddenError()

        expect(error.code).toBe(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS)
        expect(error.httpStatus).toBe(403)
      })
    })

    describe("rateLimitError", () => {
      it("should create rate limit error", () => {
        const error = rateLimitError()

        expect(error.code).toBe(ErrorCodes.RATE_LIMIT_EXCEEDED)
        expect(error.httpStatus).toBe(429)
      })

      it("should include retry-after in details", () => {
        const error = rateLimitError(60)

        expect(error.details).toEqual({ retryAfter: 60 })
      })
    })
  })

  describe("logError", () => {
    it("should log ApiError with context", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation()

      const error = new ApiError({ code: ErrorCodes.AUTH_REQUIRED })
      logError(error, { userId: "123", path: "/api/test" })

      expect(consoleSpy).toHaveBeenCalled()
      const logOutput = consoleSpy.mock.calls[0][1]
      expect(logOutput).toContain("AUTH_1001")
      expect(logOutput).toContain("123")

      consoleSpy.mockRestore()
    })

    it("should log regular Error", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation()

      const error = new Error("Test error")
      logError(error)

      expect(consoleSpy).toHaveBeenCalled()
      const logOutput = consoleSpy.mock.calls[0][1]
      expect(logOutput).toContain("UNKNOWN")

      consoleSpy.mockRestore()
    })
  })
})
