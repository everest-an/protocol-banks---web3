/**
 * TRON Payment Service
 * Handles TRC20 token transfers and TRON network interactions
 */

import { getTokenAddress, getSupportedTokens } from "@/lib/networks"
import type { PaymentResult, Recipient } from "@/types"

// TRC20 ABI for transfer function
const TRC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
]

/**
 * Get TronWeb instance
 */
function getTronWeb(): any {
  if (typeof window === "undefined" || !window.tronWeb) {
    throw new Error("TronLink is not available. Please install TronLink wallet.")
  }

  if (!window.tronWeb.defaultAddress?.base58) {
    throw new Error("TronLink is locked. Please unlock your wallet.")
  }

  return window.tronWeb
}

/**
 * Get current TRON network (mainnet or nile)
 */
export async function getTronNetwork(): Promise<"tron" | "tron-nile"> {
  const tronWeb = getTronWeb()

  // TronLink doesn't expose network info directly, we need to query the API
  try {
    const fullNode = tronWeb.fullNode.host
    if (fullNode.includes("nile")) {
      return "tron-nile"
    }
    return "tron"
  } catch (error) {
    console.warn("[TRON] Failed to detect network, defaulting to mainnet:", error)
    return "tron"
  }
}

/**
 * Validate TRON address
 */
export function isValidTronAddress(address: string): boolean {
  if (typeof window === "undefined" || !window.tronWeb) {
    // Fallback validation for server-side or when TronLink is not available
    return /^T[a-zA-Z0-9]{33}$/.test(address)
  }

  return window.tronWeb.isAddress(address)
}

/**
 * Get TRC20 token balance
 */
export async function getTRC20Balance(
  tokenAddress: string,
  walletAddress: string,
): Promise<{ balance: string; decimals: number }> {
  const tronWeb = getTronWeb()

  try {
    const contract = await tronWeb.contract(TRC20_ABI, tokenAddress)
    const decimals = await contract.decimals().call()
    const balance = await contract.balanceOf(walletAddress).call()

    return {
      balance: tronWeb.toBigNumber(balance).toString(),
      decimals: Number(decimals),
    }
  } catch (error) {
    console.error("[TRON] Failed to get balance:", error)
    throw new Error(`Failed to get token balance: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Send TRC20 token
 */
export async function sendTRC20(
  tokenAddress: string,
  toAddress: string,
  amount: string,
  decimals: number = 6,
): Promise<string> {
  const tronWeb = getTronWeb()

  // Validate addresses
  if (!isValidTronAddress(toAddress)) {
    throw new Error(`Invalid recipient address: ${toAddress}`)
  }

  if (!isValidTronAddress(tokenAddress)) {
    throw new Error(`Invalid token address: ${tokenAddress}`)
  }

  try {
    // Convert amount to smallest unit (e.g., USDT has 6 decimals)
    const amountInSmallestUnit = tronWeb
      .toBigNumber(amount)
      .multipliedBy(Math.pow(10, decimals))
      .toFixed(0)

    console.log("[TRON] Sending TRC20:", {
      token: tokenAddress,
      to: toAddress,
      amount,
      amountInSmallestUnit,
      decimals,
    })

    // Create contract instance
    const contract = await tronWeb.contract(TRC20_ABI, tokenAddress)

    // Check balance
    const fromAddress = tronWeb.defaultAddress.base58
    const balanceResult = await contract.balanceOf(fromAddress).call()
    const balance = tronWeb.toBigNumber(balanceResult)

    if (balance.lt(amountInSmallestUnit)) {
      throw new Error(
        `Insufficient balance. Required: ${amount}, Available: ${balance.dividedBy(Math.pow(10, decimals)).toFixed(decimals)}`,
      )
    }

    // Execute transfer
    const tx = await contract.transfer(toAddress, amountInSmallestUnit).send({
      feeLimit: 100_000_000, // 100 TRX fee limit
      callValue: 0,
    })

    console.log("[TRON] Transfer successful:", tx)

    return tx
  } catch (error: any) {
    console.error("[TRON] Transfer failed:", error)

    // Parse TronLink error messages
    if (error.message?.includes("Confirmation declined by user")) {
      throw new Error("Transaction was rejected by user")
    }

    if (error.message?.includes("Insufficient energy")) {
      throw new Error("Insufficient energy. Please freeze TRX for energy or wait for energy to regenerate.")
    }

    if (error.message?.includes("Insufficient bandwidth")) {
      throw new Error("Insufficient bandwidth. Transaction requires bandwidth or TRX for fees.")
    }

    throw new Error(`Transfer failed: ${error.message || "Unknown error"}`)
  }
}

/**
 * Send native TRX
 */
export async function sendTRX(toAddress: string, amount: string): Promise<string> {
  const tronWeb = getTronWeb()

  if (!isValidTronAddress(toAddress)) {
    throw new Error(`Invalid recipient address: ${toAddress}`)
  }

  try {
    // Convert TRX to sun (1 TRX = 1,000,000 sun)
    const amountInSun = tronWeb.toSun(amount)

    console.log("[TRON] Sending TRX:", {
      to: toAddress,
      amount,
      amountInSun,
    })

    const tx = await tronWeb.trx.sendTransaction(toAddress, amountInSun)

    console.log("[TRON] TRX transfer successful:", tx)

    return tx.txid || tx.transaction?.txID || tx
  } catch (error: any) {
    console.error("[TRON] TRX transfer failed:", error)

    if (error.message?.includes("Confirmation declined by user")) {
      throw new Error("Transaction was rejected by user")
    }

    throw new Error(`TRX transfer failed: ${error.message || "Unknown error"}`)
  }
}

/**
 * Process single TRON payment
 */
export async function processTronPayment(recipient: Recipient, wallet: string): Promise<PaymentResult> {
  console.log("[TRON] Processing payment:", { recipient, wallet })

  try {
    // Validate recipient address
    if (!isValidTronAddress(recipient.address)) {
      throw new Error(`Invalid TRON address: ${recipient.address}`)
    }

    // Get current network
    const network = await getTronNetwork()
    console.log("[TRON] Current network:", network)

    // Get token address from network config
    const tokenSymbol = recipient.token || "USDT"
    const tokenAddress = getTokenAddress(network, tokenSymbol)

    if (!tokenAddress) {
      // Check if supported tokens exist for this network
      const supportedTokens = getSupportedTokens(network)
      const tokenList = supportedTokens.map((t) => t.symbol).join(", ")
      throw new Error(
        `Token ${tokenSymbol} is not supported on ${network}. Supported tokens: ${tokenList || "none"}`,
      )
    }

    // Get token decimals
    const tokens = getSupportedTokens(network)
    const tokenConfig = tokens.find((t) => t.symbol === tokenSymbol)
    const decimals = tokenConfig?.decimals || 6

    // Send TRC20 transfer
    const txHash = await sendTRC20(tokenAddress, recipient.address, String(recipient.amount), decimals)

    return {
      success: true,
      txHash,
      recipient: recipient.address,
      amount: recipient.amount,
      token: tokenSymbol,
    }
  } catch (error) {
    console.error("[TRON] Payment failed:", error)

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      recipient: recipient.address,
      amount: recipient.amount,
      token: recipient.token || "USDT",
    }
  }
}

/**
 * Process batch TRON payments
 */
export async function processTronBatchPayments(
  recipients: Recipient[],
  wallet: string,
  onProgress?: (current: number, total: number) => void,
): Promise<PaymentResult[]> {
  console.log("[TRON] Processing batch payments:", { count: recipients.length, wallet })

  const results: PaymentResult[] = []

  for (let i = 0; i < recipients.length; i++) {
    const result = await processTronPayment(recipients[i], wallet)
    results.push(result)

    if (onProgress) {
      onProgress(i + 1, recipients.length)
    }

    // Add delay between transactions to avoid rate limiting
    // TRON has 3-second block time, so we wait 3s between transactions
    if (i < recipients.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
  }

  return results
}

/**
 * Get account resources (energy, bandwidth)
 */
export async function getAccountResources(address?: string): Promise<{
  energy: { available: number; limit: number; used: number }
  bandwidth: { available: number; limit: number; used: number }
}> {
  const tronWeb = getTronWeb()
  const accountAddress = address || tronWeb.defaultAddress.base58

  try {
    const resources = await tronWeb.trx.getAccountResources(accountAddress)

    return {
      energy: {
        available: resources.EnergyLimit - (resources.EnergyUsed || 0),
        limit: resources.EnergyLimit || 0,
        used: resources.EnergyUsed || 0,
      },
      bandwidth: {
        available: resources.freeNetLimit - (resources.freeNetUsed || 0),
        limit: resources.freeNetLimit || 0,
        used: resources.freeNetUsed || 0,
      },
    }
  } catch (error) {
    console.error("[TRON] Failed to get account resources:", error)
    throw new Error(`Failed to get account resources: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Estimate energy and bandwidth for TRC20 transfer
 */
export function estimateTRC20Resources(): {
  energy: number
  bandwidth: number
  feeLimit: number
} {
  // TRC20 transfer typically costs:
  // - Energy: ~32,000 (can vary)
  // - Bandwidth: ~345 bytes
  // - Fee limit: 100 TRX (100,000,000 sun)
  return {
    energy: 32000,
    bandwidth: 345,
    feeLimit: 100_000_000, // 100 TRX
  }
}

/**
 * Get transaction details from TRON network
 */
export async function getTronTransaction(txHash: string): Promise<any> {
  const tronWeb = getTronWeb()

  try {
    const tx = await tronWeb.trx.getTransaction(txHash)
    return tx
  } catch (error) {
    console.error("[TRON] Failed to get transaction:", error)
    throw new Error(`Failed to get transaction: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTronConfirmation(
  txHash: string,
  maxAttempts: number = 20,
  delayMs: number = 3000,
): Promise<boolean> {
  const tronWeb = getTronWeb()

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const tx = await tronWeb.trx.getTransactionInfo(txHash)

      if (tx && tx.id) {
        // Transaction is confirmed
        console.log(`[TRON] Transaction confirmed after ${i + 1} attempts:`, tx)
        return tx.receipt?.result === "SUCCESS"
      }
    } catch (error) {
      console.log(`[TRON] Waiting for confirmation (attempt ${i + 1}/${maxAttempts})...`)
    }

    // Wait before next attempt
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  throw new Error(`Transaction confirmation timeout after ${maxAttempts} attempts`)
}
