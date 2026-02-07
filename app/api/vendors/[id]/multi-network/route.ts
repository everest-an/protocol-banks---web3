/**
 * Single Vendor Multi-Network API
 * Handles operations for a specific vendor with multi-network support
 */

import { NextRequest, NextResponse } from "next/server"
import { getVendorWithAddresses } from "@/lib/services/vendor-multi-network.service"

/**
 * GET /api/vendors/:id/multi-network
 * Get a vendor with all network addresses
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const ownerAddress = req.headers.get("x-user-address")

    if (!ownerAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const vendor = await getVendorWithAddresses(id, ownerAddress)

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
    }

    return NextResponse.json({ vendor })
  } catch (error: any) {
    console.error(`[API] GET /api/vendors/${id}/multi-network error:`, error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch vendor" },
      { status: 500 }
    )
  }
}
