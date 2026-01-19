import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { validateOrigin, validateCSRFToken, addSecurityHeaders } from "@/lib/security-middleware"
import { generateAuthorization } from "@/services/authorization-generator.service"

export async function POST(request: NextRequest) {
  const origin = validateOrigin(request)
  if (!origin.valid) return NextResponse.json({ error: origin.error }, { status: 400 })
  const csrf = validateCSRFToken(request)
  if (!csrf.valid) return NextResponse.json({ error: csrf.error }, { status: 403 })

  const session = await getSession()
  if (!session || !session.walletAddress) {
    return NextResponse.json({ error: "Unauthorized or no wallet" }, { status: 401 })
  }

  const { tokenAddress, chainId, toAddress, amount, validityDuration } = await request.json()
  if (!tokenAddress || !chainId || !toAddress || !amount) {
    return NextResponse.json({ error: "tokenAddress, chainId, toAddress, amount are required" }, { status: 400 })
  }

  try {
    const result = await generateAuthorization({
      userId: session.userId,
      tokenAddress,
      chainId: Number(chainId),
      from: session.walletAddress,
      to: toAddress,
      amount: amount.toString(),
      validityDuration,
    })

    const response = NextResponse.json({ success: true, ...result })
    return addSecurityHeaders(response)
  } catch (error) {
    console.error("[x402] generate-authorization error", error)
    return NextResponse.json({ error: "Failed to generate authorization" }, { status: 500 })
  }
}
