import { NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

async function verifyRecaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY

  if (!secretKey || !token) {
    return true // Allow submission if reCAPTCHA not configured
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
    return true // Allow submission on verification error
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, subject, message, recaptchaToken } = body

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

    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Email service not configured. Please contact support.",
        },
        { status: 500 },
      )
    }

    const { data, error } = await resend.emails.send({
      from: "Protocol Banks <contact@e.protocolbanks.com>",
      to: ["everest9812@gmail.com"],
      subject: `Contact Form: ${subject}`,
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
                  <div class="value">${name}</div>
                </div>
                <div class="field">
                  <div class="label">Email:</div>
                  <div class="value">${email}</div>
                </div>
                <div class="field">
                  <div class="label">Subject:</div>
                  <div class="value">${subject}</div>
                </div>
                <div class="field">
                  <div class="label">Message:</div>
                  <div class="value">${message.replace(/\n/g, "<br>")}</div>
                </div>
                <div class="footer">
                  <p>This email was sent from the Protocol Banks contact form.</p>
                  <p>Reply to this email to respond directly to ${name}.</p>
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
