/**
 * Order Details API
 */

import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  try {
    const { orderNo } = await params;

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

    // Get order information
    const { data: order, error: orderError } = await supabase
      .from("acquiring_orders")
      .select("*")
      .eq("order_no", orderNo)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Get merchant information
    const { data: merchant } = await supabase
      .from("merchants")
      .select("name, logo_url, wallet_address")
      .eq("id", order.merchant_id)
      .single();

    // Check if order is expired
    const isExpired = new Date(order.expires_at) < new Date();
    if (isExpired && order.status === "pending") {
      // Automatically update to expired status
      await supabase
        .from("acquiring_orders")
        .update({ status: "expired" })
        .eq("id", order.id);
      order.status = "expired";
    }

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        merchant_name: merchant?.name,
        merchant_logo: merchant?.logo_url,
        merchant_wallet_address: merchant?.wallet_address,
      },
    });
  } catch (error: any) {
    console.error("[API] Order fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// Update order status (payment callback)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  try {
    const { orderNo } = await params;
    const body = await request.json();
    const { status, payment_method, payer_address, tx_hash } = body;

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

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (payment_method) updateData.payment_method = payment_method;
    if (payer_address) updateData.payer_address = payer_address;
    if (tx_hash) updateData.tx_hash = tx_hash;
    if (status === "paid") updateData.paid_at = new Date().toISOString();

    const { data: order, error } = await supabase
      .from("acquiring_orders")
      .update(updateData)
      .eq("order_no", orderNo)
      .select()
      .single();

    if (error) {
      console.error("[API] Order update error:", error);
      return NextResponse.json(
        { error: "Failed to update order" },
        { status: 500 },
      );
    }

    // If order is paid, update merchant balance
    if (status === "paid" && order) {
      const { data: balance } = await supabase
        .from("merchant_balances")
        .select("*")
        .eq("merchant_id", order.merchant_id)
        .eq("token", order.token)
        .single();

      if (balance) {
        await supabase
          .from("merchant_balances")
          .update({
            balance: parseFloat(balance.balance) + parseFloat(order.amount),
            updated_at: new Date().toISOString(),
          })
          .eq("id", balance.id);
      } else {
        await supabase.from("merchant_balances").insert({
          merchant_id: order.merchant_id,
          token: order.token,
          balance: order.amount,
        });
      }

      // Send Webhook notification (if configured)
      if (order.notify_url) {
        try {
          await fetch(order.notify_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "order.paid",
              order_no: order.order_no,
              amount: order.amount,
              token: order.token,
              tx_hash: order.tx_hash,
              paid_at: order.paid_at,
            }),
          });
        } catch (webhookError) {
          console.error("[API] Webhook notification error:", webhookError);
        }
      }
    }

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error("[API] Order update error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
