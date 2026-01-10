import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createSession } from "@/lib/auth/session"
import * as jose from "jose"

const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const code = formData.get("code") as string
    const idToken = formData.get("id_token") as string
    const error = formData.get("error") as string
    const userDataRaw = formData.get("user") as string | null

    if (error) {
      return NextResponse.redirect(new URL("/auth/error?error=oauth_denied", request.url))
    }

    if (!idToken) {
      return NextResponse.redirect(new URL("/auth/error?error=missing_token", request.url))
    }

    // Decode the ID token to get user info
    // Note: In production, you should verify the token signature
    const decoded = jose.decodeJwt(idToken)

    const appleUserId = decoded.sub as string
    let email = decoded.email as string | undefined

    // Parse user data if provided (only on first sign-in)
    let userData: { name?: { firstName?: string; lastName?: string }; email?: string } | null = null
    if (userDataRaw) {
      try {
        userData = JSON.parse(userDataRaw)
        if (userData?.email) {
          email = userData.email
        }
      } catch {
        // Ignore parsing errors
      }
    }

    if (!appleUserId) {
      return NextResponse.redirect(new URL("/auth/error?error=invalid_token", request.url))
    }

    // Create or get user
    const supabase = await createServerClient()

    // Check if user exists
    const { data: existingUser } = await supabase.from("auth_users").select("*").eq("apple_id", appleUserId).single()

    let userId: string

    if (existingUser) {
      userId = existingUser.id
      // Update email if we have it and it's not set
      if (email && !existingUser.email) {
        await supabase.from("auth_users").update({ email }).eq("id", existingUser.id)
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from("auth_users")
        .insert({
          email: email || null,
          apple_id: appleUserId,
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
    await createSession(userId, response)

    return response
  } catch (error) {
    console.error("[OAuth] Error:", error)
    return NextResponse.redirect(new URL("/auth/error?error=oauth_error", request.url))
  }
}
