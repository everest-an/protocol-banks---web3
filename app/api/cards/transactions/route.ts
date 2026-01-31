"use server"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - List card transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cardId = searchParams.get("cardId")
    const walletAddress = searchParams.get("wallet")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 })
    }

    let query = supabase
      .from("card_transactions")
      .select("*, user_cards!inner(wallet_address)")
      .eq("user_cards.wallet_address", walletAddress.toLowerCase())
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (cardId) {
      query = query.eq("card_id", cardId)
    }

    const { data: transactions, error } = await query

    if (error) throw error

    // Get total count
    const { count } = await supabase
      .from("card_transactions")
      .select("*", { count: "exact", head: true })
      .eq("card_id", cardId || "")

    return NextResponse.json({ 
      transactions: transactions || [],
      total: count || 0,
      limit,
      offset 
    })
  } catch (error: any) {
    console.error("[Transactions API] GET error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
