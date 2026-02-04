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
  signERC3009Authorization as signERC3009AuthorizationWeb3,
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
} from "@/lib/security/cross-function-security"

interface Web3ContextType {
  wallets: {
    EVM: string | null
    SOLANA: string | null
    BITCOIN: string | null
  }
  // Convenience aliases
  address: string | null  // Alias for wallets.EVM
  wallet: string | null   // Alias for wallets.EVM
  signer: any | null      // Placeholder for signer
  signMessage: (message: string) => Promise<string>
  sendToken: (to: string, amount: string, token: string) => Promise<string>
  signERC3009Authorization: (params: {
    tokenAddress: string
    from: string
    to: string
    amount: string
    chainId?: number
  }) => Promise<{ v: number; r: string; s: string; nonce: string; validAfter: number; validBefore: number }>
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
    chainId === CHAIN_IDS.MAINNET ||
    chainId === CHAIN_IDS.SEPOLIA ||
    chainId === CHAIN_IDS.BASE ||
    chainId === CHAIN_IDS.ARBITRUM

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

        const bindResult = bindSessionToWallet(sessionId, address)
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
          bindSessionToWallet(sessionId, savedWallets.EVM)
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
          bindSessionToWallet(sessionId, accounts[0])
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

  // Stub functions for compatibility
  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!wallets.EVM || typeof window === 'undefined' || !window.ethereum) {
      throw new Error('Wallet not connected')
    }
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, wallets.EVM],
    })
    return signature as string
  }, [wallets.EVM])

  const sendToken = useCallback(async (to: string, amount: string, token: string): Promise<string> => {
    if (!wallets.EVM) {
      throw new Error('Wallet not connected')
    }

    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask not installed')
    }

    try {
      console.log('[Web3] sendToken called:', { to, amount, token })

      // 动态导入 ethers
      const { ethers } = await import('ethers')

      // 创建 provider 和 signer
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      // 获取代币地址
      const tokenAddresses: Record<string, string> = {
        'USDT': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // Arbitrum USDT
        'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum USDC
        'DAI': '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',  // Arbitrum DAI
      }

      const tokenAddress = tokenAddresses[token.toUpperCase()]
      if (!tokenAddress) {
        throw new Error(`Unsupported token: ${token}`)
      }

      // ERC20 ABI
      const erc20Abi = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)',
      ]

      // 创建合约实例
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer)

      // 获取代币精度
      const decimals = await tokenContract.decimals()

      // 转换金额（考虑精度）
      const amountInWei = ethers.parseUnits(amount, decimals)

      console.log('[Web3] Sending transaction:', {
        to,
        amount: amountInWei.toString(),
        token,
        tokenAddress,
      })

      // 发送交易
      const tx = await tokenContract.transfer(to, amountInWei)
      console.log('[Web3] Transaction sent:', tx.hash)

      // 等待确认
      const receipt = await tx.wait()
      console.log('[Web3] Transaction confirmed:', receipt.hash)

      return receipt.hash
    } catch (error: any) {
      console.error('[Web3] sendToken error:', error)
      throw new Error(error.message || 'Transfer failed')
    }
  }, [wallets.EVM])

  const signERC3009Authorization = useCallback(async (params: {
    tokenAddress: string
    from: string
    to: string
    amount: string
    chainId?: number
  }): Promise<{ v: number; r: string; s: string; nonce: string; validAfter: number; validBefore: number }> => {
    console.log('[Web3] signERC3009Authorization called:', params)

    if (!wallets.EVM) {
      throw new Error('Wallet not connected')
    }

    const targetChainId = params.chainId || chainId

    // Use the real signing implementation from web3.ts
    const authorization = await signERC3009AuthorizationWeb3(
      params.tokenAddress,
      params.from,
      params.to,
      params.amount,
      targetChainId
    )

    console.log('[Web3] ERC-3009 authorization signed:', {
      nonce: authorization.nonce,
      validBefore: authorization.validBefore
    })

    return authorization
  }, [wallets.EVM, chainId])

  return (
    <Web3Context.Provider
      value={{
        wallets,
        address: wallets.EVM,
        wallet: wallets.EVM,
        signer: null,
        signMessage,
        sendToken,
        signERC3009Authorization,
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
