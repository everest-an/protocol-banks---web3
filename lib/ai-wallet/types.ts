/**
 * AI Wallet SDK — TypeScript Types
 *
 * All interfaces used by the AIWalletSDK and its sub-clients.
 */

// ─── SDK Configuration ─────────────────────────────────────────────

export interface AIWalletConfig {
  /** AI agent's wallet address (public, e.g. "0x...") */
  walletAddress: string

  /**
   * Callback for signing messages. The AI agent provides this function —
   * it signs the message using the agent's private key without exposing it.
   *
   * @param message - The plaintext message to sign (SIWE message)
   * @returns The hex signature string (0x-prefixed)
   */
  signMessage: (message: string) => Promise<string>

  /** Platform base URL. Default: "https://app.protocolbanks.com" */
  baseUrl?: string

  /** Chain ID for SIWE message. Default: 1 (Ethereum mainnet) */
  chainId?: number

  /** Called when the access token is refreshed (for logging/storage) */
  onTokenRefresh?: (token: string) => void
}

// ─── Authentication ─────────────────────────────────────────────────

export interface SiweSession {
  /** JWT access token (1h lifetime) */
  token: string
  /** Refresh token (30d lifetime) */
  refreshToken: string
  /** ISO timestamp when the access token expires */
  expiresAt: string
  /** Wallet address (lowercase) */
  address: string
}

export interface NonceResponse {
  nonce: string
  expiresAt: string
}

// ─── Payments ───────────────────────────────────────────────────────

export interface PaymentRequest {
  /** Recipient wallet address */
  to: string
  /** Amount as a decimal string (e.g. "100.50") */
  amount: string
  /** Token symbol */
  token: "USDC" | "USDT" | "DAI" | "ETH"
  /** Network name (e.g. "ethereum", "base", "polygon") */
  chain?: string
  /** Optional memo / description */
  memo?: string
}

export interface Payment {
  id: string
  from_address: string
  to_address: string
  amount: string
  token: string
  chain: string
  network_type: "EVM" | "TRON"
  status: "pending" | "completed" | "failed"
  tx_hash?: string
  memo?: string
  created_at: string
}

export interface PaymentFilters {
  status?: "pending" | "completed" | "failed"
  network?: string
  network_type?: "EVM" | "TRON"
  limit?: number
  offset?: number
}

// ─── Session Keys ───────────────────────────────────────────────────

export interface SessionKeyConfig {
  /** Chain ID for this session key */
  chainId: number
  /** Maximum total spending allowed (in smallest unit) */
  spendingLimit: string
  /** Tokens this key is allowed to spend */
  allowedTokens: string[]
  /** ISO timestamp when this key expires */
  expiresAt: string
}

export interface SessionKey {
  id: string
  owner_address: string
  session_key_address: string
  chain_id: number
  spending_limit: string
  spent_amount: string
  allowed_tokens: string[]
  expires_at: string
  is_active: boolean
  created_at: string
  last_used_at?: string
}

// ─── Invoices ───────────────────────────────────────────────────────

export interface CreateInvoiceParams {
  /** Amount in token units */
  amount: number
  /** Token to receive */
  token?: string
  /** Your wallet address to receive the payment */
  recipient_address: string
  /** Description shown to payer */
  description?: string
  /** Customer email for notifications */
  customer_email?: string
  /** ISO timestamp for invoice expiry */
  expires_at?: string
}

export interface Invoice {
  id: string
  invoice_id: string
  amount: number
  token: string
  status: "pending" | "paid" | "expired" | "cancelled"
  recipient_address: string
  payment_url?: string
  expires_at?: string
  created_at: string
}

// ─── x402 Protocol ──────────────────────────────────────────────────

export interface x402AuthorizationParams {
  from: string
  to: string
  amount: string
  token: string
  chainId: number
  validAfter?: number
  validBefore?: number
}

export interface x402Authorization {
  signature: string
  nonce: string
  validAfter: number
  validBefore: number
  transferId: string
}

export interface x402VerifyResult {
  success: boolean
  verified: boolean
  status: "completed" | "expired" | "pending"
  message: string
}

// ─── Vendors ────────────────────────────────────────────────────────

export interface CreateVendorParams {
  name: string
  wallet_address: string
  category?: string
  tags?: string[]
}

export interface Vendor {
  id: string
  name: string
  wallet_address: string
  owner_address: string
  category?: string
  tags?: string[]
}

// ─── SDK Errors ─────────────────────────────────────────────────────

export class AIWalletError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown
  ) {
    super(message)
    this.name = "AIWalletError"
  }
}
