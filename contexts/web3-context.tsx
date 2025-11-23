"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
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
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined)

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
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(() => { if (typeof window !== "undefined") { return isMetaMaskAvailable() } return false })

  const isSupportedNetwork =
    chainId === CHAIN_IDS.MAINNET || chainId === CHAIN_IDS.SEPOLIA || chainId === CHAIN_IDS.BASE

  const refreshBalances = async () => {
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
      } catch (error) {
        console.error("[v0] Failed to refresh balances:", error)
      }
    }
  }

  const connectWallet = async (type: ChainType = "EVM") => {
    setIsConnecting(true)
    try {
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

        const savedWallets = JSON.parse(localStorage.getItem("connected_wallets") || "{}")
        savedWallets[type] = address
        localStorage.setItem("connected_wallets", JSON.stringify(savedWallets))
        localStorage.setItem("active_chain", type)

        await refreshBalances()
      }
    } catch (error: any) {
      console.error("[v0] Failed to connect wallet:", error.message)
      if (error.code !== 4001) {
        alert(error.message || "Failed to connect wallet")
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = (type?: ChainType) => {
    if (type) {
      setWallets((prev) => ({ ...prev, [type]: null }))

      const savedWallets = JSON.parse(localStorage.getItem("connected_wallets") || "{}")
      delete savedWallets[type]
      localStorage.setItem("connected_wallets", JSON.stringify(savedWallets))

      if (activeChain === type) {
        const otherChain = (Object.keys(wallets) as ChainType[]).find((k) => k !== type && wallets[k])
        if (otherChain) setActiveChain(otherChain)
      }
    } else {
      setWallets({ EVM: null, SOLANA: null, BITCOIN: null })
      setUsdtBalance("0")
      setUsdcBalance("0")
      setDaiBalance("0")
      localStorage.removeItem("connected_wallets")
      localStorage.removeItem("active_chain")
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
        const cid = await getChainId()
        setChainId(cid)
      }
    }

    checkMetaMask()

    const savedWalletsStr = localStorage.getItem("connected_wallets")
    const savedActiveChain = localStorage.getItem("active_chain") as ChainType

    if (savedWalletsStr) {
      try {
        const savedWallets = JSON.parse(savedWalletsStr)
        setWallets((prev) => ({ ...prev, ...savedWallets }))
        if (savedActiveChain) setActiveChain(savedActiveChain)

        if (savedWallets.EVM && isMetaMaskAvailable()) {
        }
      } catch (e) {
        console.error("Failed to parse saved wallets", e)
      }
    }

    if (isMetaMaskAvailable()) {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log("[v0] Accounts changed:", accounts)
        if (accounts.length === 0) {
          disconnectWallet("EVM")
        } else {
          setWallets((prev) => {
            const newWallets = { ...prev, EVM: accounts[0] }
            const saved = JSON.parse(localStorage.getItem("connected_wallets") || "{}")
            saved.EVM = accounts[0]
            localStorage.setItem("connected_wallets", JSON.stringify(saved))
            return newWallets
          })
          refreshBalances()
        }
      }

      const handleChainChanged = (chainIdHex: string) => {
        console.log("[v0] Chain changed:", chainIdHex)
        const newChainId = Number.parseInt(chainIdHex, 16)
        setChainId(newChainId)
        refreshBalances()
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)
      window.ethereum.on("chainChanged", handleChainChanged)

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
        window.ethereum.removeListener("chainChanged", handleChainChanged)
      }
    }
  }, [])

  useEffect(() => {
    if (wallets.EVM) {
      refreshBalances()
      const interval = setInterval(refreshBalances, 60000)
      return () => clearInterval(interval)
    }
  }, [wallets.EVM])

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
