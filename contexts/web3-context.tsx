"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import {
  connectWallet as connectWeb3Wallet,
  getTokenBalance,
  getTokenAddress,
  getChainId,
  isMetaMaskAvailable,
  switchNetwork as switchWeb3Network,
  CHAIN_IDS,
} from "@/lib/web3"

interface Web3ContextType {
  wallet: string | null
  isConnected: boolean
  isConnecting: boolean
  usdtBalance: string
  usdcBalance: string
  chainId: number
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  refreshBalances: () => Promise<void>
  isMetaMaskInstalled: boolean
  switchNetwork: (chainId: number) => Promise<void>
  isSupportedNetwork: boolean
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined)

export function Web3Provider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [usdtBalance, setUsdtBalance] = useState("0")
  const [usdcBalance, setUsdcBalance] = useState("0")
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false)
  const [chainId, setChainId] = useState<number>(CHAIN_IDS.MAINNET)

  const isSupportedNetwork = chainId === CHAIN_IDS.MAINNET || chainId === CHAIN_IDS.SEPOLIA

  const refreshBalances = async () => {
    if (!wallet) return

    try {
      // Get current chain ID first
      const currentChainId = await getChainId()
      setChainId(currentChainId)

      // Get appropriate addresses for this chain
      const usdtAddress = getTokenAddress(currentChainId, "USDT")
      const usdcAddress = getTokenAddress(currentChainId, "USDC")

      const [usdt, usdc] = await Promise.all([
        getTokenBalance(wallet, usdtAddress),
        getTokenBalance(wallet, usdcAddress),
      ])
      setUsdtBalance(usdt)
      setUsdcBalance(usdc)
    } catch (error) {
      console.error("[v0] Failed to refresh balances:", error)
    }
  }

  const connectWallet = async () => {
    setIsConnecting(true)
    try {
      console.log("[v0] Starting wallet connection...")
      const address = await connectWeb3Wallet()
      if (address) {
        console.log("[v0] Wallet connected:", address)
        setWallet(address)
        localStorage.setItem("wallet_address", address)
        await refreshBalances()
      }
    } catch (error: any) {
      console.error("[v0] Failed to connect wallet:", error.message)
      // Don't alert if it's just the user cancelling
      if (error.code !== 4001) {
        // alert(error.message || "Failed to connect wallet")
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = () => {
    setWallet(null)
    setUsdtBalance("0")
    setUsdcBalance("0")
    localStorage.removeItem("wallet_address")
  }

  const switchNetwork = async (targetChainId: number) => {
    try {
      await switchWeb3Network(targetChainId)
      // The chainChanged event will handle the reload/refresh
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

    const savedWallet = localStorage.getItem("wallet_address")
    if (savedWallet && isMetaMaskAvailable()) {
      console.log("[v0] Restoring saved wallet:", savedWallet)
      setWallet(savedWallet)
    }

    if (isMetaMaskAvailable()) {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log("[v0] Accounts changed:", accounts)
        if (accounts.length === 0) {
          disconnectWallet()
        } else {
          setWallet(accounts[0])
          localStorage.setItem("wallet_address", accounts[0])
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
    if (wallet) {
      refreshBalances()
      // Refresh every 60 seconds to avoid rate limits
      const interval = setInterval(refreshBalances, 60000)
      return () => clearInterval(interval)
    }
  }, [wallet])

  return (
    <Web3Context.Provider
      value={{
        wallet,
        isConnected: !!wallet,
        isConnecting,
        usdtBalance,
        usdcBalance,
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
