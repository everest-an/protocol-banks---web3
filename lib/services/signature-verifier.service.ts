/**
 * Signature Verifier Service
 * Verifies EIP-712 signatures for authorizations
 */

import { recoverSigner, verifySignature, type DomainInput, type AuthorizationMessage } from './eip712.service'
import { isWithinValidityWindow } from './validity-window.service'
import { isNonceUsed } from './nonce-manager.service'

export interface VerificationResult {
  valid: boolean
  error?: string
  recoveredSigner?: string
}

/**
 * Verify authorization signature
 */
export function verifyAuthorizationSignature(
  domain: DomainInput,
  message: AuthorizationMessage,
  signature: string,
  expectedSigner: string
): VerificationResult {
  try {
    // Verify signature
    const isValid = verifySignature(domain, message, signature, expectedSigner)
    
    if (!isValid) {
      const recoveredSigner = recoverSigner(domain, message, signature)
      return {
        valid: false,
        error: `Signature mismatch: expected ${expectedSigner}, got ${recoveredSigner}`,
        recoveredSigner,
      }
    }
    
    return { valid: true, recoveredSigner: expectedSigner }
  } catch (err) {
    return { valid: false, error: `Signature verification failed: ${err}` }
  }
}

/**
 * Full authorization validation
 */
export async function validateAuthorization(
  domain: DomainInput,
  message: AuthorizationMessage,
  signature: string
): Promise<VerificationResult> {
  // Check validity window
  if (!isWithinValidityWindow(message.validAfter, message.validBefore)) {
    const now = Math.floor(Date.now() / 1000)
    if (now < message.validAfter) {
      return { valid: false, error: 'Authorization not yet valid' }
    }
    return { valid: false, error: 'Authorization has expired' }
  }
  
  // Check nonce
  if (await isNonceUsed(message.from, message.nonce)) {
    return { valid: false, error: 'Nonce has already been used' }
  }
  
  // Verify signature matches sender
  return verifyAuthorizationSignature(domain, message, signature, message.from)
}

/**
 * Batch verify signatures
 */
export async function verifyBatchSignatures(
  authorizations: Array<{
    domain: DomainInput
    message: AuthorizationMessage
    signature: string
  }>
): Promise<{
  allValid: boolean
  results: VerificationResult[]
  validCount: number
  invalidCount: number
}> {
  const results = await Promise.all(
    authorizations.map(auth =>
      validateAuthorization(auth.domain, auth.message, auth.signature)
    )
  )
  
  const validCount = results.filter(r => r.valid).length
  const invalidCount = results.length - validCount
  
  return {
    allValid: invalidCount === 0,
    results,
    validCount,
    invalidCount,
  }
}

/**
 * Check if signature is in compact format
 */
export function isCompactSignature(signature: string): boolean {
  // Remove 0x prefix if present
  const sig = signature.startsWith('0x') ? signature.slice(2) : signature
  // Compact signatures are 64 bytes (128 hex chars)
  // Standard signatures are 65 bytes (130 hex chars)
  return sig.length === 128
}

/**
 * Normalize signature to standard format
 */
export function normalizeSignature(signature: string): string {
  if (!signature.startsWith('0x')) {
    signature = '0x' + signature
  }
  return signature.toLowerCase()
}
