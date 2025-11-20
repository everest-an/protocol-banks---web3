import { ethers } from "ethers"

export const CHAIN_IDS = {
  MAINNET: 1,
  SEPOLIA: 11155111,
} as const

// USDT and USDC contract addresses
export const TOKEN_ADDRESSES = {
  [CHAIN_IDS.MAINNET]: {
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  [CHAIN_IDS.SEPOLIA]: {
    // Using Aave V3 Faucet tokens for Sepolia testing
    USDT: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0",
    USDC: "0x94a9D9AC8a22534E3fACA9f4e7F2e2Cf85d5e4c8",
  },
} as const

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

export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export function getMetaMaskDeepLink(path = ""): string {
  if (typeof window === "undefined") return ""

  // Get the current URL without protocol
  const currentUrl = window.location.href.replace(/^https?:\/\//, "")

  // Construct the deep link
  // Format: https://metamask.app.link/dapp/<url>
  return `https://metamask.app.link/dapp/${currentUrl}`
}

export async function getChainId(): Promise<number> {
  if (typeof window === "undefined" || !window.ethereum) return CHAIN_IDS.MAINNET
  const provider = new ethers.BrowserProvider(window.ethereum)
  const network = await provider.getNetwork()
  return Number(network.chainId)
}

export function getTokenAddress(chainId: number, symbol: "USDT" | "USDC"): string {
  const chainAddresses = TOKEN_ADDRESSES[chainId as keyof typeof TOKEN_ADDRESSES]
  if (!chainAddresses) {
    // Default to Mainnet if chain not found
    return TOKEN_ADDRESSES[CHAIN_IDS.MAINNET][symbol]
  }
  return chainAddresses[symbol]
}

export async function connectWallet(): Promise<string | null> {
  if (typeof window === "undefined") {
    throw new Error("Window is not available")
  }

  // If mobile and no ethereum provider, we can't connect directly
  // The UI should handle redirecting to MetaMask app
  if (isMobileDevice() && !window.ethereum) {
    return null
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

export async function switchNetwork(chainId: number) {
  if (typeof window === "undefined" || !window.ethereum) return

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x" + chainId.toString(16) }],
    })
  } catch (error: any) {
    // This error code indicates that the chain has not been added to MetaMask.
    if (error.code === 4902) {
      // We could add logic here to add the chain, but for Mainnet/Sepolia it's usually there
      console.error("[v0] Chain not found in MetaMask")
    }
    throw error
  }
}

// Simple cache to prevent spamming RPC with getCode for same address
const contractExistsCache: Record<string, boolean> = {}

export async function getTokenBalance(walletAddress: string, tokenAddress: string): Promise<string> {
  if (typeof window === "undefined" || !window.ethereum) {
    return "0"
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum)

    // Check cache first
    if (contractExistsCache[tokenAddress] === undefined) {
      const code = await provider.getCode(tokenAddress)
      contractExistsCache[tokenAddress] = code !== "0x"
    }

    // If contract doesn't exist on this chain, return 0 immediately
    if (!contractExistsCache[tokenAddress]) {
      return "0"
    }

    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)

    // Get balance
    const balance = await contract.balanceOf(walletAddress)

    // Get decimals - try/catch specifically for this as it might fail on some proxies
    let decimals = 18
    try {
      decimals = await contract.decimals()
    } catch (e) {
      console.warn("[v0] Failed to get decimals, defaulting to 18", e)
    }

    return ethers.formatUnits(balance, decimals)
  } catch (error: any) {
    // Handle specific RPC errors
    if (error.code === "BAD_DATA") {
      console.warn(`[v0] Could not decode result for ${tokenAddress} - likely wrong chain`)
      return "0"
    }
    if (error?.info?.error?.code === -32002) {
      console.warn("[v0] RPC rate limit hit, returning 0 temporarily")
      return "0"
    }

    console.error("[v0] Failed to get token balance:", error)
    return "0"
  }
}

export async function sendToken(tokenSymbol: "USDT" | "USDC", toAddress: string, amount: string): Promise<string> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not available")
  }

  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()

  // Get current chain ID to ensure we use the right address
  const network = await provider.getNetwork()
  const chainId = Number(network.chainId)

  const tokenAddress = getTokenAddress(chainId, tokenSymbol)

  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer)
  const decimals = await contract.decimals()
  const amountInWei = ethers.parseUnits(amount, decimals)

  const tx = await contract.transfer(toAddress, amountInWei)
  await tx.wait()

  return tx.hash
}
