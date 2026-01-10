/**
 * Send Magic Link API
 *
 * POST /api/auth/magic-link/send
 * Body: { email: string }
 */

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateSecureToken, sha256 } from "@/lib/auth/crypto"
import { AUTH_CONFIG } from "@/lib/auth/config"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    const supabase = await createClient()

    // Check rate limiting
    const cooldownTime = new Date()
    cooldownTime.setMinutes(cooldownTime.getMinutes() - AUTH_CONFIG.magicLink.cooldownMinutes)

    const { data: recentLinks } = await supabase
      .from("magic_links")
      .select("id")
      .eq("email", email.toLowerCase())
      .gt("created_at", cooldownTime.toISOString())
      .eq("used", false)

    if (recentLinks && recentLinks.length > 0) {
      return NextResponse.json({ error: "Please wait before requesting another link" }, { status: 429 })
    }

    // Generate magic link token
    const token = generateSecureToken()
    const tokenHash = await sha256(token)

    // Calculate expiry
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + AUTH_CONFIG.magicLink.expiresInMinutes)

    // Get IP and user agent
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"

    // Store magic link in database
    const { error: insertError } = await supabase.from("magic_links").insert({
      email: email.toLowerCase(),
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    if (insertError) {
      console.error("[Auth] Failed to create magic link:", insertError)
      return NextResponse.json({ error: "Failed to send magic link" }, { status: 500 })
    }

    // Build magic link URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://protocolbank.io"
    const magicLinkUrl = `${baseUrl}/api/auth/magic-link/verify?token=${token}`

    // Send email
    try {
      await resend.emails.send({
        from: `${AUTH_CONFIG.email.fromName} <${AUTH_CONFIG.email.fromAddress}>`,
        to: email.toLowerCase(),
        subject: "Sign in to Protocol Bank",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 40px 20px;">
              <div style="max-width: 480px; margin: 0 auto; background-color: #111111; border-radius: 16px; padding: 40px; border: 1px solid #222222;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #22d3ee; font-size: 24px; margin: 0;">Protocol Bank</h1>
                </div>
                
                <h2 style="font-size: 20px; margin-bottom: 16px; color: #ffffff;">Sign in to your account</h2>
                
                <p style="color: #888888; line-height: 1.6; margin-bottom: 24px;">
                  Click the button below to sign in. This link will expire in ${AUTH_CONFIG.magicLink.expiresInMinutes} minutes.
                </p>
                
                <a href="${magicLinkUrl}" style="display: inline-block; background-color: #22d3ee; color: #000000; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Sign in to Protocol Bank
                </a>
                
                <p style="color: #666666; font-size: 12px; margin-top: 32px; line-height: 1.5;">
                  If you didn't request this email, you can safely ignore it.
                </p>
                
                <hr style="border: none; border-top: 1px solid #222222; margin: 24px 0;">
                
                <p style="color: #444444; font-size: 11px; text-align: center;">
                  Protocol Bank - Enterprise Crypto Payment Platform
                </p>
              </div>
            </body>
          </html>
        `,
      })
    } catch (emailError) {
      console.error("[Auth] Failed to send email:", emailError)
      // Don't expose email errors to client
      return NextResponse.json({ error: "Failed to send magic link" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Magic link sent" })
  } catch (error) {
    console.error("[Auth] Magic link error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
