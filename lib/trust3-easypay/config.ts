import crypto from "crypto"
import type { NextRequest } from "next/server"

export type Trust3EasypayConfig = {
  pid: string
  pkey: string
  merchantId: string
  cnyPerUsd: number
  notifyUrl: string
}

export function getTrust3EasypayConfig(): Trust3EasypayConfig {
  return {
    pid: process.env.TRUST3_EASYPAY_PID || "trust3",
    pkey: process.env.TRUST3_EASYPAY_PKEY || "",
    merchantId: process.env.TRUST3_MERCHANT_ID || "",
    cnyPerUsd: Number(process.env.TRUST3_CNY_PER_USD || "7.2"),
    notifyUrl:
      process.env.TRUST3_EASYPAY_NOTIFY_URL ||
      "https://api.trust3.pro/api/v1/payment/webhook/easypay",
  }
}

export function getAppBaseUrl(request: NextRequest): string {
  const origin = request.nextUrl.origin
  if (/^https?:\/\//i.test(origin)) return origin.replace(/\/+$/, "")
  let url = process.env.NEXT_PUBLIC_APP_URL || "https://www.protocolbanks.com"
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  return url.replace(/\/+$/, "")
}

export function easypaySign(params: Record<string, string>, pkey: string): string {
  const keys = Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type" && params[key] !== "")
    .sort()
  const payload = keys.map((key) => `${key}=${params[key]}`).join("&") + pkey
  return crypto.createHash("md5").update(payload).digest("hex")
}

export function verifyEasypaySign(params: Record<string, string>, pkey: string): boolean {
  const supplied = params.sign || ""
  const expected = easypaySign(params, pkey)
  if (!supplied || supplied.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
}

export function parseParams(request: NextRequest, body?: string): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [key, value] of request.nextUrl.searchParams.entries()) params[key] = value
  if (body) {
    for (const [key, value] of new URLSearchParams(body).entries()) params[key] = value
  }
  return params
}

export function parseCnyToUsd(cnyRaw: string, cnyPerUsd: number): { cny: number; usd: number } {
  const cny = Number.parseFloat(cnyRaw)
  if (!Number.isFinite(cny) || cny <= 0) throw new Error("Invalid amount")
  if (!Number.isFinite(cnyPerUsd) || cnyPerUsd <= 0) throw new Error("Invalid exchange rate")
  const usd = Math.round((cny / cnyPerUsd) * 100) / 100
  if (!Number.isFinite(usd) || usd < 0.01) throw new Error("Amount is below the USDC minimum")
  return { cny, usd }
}

export function isTrust3NotifyUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === "https:" && (url.hostname === "trust3.pro" || url.hostname.endsWith(".trust3.pro"))
  } catch {
    return false
  }
}
