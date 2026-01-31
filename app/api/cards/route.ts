"use server"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - List user's cards
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get("wallet")

    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 })
    }

    const { data: cards, error } = await supabase
      .from("user_cards")
      .select("*")
      .eq("wallet_address", walletAddress.toLowerCase())
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ cards: cards || [] })
  } catch (error: any) {
    console.error("[Cards API] GET error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create/apply for a new card
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { walletAddress, cardType, currency, spendingLimit } = body

    if (!walletAddress || !cardType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check for existing pending or active card of same type
    const { data: existing } = await supabase
      .from("user_cards")
      .select("id")
      .eq("wallet_address", walletAddress.toLowerCase())
      .eq("card_type", cardType)
      .in("status", ["pending", "active"])
      .single()

    if (existing) {
      return NextResponse.json({ error: "You already have a card of this type" }, { status: 400 })
    }

    // Generate card number (last 4 digits only for display)
    const last4 = Math.floor(1000 + Math.random() * 9000).toString()

    // Create card record (in production, this would call Rain API)
    const { data: card, error } = await supabase
      .from("user_cards")
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        card_type: cardType,
        card_number_last4: last4,
        status: "pending", // Would be updated by Rain webhook
        balance: "0",
        currency: currency || "USD",
        spending_limit: spendingLimit || "10000",
        metadata: {
          application_date: new Date().toISOString(),
          requested_limit: spendingLimit,
        },
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ card, message: "Card application submitted" })
  } catch (error: any) {
    console.error("[Cards API] POST error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Update card (freeze/unfreeze, update limit)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { cardId, walletAddress, action, data } = body

    if (!cardId || !walletAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify card ownership
    const { data: card, error: fetchError } = await supabase
      .from("user_cards")
      .select("*")
      .eq("id", cardId)
      .eq("wallet_address", walletAddress.toLowerCase())
      .single()

    if (fetchError || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }

    let updateData: Record<string, any> = { updated_at: new Date().toISOString() }

    switch (action) {
      case "freeze":
        updateData.status = "frozen"
        break
      case "unfreeze":
        updateData.status = "active"
        break
      case "update_limit":
        if (data?.spendingLimit) {
          updateData.spending_limit = data.spendingLimit
        }
        break
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const { data: updatedCard, error: updateError } = await supabase
      .from("user_cards")
      .update(updateData)
      .eq("id", cardId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ card: updatedCard })
  } catch (error: any) {
    console.error("[Cards API] PATCH error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
