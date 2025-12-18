"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

// User type: web2 (email/social login) vs web3 (crypto wallet)
type UserType = "web2" | "web3" | null

interface UserTypeContextType {
  userType: UserType
  setUserType: (type: UserType) => void
  isWeb2User: boolean
  isWeb3User: boolean
  // Simplified labels for Web2 users
  getLabel: (web3Term: string) => string
}

const UserTypeContext = createContext<UserTypeContextType | undefined>(undefined)

// Mapping of Web3 terms to Web2-friendly terms
const web2FriendlyLabels: Record<string, string> = {
  Wallet: "Account",
  "Connect Wallet": "Sign In",
  "Disconnect Wallet": "Sign Out",
  "Wallet Address": "Account ID",
  "Gas Fee": "Transaction Fee",
  "Transaction Hash": "Confirmation Number",
  "Block Confirmation": "Processing",
  "Smart Contract": "Automated Payment",
  USDT: "Digital Dollar (USDT)",
  USDC: "Digital Dollar (USDC)",
  Token: "Digital Currency",
  Blockchain: "Secure Network",
  Ethereum: "Payment Network",
  Mainnet: "Live Network",
  Testnet: "Test Mode",
  Sepolia: "Test Mode",
  DeFi: "Digital Finance",
  Crypto: "Digital Currency",
  "On-Ramp": "Add Funds",
  "Off-Ramp": "Withdraw Funds",
  "Seed Phrase": "Recovery Code",
  "Private Key": "Secret Key",
  "Sign Transaction": "Approve Payment",
  Approve: "Confirm",
  Pending: "Processing",
  Confirmed: "Complete",
  Failed: "Unsuccessful",
  "Network Fee": "Service Fee",
  Slippage: "Price Variation",
}

export function UserTypeProvider({ children }: { children: ReactNode }) {
  const [userType, setUserTypeState] = useState<UserType>(null)

  useEffect(() => {
    // Restore user type from localStorage
    try {
      const saved = localStorage.getItem("user_type")
      if (saved === "web2" || saved === "web3") {
        setUserTypeState(saved)
      }
    } catch (e) {
      console.warn("Failed to restore user type from localStorage")
    }
  }, [])

  const setUserType = (type: UserType) => {
    setUserTypeState(type)
    try {
      if (type) {
        localStorage.setItem("user_type", type)
      } else {
        localStorage.removeItem("user_type")
      }
    } catch (e) {
      console.warn("Failed to save user type to localStorage")
    }
  }

  const getLabel = (web3Term: string): string => {
    if (userType === "web2") {
      return web2FriendlyLabels[web3Term] || web3Term
    }
    return web3Term
  }

  return (
    <UserTypeContext.Provider
      value={{
        userType,
        setUserType,
        isWeb2User: userType === "web2",
        isWeb3User: userType === "web3",
        getLabel,
      }}
    >
      {children}
    </UserTypeContext.Provider>
  )
}

export function useUserType() {
  const context = useContext(UserTypeContext)
  if (context === undefined) {
    throw new Error("useUserType must be used within a UserTypeProvider")
  }
  return context
}
