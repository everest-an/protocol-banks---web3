/**
 * EIP-712 Typed Data Service
 * For TransferWithAuthorization signatures
 */

import { ethers } from 'ethers'

export interface DomainInput {
  name: string
  version: string
  chainId: number
  verifyingContract: string
}

export interface AuthorizationMessage {
  from: string
  to: string
  value: string | bigint
  validAfter: number
  validBefore: number
  nonce: string
}

/**
 * EIP-712 Domain Type
 */
export const DOMAIN_TYPE = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
]

/**
 * TransferWithAuthorization Types for EIP-3009
 */
export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
}

/**
 * Build EIP-712 domain separator
 */
export function buildDomain(input: DomainInput): {
  name: string
  version: string
  chainId: number
  verifyingContract: string
} {
  return {
    name: input.name,
    version: input.version,
    chainId: input.chainId,
    verifyingContract: input.verifyingContract,
  }
}

/**
 * Build typed data for TransferWithAuthorization
 */
export function buildTypedData(
  domain: DomainInput,
  message: AuthorizationMessage
) {
  return {
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: 'TransferWithAuthorization' as const,
    domain: buildDomain(domain),
    message: {
      from: message.from,
      to: message.to,
      value: message.value.toString(),
      validAfter: message.validAfter,
      validBefore: message.validBefore,
      nonce: message.nonce,
    },
  }
}

/**
 * Hash typed data according to EIP-712
 */
export function hashTypedData(
  domain: DomainInput,
  message: AuthorizationMessage
): string {
  const typedData = buildTypedData(domain, message)
  return ethers.TypedDataEncoder.hash(
    typedData.domain,
    typedData.types,
    typedData.message
  )
}

/**
 * Recover signer address from signature
 */
export function recoverSigner(
  domain: DomainInput,
  message: AuthorizationMessage,
  signature: string
): string {
  const typedData = buildTypedData(domain, message)
  return ethers.verifyTypedData(
    typedData.domain,
    typedData.types,
    typedData.message,
    signature
  )
}

/**
 * Verify signature matches expected signer
 */
export function verifySignature(
  domain: DomainInput,
  message: AuthorizationMessage,
  signature: string,
  expectedSigner: string
): boolean {
  try {
    const recoveredSigner = recoverSigner(domain, message, signature)
    return recoveredSigner.toLowerCase() === expectedSigner.toLowerCase()
  } catch {
    return false
  }
}

/**
 * Split signature into v, r, s components
 */
export function splitSignature(signature: string): {
  v: number
  r: string
  s: string
} {
  const sig = ethers.Signature.from(signature)
  return {
    v: sig.v,
    r: sig.r,
    s: sig.s,
  }
}
