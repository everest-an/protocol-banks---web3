import { ethers } from "ethers"

// USDT and USDC contract addresses on Ethereum mainnet
export const TOKEN_ADDRESSES = {
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
} as const

// ERC20 ABI for token transfers
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]

export function isMetaMaskAvailable(): boolean {
  if (typeof window === "undefined") return false
  return !!(window.ethereum && window.ethereum.isMetaMask)
}

export async function connectWallet(): Promise<string | null> {
  if (typeof window === "undefined") {
    throw new Error("Window is not available")
  }

  if (!window.ethereum) {
    throw new Error("Please install MetaMask extension to connect your wallet")
  }

  try {
    console.log("[v0] Attempting to connect to MetaMask...")
    const provider = new ethers.BrowserProvider(window.ethereum)
    const accounts = await provider.send("eth_requestAccounts", [])
    console.log("[v0] Successfully connected:", accounts[0])
    return accounts[0]
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("Connection request rejected by user")
    }
    console.error("[v0] Failed to connect wallet:", error)
    throw new Error(error.message || "Failed to connect to MetaMask")
  }
}

export async function getTokenBalance(walletAddress: string, tokenAddress: string): Promise<string> {
  if (typeof window === "undefined" || !window.ethereum) {
    return "0"
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
    const balance = await contract.balanceOf(walletAddress)
    const decimals = await contract.decimals()
    return ethers.formatUnits(balance, decimals)
  } catch (error) {
    console.error("[v0] Failed to get token balance:", error)
    return "0"
  }
}

export async function sendToken(tokenAddress: string, toAddress: string, amount: string): Promise<string> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not available")
  }

  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer)
  const decimals = await contract.decimals()
  const amountInWei = ethers.parseUnits(amount, decimals)

  const tx = await contract.transfer(toAddress, amountInWei)
  await tx.wait()

  return tx.hash
}

declare global {
  interface Window {
    ethereum?: any
  }
}
