import { createClient } from "@/lib/supabase/server"

export async function getCurrentNonce(userId: string, tokenAddress: string, chainId: number): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("x402_nonces")
    .select("current_nonce")
    .eq("user_id", userId)
    .eq("token_address", tokenAddress)
    .eq("chain_id", chainId)
    .maybeSingle()

  return data?.current_nonce ?? 0
}

export async function incrementNonce(userId: string, tokenAddress: string, chainId: number): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("x402_nonces")
    .upsert({
      user_id: userId,
      token_address: tokenAddress,
      chain_id: chainId,
      current_nonce: 1,
    }, { onConflict: "user_id,token_address,chain_id" })
    .select("current_nonce")
    .single()

  if (error) {
    throw error
  }

  const next = (data?.current_nonce ?? 0) + 1
  await supabase
    .from("x402_nonces")
    .update({ current_nonce: next })
    .eq("user_id", userId)
    .eq("token_address", tokenAddress)
    .eq("chain_id", chainId)

  return next
}

export async function markNonceUsed(userId: string, tokenAddress: string, chainId: number, nonce: number) {
  const supabase = await createClient()
  await supabase.from("x402_used_nonces").insert({
    user_id: userId,
    token_address: tokenAddress,
    chain_id: chainId,
    nonce,
  })
}

export async function isNonceUsed(userId: string, tokenAddress: string, chainId: number, nonce: number): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("x402_used_nonces")
    .select("id")
    .eq("user_id", userId)
    .eq("token_address", tokenAddress)
    .eq("chain_id", chainId)
    .eq("nonce", nonce)
    .maybeSingle()
  return Boolean(data)
}
