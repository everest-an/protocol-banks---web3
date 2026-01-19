/**
 * Session Management
 */

import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { generateSecureToken, sha256 } from "./crypto"
import { AUTH_CONFIG } from "./config"

export interface Session {
  userId: string
  email: string
  walletAddress?: string
  expiresAt: Date
}

/**
 * Create a new session for user
 */
export async function createSession(
  userId: string,
  email: string,
  walletAddress?: string,
  metadata?: {
    ipAddress?: string
    userAgent?: string
    deviceFingerprint?: string
  },
): Promise<string> {
  const supabase = await createClient()

  // Generate session token
  const sessionToken = generateSecureToken()
  const tokenHash = await sha256(sessionToken)

  // Calculate expiry
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + AUTH_CONFIG.session.expiresInDays)

  // Store session in database
  const { error } = await supabase.from("auth_sessions").insert({
    user_id: userId,
    session_token_hash: tokenHash,
    wallet_address: walletAddress,
    device_fingerprint: metadata?.deviceFingerprint,
    ip_address: metadata?.ipAddress,
    user_agent: metadata?.userAgent,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    console.error("[Auth] Failed to create session:", error)
    throw new Error("Failed to create session")
  }

  // Set session cookie
  const cookieStore = await cookies()
  cookieStore.set(AUTH_CONFIG.session.cookieName, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  })

  return sessionToken
}

/**
 * Get current session from cookie
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(AUTH_CONFIG.session.cookieName)?.value

  if (!sessionToken) {
    return null
  }

  const supabase = await createClient()
  const tokenHash = await sha256(sessionToken)

  // Get session from database
  const { data: session, error } = await supabase
    .from("auth_sessions")
    .select(
      `
      id,
      user_id,
      wallet_address,
      expires_at,
      auth_users (
        id,
        email,
        embedded_wallets (
          wallet_address,
          address
        )
      )
    `,
    )
    .eq("session_token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .single()

  if (error || !session) {
    return null
  }

  // Update last active
  await supabase.from("auth_sessions").update({ last_active_at: new Date().toISOString() }).eq("id", session.id)

  const user = session.auth_users as any
  const persistedWallet = (user?.embedded_wallets && user.embedded_wallets[0]?.wallet_address) ||
    (user?.embedded_wallets && user.embedded_wallets[0]?.address)

  return {
    userId: session.user_id,
    email: user?.email || "",
    walletAddress: session.wallet_address || persistedWallet,
    expiresAt: new Date(session.expires_at),
  }
}

/**
 * Destroy current session
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(AUTH_CONFIG.session.cookieName)?.value

  if (sessionToken) {
    const supabase = await createClient()
    const tokenHash = await sha256(sessionToken)

    // Delete from database
    await supabase.from("auth_sessions").delete().eq("session_token_hash", tokenHash)
  }

  // Clear cookie
  cookieStore.delete(AUTH_CONFIG.session.cookieName)
}

/**
 * Refresh session if needed
 */
export async function refreshSessionIfNeeded(): Promise<void> {
  const session = await getSession()

  if (!session) return

  const daysUntilExpiry = (session.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)

  if (daysUntilExpiry < AUTH_CONFIG.session.refreshThresholdDays) {
    // Create new session
    await createSession(session.userId, session.email, session.walletAddress)
  }
}

/**
 * Verify session and return session data or null
 * Use this in API routes to check authentication
 */
export async function verifySession(): Promise<Session | null> {
  try {
    const session = await getSession()

    if (!session) {
      return null
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await destroySession()
      return null
    }

    // Optionally refresh if close to expiry
    await refreshSessionIfNeeded()

    return session
  } catch (error) {
    console.error("[Auth] Session verification failed:", error)
    return null
  }
}
