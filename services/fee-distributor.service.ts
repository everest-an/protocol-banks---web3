import { createClient } from "@/lib/supabase/server"

export async function logFeeDistribution(options: {
  authorizationId: string
  userId: string
  relayerAddress?: string | null
  fee: string
}) {
  const supabase = await createClient()
  await supabase.from("x402_audit_logs").insert({
    user_id: options.userId,
    authorization_id: options.authorizationId,
    action: "fee_calculated",
    details: {
      relayerAddress: options.relayerAddress,
      fee: options.fee,
    },
  })
}
