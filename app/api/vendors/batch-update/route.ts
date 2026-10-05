import { type NextRequest, NextResponse } from "next/server"
import { prisma, scopedTransaction } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"
import {
  validateAndChecksumAddress,
  sanitizeTextInput,
  createVendorIntegrityHash,
  createAuditLog,
} from "@/lib/security/security"

const MAX_BATCH_SIZE = 100

/**
 * PUT /api/vendors/batch-update
 * Batch update vendor names (only names, not addresses).
 * Address changes require individual signature confirmation.
 *
 * Identity comes from the verified session (withAuth) — never from the request
 * body — and the reads/writes run inside the caller's RLS context.
 */
export const PUT = withAuth(async (request: NextRequest, callerAddress: string) => {
  try {
    const body = await request.json()
    const { updates } = body as {
      updates: Array<{ id: string; name: string }>
    }

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: "updates array is required" }, { status: 400 })
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 })
    }

    if (updates.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` },
        { status: 400 },
      )
    }

    // The owner is the authenticated caller. Normalise to checksum form so the
    // created_by comparisons below stay case-insensitive-safe.
    const ownerValidation = validateAndChecksumAddress(callerAddress)
    if (!ownerValidation.valid) {
      return NextResponse.json(
        { error: `Invalid owner address: ${ownerValidation.error}` },
        { status: 400 },
      )
    }

    // Validate all updates have required fields
    for (const update of updates) {
      if (!update.id || !update.name) {
        return NextResponse.json(
          { error: "Each update must have id and name" },
          { status: 400 },
        )
      }
    }

    // Fetch all vendors in one query and verify ownership
    const vendorIds = updates.map((u) => u.id)
    const existingVendors = await prisma.vendor.findMany({
      where: { id: { in: vendorIds } },
    })

    // Verify all vendors exist
    if (existingVendors.length !== vendorIds.length) {
      const foundIds = new Set(existingVendors.map((v) => v.id))
      const missingIds = vendorIds.filter((id) => !foundIds.has(id))
      return NextResponse.json(
        { error: `Vendors not found: ${missingIds.join(", ")}` },
        { status: 404 },
      )
    }

    // Verify ownership for ALL vendors
    const unauthorizedVendors = existingVendors.filter(
      (v) => v.created_by?.toLowerCase() !== ownerValidation.checksummed!.toLowerCase(),
    )
    if (unauthorizedVendors.length > 0) {
      return NextResponse.json(
        { error: `Access denied: you do not own vendor(s) ${unauthorizedVendors.map((v) => v.name).join(", ")}` },
        { status: 403 },
      )
    }

    // Perform batch update inside the caller's RLS-scoped transaction.
    const updatedVendors = await scopedTransaction(async (tx) =>
      Promise.all(
        updates.map((update) => {
          const { sanitized: sanitizedName } = sanitizeTextInput(update.name)
          const existing = existingVendors.find((v) => v.id === update.id)!

          const integrityHash = createVendorIntegrityHash({
            id: update.id,
            name: sanitizedName,
            wallet_address: existing.wallet_address,
            created_by: existing.created_by!,
          })

          return tx.vendor.update({
            where: { id: update.id },
            data: {
              name: sanitizedName,
              integrity_hash: integrityHash,
            },
          })
        }),
      ),
    )

    // Single audit log for the batch
    const auditLog = createAuditLog({
      action: "VENDOR_UPDATED",
      actor: ownerValidation.checksummed!,
      details: {
        batch: true,
        count: updates.length,
        changes: updates.map((u) => {
          const existing = existingVendors.find((v) => v.id === u.id)
          return {
            id: u.id,
            previous_name: existing?.name,
            new_name: u.name,
          }
        }),
      },
    })
    console.log("[Audit]", auditLog)

    return NextResponse.json({
      success: true,
      updated: updatedVendors.length,
      vendors: updatedVendors,
    })
  } catch (error: any) {
    console.error("[Vendors API] Batch update error:", error)
    return NextResponse.json({ error: error.message || "Failed to batch update vendors" }, { status: 500 })
  }
}, { component: "vendors-batch-update" })
