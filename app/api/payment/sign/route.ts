import crypto from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"

export const dynamic = "force-dynamic"

export const POST = withAuth(async (request: NextRequest) => {
  const secret = process.env.PAYMENT_LINK_SECRET
  if (!secret) {
    return NextResponse.json({ error: "payment links are not configured" }, { status: 503 })
  }

  let body: { to?: unknown; amount?: unknown; token?: unknown; exp?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const to = typeof body.to === "string" ? body.to : ""
  const amount = typeof body.amount === "string" ? body.amount : String(body.amount ?? "")
  const token = typeof body.token === "string" ? body.token : ""
  const exp = typeof body.exp === "string" ? body.exp : String(body.exp ?? "")

  if (!to || !amount || !token || !exp || Number(amount) <= 0 || !Number.isFinite(Number(exp))) {
    return NextResponse.json({ error: "to, amount, token and exp are required" }, { status: 400 })
  }
  if (Number(exp) <= Date.now()) {
    return NextResponse.json({ error: "expiry must be in the future" }, { status: 400 })
  }

  const message = `${to}:${amount}:${token}:${exp}`
  const sig = crypto.createHmac("sha256", secret).update(message).digest("hex").slice(0, 16)
  return NextResponse.json({ sig, exp })
}, { component: "payment-sign" })
