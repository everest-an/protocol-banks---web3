/**
 * Vendor Addresses API
 * Manages network addresses for a specific vendor
 */

import { NextRequest, NextResponse } from "next/server"
import {
  addVendorAddress,
  getVendorWithAddresses,
} from "@/lib/services/vendor-multi-network.service"
import { validateAddress } from "@/lib/address-utils"

/**
 * GET /api/vendors/:id/addresses
 * Get all addresses for a vendor
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerAddress = req.headers.get("x-user-address")

    if (!ownerAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const vendor = await getVendorWithAddresses(params.id, ownerAddress)

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
    }

    return NextResponse.json({
      addresses: vendor.addresses,
      count: vendor.addresses.length,
    })
  } catch (error: any) {
    console.error(`[API] GET /api/vendors/${params.id}/addresses error:`, error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch addresses" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/vendors/:id/addresses
 * Add a new network address to a vendor
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerAddress = req.headers.get("x-user-address")

    if (!ownerAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { network, address, label, isPrimary } = body

    // Validation
    if (!network || !network.trim()) {
      return NextResponse.json({ error: "Network is required" }, { status: 400 })
    }

    if (!address || !address.trim()) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 })
    }

    // Validate address format
    const validation = validateAddress(address.trim())
    if (!validation.isValid) {
      return NextResponse.json(
        { error: `Invalid address: ${validation.error}` },
        { status: 400 }
      )
    }

    // Add address
    const newAddress = await addVendorAddress(params.id, ownerAddress, {
      network: network.trim().toLowerCase(),
      address: validation.checksumAddress!,
      label: label?.trim(),
      isPrimary: isPrimary || false,
    })

    return NextResponse.json({
      address: newAddress,
      message: "Address added successfully",
    }, { status: 201 })
  } catch (error: any) {
    console.error(`[API] POST /api/vendors/${params.id}/addresses error:`, error)

    if (error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    if (error.message.includes("already exists")) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    return NextResponse.json(
      { error: error.message || "Failed to add address" },
      { status: 500 }
    )
  }
}
