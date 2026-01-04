import { NextResponse } from "next/server"

const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID
const APPLE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/oauth/apple/callback`

export async function GET() {
  if (!APPLE_CLIENT_ID) {
    return NextResponse.json({ error: "Apple OAuth not configured" }, { status: 500 })
  }

  const params = new URLSearchParams({
    client_id: APPLE_CLIENT_ID,
    redirect_uri: APPLE_REDIRECT_URI,
    response_type: "code id_token",
    scope: "name email",
    response_mode: "form_post",
  })

  const authUrl = `https://appleid.apple.com/auth/authorize?${params.toString()}`

  return NextResponse.redirect(authUrl)
}
