// Telegram binding for the authenticated wallet. A one-time code (15 min)
// generated here is redeemed with `/start <code>` in the bot's DM — the SIWE
// session that generated the code proves wallet ownership, so nobody can bind
// someone else's wallet. Once bound, the chat receives that account's trade
// notifications and can ask questions answered from that wallet's data only.
import { type NextRequest, NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"

const BOT_USERNAME = process.env.TG_BOT_USERNAME || "ProtocolTraderBot"
const CODE_TTL_MS = 15 * 60_000

export const GET = withAuth(async (_req: NextRequest, address: string) => {
  const row = await prisma.tradingAccount.findUnique({
    where: { wallet_address: address.toLowerCase() },
    select: { telegram_chat_id: true },
  })
  return NextResponse.json({ bound: !!row?.telegram_chat_id, chat_id: row?.telegram_chat_id ?? null })
})

export const POST = withAuth(async (_req: NextRequest, address: string) => {
  const code = randomBytes(6).toString("hex")
  const expires = new Date(Date.now() + CODE_TTL_MS)
  await prisma.tradingAccount.upsert({
    where: { wallet_address: address.toLowerCase() },
    create: { wallet_address: address.toLowerCase(), telegram_link_code: code, telegram_link_expires_at: expires },
    update: { telegram_link_code: code, telegram_link_expires_at: expires },
  })
  return NextResponse.json({
    url: `https://t.me/${BOT_USERNAME}?start=${code}`,
    code,
    expires_at: expires.toISOString(),
  })
})

export const DELETE = withAuth(async (_req: NextRequest, address: string) => {
  await prisma.tradingAccount.updateMany({
    where: { wallet_address: address.toLowerCase() },
    data: { telegram_chat_id: null, telegram_link_code: null, telegram_link_expires_at: null },
  })
  return NextResponse.json({ ok: true })
})
