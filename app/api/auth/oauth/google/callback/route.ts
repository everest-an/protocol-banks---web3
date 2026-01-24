import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createSession } from "@/lib/auth/session"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/oauth/google/callback`

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(new URL("/auth/error?error=oauth_denied", request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL("/auth/error?error=missing_code", request.url))
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/auth/error?error=oauth_not_configured", request.url))
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: GOOGLE_REDIRECT_URI,
      }),
    })

    const tokens = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error("[OAuth] Token exchange failed:", tokens)
      return NextResponse.redirect(new URL("/auth/error?error=token_exchange_failed", request.url))
    }

    // Get user info
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    const userInfo = await userInfoResponse.json()

    if (!userInfoResponse.ok) {
      console.error("[OAuth] User info failed:", userInfo)
      return NextResponse.redirect(new URL("/auth/error?error=user_info_failed", request.url))
    }

    // Create or get user
    const supabase = await createServerClient()

    // Check if user exists
    const { data: existingUser } = await supabase
      .from("auth_users")
      .select("*")
      .or(`google_id.eq.${userInfo.id},email.eq.${userInfo.email}`)
      .single()

    let userId: string

    if (existingUser) {
      userId = existingUser.id
      // Update google_id if not set
      if (!existingUser.google_id) {
        await supabase.from("auth_users").update({ google_id: userInfo.id }).eq("id", existingUser.id)
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from("auth_users")
        .insert({
          email: userInfo.email,
          google_id: userInfo.id,
        })
        .select()
        .single()

      if (createError || !newUser) {
        console.error("[OAuth] User creation failed:", createError)
        return NextResponse.redirect(new URL("/auth/error?error=user_creation_failed", request.url))
      }

      userId = newUser.id
    }

    // Create session
    const response = NextResponse.redirect(new URL("/?login=success", request.url))
    await createSession(userId, userInfo.email || "")

    return response
  } catch (error) {
    console.error("[OAuth] Error:", error)
    return NextResponse.redirect(new URL("/auth/error?error=oauth_error", request.url))
  }
}
