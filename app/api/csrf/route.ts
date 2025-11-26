/**
 * CSRF Token Generation Endpoint
 *
 * Generates and sets a CSRF token cookie for client-side requests.
 */

import { type NextRequest, NextResponse } from "next/server"
import { generateCSRFToken, addSecurityHeaders } from "@/lib/security-middleware"

export async function GET(request: NextRequest) {
  const token = generateCSRFToken()

  const response = NextResponse.json({ csrfToken: token })

  // Set CSRF cookie
  response.cookies.set("__csrf", token, {
    httpOnly: false, // Client needs to read this
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60, // 1 hour
    path: "/",
  })

  return addSecurityHeaders(response)
}
