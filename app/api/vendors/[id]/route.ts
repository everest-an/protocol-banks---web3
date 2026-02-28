import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ethers } from "ethers"
import {
  validateAndChecksumAddress,
  sanitizeTextInput,
  createVendorIntegrityHash,
  createAuditLog,
} from "@/lib/security/security"
import { withAuth } from "@/lib/middleware/api-auth"

const ADDRESS_CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * GET /api/vendors/[id]?owner=0x...
 * Get a single vendor by ID with ownership check
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (req, authenticatedAddress) => {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const ownerParam = searchParams.get("owner")

    // If specific owner param provided, it must match
    if (ownerParam && ownerParam.toLowerCase() !== authenticatedAddress.toLowerCase()) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const owner = authenticatedAddress;

    const ownerValidation = validateAndChecksumAddress(owner)
    if (!ownerValidation.valid) {
      return NextResponse.json({ error: ownerValidation.error }, { status: 400 })
    }

    try {
      const vendor = await prisma.vendor.findFirst({
        where: {
          id,
          OR: [
            { created_by: { equals: ownerValidation.checksummed!, mode: "insensitive" } },
            { owner_address: { equals: ownerValidation.checksummed!, mode: "insensitive" } },
          ],
        },
      })

      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found or access denied" }, { status: 404 })
      }

      return NextResponse.json({ vendor })
    } catch (error) {
      console.error("[Vendors API] GET by ID error:", error)
      return NextResponse.json({ error: "Failed to fetch vendor" }, { status: 500 })
    }
  }, { component: 'vendors-id' })(request);
}

/**
 * PUT /api/vendors/[id]
 * Update vendor with ownership check, address change detection,
 * signature verification, and cooldown enforcement
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (req, authenticatedAddress) => {
    const { id } = await params

    try {
      const body = await req.json()
      const { owner_address: ownerAddrFromBody, address_change_signature, address_change_message, ...updates } = body

      // Use authenticated address as the owner
      const ownerAddr = authenticatedAddress;

      if (ownerAddrFromBody && ownerAddrFromBody.toLowerCase() !== authenticatedAddress.toLowerCase()) {
           return NextResponse.json({ error: "Forbidden: You cannot update another user's vendor" }, { status: 403 })
      }

      const ownerValidation = validateAndChecksumAddress(ownerAddr)
      if (!ownerValidation.valid) {
        return NextResponse.json({ error: `Invalid owner address: ${ownerValidation.error}` }, { status: 400 })
      }

      // Fetch existing vendor and verify ownership
      const existing = await prisma.vendor.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
      }

      if (existing.created_by?.toLowerCase() !== ownerValidation.checksummed!.toLowerCase()) {
        console.warn(`[Security] Unauthorized vendor update attempt: ${ownerAddr} tried to update vendor ${id} owned by ${existing.created_by}`)
        return NextResponse.json({ error: "Access denied: you are not the owner" }, { status: 403 })
      }

      // Detect address change
      const isAddressChange =
        updates.wallet_address &&
        updates.wallet_address.toLowerCase() !== existing.wallet_address.toLowerCase()

      if (isAddressChange) {
        // Validate new address
        const newAddrValidation = validateAndChecksumAddress(updates.wallet_address)
        if (!newAddrValidation.valid) {
          return NextResponse.json({ error: `Invalid new address: ${newAddrValidation.error}` }, { status: 400 })
        }
        updates.wallet_address = newAddrValidation.checksummed!

        // P1: Check cooldown
        if (existing.address_changed_at) {
          const timeSinceLastChange = Date.now() - new Date(existing.address_changed_at).getTime()
          if (timeSinceLastChange < ADDRESS_CHANGE_COOLDOWN_MS) {
            const remainingHours = Math.ceil((ADDRESS_CHANGE_COOLDOWN_MS - timeSinceLastChange) / (1000 * 60 * 60))
            return NextResponse.json(
              {
                error: `Address change cooldown active. ${remainingHours} hours remaining.`,
                cooldown_expires_at: new Date(
                  new Date(existing.address_changed_at).getTime() + ADDRESS_CHANGE_COOLDOWN_MS,
                ).toISOString(),
              },
              { status: 429 },
            )
          }
        }

        // P1: Verify wallet signature for address changes
        if (!address_change_signature || !address_change_message) {
          return NextResponse.json(
            { error: "Wallet signature is required to change vendor address" },
            { status: 400 },
          )
        }

        try {
          const recoveredAddress = ethers.verifyMessage(address_change_message, address_change_signature)
          if (recoveredAddress.toLowerCase() !== ownerValidation.checksummed!.toLowerCase()) {
            return NextResponse.json(
              { error: "Invalid signature - address change rejected" },
              { status: 403 },
            )
          }

          // Verify message content matches actual change
          const msgLower = address_change_message.toLowerCase()
          if (
            !msgLower.includes(existing.wallet_address.toLowerCase()) ||
            !msgLower.includes(updates.wallet_address.toLowerCase())
          ) {
            return NextResponse.json(
              { error: "Signature message does not match the requested change" },
              { status: 400 },
            )
          }
        } catch {
          return NextResponse.json({ error: "Signature verification failed" }, { status: 400 })
        }
      }

      // Sanitize text inputs
      const sanitizedUpdates: Record<string, any> = {}
      if (updates.name) {
        const { sanitized } = sanitizeTextInput(updates.name)
        sanitizedUpdates.name = sanitized
      }
      if (updates.notes !== undefined) {
        const { sanitized } = sanitizeTextInput(updates.notes || "")
        sanitizedUpdates.notes = sanitized || null
      }

      // Pass through safe fields
      const safeFields = ["ens_name", "email", "category", "tier", "chain", "contact_email", "contact_name", "company_name"]
      for (const field of safeFields) {
        if (updates[field] !== undefined) {
          sanitizedUpdates[field] = updates[field] || null
        }
      }

      if (updates.wallet_address) {
        sanitizedUpdates.wallet_address = updates.wallet_address
      }

      // Set address change tracking fields
      if (isAddressChange) {
        sanitizedUpdates.address_changed_at = new Date()
        sanitizedUpdates.address_change_signature = address_change_signature
      }

      // Recompute integrity hash
      const updatedName = sanitizedUpdates.name || existing.name
      const updatedAddress = sanitizedUpdates.wallet_address || existing.wallet_address
      sanitizedUpdates.integrity_hash = createVendorIntegrityHash({
        id: existing.id,
        name: updatedName,
        wallet_address: updatedAddress,
        created_by: existing.created_by!,
      })

      // Perform update
      const vendor = await prisma.vendor.update({
        where: { id },
        data: sanitizedUpdates,
      })

      // Audit log
      const auditLog = createAuditLog({
        action: isAddressChange ? "ADDRESS_CHANGED" : "VENDOR_UPDATED",
        actor: ownerValidation.checksummed!,
        target: id,
        details: {
          changes: sanitizedUpdates,
          ...(isAddressChange
            ? { previous_address: existing.wallet_address, new_address: updates.wallet_address }
            : {}),
        },
      })
      console.log("[Audit]", auditLog)

      // Trigger notification for address changes
      if (isAddressChange) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://protocol-banks.vercel.app"
          await fetch(`${baseUrl}/api/notifications/vendor-address-change`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ownerAddress: ownerValidation.checksummed!,
              ownerEmail: existing.email || existing.contact_email,
              vendorName: vendor.name,
              vendorId: vendor.id,
              previousAddress: existing.wallet_address,
              newAddress: vendor.wallet_address,
              changedBy: ownerValidation.checksummed!,
            }),
          })
        } catch (notifError) {
          console.error("[Vendors API] Failed to send address change notification:", notifError)
          // Don't fail the update if notification fails
        }
      }

      return NextResponse.json({ vendor })
    } catch (error: any) {
      console.error("[Vendors API] PUT error:", error)
      return NextResponse.json({ error: error.message || "Failed to update vendor" }, { status: 500 })
    }
  }, { component: 'vendors-id' })(request);
}

/**
 * DELETE /api/vendors/[id]
 * Delete vendor with ownership check and audit logging
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (req, authenticatedAddress) => {
    const { id } = await params
    const owner = authenticatedAddress;

    const ownerValidation = validateAndChecksumAddress(owner)
    if (!ownerValidation.valid) {
      return NextResponse.json({ error: ownerValidation.error }, { status: 400 })
    }

    try {
      // Verify ownership before deletion
      const existing = await prisma.vendor.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
      }

      if (existing.created_by?.toLowerCase() !== ownerValidation.checksummed!.toLowerCase()) {
        return NextResponse.json({ error: "Access denied: you are not the owner" }, { status: 403 })
      }

      await prisma.vendor.delete({ where: { id } })

      // Audit log
      const auditLog = createAuditLog({
        action: "VENDOR_DELETED",
        actor: ownerValidation.checksummed!,
        target: id,
        details: {
          name: existing.name,
          wallet_address: existing.wallet_address,
        },
      })
      console.log("[Audit]", auditLog)

      return NextResponse.json({ success: true })
    } catch (error: any) {
      console.error("[Vendors API] DELETE error:", error)
      return NextResponse.json({ error: error.message || "Failed to delete vendor" }, { status: 500 })
    }
  }, { component: 'vendors-id' })(request);
}
