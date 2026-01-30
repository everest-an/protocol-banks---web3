/**
 * Zustand Store Tests
 * Tests for lib/stores/
 */

// Mock zustand persist middleware
jest.mock("zustand/middleware", () => ({
  devtools: (fn: any) => fn,
  persist: (fn: any) => fn,
}))

// Import stores after mocking
import { useUIStore } from "@/lib/stores/ui-store"
import { useWalletStore, formatAddress, isValidAddress } from "@/lib/stores/wallet-store"

describe("UI Store", () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({
      sidebarCollapsed: false,
      isLoading: false,
      loadingMessage: "",
      modals: {},
      toasts: [],
      preferredView: "list",
      isDemoMode: false,
    })
  })

  describe("Sidebar", () => {
    it("should toggle sidebar collapsed state", () => {
      const store = useUIStore.getState()
      expect(store.sidebarCollapsed).toBe(false)

      store.toggleSidebar()
      expect(useUIStore.getState().sidebarCollapsed).toBe(true)

      store.toggleSidebar()
      expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    })

    it("should set sidebar collapsed directly", () => {
      const store = useUIStore.getState()
      store.setSidebarCollapsed(true)
      expect(useUIStore.getState().sidebarCollapsed).toBe(true)
    })
  })

  describe("Loading State", () => {
    it("should set loading state with message", () => {
      const store = useUIStore.getState()
      store.setLoading(true, "Processing payment...")

      const state = useUIStore.getState()
      expect(state.isLoading).toBe(true)
      expect(state.loadingMessage).toBe("Processing payment...")
    })

    it("should clear loading state", () => {
      const store = useUIStore.getState()
      store.setLoading(true, "Loading...")
      store.setLoading(false)

      const state = useUIStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.loadingMessage).toBe("")
    })
  })

  describe("Modal Management", () => {
    it("should open modal with data", () => {
      const store = useUIStore.getState()
      store.openModal("confirmDelete", { id: "123", name: "Test" })

      expect(store.isModalOpen("confirmDelete")).toBe(true)
      expect(store.getModalData("confirmDelete")).toEqual({
        id: "123",
        name: "Test",
      })
    })

    it("should close modal and clear data", () => {
      const store = useUIStore.getState()
      store.openModal("testModal", { test: true })
      store.closeModal("testModal")

      expect(store.isModalOpen("testModal")).toBe(false)
      expect(store.getModalData("testModal")).toBeUndefined()
    })

    it("should handle multiple modals independently", () => {
      const store = useUIStore.getState()
      store.openModal("modal1", { data: 1 })
      store.openModal("modal2", { data: 2 })

      expect(store.isModalOpen("modal1")).toBe(true)
      expect(store.isModalOpen("modal2")).toBe(true)

      store.closeModal("modal1")

      expect(store.isModalOpen("modal1")).toBe(false)
      expect(store.isModalOpen("modal2")).toBe(true)
    })
  })

  describe("Toast Notifications", () => {
    it("should add toast notification", () => {
      const store = useUIStore.getState()
      store.addToast({
        type: "success",
        message: "Payment completed",
        duration: 0, // Prevent auto-remove
      })

      const toasts = useUIStore.getState().toasts
      expect(toasts).toHaveLength(1)
      expect(toasts[0].type).toBe("success")
      expect(toasts[0].message).toBe("Payment completed")
    })

    it("should remove toast notification", () => {
      const store = useUIStore.getState()
      store.addToast({
        type: "error",
        message: "Error occurred",
        duration: 0,
      })

      const toastId = useUIStore.getState().toasts[0].id
      store.removeToast(toastId)

      expect(useUIStore.getState().toasts).toHaveLength(0)
    })

    it("should generate unique toast IDs", () => {
      const store = useUIStore.getState()
      store.addToast({ type: "info", message: "Toast 1", duration: 0 })
      store.addToast({ type: "info", message: "Toast 2", duration: 0 })

      const toasts = useUIStore.getState().toasts
      expect(toasts[0].id).not.toBe(toasts[1].id)
    })
  })

  describe("View Preference", () => {
    it("should set preferred view", () => {
      const store = useUIStore.getState()
      expect(store.preferredView).toBe("list")

      store.setPreferredView("grid")
      expect(useUIStore.getState().preferredView).toBe("grid")
    })
  })

  describe("Demo Mode", () => {
    it("should toggle demo mode", () => {
      const store = useUIStore.getState()
      expect(store.isDemoMode).toBe(false)

      store.setDemoMode(true)
      expect(useUIStore.getState().isDemoMode).toBe(true)
    })
  })
})

describe("Wallet Store", () => {
  beforeEach(() => {
    // Reset store state before each test
    useWalletStore.setState({
      address: null,
      chainId: null,
      isConnected: false,
      isConnecting: false,
      balances: [],
      isLoadingBalances: false,
      lastBalanceUpdate: null,
      recentAddresses: [],
    })
  })

  describe("Connection State", () => {
    it("should set wallet connection", () => {
      const store = useWalletStore.getState()
      store.setWallet("0x1234567890123456789012345678901234567890", 1)

      const state = useWalletStore.getState()
      expect(state.address).toBe("0x1234567890123456789012345678901234567890")
      expect(state.chainId).toBe(1)
      expect(state.isConnected).toBe(true)
      expect(state.isConnecting).toBe(false)
    })

    it("should set connecting state", () => {
      const store = useWalletStore.getState()
      store.setConnecting(true)
      expect(useWalletStore.getState().isConnecting).toBe(true)
    })

    it("should disconnect and clear state", () => {
      const store = useWalletStore.getState()

      // First connect
      store.setWallet("0x1234567890123456789012345678901234567890", 1)
      store.setBalances([
        {
          token: "USDC",
          symbol: "USDC",
          balance: "1000",
          balanceUSD: 1000,
          decimals: 6,
        },
      ])

      // Then disconnect
      store.disconnect()

      const state = useWalletStore.getState()
      expect(state.address).toBeNull()
      expect(state.chainId).toBeNull()
      expect(state.isConnected).toBe(false)
      expect(state.balances).toHaveLength(0)
    })
  })

  describe("Balance Management", () => {
    it("should set balances", () => {
      const store = useWalletStore.getState()
      const balances = [
        {
          token: "USDC",
          symbol: "USDC",
          balance: "1000.00",
          balanceUSD: 1000,
          decimals: 6,
        },
        {
          token: "ETH",
          symbol: "ETH",
          balance: "1.5",
          balanceUSD: 3000,
          decimals: 18,
        },
      ]

      store.setBalances(balances)

      const state = useWalletStore.getState()
      expect(state.balances).toEqual(balances)
      expect(state.isLoadingBalances).toBe(false)
      expect(state.lastBalanceUpdate).toBeTruthy()
    })

    it("should get balance by symbol", () => {
      const store = useWalletStore.getState()
      store.setBalances([
        {
          token: "USDC",
          symbol: "USDC",
          balance: "500",
          balanceUSD: 500,
          decimals: 6,
        },
      ])

      const balance = store.getBalance("USDC")
      expect(balance?.balance).toBe("500")

      const notFound = store.getBalance("DAI")
      expect(notFound).toBeUndefined()
    })

    it("should calculate total balance in USD", () => {
      const store = useWalletStore.getState()
      store.setBalances([
        {
          token: "USDC",
          symbol: "USDC",
          balance: "1000",
          balanceUSD: 1000,
          decimals: 6,
        },
        {
          token: "ETH",
          symbol: "ETH",
          balance: "1",
          balanceUSD: 2000,
          decimals: 18,
        },
      ])

      expect(store.getTotalBalanceUSD()).toBe(3000)
    })
  })

  describe("Recent Addresses", () => {
    it("should add recent address", () => {
      const store = useWalletStore.getState()
      store.addRecentAddress("0xabc123")
      expect(useWalletStore.getState().recentAddresses).toContain("0xabc123")
    })

    it("should not duplicate addresses (case insensitive)", () => {
      const store = useWalletStore.getState()
      store.addRecentAddress("0xABC123")
      store.addRecentAddress("0xabc123")
      expect(useWalletStore.getState().recentAddresses).toHaveLength(1)
    })

    it("should limit to max recent addresses", () => {
      const store = useWalletStore.getState()
      for (let i = 0; i < 15; i++) {
        store.addRecentAddress(`0x${i.toString().padStart(40, "0")}`)
      }
      expect(useWalletStore.getState().recentAddresses.length).toBeLessThanOrEqual(10)
    })

    it("should clear recent addresses", () => {
      const store = useWalletStore.getState()
      store.addRecentAddress("0xabc")
      store.addRecentAddress("0xdef")
      store.clearRecentAddresses()
      expect(useWalletStore.getState().recentAddresses).toHaveLength(0)
    })
  })
})

describe("Utility Functions", () => {
  describe("formatAddress", () => {
    it("should format address with default chars", () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678"
      expect(formatAddress(address)).toBe("0x1234...5678")
    })

    it("should format address with custom chars", () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678"
      expect(formatAddress(address, 6)).toBe("0x123456...345678")
    })

    it("should return empty string for empty input", () => {
      expect(formatAddress("")).toBe("")
    })
  })

  describe("isValidAddress", () => {
    it("should validate correct Ethereum address", () => {
      expect(isValidAddress("0x1234567890123456789012345678901234567890")).toBe(true)
    })

    it("should reject address without 0x prefix", () => {
      expect(isValidAddress("1234567890123456789012345678901234567890")).toBe(false)
    })

    it("should reject address with wrong length", () => {
      expect(isValidAddress("0x123456")).toBe(false)
    })

    it("should reject address with invalid characters", () => {
      expect(isValidAddress("0x123456789012345678901234567890123456789g")).toBe(false)
    })
  })
})
