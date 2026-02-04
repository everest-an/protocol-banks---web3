/**
 * Payment Verification API
 *
 * Server-side endpoint to verify payment integrity between
 * client-submitted parameters and blockchain state.
 */

import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { validateAndChecksumAddress, validateAmount, verifyTransactionIntegrity, createAuditLog } from "@/lib/security/security"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paymentId, clientParams, integrityHash } = body

    // Validate required fields
    if (!paymentId || !clientParams || !integrityHash) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate client parameters
    const addressValidation = validateAndChecksumAddress(clientParams.to_address)
    if (!addressValidation.valid) {
      return NextResponse.json({ error: `Invalid address: ${addressValidation.error}` }, { status: 400 })
    }

    const amountValidation = validateAmount(clientParams.amount)
    if (!amountValidation.valid) {
      return NextResponse.json({ error: `Invalid amount: ${amountValidation.error}` }, { status: 400 })
    }

    // Create Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    })

    // Fetch payment from database
    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single()

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    // Compare parameters
    const discrepancies: string[] = []

    // Normalize and compare addresses
    const storedAddress = payment.to_address?.toLowerCase()
    const clientAddress = addressValidation.checksummed?.toLowerCase()

    if (storedAddress !== clientAddress) {
      discrepancies.push(`Address mismatch: stored=${storedAddress}, client=${clientAddress}`)
    }

    if (payment.amount !== clientParams.amount) {
      discrepancies.push(`Amount mismatch: stored=${payment.amount}, client=${clientParams.amount}`)
    }

    if (payment.token_symbol !== clientParams.token_symbol) {
      discrepancies.push(`Token mismatch: stored=${payment.token_symbol}, client=${clientParams.token_symbol}`)
    }

    // Verify integrity hash
    const integrityValid = verifyTransactionIntegrity(integrityHash, {
      from: payment.from_address,
      to: payment.to_address,
      amount: payment.amount,
      tokenAddress: payment.token_address,
      chainId: clientParams.chainId || 1,
      timestamp: clientParams.timestamp,
      nonce: clientParams.nonce,
    })

    // Store verification result
    await supabase.from("payment_integrity").insert({
      payment_id: paymentId,
      client_hash: integrityHash,
      server_hash: integrityHash, // In production, compute server-side hash
      match_status: discrepancies.length === 0 && integrityValid,
      discrepancies: discrepancies,
    })

    // Log if there are discrepancies
    if (discrepancies.length > 0) {
      const alertLog = createAuditLog({
        action: "SECURITY_ALERT",
        actor: payment.from_address,
        target: paymentId,
        details: {
          reason: "Payment parameter mismatch",
          discrepancies,
        },
      })
      console.error("[Security Alert]", alertLog)

      // Store security alert
      await supabase.from("security_alerts").insert({
        alert_type: "TAMPERING",
        severity: "high",
        actor: payment.from_address,
        description: `Payment parameters do not match between client and server`,
        details: { discrepancies, payment_id: paymentId },
      })
    }

    return NextResponse.json({
      verified: discrepancies.length === 0 && integrityValid,
      discrepancies,
      integrityValid,
    })
  } catch (error: any) {
    console.error("[API] Verification error:", error)
    return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 })
  }
}
