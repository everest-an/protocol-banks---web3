/**
 * x402 Protocol Client
 * Handles HTTP 402 Payment Required responses and automatic payment flow
 * 
 * Supports:
 * - CDP Facilitator (free settlement on Base chain USDC)
 * - Self-built Relayer (fallback for other chains)
 */

import { signERC3009Authorization, executeERC3009Transfer, getTokenAddress, CHAIN_IDS } from "./web3"

// Settlement method types
export type SettlementMethod = 'cdp' | 'relayer' | 'auto';

// x402 Payment Request Header format
export interface X402PaymentRequest {
  version: "1.0"
  network: string
  paymentAddress: string
  amount: string
  token: string
  chainId: number
  memo?: string
  expiresAt?: number
}

// x402 Payment Proof Header format
export interface X402PaymentProof {
  txHash?: string
  signature?: {
    v: number
    r: string
    s: string
    nonce: string
    validAfter: number
    validBefore: number
  }
  from: string
  timestamp: number
  method?: SettlementMethod
}

// CDP Settlement Response
export interface CDPSettleResponse {
  success: boolean
  transactionHash?: string
  network?: string
  method: SettlementMethod
  fee?: string
  error?: string
}

/**
 * Parse X-Payment-Request header from 402 response
 */
export function parsePaymentRequest(header: string): X402PaymentRequest | null {
  try {
    // Header format: base64 encoded JSON
    const decoded = atob(header)
    return JSON.parse(decoded) as X402PaymentRequest
  } catch {
    // Try direct JSON parse
    try {
      return JSON.parse(header) as X402PaymentRequest
    } catch {
      console.error("[x402] Failed to parse payment request header")
      return null
    }
  }
}

/**
 * Create X-Payment header for authenticated request
 */
export function createPaymentProof(proof: X402PaymentProof): string {
  const jsonString = JSON.stringify(proof)

  // Convert string to UTF-8 bytes first, then to base64
  // This avoids the Latin1 character limitation of btoa()
  const utf8Bytes = new TextEncoder().encode(jsonString)
  let binary = ""
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i])
  }
  return btoa(binary)
}

/**
 * Check if response is a 402 Payment Required
 */
export function is402Response(response: Response): boolean {
  return response.status === 402
}

/**
 * Extract payment request from 402 response
 */
export async function extractPaymentRequest(response: Response): Promise<X402PaymentRequest | null> {
  // Try header first
  const headerValue = response.headers.get("X-Payment-Request")
  if (headerValue) {
    return parsePaymentRequest(headerValue)
  }

  // Try response body
  try {
    const body = await response.json()
    if (body.paymentRequest) {
      return body.paymentRequest as X402PaymentRequest
    }
  } catch {
    // Body parsing failed
  }

  return null
}

/**
 * x402 Payment Flow Handler
 * Intercepts 402 responses and handles payment automatically
 */
export class X402Client {
  private walletAddress: string
  private chainId: number
  private autoSign: boolean
  private maxAutoAmount: number // Maximum amount for auto-signing (in USD)
  private preferCDP: boolean // Prefer CDP Facilitator when available

  constructor(options: {
    walletAddress: string
    chainId?: number
    autoSign?: boolean
    maxAutoAmount?: number
    preferCDP?: boolean
  }) {
    this.walletAddress = options.walletAddress
    this.chainId = options.chainId || CHAIN_IDS.BASE
    this.autoSign = options.autoSign ?? false
    this.maxAutoAmount = options.maxAutoAmount ?? 1 // Default $1 max for auto
    this.preferCDP = options.preferCDP ?? true // Default to CDP (free on Base)
  }

  /**
   * Check if CDP Facilitator is supported for this chain/token
   */
  isCDPSupported(chainId?: number, token?: string): boolean {
    const chain = chainId || this.chainId
    const tokenSymbol = token?.toUpperCase() || 'USDC'
    // CDP supports Base chain (8453) with USDC
    return chain === 8453 && tokenSymbol === 'USDC'
  }

  /**
   * Get settlement fee estimate
   */
  getSettlementFee(amount: string, chainId?: number): { fee: string; method: SettlementMethod } {
    if (this.isCDPSupported(chainId)) {
      return { fee: '0', method: 'cdp' }
    }
    // Relayer fee: 0.5% with $5 cap
    const amountNum = parseFloat(amount)
    const fee = Math.min(amountNum * 0.005, 5)
    return { fee: fee.toFixed(2), method: 'relayer' }
  }

  /**
   * Make an authenticated x402 request
   * Automatically handles 402 responses with payment
   */
  async fetch(
    url: string,
    options: RequestInit = {},
    onPaymentRequired?: (request: X402PaymentRequest) => Promise<boolean>,
  ): Promise<Response> {
    // Initial request
    const response = await fetch(url, options)

    // Check for 402
    if (!is402Response(response)) {
      return response
    }

    // Extract payment request
    const paymentRequest = await extractPaymentRequest(response)
    if (!paymentRequest) {
      throw new Error("Invalid 402 response: missing payment request")
    }

    // Check if we should proceed with payment
    const shouldPay = onPaymentRequired ? await onPaymentRequired(paymentRequest) : this.shouldAutoSign(paymentRequest)

    if (!shouldPay) {
      throw new Error("Payment declined by user")
    }

    // Process payment
    const proof = await this.processPayment(paymentRequest)

    // Retry request with payment proof
    const authenticatedOptions = {
      ...options,
      headers: {
        ...options.headers,
        "X-Payment": createPaymentProof(proof),
      },
    }

    return fetch(url, authenticatedOptions)
  }

  /**
   * Check if payment should be auto-signed
   */
  private shouldAutoSign(request: X402PaymentRequest): boolean {
    if (!this.autoSign) return false

    const amount = Number.parseFloat(request.amount)
    return amount <= this.maxAutoAmount
  }

  /**
   * Process x402 payment using EIP-3009 signature
   * Uses CDP Facilitator for Base chain USDC (free), falls back to relayer
   */
  async processPayment(request: X402PaymentRequest): Promise<X402PaymentProof> {
    const tokenAddress = getTokenAddress(request.chainId || this.chainId, request.token)
    if (!tokenAddress) {
      throw new Error(`Token ${request.token} not supported on chain ${request.chainId}`)
    }

    // Sign EIP-3009 authorization
    const auth = await signERC3009Authorization(
      tokenAddress,
      this.walletAddress,
      request.paymentAddress,
      request.amount,
      request.chainId || this.chainId,
    )

    // Determine settlement method
    const useCDP = this.preferCDP && this.isCDPSupported(request.chainId, request.token)
    
    if (useCDP) {
      // Submit to CDP Facilitator via our settle endpoint
      try {
        const response = await fetch('/api/x402/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signature: auth,
            from: this.walletAddress,
            to: request.paymentAddress,
            value: request.amount,
            chainId: request.chainId || this.chainId,
            token: request.token,
          }),
        })
        
        const result: CDPSettleResponse = await response.json()
        
        if (result.success && result.transactionHash) {
          return {
            txHash: result.transactionHash,
            signature: auth,
            from: this.walletAddress,
            timestamp: Date.now(),
            method: 'cdp',
          }
        }
        
        // CDP failed, fall through to return signature for server-side processing
        console.warn('[x402] CDP settlement failed, returning signature for fallback')
      } catch (error) {
        console.warn('[x402] CDP request failed:', error)
      }
    }

    // For x402, we typically just send the signature
    // The server/facilitator will execute the transfer
    return {
      signature: auth,
      from: this.walletAddress,
      timestamp: Date.now(),
      method: useCDP ? 'cdp' : 'relayer',
    }
  }

  /**
   * Execute payment on-chain (for self-relay scenarios)
   */
  async executePayment(request: X402PaymentRequest): Promise<X402PaymentProof> {
    const tokenAddress = getTokenAddress(request.chainId || this.chainId, request.token)
    if (!tokenAddress) {
      throw new Error(`Token ${request.token} not supported on chain ${request.chainId}`)
    }

    // Sign authorization
    const auth = await signERC3009Authorization(
      tokenAddress,
      this.walletAddress,
      request.paymentAddress,
      request.amount,
      request.chainId || this.chainId,
    )

    // Execute on-chain
    const txHash = await executeERC3009Transfer(
      tokenAddress,
      this.walletAddress,
      request.paymentAddress,
      request.amount,
      auth,
    )

    return {
      txHash,
      signature: auth,
      from: this.walletAddress,
      timestamp: Date.now(),
    }
  }

  /**
   * Update wallet address
   */
  setWallet(address: string) {
    this.walletAddress = address
  }

  /**
   * Update chain ID
   */
  setChainId(chainId: number) {
    this.chainId = chainId
  }

  /**
   * Enable/disable auto-signing
   */
  setAutoSign(enabled: boolean, maxAmount?: number) {
    this.autoSign = enabled
    if (maxAmount !== undefined) {
      this.maxAutoAmount = maxAmount
    }
  }

  /**
   * Enable/disable CDP preference
   */
  setPreferCDP(enabled: boolean) {
    this.preferCDP = enabled
  }
}

/**
 * Create a global x402 fetch wrapper
 */
export function createX402Fetch(client: X402Client) {
  return (url: string, options?: RequestInit) => client.fetch(url, options)
}
