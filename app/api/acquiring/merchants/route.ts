/**
 * Merchant Management API
 */

import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";
import { verifySession } from "@/lib/auth/session";

// Generate API Key
function generateApiKey(): {
  keyId: string;
  keySecret: string;
  keySecretHash: string;
} {
  const keyId = `pk_${crypto.randomBytes(16).toString("hex")}`;
  const keySecret = `sk_${crypto.randomBytes(32).toString("hex")}`;
  const keySecretHash = crypto
    .createHash("sha256")
    .update(keySecret)
    .digest("hex");

  return { keyId, keySecret, keySecretHash };
}

// Create merchant
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, logo_url, wallet_address, callback_url } = body;

    // Validate required fields
    if (!name || !wallet_address) {
      return NextResponse.json(
        { error: "Name and wallet address are required" },
        { status: 400 },
      );
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 },
      );
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

    // Create merchant
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .insert({
        user_id: session.userId,
        name,
        logo_url,
        wallet_address,
        callback_url,
        status: "active",
      })
      .select()
      .single();

    if (merchantError) {
      console.error("[API] Merchant creation error:", merchantError);
      return NextResponse.json(
        { error: "Failed to create merchant" },
        { status: 500 },
      );
    }

    // Automatically generate an API Key
    const { keyId, keySecret, keySecretHash } = generateApiKey();

    const { error: keyError } = await supabase
      .from("merchant_api_keys")
      .insert({
        merchant_id: merchant.id,
        key_id: keyId,
        key_secret_hash: keySecretHash,
        name: "Default API Key",
      });

    if (keyError) {
      console.warn("[API] API Key creation warning:", keyError);
    }

    return NextResponse.json({
      success: true,
      merchant,
      api_key: {
        key_id: keyId,
        key_secret: keySecret, // Only returned once during creation
      },
    });
  } catch (error: any) {
    console.error("[API] Merchant creation error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// Get merchant list
export async function GET(request: NextRequest) {
  try {
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: merchants, error } = await supabase
      .from("merchants")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[API] Merchants fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch merchants" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, merchants });
  } catch (error: any) {
    console.error("[API] Merchants fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
