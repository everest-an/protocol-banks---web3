/**
 * Order Management API
 */

import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";
import { verifySession } from "@/lib/auth/session";

// Generate order number
function generateOrderNo(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `ORDER${timestamp}${random}`;
}

// Create order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      merchant_id,
      amount,
      currency = "USD",
      token = "USDC",
      order_no,
      notify_url,
      return_url,
      expire_minutes = 30,
      metadata,
    } = body;

    // Validate required fields
    if (!merchant_id || !amount) {
      return NextResponse.json(
        { error: "Merchant ID and amount are required" },
        { status: 400 },
      );
    }

    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      },
    );

    const session = await verifySession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify merchant exists
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("*")
      .eq("id", merchant_id)
      .eq("user_id", session.userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: "Merchant not found" },
        { status: 404 },
      );
    }

    if (merchant.status !== "active") {
      return NextResponse.json(
        { error: "Merchant is not active" },
        { status: 403 },
      );
    }

    // Generate order number (if not provided)
    const finalOrderNo = order_no || generateOrderNo();

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expire_minutes * 60 * 1000);

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("acquiring_orders")
      .insert({
        order_no: finalOrderNo,
        merchant_id,
        amount: parseFloat(amount),
        currency,
        token,
        notify_url,
        return_url,
        expires_at: expiresAt.toISOString(),
        metadata,
        status: "pending",
      })
      .select()
      .single();

    if (orderError) {
      console.error("[API] Order creation error:", orderError);
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 },
      );
    }

    // Generate checkout link
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://protocol-banks.vercel.app";
    const checkoutUrl = `${baseUrl}/checkout?order=${order.order_no}`;

    return NextResponse.json({
      success: true,
      order,
      checkout_url: checkoutUrl,
    });
  } catch (error: any) {
    console.error("[API] Order creation error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// Get order list
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantId = searchParams.get("merchant_id");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      },
    );

    let query = supabase
      .from("acquiring_orders")
      .select("*", { count: "exact" });

    if (merchantId) {
      query = query.eq("merchant_id", merchantId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const {
      data: orders,
      error,
      count,
    } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[API] Orders fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch orders" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      orders,
      total: count,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("[API] Orders fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
