/**
 * AI Wallet SDK — Entry Point
 *
 * Usage:
 * ```typescript
 * import { AIWalletSDK } from '@/lib/ai-wallet'
 *
 * const wallet = new AIWalletSDK({
 *   walletAddress: '0x...',
 *   signMessage: (msg) => account.signMessage({ message: msg }),
 * })
 *
 * const session = await wallet.connectAndSignIn()
 * const payment = await wallet.payments.create({ ... })
 * ```
 */

// Main SDK class
export { AIWalletSDK } from './sdk'

// Client-side SIWE helper
export { createSiweMessage } from './siwe'
export type { SiweMessageParams } from './siwe'

// Sub-client classes (for advanced usage / testing)
export { PaymentClient, SessionKeyClient, InvoiceClient, VendorClient } from './payments'

// All TypeScript types
export type {
  AIWalletConfig,
  SiweSession,
  NonceResponse,
  PaymentRequest,
  Payment,
  PaymentFilters,
  SessionKeyConfig,
  SessionKey,
  CreateInvoiceParams,
  Invoice,
  x402AuthorizationParams,
  x402Authorization,
  x402VerifyResult,
  CreateVendorParams,
  Vendor,
} from './types'

// Error class
export { AIWalletError } from './types'
