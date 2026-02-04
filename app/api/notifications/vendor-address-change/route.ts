/**
 * Vendor Address Change Notification Endpoint
 * POST /api/notifications/vendor-address-change
 *
 * Sends email + push notification when a vendor's wallet address is changed.
 */

import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

interface AddressChangeNotificationRequest {
  ownerAddress: string
  ownerEmail?: string
  vendorName: string
  vendorId: string
  previousAddress: string
  newAddress: string
  changedBy: string
}

function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function buildAddressChangeEmail(data: AddressChangeNotificationRequest): string {
  const timestamp = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #dc2626; padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 20px;">Vendor Address Changed</h1>
    </div>
    <div style="padding: 24px;">
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="color: #dc2626; font-weight: 600; margin: 0 0 4px 0;">Security Alert</p>
        <p style="color: #7f1d1d; margin: 0; font-size: 14px;">
          A vendor wallet address in your contact list was modified. If you did not make this change, please review immediately.
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">Vendor</td>
          <td style="padding: 10px 0; font-weight: 600; border-bottom: 1px solid #eee;">${data.vendorName}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">Previous Address</td>
          <td style="padding: 10px 0; font-family: monospace; border-bottom: 1px solid #eee; color: #dc2626;">
            ${data.previousAddress}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">New Address</td>
          <td style="padding: 10px 0; font-family: monospace; border-bottom: 1px solid #eee; color: #16a34a;">
            ${data.newAddress}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">Changed By</td>
          <td style="padding: 10px 0; font-family: monospace; border-bottom: 1px solid #eee;">
            ${formatAddress(data.changedBy)}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #666;">Time</td>
          <td style="padding: 10px 0;">${timestamp}</td>
        </tr>
      </table>

      <div style="margin-top: 24px; padding: 16px; background: #f9fafb; border-radius: 8px;">
        <p style="margin: 0; font-size: 12px; color: #666;">
          A 24-hour cooldown is now active. The address cannot be changed again during this period.
          Any payments to this vendor will show a warning badge until the cooldown expires.
        </p>
      </div>
    </div>
    <div style="padding: 16px 24px; background: #f9fafb; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #999;">Protocol Banks - Enterprise Crypto Payment Platform</p>
    </div>
  </div>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  try {
    const body: AddressChangeNotificationRequest = await request.json()
    const { ownerEmail, vendorName, previousAddress, newAddress, changedBy } = body

    if (!vendorName || !previousAddress || !newAddress || !changedBy) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Send email if Resend is configured and owner has an email
    if (resend && ownerEmail) {
      try {
        const html = buildAddressChangeEmail(body)
        await resend.emails.send({
          from: "Protocol Banks <notifications@e.protocolbanks.com>",
          to: ownerEmail,
          subject: `Security Alert: Vendor "${vendorName}" Address Changed`,
          html,
        })
        console.log(`[Notification] Address change email sent for vendor "${vendorName}" to ${ownerEmail}`)
      } catch (emailError) {
        console.error("[Notification] Failed to send address change email:", emailError)
      }
    } else if (!resend) {
      console.log("[Notification] Resend not configured, skipping email. Data:", {
        vendorName,
        previousAddress: formatAddress(previousAddress),
        newAddress: formatAddress(newAddress),
      })
    }

    // Send push notification
    try {
      const { NotificationService } = await import("@/lib/services/notification-service")
      const notificationService = new NotificationService()
      await notificationService.send(body.ownerAddress.toLowerCase(), "vendor_address_changed" as any, {
        title: "Vendor Address Changed",
        body: `${vendorName}: address changed from ${formatAddress(previousAddress)} to ${formatAddress(newAddress)}`,
        tag: "vendor-address-changed",
        data: {
          type: "vendor_address_changed",
          vendorName,
          previousAddress,
          newAddress,
          changedBy,
        },
      })
    } catch (pushError) {
      console.error("[Notification] Failed to send push notification:", pushError)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Notification] vendor-address-change error:", error)
    return NextResponse.json({ error: error.message || "Failed to send notification" }, { status: 500 })
  }
}
