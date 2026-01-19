import { createClient } from "@/lib/supabase/server"

export async function retryFailedItems(batchId: string, userId: string): Promise<{ retried: number }> {
  const supabase = await createClient()

  const { data: batch, error: batchError } = await supabase
    .from("batch_payments")
    .select("id, user_id")
    .eq("id", batchId)
    .single()

  if (batchError || !batch || batch.user_id !== userId) {
    throw new Error("Batch not found")
  }

  const { data: failedItems, error } = await supabase
    .from("payment_items")
    .select("id")
    .eq("batch_id", batchId)
    .eq("status", "failed")

  if (error) {
    throw error
  }

  const failedIds = (failedItems || []).map((item) => item.id)
  if (failedIds.length === 0) {
    return { retried: 0 }
  }

  await supabase
    .from("payment_items")
    .update({ status: "pending", error_reason: null })
    .in("id", failedIds)

  await supabase
    .from("batch_payments")
    .update({ status: "processing" })
    .eq("id", batchId)

  await supabase.from("payment_audit_logs").insert({
    batch_id: batchId,
    user_id: userId,
    action: "batch_retry",
    details: { retried: failedIds.length },
  })

  return { retried: failedIds.length }
}
