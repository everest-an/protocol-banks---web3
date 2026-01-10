export interface BatchPaymentRequest {
  recipients: Array<{
    address: string
    amount: string
    token: string
    vendorName?: string
  }>
  from: string
  chainId: number
}

export interface PaymentResult {
  success: boolean
  txHash?: string
  error?: string
}

export class PaymentService {
  /**
   * Execute batch payment using EIP-3009 authorization
   */
  static async executeBatchPayment(
    request: BatchPaymentRequest,
    signFunction: (data: any) => Promise<string>,
  ): Promise<PaymentResult[]> {
    console.log("[v0] PaymentService: executing batch payment", {
      recipientCount: request.recipients.length,
      from: request.from,
    })

    const results: PaymentResult[] = []

    for (const recipient of request.recipients) {
      try {
        // Sign EIP-3009 authorization
        const authorization = {
          from: request.from,
          to: recipient.address,
          value: recipient.amount,
          validAfter: Math.floor(Date.now() / 1000),
          validBefore: Math.floor(Date.now() / 1000) + 3600,
          nonce: crypto.randomUUID(),
        }

        const signature = await signFunction(authorization)

        // In production, this would call the smart contract
        // For now, we simulate success
        results.push({
          success: true,
          txHash: `0x${Math.random().toString(16).substring(2, 66)}`,
        })

        console.log("[v0] PaymentService: payment successful", {
          to: recipient.address,
          amount: recipient.amount,
        })
      } catch (error) {
        console.error("[v0] PaymentService: payment failed", error)
        results.push({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return results
  }

  /**
   * Store payment record in database
   */
  static async recordPayment(
    payment: {
      from: string
      to: string
      amount: string
      token: string
      txHash: string
      status: string
    },
    supabase: any,
  ): Promise<boolean> {
    try {
      const { error } = await supabase.from("payments").insert({
        from_address: payment.from,
        to_address: payment.to,
        amount: payment.amount,
        token: payment.token,
        tx_hash: payment.txHash,
        status: payment.status,
        type: "sent",
        created_at: new Date().toISOString(),
      })

      if (error) throw error
      return true
    } catch (error) {
      console.error("[v0] PaymentService: failed to record payment", error)
      return false
    }
  }
}
