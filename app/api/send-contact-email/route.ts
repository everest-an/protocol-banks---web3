import { NextResponse } from "next/server"
import { Resend } from "resend"
import { sanitizeTextInput, checkRateLimit } from "@/lib/security"

// Lazy initialize Resend to avoid build-time errors when API key is not set
let resend: Resend | null = null
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

const INPUT_LIMITS = {
  name: 100,
  email: 254,
  subject: 200,
  message: 5000,
}

async function verifyRecaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY

  if (!secretKey || !token) {
    return true
  }

  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `secret=${secretKey}&response=${token}`,
    })

    const data = await response.json()
    return data.success && (!data.score || data.score >= 0.3)
  } catch (error) {
    return true
  }
}

export async function POST(request: Request) {
  try {
    const clientIP = request.headers.get("x-forwarded-for") || "unknown"
    const rateCheck = checkRateLimit({
      identifier: `contact:${clientIP}`,
      maxRequests: 5,
      windowMs: 60 * 1000, // 5 requests per minute
    })

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: "Too many requests. Please try again later.",
        },
        { status: 429 },
      )
    }

    const body = await request.json()
    const { name, email, subject, message, recaptchaToken } = body

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        {
          success: false,
          message: "All fields are required.",
        },
        { status: 400 },
      )
    }

    if (
      name.length > INPUT_LIMITS.name ||
      email.length > INPUT_LIMITS.email ||
      subject.length > INPUT_LIMITS.subject ||
      message.length > INPUT_LIMITS.message
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Input exceeds maximum length.",
        },
        { status: 400 },
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email format.",
        },
        { status: 400 },
      )
    }

    const { sanitized: sanitizedName, warnings: nameWarnings } = sanitizeTextInput(name)
    const { sanitized: sanitizedSubject, warnings: subjectWarnings } = sanitizeTextInput(subject)
    const { sanitized: sanitizedMessage, warnings: messageWarnings } = sanitizeTextInput(message)

    const allWarnings = [...nameWarnings, ...subjectWarnings, ...messageWarnings]
    if (allWarnings.length > 0) {
      console.warn("[Security] Suspicious input detected in contact form:", {
        ip: clientIP,
        warnings: allWarnings,
      })
    }

    const isHuman = await verifyRecaptcha(recaptchaToken)

    if (!isHuman) {
      return NextResponse.json(
        {
          success: false,
          message: "Verification failed. Please try again.",
        },
        { status: 403 },
      )
    }

    const resendClient = getResend()

    if (!resendClient) {
      return NextResponse.json(
        {
          success: false,
          message: "Email service not configured. Please contact support.",
        },
        { status: 500 },
      )
    }

    const { data, error } = await resendClient.emails.send({
      from: "Protocol Banks <contact@e.protocolbanks.com>",
      to: ["everest9812@gmail.com"],
      subject: `Contact Form: ${sanitizedSubject}`,
      replyTo: email,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .field { margin-bottom: 20px; }
              .label { font-weight: bold; color: #667eea; margin-bottom: 5px; }
              .value { background: white; padding: 10px; border-radius: 4px; border-left: 3px solid #667eea; }
              .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2 style="margin: 0;">New Contact Form Submission</h2>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Protocol Banks</p>
              </div>
              <div class="content">
                <div class="field">
                  <div class="label">From:</div>
                  <div class="value">${sanitizedName}</div>
                </div>
                <div class="field">
                  <div class="label">Email:</div>
                  <div class="value">${email}</div>
                </div>
                <div class="field">
                  <div class="label">Subject:</div>
                  <div class="value">${sanitizedSubject}</div>
                </div>
                <div class="field">
                  <div class="label">Message:</div>
                  <div class="value">${sanitizedMessage.replace(/\n/g, "<br>")}</div>
                </div>
                <div class="footer">
                  <p>This email was sent from the Protocol Banks contact form.</p>
                  <p>Reply to this email to respond directly to ${sanitizedName}.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    })

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: "Failed to send email. Please try again.",
        },
        { status: 500 },
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: "Message sent successfully! We'll get back to you soon.",
      },
      { status: 200 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred. Please try again.",
      },
      { status: 500 },
    )
  }
}
