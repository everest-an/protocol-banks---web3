import { NextResponse } from "next/server"
import { Resend } from "resend"
import { sanitizeTextInput, checkRateLimit } from "@/lib/security/security"
import fs from "fs"
import path from "path"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const SUPPORT_EMAIL = "everest9812@gmail.com"

const INPUT_LIMITS = {
  message: 5000,
  page: 300,
  error: 2000,
  walletAddress: 100,
}

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

/**
 * POST /api/support/report
 *
 * User issue reporting — every report is emailed to the founder's inbox
 * and appended to a local log. Rate-limited and sanitized; unauthenticated
 * by design so users can always reach support, even when broken.
 */
export async function POST(request: Request) {
  try {
    const clientIP = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"

    const rateCheck = checkRateLimit({
      identifier: `support-report:${clientIP}`,
      maxRequests: 10,
      windowMs: 60 * 1000,
    })
    if (!rateCheck.allowed) {
      return NextResponse.json({ success: false, message: "Too many reports. Please slow down." }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 })

    const { message, page, error, walletAddress } = body as {
      message?: string
      page?: string
      error?: string
      walletAddress?: string
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ success: false, message: "Please describe the issue." }, { status: 400 })
    }

    for (const [key, limit] of Object.entries(INPUT_LIMITS)) {
      const value = (body as Record<string, unknown>)[key]
      if (typeof value === "string" && value.length > limit) {
        return NextResponse.json({ success: false, message: "Input exceeds maximum length." }, { status: 400 })
      }
    }

    // Sanitize all user-provided text
    const { sanitized: safeMessage } = sanitizeTextInput(message)
    const { sanitized: safePage } = sanitizeTextInput((page ?? "unknown").slice(0, INPUT_LIMITS.page))
    const { sanitized: safeError } = sanitizeTextInput((error ?? "").slice(0, INPUT_LIMITS.error))
    const safeWallet =
      walletAddress && WALLET_RE.test(walletAddress) ? walletAddress.toLowerCase() : "not connected"

    // Local log backup (survives email outages)
    try {
      const logDir = process.env.TRADING_STATE_DIR || path.join(process.cwd(), ".data", "support")
      fs.mkdirSync(logDir, { recursive: true })
      fs.appendFileSync(
        path.join(logDir, "issues.jsonl"),
        JSON.stringify({
          at: new Date().toISOString(),
          page: safePage,
          wallet: safeWallet,
          message: safeMessage,
          error: safeError,
          ip: clientIP,
        }) + "\n",
        "utf-8",
      )
    } catch (logErr) {
      console.warn("[support] local log failed:", logErr)
    }

    // Email the founder
    if (resend) {
      try {
        await resend.emails.send({
          from: "Protocol Banks <noreply@e.protocolbanks.com>",
          to: [SUPPORT_EMAIL],
          subject: `[User Issue] ${safePage} — ${safeMessage.slice(0, 80)}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333">
              <h2 style="margin:0 0 16px">User Issue Report</h2>
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr><td style="padding:8px;font-weight:bold;color:#667eea;width:120px">Page</td><td style="padding:8px">${safePage}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;color:#667eea">Wallet</td><td style="padding:8px;font-family:monospace">${safeWallet}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;color:#667eea">Message</td><td style="padding:8px">${safeMessage.replace(/\n/g, "<br>")}</td></tr>
                ${
                  safeError
                    ? `<tr><td style="padding:8px;font-weight:bold;color:#667eea">Error</td><td style="padding:8px;font-family:monospace;font-size:12px;background:#f9fafb;border-radius:4px">${safeError}</td></tr>`
                    : ""
                }
                <tr><td style="padding:8px;font-weight:bold;color:#667eea">IP</td><td style="padding:8px;color:#6b7280">${clientIP}</td></tr>
              </table>
              <p style="margin-top:20px;color:#6b7280;font-size:12px">Sent automatically by the Protocol Banks issue reporter.</p>
            </div>
          `,
        })
      } catch (emailErr) {
        console.error("[support] email send failed:", emailErr)
      }
    }

    return NextResponse.json({ success: true, message: "Report submitted. Thank you!" })
  } catch (e) {
    console.error("[support] report failed:", e)
    return NextResponse.json({ success: false, message: "Something went wrong. Please try again." }, { status: 500 })
  }
}
