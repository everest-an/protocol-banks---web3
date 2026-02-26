/**
 * AI Wallet SDK — Client-Side SIWE Message Builder
 *
 * Constructs EIP-4361 compliant Sign-In with Ethereum messages.
 * This runs on the AI agent side (client), NOT on the server.
 */

export interface SiweMessageParams {
  /** Wallet address (checksummed or lowercase) */
  address: string
  /** Random nonce from the server */
  nonce: string
  /** Domain of the service (e.g. "app.protocolbanks.com") */
  domain?: string
  /** Full URI of the service */
  uri?: string
  /** Chain ID (default: 1 for Ethereum mainnet) */
  chainId?: number
  /** Human-readable statement */
  statement?: string
  /** ISO timestamp — issued at */
  issuedAt?: string
  /** ISO timestamp — expiration */
  expirationTime?: string
}

/**
 * Construct an EIP-4361 compliant SIWE message string.
 *
 * @see https://eips.ethereum.org/EIPS/eip-4361
 *
 * Format:
 * ```
 * ${domain} wants you to sign in with your Ethereum account:
 * ${address}
 *
 * ${statement}
 *
 * URI: ${uri}
 * Version: 1
 * Chain ID: ${chainId}
 * Nonce: ${nonce}
 * Issued At: ${issuedAt}
 * Expiration Time: ${expirationTime}
 * ```
 */
export function createSiweMessage(params: SiweMessageParams): string {
  const {
    address,
    nonce,
    domain = 'app.protocolbanks.com',
    uri = `https://${domain}`,
    chainId = 1,
    statement = 'Sign in to Protocol Banks AI Wallet',
    issuedAt = new Date().toISOString(),
    expirationTime,
  } = params

  const lines: string[] = [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    statement,
    '',
    `URI: ${uri}`,
    `Version: 1`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ]

  if (expirationTime) {
    lines.push(`Expiration Time: ${expirationTime}`)
  }

  return lines.join('\n')
}
