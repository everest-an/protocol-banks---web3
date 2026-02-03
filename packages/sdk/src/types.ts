/**
 * SDK Type Definitions
 */

export type TokenSymbol = "USDC" | "USDT" | "DAI"

export type ChainId = 1 | 8453 | 42161 | 137 | 10 | 56

export type PaymentStatus = "pending" | "paid" | "expired" | "cancelled" | "failed"

export interface ProtocolBanksConfig {
  /** API key for authentication (pk_* format) */
  apiKey: string
  /** API secret (sk_* format, server-side only) */
  apiSecret?: string
  /** Base URL for the Protocol Banks API */
  baseUrl?: string
  /** Default chain ID */
  defaultChainId?: ChainId
  /** Default token */
  defaultToken?: TokenSymbol
}

export interface PaymentLinkConfig {
  /** Payment title */
  title: string
  /** Payment description */
  description?: string
  /** Fixed amount (if not set, customer enters amount) */
  amount?: string
  /** Payment token */
  token?: TokenSymbol
  /** Recipient wallet address */
  recipientAddress: string
  /** Redirect URL after payment */
  redirectUrl?: string
  /** Expiration in seconds */
  expiresIn?: number
  /** Custom branding */
  branding?: {
    color?: string
    logoUrl?: string
  }
  /** Post-payment asset distribution */
  assetDistribution?: {
    type: "nft" | "token"
    contractAddress: string
    tokenId?: string
    amount?: string
  }
  /** Custom metadata */
  metadata?: Record<string, any>
}

export interface InvoiceConfig {
  /** Recipient wallet address */
  recipientAddress: string
  /** Crypto amount */
  amount: string
  /** Payment token */
  token?: TokenSymbol
  /** Invoice description */
  description: string
  /** Merchant/business name */
  merchantName: string
  /** Fiat amount for dual-currency display */
  amountFiat?: string
  /** Fiat currency code */
  fiatCurrency?: string
  /** Customer info */
  customer?: {
    name?: string
    email?: string
  }
  /** Expiration in hours */
  expiresInHours?: number
  /** Custom metadata */
  metadata?: Record<string, any>
}

export interface CheckoutConfig {
  /** Order amount */
  amount: string
  /** Currency (USD, EUR, etc.) */
  currency?: string
  /** Payment token */
  token?: TokenSymbol
  /** Merchant ID */
  merchantId: string
  /** Notification URL for payment callbacks */
  notifyUrl?: string
  /** Return URL after payment */
  returnUrl?: string
  /** Custom metadata */
  metadata?: Record<string, any>
}

export interface PaymentResult {
  success: boolean
  /** Payment/order ID */
  id: string
  /** Payment link URL */
  paymentUrl: string
  /** Short URL */
  shortUrl?: string
  /** QR code data */
  qrCodeData?: string
  /** Payment status */
  status: PaymentStatus
  /** Transaction hash (after payment) */
  txHash?: string
  /** Error message */
  error?: string
}

export interface EmbedConfig {
  /** Container element or selector */
  container: HTMLElement | string
  /** Recipient address */
  to: string
  /** Payment amount */
  amount?: string
  /** Payment token */
  token?: TokenSymbol
  /** Merchant name */
  merchantName?: string
  /** Theme */
  theme?: "light" | "dark"
  /** Callback on payment success */
  onSuccess?: (result: PaymentResult) => void
  /** Callback on payment error */
  onError?: (error: Error) => void
  /** Callback when payment is cancelled */
  onCancel?: () => void
}
