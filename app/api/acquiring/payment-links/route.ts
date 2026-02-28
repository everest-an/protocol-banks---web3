/**
 * Payment Links API
 *
 * Create and manage no-code payment links for merchants.
 * Full CRUD: POST (create), GET (list/single), PATCH (update), DELETE (remove)
 */

import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { withAuth } from "@/lib/middleware/api-auth"

// ============================================
// Helpers
// ============================================

function generateLinkId(): string {
  return `PL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
}

let _fallbackSecret: string | null = null
function getPaymentLinkSecret(): string {
  const configured = process.env.PAYMENT_LINK_SECRET
  if (configured) return configured
  if (!_fallbackSecret) {
    _fallbackSecret = crypto.randomBytes(32).toString("hex")
    console.warn("[PaymentLinks] PAYMENT_LINK_SECRET not configured — using random per-instance secret.")
  }
  return _fallbackSecret
}

function generateSignature(data: string): string {
  return crypto.createHmac("sha256", getPaymentLinkSecret()).update(data).digest("hex").slice(0, 16)
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

export const POST = withAuth(async (request: NextRequest, callerAddress: string) => {
  try {
    const body = await request.json()
    const {
      merchantId, title, description, amount, currency, token,
      recipientAddress, amountType, minAmount, maxAmount, expiresAt,
      redirectUrl, metadata, brandColor, logoUrl,
      distributeAsset, assetType, assetContractAddress, assetTokenId, assetAmount,
    } = body

    if (!recipientAddress || !/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      return NextResponse.json({ error: "Invalid recipient address" }, { status: 400 })
    }

    if (amountType === "fixed" && (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
      return NextResponse.json({ error: "Invalid amount for fixed payment link" }, { status: 400 })
    }

    const linkId = generateLinkId()
    const tokenValue = token || "USDC"
    const titleValue = title || "Payment"
    const signatureData = `${linkId}|${recipientAddress}|${amount || "dynamic"}|${tokenValue}`
    const signature = generateSignature(signatureData)

    const link = await prisma.paymentLink.create({
      data: {
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
      },
    })

    const urls = buildPaymentUrl(linkId, recipientAddress, amount, tokenValue, titleValue, signature)
    return NextResponse.json({ success: true, link, ...urls })
  } catch (error: any) {
    console.error("[API] Payment link creation error:", error)
    return NextResponse.json({ error: error.message || "Failed to create payment link" }, { status: 500 })
  }
}, { component: 'acquiring-payment-links' })

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

    // Fetch single link by linkId
    if (linkId) {
      const link = await prisma.paymentLink.findUnique({
        where: { link_id: linkId },
      })

      if (!link) {
        return NextResponse.json({ error: "Payment link not found" }, { status: 404 })
      }

      return NextResponse.json(link)
    }

    // Fetch list with filters and pagination
    const where: any = {}
    if (merchantId) where.merchant_id = merchantId
    if (status) where.status = status

    const [links, total] = await Promise.all([
      prisma.paymentLink.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.paymentLink.count({ where }),
    ])

    return NextResponse.json({ success: true, links, total })
  } catch (error: any) {
    console.error("[API] Payment links fetch error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch payment links" }, { status: 500 })
  }
}

// ============================================
// PATCH - Update payment link
// ============================================

export const PATCH = withAuth(async (request: NextRequest, callerAddress: string) => {
  try {
    const body = await request.json()
    const { linkId, status, ...updates } = body

    if (!linkId) {
      return NextResponse.json({ error: "Link ID required" }, { status: 400 })
    }

    const updateData: any = {
      ...updates,
      updated_at: new Date(),
    }
    if (status) updateData.status = status

    const link = await prisma.paymentLink.update({
      where: { link_id: linkId },
      data: updateData,
    })

    return NextResponse.json({ success: true, link })
  } catch (error: any) {
    console.error("[API] Payment link update error:", error)
    return NextResponse.json({ error: error.message || "Failed to update payment link" }, { status: 500 })
  }
}, { component: 'acquiring-payment-links' })

// ============================================
// DELETE - Remove payment link
// ============================================

export const DELETE = withAuth(async (request: NextRequest, callerAddress: string) => {
  try {
    const { searchParams } = new URL(request.url)
    const linkId = searchParams.get("linkId")

    if (!linkId) {
      return NextResponse.json({ error: "Link ID required" }, { status: 400 })
    }

    await prisma.paymentLink.delete({
      where: { link_id: linkId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[API] Payment link delete error:", error)
    return NextResponse.json({ error: error.message || "Failed to delete payment link" }, { status: 500 })
  }
}, { component: 'acquiring-payment-links' })
