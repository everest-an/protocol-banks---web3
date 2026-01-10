"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import {
  connectWallet as connectWeb3Wallet,
  connectSolana,
  connectBitcoin,
  getTokenBalance,
  getTokenAddress,
  getChainId,
  isMetaMaskAvailable,
  switchNetwork as switchWeb3Network,
  CHAIN_IDS,
  type ChainType,
} from "@/lib/web3"
import {
  verifyProviderAuthenticity,
  createStateSnapshot,
  verifyStateConsistency,
  recordBalance,
  verifyBalanceFreshness,
  detectCombinedAttack,
  bindSessionToWallet,
  verifySessionBinding,
  signEvent,
} from "@/lib/cross-function-security"

interface Web3ContextType {
  wallets: {
    EVM: string | null
    SOLANA: string | null
    BITCOIN: string | null
  }
  activeChain: ChainType
  setActiveChain: (chain: ChainType) => void
  isConnected: boolean
  isConnecting: boolean
  usdtBalance: string
  usdcBalance: string
  daiBalance: string
  chainId: number
  connectWallet: (type?: ChainType) => Promise<void>
  disconnectWallet: (type?: ChainType) => void
  refreshBalances: () => Promise<void>
  isMetaMaskInstalled: boolean
  switchNetwork: (chainId: number) => Promise<void>
  isSupportedNetwork: boolean
  securityStatus: {
    providerAuthentic: boolean
    sessionBound: boolean
    stateConsistent: boolean
    warnings: string[]
  }
  verifyBeforeTransaction: () => Promise<{ allowed: boolean; errors: string[] }>
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined)

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<{
    EVM: string | null
    SOLANA: string | null
    BITCOIN: string | null
  }>({
    EVM: null,
    SOLANA: null,
    BITCOIN: null,
  })

  const [activeChain, setActiveChain] = useState<ChainType>("EVM")
  const [isConnecting, setIsConnecting] = useState(false)
  const [usdtBalance, setUsdtBalance] = useState("0")
  const [usdcBalance, setUsdcBalance] = useState("0")
  const [daiBalance, setDaiBalance] = useState("0")
  const [chainId, setChainId] = useState<number>(CHAIN_IDS.MAINNET)
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(() => {
    if (typeof window !== "undefined") {
      return isMetaMaskAvailable()
    }
    return false
  })

  const [sessionId] = useState(() => generateSessionId())
  const [securityStatus, setSecurityStatus] = useState({
    providerAuthentic: false,
    sessionBound: false,
    stateConsistent: true,
    warnings: [] as string[],
  })
  const [stateNonce, setStateNonce] = useState<string | null>(null)

  const isSupportedNetwork =
    chainId === CHAIN_IDS.MAINNET || chainId === CHAIN_IDS.SEPOLIA || chainId === CHAIN_IDS.BASE

  const refreshBalances = useCallback(async () => {
    if (!wallets.EVM) {
      setUsdtBalance("0")
      setUsdcBalance("0")
      setDaiBalance("0")
      return
    }

    if (activeChain === "EVM" || wallets.EVM) {
      try {
        const currentChainId = await getChainId()
        setChainId(currentChainId)

        const usdtAddress = getTokenAddress(currentChainId, "USDT")
        const usdcAddress = getTokenAddress(currentChainId, "USDC")
        const daiAddress = getTokenAddress(currentChainId, "DAI")

        const [usdt, usdc, dai] = await Promise.all([
          usdtAddress ? getTokenBalance(wallets.EVM, usdtAddress) : "0",
          usdcAddress ? getTokenBalance(wallets.EVM, usdcAddress) : "0",
          daiAddress ? getTokenBalance(wallets.EVM, daiAddress) : "0",
        ])

        setUsdtBalance(usdt)
        setUsdcBalance(usdc)
        setDaiBalance(dai)

        if (wallets.EVM) {
          recordBalance(wallets.EVM, "USDT", usdt)
          recordBalance(wallets.EVM, "USDC", usdc)
          recordBalance(wallets.EVM, "DAI", dai)
        }

        const nonce = createStateSnapshot(sessionId, wallets.EVM, currentChainId, {
          USDT: usdt,
          USDC: usdc,
          DAI: dai,
        })
        setStateNonce(nonce)
      } catch (error) {
        console.error("[v0] Failed to refresh balances:", error)
      }
    }
  }, [wallets.EVM, activeChain, sessionId])

  const verifyBeforeTransaction = useCallback(async (): Promise<{ allowed: boolean; errors: string[] }> => {
    const errors: string[] = []
    const indicators: string[] = []

    // 1. Verify provider authenticity
    const providerCheck = verifyProviderAuthenticity()
    if (!providerCheck.authentic) {
      errors.push(...providerCheck.warnings)
      indicators.push("suspicious_provider")
    }

    // 2. Verify state consistency
    if (stateNonce) {
      const stateCheck = verifyStateConsistency(sessionId, wallets.EVM, chainId, stateNonce)
      if (!stateCheck.valid) {
        errors.push(...stateCheck.errors)
        indicators.push("state_mismatch")
        if (stateCheck.requiresRefresh) {
          await refreshBalances()
        }
      }
    }

    // 3. Verify balance freshness
    if (wallets.EVM) {
      const usdcFreshness = verifyBalanceFreshness(wallets.EVM, "USDC", true)
      if (!usdcFreshness.fresh) {
        indicators.push("stale_balance")
        // Auto-refresh if stale
        await refreshBalances()
      }
    }

    // 4. Verify session binding
    if (wallets.EVM) {
      const sessionCheck = verifySessionBinding(sessionId, wallets.EVM)
      if (!sessionCheck.valid) {
        errors.push(sessionCheck.error || "Session verification failed")
        indicators.push("session_invalid")
      }
    }

    // 5. Check for combined attack patterns
    const attackCheck = detectCombinedAttack(indicators)
    if (attackCheck.detected.length > 0) {
      for (const pattern of attackCheck.detected) {
        errors.push(`Potential attack detected: ${pattern.name}`)
      }
      errors.push(...attackCheck.recommendations)
    }

    return {
      allowed: errors.length === 0,
      errors,
    }
  }, [sessionId, wallets.EVM, chainId, stateNonce, refreshBalances])

  const connectWallet = async (type: ChainType = "EVM") => {
    setIsConnecting(true)
    try {
      if (type === "EVM") {
        const providerCheck = verifyProviderAuthenticity()
        if (!providerCheck.authentic) {
          console.warn("[v0] Provider authenticity warnings:", providerCheck.warnings)
          setSecurityStatus((prev) => ({
            ...prev,
            providerAuthentic: false,
            warnings: providerCheck.warnings,
          }))
        } else {
          setSecurityStatus((prev) => ({ ...prev, providerAuthentic: true, warnings: [] }))
        }
      }

      console.log(`[v0] Starting ${type} wallet connection...`)
      let address = ""

      if (type === "EVM") {
        const addr = await connectWeb3Wallet("EVM")
        if (addr) address = addr
      } else if (type === "SOLANA") {
        address = await connectSolana()
      } else if (type === "BITCOIN") {
        address = await connectBitcoin()
      }

      if (address) {
        console.log("[v0] Wallet connected:", address)
        setWallets((prev) => ({ ...prev, [type]: address }))
        setActiveChain(type)

        const bindResult = bindSessionToWallet(sessionId, address, signEvent("wallet_connect", { address }))
        if (bindResult.success) {
          setSecurityStatus((prev) => ({ ...prev, sessionBound: true }))
        }

        try {
          const savedWallets = JSON.parse(localStorage.getItem("connected_wallets") || "{}")
          savedWallets[type] = address
          localStorage.setItem("connected_wallets", JSON.stringify(savedWallets))
          localStorage.setItem("active_chain", type)
        } catch (e) {
          console.warn("[v0] Failed to save wallet to localStorage:", e)
        }

        await refreshBalances()
      }
    } catch (error: any) {
      console.error("[v0] Failed to connect wallet:", error.message)
      if (error.code !== 4001) {
        // Don't alert for user rejection
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = (type?: ChainType) => {
    if (type) {
      setWallets((prev) => ({ ...prev, [type]: null }))

      try {
        const savedWallets = JSON.parse(localStorage.getItem("connected_wallets") || "{}")
        delete savedWallets[type]
        localStorage.setItem("connected_wallets", JSON.stringify(savedWallets))
      } catch (e) {
        console.warn("[v0] Failed to update localStorage:", e)
      }

      if (activeChain === type) {
        const otherChain = (Object.keys(wallets) as ChainType[]).find((k) => k !== type && wallets[k])
        if (otherChain) setActiveChain(otherChain)
      }
    } else {
      setWallets({ EVM: null, SOLANA: null, BITCOIN: null })
      setUsdtBalance("0")
      setUsdcBalance("0")
      setDaiBalance("0")
      setSecurityStatus({
        providerAuthentic: false,
        sessionBound: false,
        stateConsistent: true,
        warnings: [],
      })
      try {
        localStorage.removeItem("connected_wallets")
        localStorage.removeItem("active_chain")
      } catch (e) {
        console.warn("[v0] Failed to clear localStorage:", e)
      }
    }
  }

  const switchNetwork = async (targetChainId: number) => {
    try {
      await switchWeb3Network(targetChainId)
    } catch (error) {
      console.error("[v0] Failed to switch network:", error)
    }
  }

  useEffect(() => {
    const checkMetaMask = async () => {
      const available = isMetaMaskAvailable()
      console.log("[v0] MetaMask available:", available)
      setIsMetaMaskInstalled(available)

      if (available) {
        const providerCheck = verifyProviderAuthenticity()
        setSecurityStatus((prev) => ({
          ...prev,
          providerAuthentic: providerCheck.authentic,
          warnings: providerCheck.warnings,
        }))

        const cid = await getChainId()
        setChainId(cid)
      }
    }

    checkMetaMask()

    try {
      const savedWalletsStr = localStorage.getItem("connected_wallets")
      const savedActiveChain = localStorage.getItem("active_chain") as ChainType

      if (savedWalletsStr) {
        const savedWallets = JSON.parse(savedWalletsStr)
        setWallets((prev) => ({ ...prev, ...savedWallets }))
        if (savedActiveChain) setActiveChain(savedActiveChain)

        if (savedWallets.EVM) {
          bindSessionToWallet(sessionId, savedWallets.EVM, signEvent("session_restore", { wallet: savedWallets.EVM }))
          setSecurityStatus((prev) => ({ ...prev, sessionBound: true }))
        }
      }
    } catch (e) {
      console.error("[v0] Failed to parse saved wallets", e)
    }

    if (isMetaMaskAvailable()) {
      const accountsChangedHash = signEvent("accounts_changed_listener", {})
      const chainChangedHash = signEvent("chain_changed_listener", {})

      const handleAccountsChanged = (accounts: string[]) => {
        console.log("[v0] Accounts changed:", accounts)
        if (accounts.length === 0) {
          disconnectWallet("EVM")
        } else {
          setWallets((prev) => {
            const newWallets = { ...prev, EVM: accounts[0] }
            try {
              const saved = JSON.parse(localStorage.getItem("connected_wallets") || "{}")
              saved.EVM = accounts[0]
              localStorage.setItem("connected_wallets", JSON.stringify(saved))
            } catch (e) {
              console.warn("[v0] Failed to update localStorage:", e)
            }
            return newWallets
          })
          bindSessionToWallet(sessionId, accounts[0], signEvent("account_switch", { newAccount: accounts[0] }))
          refreshBalances()
        }
      }

      const handleChainChanged = (chainIdHex: string) => {
        console.log("[v0] Chain changed:", chainIdHex)
        const newChainId = Number.parseInt(chainIdHex, 16)
        setChainId(newChainId)
        setSecurityStatus((prev) => ({ ...prev, stateConsistent: false }))
        refreshBalances().then(() => {
          setSecurityStatus((prev) => ({ ...prev, stateConsistent: true }))
        })
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)
      window.ethereum.on("chainChanged", handleChainChanged)

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
        window.ethereum.removeListener("chainChanged", handleChainChanged)
      }
    }
  }, [sessionId])

  useEffect(() => {
    if (wallets.EVM) {
      refreshBalances()
      const interval = setInterval(refreshBalances, 60000)
      return () => clearInterval(interval)
    }
  }, [wallets.EVM, refreshBalances])

  return (
    <Web3Context.Provider
      value={{
        wallets,
        activeChain,
        setActiveChain,
        isConnected: Object.values(wallets).some((w) => w !== null),
        isConnecting,
        usdtBalance,
        usdcBalance,
        daiBalance,
        chainId,
        connectWallet,
        disconnectWallet,
        refreshBalances,
        isMetaMaskInstalled,
        switchNetwork,
        isSupportedNetwork,
        securityStatus,
        verifyBeforeTransaction,
      }}
    >
      {children}
    </Web3Context.Provider>
  )
}

export function useWeb3() {
  const context = useContext(Web3Context)
  if (context === undefined) {
    throw new Error("useWeb3 must be used within a Web3Provider")
  }
  return context
}
