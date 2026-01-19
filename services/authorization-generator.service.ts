import { ethers } from "ethers"
import { createClient } from "@/lib/supabase/server"
import { incrementNonce } from "@/services/nonce-manager.service"
import { buildDomain, TRANSFER_WITH_AUTHORIZATION_TYPES, AuthorizationMessage } from "@/services/eip712.service"

const DEFAULT_VALIDITY_SECONDS = 3600
const PROTOCOL_NAME = "ProtocolBanks"
const PROTOCOL_VERSION = "1"

export type GenerateAuthorizationInput = {
  userId: string
  tokenAddress: string
  chainId: number
  from: string
  to: string
  amount: string
  validityDuration?: number
}

export async function generateAuthorization(input: GenerateAuthorizationInput) {
  const supabase = await createClient()

  const nowSec = Math.floor(Date.now() / 1000)
  const validAfter = nowSec
  const validBefore = nowSec + (input.validityDuration || DEFAULT_VALIDITY_SECONDS)

  const nonce = await incrementNonce(input.userId, input.tokenAddress, input.chainId)
  const nonceBytes32 = ethers.zeroPadValue(ethers.toBeHex(nonce), 32)

  const domain = buildDomain({
    name: PROTOCOL_NAME,
    version: PROTOCOL_VERSION,
    chainId: input.chainId,
    verifyingContract: input.tokenAddress,
  })

  const message: AuthorizationMessage = {
    from: ethers.getAddress(input.from),
    to: ethers.getAddress(input.to),
    value: input.amount,
    validAfter,
    validBefore,
    nonce: nonceBytes32,
    data: "0x",
  }

  const { data: record, error } = await supabase
    .from("x402_authorizations")
    .insert({
      user_id: input.userId,
      token_address: input.tokenAddress,
      chain_id: input.chainId,
      from_address: message.from,
      to_address: message.to,
      amount: input.amount,
      nonce,
      valid_after: new Date(validAfter * 1000).toISOString(),
      valid_before: new Date(validBefore * 1000).toISOString(),
      status: "pending",
    })
    .select("id")
    .single()

  if (error) {
    throw error
  }

  return {
    authorizationId: record.id,
    domain,
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    message,
    validBefore: new Date(validBefore * 1000).toISOString(),
  }
}
