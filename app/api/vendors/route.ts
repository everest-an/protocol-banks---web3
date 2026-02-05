import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  validateAndChecksumAddress,
  sanitizeTextInput,
  createVendorIntegrityHash,
  verifyVendorIntegrity,
  createAuditLog,
} from "@/lib/security/security"
import { getAuthenticatedAddress } from "@/lib/api-auth"

/**
 * GET /api/vendors?owner=0x...
 * List vendors by owner with integrity verification
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ownerParam = searchParams.get("owner")
  
  // Security: Enforce authentication
  const authenticatedAddress = await getAuthenticatedAddress(request);
  
  // If no auth, deny access. (Or allow strictly public data if designed, but here we want isolation)
  if (!authenticatedAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // If a specific owner is requested, it MUST match the authenticated user
  if (ownerParam) {
    const ownerValidation = validateAndChecksumAddress(ownerParam)
    if (!ownerValidation.valid || ownerValidation.checksummed?.toLowerCase() !== authenticatedAddress.toLowerCase()) {
       return NextResponse.json({ error: "Forbidden: You can only access your own vendors" }, { status: 403 })
    }
  }

  // Use the authenticated address as the source of truth
  const owner = authenticatedAddress

  const ownerValidation = validateAndChecksumAddress(owner)
  if (!ownerValidation.valid) {
    return NextResponse.json({ error: ownerValidation.error }, { status: 400 })
  }

  try {
    const vendors = await prisma.vendor.findMany({
      where: {
        OR: [
          { created_by: { equals: ownerValidation.checksummed!, mode: "insensitive" } },
          { owner_address: { equals: ownerValidation.checksummed!, mode: "insensitive" } },
        ],
      },
      include: { payments: { select: { id: true, amount: true, status: true }, take: 0 } },
      orderBy: { updated_at: "desc" },
    })

    // Verify integrity for each vendor
    const vendorsWithIntegrity = vendors.map((vendor) => {
      let integrity_verified: boolean | null = null
      if (vendor.integrity_hash && vendor.created_by) {
        integrity_verified = verifyVendorIntegrity(
          {
            id: vendor.id,
            name: vendor.name,
            wallet_address: vendor.wallet_address,
            created_by: vendor.created_by,
          },
          vendor.integrity_hash,
        )
        if (!integrity_verified) {
          console.warn(`[Security] Integrity mismatch for vendor ${vendor.id} (${vendor.name})`)
        }
      }
      return { ...vendor, integrity_verified }
    })

    return NextResponse.json({ vendors: vendorsWithIntegrity })
  } catch (error) {
    console.error("[Vendors API] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch vendors" }, { status: 500 })
  }
}

/**
 * POST /api/vendors
 * Create a new vendor with validation, sanitization, and integrity hash
 */
export async function POST(request: NextRequest) {
  try {
    const callerAddress = await getAuthenticatedAddress(request);
    if (!callerAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json()
    const {
      name,
      wallet_address,
      ens_name,
      email,
      notes,
      category,
      tier,
      chain,
      created_by,
    } = body

    if (!name || !wallet_address) {
      return NextResponse.json(
        { error: "name and wallet_address are required" },
        { status: 400 },
      )
    }

    // Security: Enforce creator is the authenticated caller
    const creatorValidation = validateAndChecksumAddress(callerAddress)
    
    // Check if body.created_by matches (optional validation, but we override it)
    if (created_by && created_by.toLowerCase() !== callerAddress.toLowerCase()) {
        return NextResponse.json({ error: "Forbidden: Cannot create vendor for another user" }, { status: 403 })
    }

    if (!creatorValidation.valid) {
      return NextResponse.json({ error: `Invalid creator address: ${creatorValidation.error}` }, { status: 400 })
    }

    const addressValidation = validateAndChecksumAddress(wallet_address)
    if (!addressValidation.valid) {
      return NextResponse.json({ error: `Invalid wallet address: ${addressValidation.error}` }, { status: 400 })
    }

    // Sanitize text inputs
    const { sanitized: sanitizedName, warnings: nameWarnings } = sanitizeTextInput(name)
    const { sanitized: sanitizedNotes } = notes ? sanitizeTextInput(notes) : { sanitized: null }

    if (nameWarnings.length > 0) {
      console.warn("[Vendors API] Name sanitization warnings:", nameWarnings)
    }

    // Create vendor with Prisma
    const vendor = await prisma.vendor.create({
      data: {
        name: sanitizedName,
        wallet_address: addressValidation.checksummed!,
        owner_address: creatorValidation.checksummed!,
        ens_name: ens_name || null,
        email: email || null,
        notes: sanitizedNotes,
        category: category || null,
        tier: tier || "vendor",
        chain: chain || "Ethereum",
        created_by: creatorValidation.checksummed!,
        integrity_hash: "", // Will be set after we have the ID
      },
    })

    // Generate deterministic integrity hash with the ID
    const integrityHash = createVendorIntegrityHash({
      id: vendor.id,
      name: vendor.name,
      wallet_address: vendor.wallet_address,
      created_by: vendor.created_by!,
    })

    // Update with the hash
    const updatedVendor = await prisma.vendor.update({
      where: { id: vendor.id },
      data: { integrity_hash: integrityHash },
    })

    // Audit log
    const auditLog = createAuditLog({
      action: "VENDOR_CREATED",
      actor: creatorValidation.checksummed!,
      target: vendor.id,
      details: {
        name: vendor.name,
        wallet_address: vendor.wallet_address,
        integrity_hash: integrityHash,
      },
    })
    console.log("[Audit]", auditLog)

    return NextResponse.json({ vendor: updatedVendor }, { status: 201 })
  } catch (error: any) {
    console.error("[Vendors API] POST error:", error)
    return NextResponse.json({ error: error.message || "Failed to create vendor" }, { status: 500 })
  }
}
