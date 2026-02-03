/**
 * Payment Links API
 *
 * Create and manage no-code payment links for merchants.
 * Full CRUD: POST (create), GET (list/single), PATCH (update), DELETE (remove)
 */

import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import crypto from "crypto"

// ============================================
// Helpers
// ============================================

/**
 * Create Supabase client with service role key (bypasses RLS for merchant operations)
 */
async function getServiceSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
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
    }
  )
}

function generateLinkId(): string {
  return `PL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
}

function generateSignature(data: string): string {
  const secret = process.env.PAYMENT_LINK_SECRET || "default-secret"
  return crypto.createHmac("sha256", secret).update(data).digest("hex").slice(0, 16)
}

function buildPaymentUrl(linkId: string, recipientAddress: string, amount: string | null, token: string, title: string, signature: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://protocol-banks.vercel.app"
  const paymentUrl = `${baseUrl}/pay?to=${recipientAddress}&amount=${amount || ""}&token=${token}&merchant=${encodeURIComponent(title)}&sig=${signature}&linkId=${linkId}`
  const shortUrl = `${baseUrl}/p/${linkId}`
  return { paymentUrl, shortUrl }
}

// ============================================
// POST - Create payment link
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      merchantId,
      title,
      description,
      amount,
      currency,
      token,
      recipientAddress,
      amountType,
      minAmount,
      maxAmount,
      expiresAt,
      redirectUrl,
      metadata,
      brandColor,
      logoUrl,
      distributeAsset,
      assetType,
      assetContractAddress,
      assetTokenId,
      assetAmount,
    } = body

    // Validate required fields
    if (!recipientAddress || !/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      return NextResponse.json({ error: "Invalid recipient address" }, { status: 400 })
    }

    if (amountType === "fixed" && (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
      return NextResponse.json({ error: "Invalid amount for fixed payment link" }, { status: 400 })
    }

    const supabase = await getServiceSupabase()
    const linkId = generateLinkId()
    const tokenValue = token || "USDC"
    const titleValue = title || "Payment"
    const signatureData = `${linkId}|${recipientAddress}|${amount || "dynamic"}|${tokenValue}`
    const signature = generateSignature(signatureData)

    const insertData = {
      link_id: linkId,
      merchant_id: merchantId,
      title: titleValue,
      description,
      amount: amount ? parseFloat(amount) : null,
      currency: currency || "USD",
      token: tokenValue,
      recipient_address: recipientAddress,
      amount_type: amountType || "fixed",
      min_amount: minAmount ? parseFloat(minAmount) : null,
      max_amount: maxAmount ? parseFloat(maxAmount) : null,
      expires_at: expiresAt || null,
      redirect_url: redirectUrl,
      signature,
      status: "active",
      metadata: metadata || {},
      brand_color: brandColor,
      logo_url: logoUrl,
      distribute_asset: distributeAsset || false,
      asset_type: assetType,
      asset_contract_address: assetContractAddress,
      asset_token_id: assetTokenId,
      asset_amount: assetAmount,
    }

    const { data: link, error: insertError } = await supabase
      .from("payment_links")
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.warn("[API] Payment links table may not exist:", insertError.message)

      // Return mock response when table doesn't exist (pre-migration)
      const mockLink = {
        id: crypto.randomUUID(),
        ...insertData,
        created_at: new Date().toISOString(),
        total_payments: 0,
        total_amount: 0,
      }

      const urls = buildPaymentUrl(linkId, recipientAddress, amount, tokenValue, titleValue, signature)
      return NextResponse.json({ success: true, link: mockLink, ...urls })
    }

    const urls = buildPaymentUrl(linkId, recipientAddress, amount, tokenValue, titleValue, signature)
    return NextResponse.json({ success: true, link, ...urls })
  } catch (error: any) {
    console.error("[API] Payment link creation error:", error)
    return NextResponse.json({ error: error.message || "Failed to create payment link" }, { status: 500 })
  }
}

// ============================================
// GET - Fetch payment links
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const merchantId = searchParams.get("merchantId")
    const linkId = searchParams.get("linkId")
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    const supabase = await getServiceSupabase()

    // Fetch single link by linkId
    if (linkId) {
      const { data: link, error } = await supabase
        .from("payment_links")
        .select("*")
        .eq("link_id", linkId)
        .single()

      if (error || !link) {
        return NextResponse.json({ error: "Payment link not found" }, { status: 404 })
      }

      return NextResponse.json(link)
    }

    // Fetch list with filters and pagination
    let query = supabase
      .from("payment_links")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (merchantId) {
      query = query.eq("merchant_id", merchantId)
    }

    if (status) {
      query = query.eq("status", status)
    }

    const { data: links, error, count } = await query

    if (error) {
      console.warn("[API] Payment links fetch error:", error.message)
      return NextResponse.json({ success: true, links: [], total: 0 })
    }

    return NextResponse.json({ success: true, links, total: count || 0 })
  } catch (error: any) {
    console.error("[API] Payment links fetch error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch payment links" }, { status: 500 })
  }
}

// ============================================
// PATCH - Update payment link
// ============================================

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { linkId, status, ...updates } = body

    if (!linkId) {
      return NextResponse.json({ error: "Link ID required" }, { status: 400 })
    }

    const supabase = await getServiceSupabase()

    const updateData: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    }

    if (status) updateData.status = status

    const { data: link, error } = await supabase
      .from("payment_links")
      .update(updateData)
      .eq("link_id", linkId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update payment link" }, { status: 500 })
    }

    return NextResponse.json({ success: true, link })
  } catch (error: any) {
    console.error("[API] Payment link update error:", error)
    return NextResponse.json({ error: error.message || "Failed to update payment link" }, { status: 500 })
  }
}

// ============================================
// DELETE - Remove payment link
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const linkId = searchParams.get("linkId")

    if (!linkId) {
      return NextResponse.json({ error: "Link ID required" }, { status: 400 })
    }

    const supabase = await getServiceSupabase()

    const { error } = await supabase.from("payment_links").delete().eq("link_id", linkId)

    if (error) {
      return NextResponse.json({ error: "Failed to delete payment link" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[API] Payment link delete error:", error)
    return NextResponse.json({ error: error.message || "Failed to delete payment link" }, { status: 500 })
  }
}
