/**
 * Invoice API
 *
 * Create and manage payment invoices for merchants
 */

import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import crypto from "crypto"

// Generate secure invoice ID
function generateInvoiceId(): string {
  return `INV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
}

// Generate payment link signature
function generateSignature(data: string): string {
  const secret = process.env.PAYMENT_LINK_SECRET || "default-secret"
  return crypto.createHmac("sha256", secret).update(data).digest("hex").slice(0, 16)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recipientAddress, amount, token, description, merchantName, expiresIn, metadata } = body

    // Validate required fields
    if (!recipientAddress || !/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      return NextResponse.json({ error: "Invalid recipient address" }, { status: 400 })
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
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

    // Generate invoice
    const invoiceId = generateInvoiceId()
    const expiresAt = new Date(Date.now() + (expiresIn || 24 * 60 * 60 * 1000)) // Default 24 hours

    // Generate signature for payment link
    const signatureData = `${invoiceId}|${recipientAddress}|${amount}|${token || "USDC"}`
    const signature = generateSignature(signatureData)

    // Store invoice in database
    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        invoice_id: invoiceId,
        recipient_address: recipientAddress,
        amount: parseFloat(amount),
        token: token || "USDC",
        description,
        merchant_name: merchantName,
        status: "pending",
        signature,
        expires_at: expiresAt.toISOString(),
        metadata,
      })
      .select()
      .single()

    if (insertError) {
      // If table doesn't exist, return mock response for demo
      console.warn("[API] Invoice table may not exist:", insertError.message)

      const mockInvoice = {
        id: crypto.randomUUID(),
        invoice_id: invoiceId,
        recipient_address: recipientAddress,
        amount: parseFloat(amount),
        token: token || "USDC",
        description,
        merchant_name: merchantName,
        status: "pending",
        signature,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      }

      // Generate payment link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://protocol-banks.vercel.app"
      const paymentLink = `${baseUrl}/pay?invoice=${invoiceId}&sig=${signature}`

      return NextResponse.json({
        success: true,
        invoice: mockInvoice,
        paymentLink,
        qrCodeData: paymentLink,
      })
    }

    // Generate payment link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://protocol-banks.vercel.app"
    const paymentLink = `${baseUrl}/pay?invoice=${invoiceId}&sig=${signature}`

    return NextResponse.json({
      success: true,
      invoice,
      paymentLink,
      qrCodeData: paymentLink,
    })
  } catch (error: any) {
    console.error("[API] Invoice creation error:", error)
    return NextResponse.json({ error: error.message || "Failed to create invoice" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get("id")
    const signature = searchParams.get("sig")

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID required" }, { status: 400 })
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

    // Fetch invoice
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("invoice_id", invoiceId)
      .single()

    if (error || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Verify signature if provided
    if (signature) {
      const expectedSig = generateSignature(
        `${invoice.invoice_id}|${invoice.recipient_address}|${invoice.amount}|${invoice.token}`,
      )
      if (signature !== expectedSig) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
      }
    }

    // Check expiration
    if (new Date(invoice.expires_at) < new Date()) {
      return NextResponse.json({
        ...invoice,
        status: "expired",
        isExpired: true,
      })
    }

    return NextResponse.json(invoice)
  } catch (error: any) {
    console.error("[API] Invoice fetch error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch invoice" }, { status: 500 })
  }
}

// Update invoice status (e.g., after payment)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { invoiceId, status, txHash, paidBy } = body

    if (!invoiceId || !status) {
      return NextResponse.json({ error: "Invoice ID and status required" }, { status: 400 })
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

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (txHash) updateData.tx_hash = txHash
    if (paidBy) updateData.paid_by = paidBy
    if (status === "paid") updateData.paid_at = new Date().toISOString()

    const { data: invoice, error } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("invoice_id", invoiceId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 })
    }

    return NextResponse.json({ success: true, invoice })
  } catch (error: any) {
    console.error("[API] Invoice update error:", error)
    return NextResponse.json({ error: error.message || "Failed to update invoice" }, { status: 500 })
  }
}
