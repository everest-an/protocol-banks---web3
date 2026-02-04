/**
 * Authorization Generator Service
 * Generates EIP-3009 TransferWithAuthorization data
 */

import { ethers } from 'ethers'
import { generateNonce } from './nonce-manager.service'
import { buildTypedData, type DomainInput, type AuthorizationMessage } from './eip712.service'
import { createValidityWindow } from './validity-window.service'

export interface AuthorizationParams {
  from: string
  to: string
  value: string | bigint
  tokenAddress: string
  tokenName: string
  chainId: number
  validityDurationSeconds?: number
}

export interface GeneratedAuthorization {
  domain: DomainInput
  message: AuthorizationMessage
  typedData: ReturnType<typeof buildTypedData>
  nonce: string
  validAfter: number
  validBefore: number
}

/**
 * Generate authorization data for signing
 */
export function generateAuthorization(params: AuthorizationParams): GeneratedAuthorization {
  const nonce = generateNonce()
  const { validAfter, validBefore } = createValidityWindow(params.validityDurationSeconds)
  
  const domain: DomainInput = {
    name: params.tokenName,
    version: '1',
    chainId: params.chainId,
    verifyingContract: params.tokenAddress,
  }
  
  const message: AuthorizationMessage = {
    from: params.from,
    to: params.to,
    value: params.value,
    validAfter,
    validBefore,
    nonce,
  }
  
  const typedData = buildTypedData(domain, message)
  
  return {
    domain,
    message,
    typedData,
    nonce,
    validAfter,
    validBefore,
  }
}

/**
 * Generate batch authorizations
 */
export function generateBatchAuthorizations(
  items: Array<{
    to: string
    value: string | bigint
  }>,
  commonParams: {
    from: string
    tokenAddress: string
    tokenName: string
    chainId: number
    validityDurationSeconds?: number
  }
): GeneratedAuthorization[] {
  return items.map(item =>
    generateAuthorization({
      ...commonParams,
      to: item.to,
      value: item.value,
    })
  )
}

/**
 * Encode authorization call data for contract
 */
export function encodeTransferWithAuthorization(
  authorization: GeneratedAuthorization,
  signature: string
): string {
  const { v, r, s } = ethers.Signature.from(signature)
  
  const iface = new ethers.Interface([
    'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
  ])
  
  return iface.encodeFunctionData('transferWithAuthorization', [
    authorization.message.from,
    authorization.message.to,
    authorization.message.value,
    authorization.message.validAfter,
    authorization.message.validBefore,
    authorization.message.nonce,
    v,
    r,
    s,
  ])
}

/**
 * Create permit message for approval
 */
export function createPermitMessage(params: {
  owner: string
  spender: string
  value: string | bigint
  nonce: number
  deadline: number
}): {
  domain: DomainInput
  types: Record<string, Array<{ name: string; type: string }>>
  message: Record<string, unknown>
} {
  return {
    domain: {
      name: '',
      version: '1',
      chainId: 0,
      verifyingContract: '',
    },
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    message: {
      owner: params.owner,
      spender: params.spender,
      value: params.value.toString(),
      nonce: params.nonce,
      deadline: params.deadline,
    },
  }
}
