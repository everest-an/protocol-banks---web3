import { ethers } from "ethers"

export const CHAIN_IDS = {
  MAINNET: 1,
  SEPOLIA: 11155111,
  BASE: 8453,
} as const

// USDT, USDC, and DAI contract addresses
export const TOKEN_ADDRESSES = {
  [CHAIN_IDS.MAINNET]: {
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  },
  [CHAIN_IDS.SEPOLIA]: {
    // Using Aave V3 Faucet tokens for Sepolia testing
    USDT: "0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0",
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    DAI: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357",
  },
  [CHAIN_IDS.BASE]: {
    // Base Mainnet Addresses
    // Bridged USDT (Axelar or Celer common, but usually users want Native USDC)
    // We will use the canonical bridged USDT from standard bridge if available, or just placeholder.
    // Official Bridged USDT (from Ethereum) doesn't exist as native, but there is "USDbC" which is Bridged USDC (Legacy).
    // The user specifically wants USDC (Native) x402 support.
    USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // Bridged USDT (unofficial standard)
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Native USDC (Circle)
    DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // Bridged DAI
  },
} as const

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external",
]

export type ChainType = "EVM" | "SOLANA" | "BITCOIN"

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean
      connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>
      disconnect: () => Promise<void>
      request: (args: { method: string; params?: any }) => Promise<any>
    }
    unisat?: {
      requestAccounts: () => Promise<string[]>
      getAccounts: () => Promise<string[]>
      getNetwork: () => Promise<string>
      switchNetwork: (network: string) => Promise<void>
      getBalance: () => Promise<{ total: number; confirmed: number; unconfirmed: number }>
    }
  }
}

export function isMetaMaskAvailable(): boolean {
  if (typeof window === "undefined") return false
  const eth = window.ethereum as any
  if (!eth) return false

  if (eth.providers) {
    return eth.providers.some((p: any) => p.isMetaMask)
  }

  return !!eth.isMetaMask
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

export async function connectWallet(type: ChainType): Promise<string | null> {
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
    let address = ""

    if (type === "EVM") {
      let provider = window.ethereum as any
      if (provider.providers) {
        const metaMaskProvider = provider.providers.find((p: any) => p.isMetaMask)
        if (metaMaskProvider) {
          provider = metaMaskProvider
        }
      }

      console.log("[Web3] Requesting accounts from provider:", provider)

      // This is more reliable for triggering the popup
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[]
      address = accounts[0]
    }

    if (address) {
      return address
    }
  } catch (error: any) {
    console.error("[Web3] Failed to connect wallet:", error.message)
    if (error.code !== 4001) {
      // alert(error.message || "Failed to connect wallet")
    }
    throw new Error(error.message || "Failed to connect wallet")
  }

  return null
}

export function getTokenAddress(chainId: number, symbol: string): string | undefined {
  const chainAddresses = TOKEN_ADDRESSES[chainId as keyof typeof TOKEN_ADDRESSES]
  if (!chainAddresses) {
    // Default to Mainnet if chain not found
    return (TOKEN_ADDRESSES[CHAIN_IDS.MAINNET] as any)[symbol]
  }
  return (chainAddresses as any)[symbol]
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

  if (!ethers.isAddress(walletAddress) || !ethers.isAddress(tokenAddress)) {
    console.warn("[v0] Invalid address provided to getTokenBalance")
    return "0"
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const network = await provider.getNetwork()
    const chainId = Number(network.chainId)

    // Check cache first
    if (contractExistsCache[tokenAddress] === undefined) {
      try {
        const code = await provider.getCode(tokenAddress)
        contractExistsCache[tokenAddress] = code !== "0x"
      } catch (e: any) {
        // If getCode fails with rate limit, assume it exists for now to try balance, or return 0
        if (e?.error?.code === -32002 || e?.info?.error?.code === -32002) {
          console.warn("[v0] RPC rate limit during getCode, skipping cache update")
          return "0"
        }
        throw e
      }
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
    if (error.code === "BAD_DATA" || error.code === "INVALID_ARGUMENT") {
      console.warn(`[v0] Could not decode result for ${tokenAddress} - likely wrong chain or invalid address`)
      return "0"
    }

    if (
      error?.info?.error?.code === -32002 ||
      error?.error?.code === -32002 ||
      error?.code === -32002 ||
      error?.message?.includes("RPC endpoint returned too many errors")
    ) {
      console.warn("[v0] RPC rate limit hit, returning 0 temporarily")
      return "0"
    }

    console.error("[v0] Failed to get token balance:", error)
    return "0"
  }
}

export async function sendToken(tokenAddress: string, toAddress: string, amount: string): Promise<string> {
  if (tokenAddress === "SOL") {
    console.log("[Web3] Simulating Solana transaction...")
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return "5U3bHwJ6e5..." // Mock Solana signature
  }

  if (tokenAddress === "BTC") {
    console.log("[Web3] Simulating Bitcoin transaction...")
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return "a1b2c3d4..." // Mock Bitcoin tx hash
  }

  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not available")
  }

  if (!ethers.isAddress(toAddress)) {
    throw new Error("Invalid recipient address")
  }
  if (!ethers.isAddress(tokenAddress)) {
    throw new Error("Invalid token contract address")
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

export async function connectSolana(): Promise<string> {
  if (typeof window === "undefined") return ""

  if (!window.solana?.isPhantom) {
    window.open("https://phantom.app/", "_blank")
    throw new Error("Please install Phantom wallet for Solana")
  }

  try {
    const resp = await window.solana.connect()
    return resp.publicKey.toString()
  } catch (err: any) {
    throw new Error(err.message || "User rejected the request.")
  }
}

export async function connectBitcoin(): Promise<string> {
  if (typeof window === "undefined") return ""

  if (typeof window.unisat === "undefined") {
    window.open("https://unisat.io/", "_blank")
    throw new Error("Please install Unisat wallet for Bitcoin")
  }

  try {
    const accounts = await window.unisat.requestAccounts()
    return accounts[0]
  } catch (err: any) {
    throw new Error(err.message || "User rejected the request.")
  }
}

export async function signERC3009Authorization(
  tokenAddress: string,
  from: string,
  to: string,
  amount: string,
  chainId: number,
): Promise<{ v: number; r: string; s: string; nonce: string; validAfter: number; validBefore: number }> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not available")
  }

  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()

  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
  const name = await contract.symbol()

  // Random nonce (32 bytes hex)
  const nonce = ethers.hexlify(ethers.randomBytes(32))
  const validAfter = 0
  const validBefore = Math.floor(Date.now() / 1000) + 3600 // 1 hour

  const domain = {
    name: name === "USDC" ? "USD Coin" : name,
    version: name === "USDC" ? "2" : "1",
    chainId: chainId,
    verifyingContract: tokenAddress,
  }

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  }

  // Value in Wei
  const decimals = await contract.decimals()
  const value = ethers.parseUnits(amount, decimals)

  const message = {
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
  }

  // Sign Typed Data
  const signature = await signer.signTypedData(domain, types, message)
  const { v, r, s } = ethers.Signature.from(signature)

  return { v, r, s, nonce, validAfter, validBefore }
}

export async function executeERC3009Transfer(
  tokenAddress: string,
  from: string,
  to: string,
  amount: string,
  auth: { v: number; r: string; s: string; nonce: string; validAfter: number; validBefore: number },
): Promise<string> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not available")
  }

  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()

  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer)
  const decimals = await contract.decimals()
  const value = ethers.parseUnits(amount, decimals)

  try {
    const tx = await contract.transferWithAuthorization(
      from,
      to,
      value,
      auth.validAfter,
      auth.validBefore,
      auth.nonce,
      auth.v,
      auth.r,
      auth.s,
    )

    await tx.wait()
    return tx.hash
  } catch (error: any) {
    throw new Error(error.message || "Transaction failed")
  }
}
