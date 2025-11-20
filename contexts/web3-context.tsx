"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { connectWallet as connectWeb3Wallet, getTokenBalance, TOKEN_ADDRESSES, isMetaMaskAvailable } from "@/lib/web3"

interface Web3ContextType {
  wallet: string | null
  isConnected: boolean
  isConnecting: boolean
  usdtBalance: string
  usdcBalance: string
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  refreshBalances: () => Promise<void>
  isMetaMaskInstalled: boolean
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined)

export function Web3Provider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [usdtBalance, setUsdtBalance] = useState("0")
  const [usdcBalance, setUsdcBalance] = useState("0")
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false)

  const refreshBalances = async () => {
    if (!wallet) return

    try {
      const [usdt, usdc] = await Promise.all([
        getTokenBalance(wallet, TOKEN_ADDRESSES.USDT),
        getTokenBalance(wallet, TOKEN_ADDRESSES.USDC),
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
      }
    } catch (error: any) {
      console.error("[v0] Failed to connect wallet:", error.message)
      alert(error.message || "Failed to connect wallet")
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

  useEffect(() => {
    const checkMetaMask = () => {
      const available = isMetaMaskAvailable()
      console.log("[v0] MetaMask available:", available)
      setIsMetaMaskInstalled(available)
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
        }
      }

      const handleChainChanged = () => {
        console.log("[v0] Chain changed, reloading...")
        window.location.reload()
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
      const interval = setInterval(refreshBalances, 30000)
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
        connectWallet,
        disconnectWallet,
        refreshBalances,
        isMetaMaskInstalled,
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
