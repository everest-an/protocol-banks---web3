import { ethers } from "ethers"

export type DomainInput = {
  name: string
  version: string
  chainId: number
  verifyingContract: string
}

export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
    { name: "data", type: "bytes" },
  ],
} as const

export type AuthorizationMessage = {
  from: string
  to: string
  value: string
  validAfter: number
  validBefore: number
  nonce: string
  data: string
}

export function buildDomain(input: DomainInput) {
  return {
    name: input.name,
    version: input.version,
    chainId: input.chainId,
    verifyingContract: input.verifyingContract,
  }
}

export function hashAuthorization(domain: DomainInput, message: AuthorizationMessage): string {
  return ethers.TypedDataEncoder.hash(
    buildDomain(domain),
    TRANSFER_WITH_AUTHORIZATION_TYPES,
    message,
  )
}

export function recoverSigner(domain: DomainInput, message: AuthorizationMessage, signature: string): string {
  return ethers.recoverAddress(
    ethers.TypedDataEncoder.hash(buildDomain(domain), TRANSFER_WITH_AUTHORIZATION_TYPES, message),
    signature,
  )
}
