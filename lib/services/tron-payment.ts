/**
 * TRON Payment Service
 * Handles TRC20 token transfers and TRON network interactions
 */

import { getTokenAddress, getSupportedTokens } from "@/lib/networks"
import type { PaymentResult, Recipient } from "@/types"

// Browser-safe logger (tron-payment runs client-side via TronLink, cannot import winston)
const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => console.log(`[TRON] ${msg}`, meta ?? ""),
  warn: (msg: string, meta?: Record<string, unknown>) => console.warn(`[TRON] ${msg}`, meta ?? ""),
  error: (msg: string, err?: unknown, meta?: Record<string, unknown>) => console.error(`[TRON] ${msg}`, err, meta ?? ""),
  debug: (msg: string, meta?: Record<string, unknown>) => console.debug(`[TRON] ${msg}`, meta ?? ""),
  logBlockchainInteraction: (chain: string, action: string, tx: string, status: string, meta?: Record<string, unknown>) =>
    console.log(`[TRON:${chain}] ${action} ${tx} ${status}`, meta ?? ""),
  logPayment: (status: string, tx: string, amount: string, meta?: Record<string, unknown>) =>
    console.log(`[TRON:payment] ${status} ${tx} ${amount}`, meta ?? ""),
}

/**
 * TRON Error Classification
 *
 * Maps raw TRON/TronLink error messages to user-friendly errors with action hints.
 */
export class TronError extends Error {
  code: string
  recoverable: boolean
  action: string

  constructor(code: string, message: string, recoverable: boolean, action: string) {
    super(message)
    this.name = 'TronError'
    this.code = code
    this.recoverable = recoverable
    this.action = action
  }
}

const TRON_ERROR_MAP: Array<{
  pattern: RegExp | string
  code: string
  message: string
  recoverable: boolean
  action: string
}> = [
  {
    pattern: /Confirmation declined by user/i,
    code: 'USER_REJECTED',
    message: 'Transaction was rejected by user',
    recoverable: true,
    action: 'Please approve the transaction in TronLink'
  },
  {
    pattern: /Insufficient energy/i,
    code: 'INSUFFICIENT_ENERGY',
    message: 'Insufficient energy for this transaction',
    recoverable: true,
    action: 'Freeze TRX for energy or wait for energy to regenerate'
  },
  {
    pattern: /Insufficient bandwidth/i,
    code: 'INSUFFICIENT_BANDWIDTH',
    message: 'Insufficient bandwidth for this transaction',
    recoverable: true,
    action: 'Freeze TRX for bandwidth or use TRX to pay for fees'
  },
  {
    pattern: /OUT_OF_ENERGY/i,
    code: 'OUT_OF_ENERGY',
    message: 'Contract execution ran out of energy',
    recoverable: true,
    action: 'Increase fee limit or freeze more TRX for energy'
  },
  {
    pattern: /REVERT/i,
    code: 'CONTRACT_REVERT',
    message: 'Smart contract execution reverted',
    recoverable: false,
    action: 'Check contract parameters and allowance'
  },
  {
    pattern: /Account not found|account.*does not exist|Account not activated/i,
    code: 'ACCOUNT_NOT_FOUND',
    message: 'Target account is not activated on TRON network',
    recoverable: false,
    action: 'The recipient must have at least 0.1 TRX to activate their account'
  },
  {
    pattern: /balance is not sufficient|Insufficient balance/i,
    code: 'INSUFFICIENT_BALANCE',
    message: 'Insufficient token balance for this transfer',
    recoverable: false,
    action: 'Check your token balance and ensure you have enough funds'
  },
  {
    pattern: /TAPOS_ERROR|tapos/i,
    code: 'TAPOS_ERROR',
    message: 'Transaction reference block is invalid or expired',
    recoverable: true,
    action: 'Retry the transaction'
  },
  {
    pattern: /TOO_BIG_TRANSACTION_ERROR/i,
    code: 'TX_TOO_BIG',
    message: 'Transaction data exceeds maximum size',
    recoverable: false,
    action: 'Reduce the number of operations in this transaction'
  },
  {
    pattern: /DUPLICATE_TRANSACTION/i,
    code: 'DUPLICATE_TX',
    message: 'This transaction has already been submitted',
    recoverable: false,
    action: 'Wait for the original transaction to confirm'
  },
  {
    pattern: /CONTRACT_VALIDATE_ERROR|validate error/i,
    code: 'CONTRACT_VALIDATE_ERROR',
    message: 'Contract validation failed',
    recoverable: false,
    action: 'Check contract address and parameters'
  },
  {
    pattern: /Signature.*invalid|signature/i,
    code: 'INVALID_SIGNATURE',
    message: 'Transaction signature is invalid',
    recoverable: true,
    action: 'Reconnect TronLink and try again'
  },
  {
    pattern: /fee.*limit.*low|feeLimit/i,
    code: 'FEE_LIMIT_TOO_LOW',
    message: 'Transaction fee limit is too low',
    recoverable: true,
    action: 'Increase the fee limit for this transaction'
  },
  {
    pattern: /timeout|ETIMEDOUT|ECONNREFUSED/i,
    code: 'NETWORK_ERROR',
    message: 'Network connection error',
    recoverable: true,
    action: 'Check your internet connection and try again'
  },
]

/**
 * Parse raw TRON error into a structured TronError
 */
export function parseTronError(error: unknown): TronError {
  const message = error instanceof Error ? error.message : String(error)

  for (const mapping of TRON_ERROR_MAP) {
    const matches = typeof mapping.pattern === 'string'
      ? message.includes(mapping.pattern)
      : mapping.pattern.test(message)

    if (matches) {
      return new TronError(mapping.code, mapping.message, mapping.recoverable, mapping.action)
    }
  }

  return new TronError(
    'UNKNOWN_ERROR',
    `TRON transaction failed: ${message}`,
    false,
    'Please try again or contact support'
  )
}

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
    logger.warn("Failed to detect TRON network, defaulting to mainnet", {
      network: "tron",
      component: "tron-payment",
      action: "network_detection",
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
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
    logger.error("Failed to get TRC20 balance", error instanceof Error ? error : new Error(String(error)), {
      network: "tron",
      component: "tron-payment",
      action: "get_balance",
      metadata: { tokenAddress, walletAddress }
    })
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

    logger.info("Initiating TRC20 transfer", {
      network: "tron",
      component: "tron-payment",
      action: "send_trc20",
      metadata: {
        tokenAddress,
        toAddress,
        amount,
        amountInSmallestUnit,
        decimals
      }
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

    logger.logBlockchainInteraction("tron", "TRC20_transfer", tx, "success", {
      component: "tron-payment",
      metadata: { amount, toAddress, tokenAddress }
    })

    return tx
  } catch (error: any) {
    const tronError = parseTronError(error)

    logger.error("TRC20 transfer failed", tronError, {
      network: "tron",
      component: "tron-payment",
      action: "send_trc20",
      metadata: {
        amount, toAddress, tokenAddress,
        errorCode: tronError.code,
        recoverable: tronError.recoverable,
        action: tronError.action
      }
    })

    throw tronError
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

    logger.info("Initiating TRX transfer", {
      network: "tron",
      component: "tron-payment",
      action: "send_trx",
      metadata: { toAddress, amount, amountInSun }
    })

    const tx = await tronWeb.trx.sendTransaction(toAddress, amountInSun)

    const txHash = tx.txid || tx.transaction?.txID || tx
    logger.logBlockchainInteraction("tron", "TRX_transfer", txHash, "success", {
      component: "tron-payment",
      metadata: { amount, toAddress }
    })

    return txHash
  } catch (error: any) {
    const tronError = parseTronError(error)

    logger.error("TRX transfer failed", tronError, {
      network: "tron",
      component: "tron-payment",
      action: "send_trx",
      metadata: {
        amount, toAddress,
        errorCode: tronError.code,
        recoverable: tronError.recoverable
      }
    })

    throw tronError
  }
}

/**
 * Process single TRON payment
 */
export async function processTronPayment(recipient: Recipient, wallet: string): Promise<PaymentResult> {
  logger.info("Processing TRON payment", {
    network: "tron",
    component: "tron-payment",
    action: "process_payment",
    metadata: { recipientAddress: recipient.address, amount: recipient.amount, wallet }
  })

  try {
    // Validate recipient address
    if (!isValidTronAddress(recipient.address)) {
      throw new Error(`Invalid TRON address: ${recipient.address}`)
    }

    // Get current network
    const network = await getTronNetwork()
    logger.debug("Detected TRON network", {
      network,
      component: "tron-payment",
      action: "network_detection"
    })

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

    logger.logPayment("completed", txHash, String(recipient.amount), {
      network: "tron",
      component: "tron-payment",
      metadata: { recipientAddress: recipient.address, token: tokenSymbol }
    })

    return {
      success: true,
      txHash,
      recipient: recipient.address,
      amount: recipient.amount,
      token: tokenSymbol,
    }
  } catch (error) {
    logger.error("TRON payment failed", error instanceof Error ? error : new Error(String(error)), {
      network: "tron",
      component: "tron-payment",
      action: "process_payment",
      metadata: { recipientAddress: recipient.address, amount: recipient.amount }
    })

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
  logger.info("Processing TRON batch payments", {
    network: "tron",
    component: "tron-payment",
    action: "batch_payment",
    metadata: { recipientCount: recipients.length, wallet }
  })

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
    logger.error("Failed to get account resources", error instanceof Error ? error : new Error(String(error)), {
      network: "tron",
      component: "tron-payment",
      action: "get_resources",
      metadata: { accountAddress }
    })
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
    logger.error("Failed to get transaction details", error instanceof Error ? error : new Error(String(error)), {
      network: "tron",
      component: "tron-payment",
      action: "get_transaction",
      txHash
    })
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
        const isSuccess = tx.receipt?.result === "SUCCESS"
        logger.info(`Transaction confirmed after ${i + 1} attempts`, {
          network: "tron",
          component: "tron-payment",
          action: "wait_confirmation",
          txHash,
          metadata: { attempts: i + 1, success: isSuccess }
        })
        return isSuccess
      }
    } catch (error) {
      logger.debug(`Waiting for confirmation (attempt ${i + 1}/${maxAttempts})`, {
        network: "tron",
        component: "tron-payment",
        action: "wait_confirmation",
        txHash,
        metadata: { attempt: i + 1, maxAttempts }
      })
    }

    // Wait before next attempt
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  logger.error("Transaction confirmation timeout", new Error(`Timeout after ${maxAttempts} attempts`), {
    network: "tron",
    component: "tron-payment",
    action: "wait_confirmation",
    txHash,
    metadata: { maxAttempts }
  })

  throw new Error(`Transaction confirmation timeout after ${maxAttempts} attempts`)
}

/**
 * Get confirmation info for a transaction
 * Returns the number of confirmations and the block number
 */
export async function getConfirmationInfo(
  txHash: string
): Promise<{ confirmations: number; blockNumber: number }> {
  const tronWeb = getTronWeb()

  try {
    const txInfo = await tronWeb.trx.getTransactionInfo(txHash)

    if (!txInfo || !txInfo.blockNumber) {
      return { confirmations: 0, blockNumber: 0 }
    }

    const currentBlock = await tronWeb.trx.getCurrentBlock()
    const currentBlockNumber = currentBlock?.block_header?.raw_data?.number ?? 0
    const confirmations = Math.max(0, currentBlockNumber - txInfo.blockNumber)

    return {
      confirmations,
      blockNumber: txInfo.blockNumber
    }
  } catch (error) {
    logger.error("Failed to get confirmation info", error instanceof Error ? error : new Error(String(error)), {
      network: "tron",
      component: "tron-payment",
      action: "get_confirmation_info",
      txHash
    })
    return { confirmations: 0, blockNumber: 0 }
  }
}
