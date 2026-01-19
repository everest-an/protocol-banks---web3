import { createClient } from "@/lib/supabase/server"
import { recoverSigner, AuthorizationMessage, DomainInput } from "@/services/eip712.service"
import { isNonceUsed, markNonceUsed } from "@/services/nonce-manager.service"
import { isWithinValidityWindow } from "@/services/validity-window.service"

export async function verifyAuthorizationSignature(options: {
  authorizationId: string
  domain: DomainInput
  message: AuthorizationMessage
  signature: string
}) {
  const supabase = await createClient()

  // Load authorization
  const { data: auth, error } = await supabase
    .from("x402_authorizations")
    .select("user_id, nonce, token_address, chain_id, from_address, status, valid_after, valid_before")
    .eq("id", options.authorizationId)
    .single()

  if (error || !auth) {
    return { valid: false, error: "Authorization not found" }
  }

  if (auth.status !== "pending") {
    return { valid: false, error: "Authorization not pending" }
  }

  // Validity window check
  const validAfter = new Date(auth.valid_after)
  const validBefore = new Date(auth.valid_before)
  if (!isWithinValidityWindow(validAfter, validBefore)) {
    await supabase
      .from("x402_authorizations")
      .update({ status: "expired" })
      .eq("id", options.authorizationId)
    return { valid: false, error: "Authorization expired" }
  }

  // Nonce reuse check
  const used = await isNonceUsed(auth.user_id, auth.token_address, auth.chain_id, auth.nonce)
  if (used) {
    return { valid: false, error: "Nonce already used" }
  }

  // Recover signer
  const recovered = recoverSigner(options.domain, options.message, options.signature)
  if (recovered.toLowerCase() !== auth.from_address.toLowerCase()) {
    return { valid: false, error: "Invalid signature" }
  }

  // Persist signature & mark used nonce
  await supabase
    .from("x402_authorizations")
    .update({ signature: options.signature, status: "submitted" })
    .eq("id", options.authorizationId)

  await markNonceUsed(auth.user_id, auth.token_address, auth.chain_id, auth.nonce)

  return { valid: true }
}
