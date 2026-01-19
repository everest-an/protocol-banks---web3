import { isAddress } from "ethers"
import { createClient } from "@/lib/supabase/server"

export type AccountValidationResult = {
  valid: boolean
  error?: string
  walletAddress?: string
}

export async function validateAccountWalletAssociation(userId: string): Promise<AccountValidationResult> {
  const supabase = await createClient()

  const { data: wallet, error } = await supabase
    .from("embedded_wallets")
    .select("id, wallet_address, address, user_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error("[AccountValidator] Failed to fetch wallet:", error)
    return { valid: false, error: "Wallet lookup failed" }
  }

  if (!wallet) {
    return { valid: false, error: "Wallet not found" }
  }

  const walletAddress = wallet.wallet_address || wallet.address
  if (!walletAddress) {
    return { valid: false, error: "Wallet address missing" }
  }

  if (!isAddress(walletAddress)) {
    return { valid: false, error: "Invalid wallet address" }
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "account_validation",
    details: { walletAddress },
  })

  return { valid: true, walletAddress }
}
