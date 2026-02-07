/**
 * Multi-Network Vendor API
 * Handles CRUD operations for vendors with multi-network address support
 */

import { NextRequest, NextResponse } from "next/server"
import {
  createVendorWithAddresses,
  listVendorsWithAddresses,
} from "@/lib/services/vendor-multi-network.service"
import { validateAddress } from "@/lib/address-utils"

/**
 * GET /api/vendors/multi-network
 * List all vendors with their network addresses
 */
export async function GET(req: NextRequest) {
  try {
    // Get user address from headers or auth
    const ownerAddress = req.headers.get("x-user-address")

    if (!ownerAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const vendors = await listVendorsWithAddresses(ownerAddress)

    return NextResponse.json({
      vendors,
      count: vendors.length,
    })
  } catch (error: any) {
    console.error("[API] GET /api/vendors/multi-network error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch vendors" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/vendors/multi-network
 * Create a new vendor with multi-network addresses
 */
export async function POST(req: NextRequest) {
  try {
    const ownerAddress = req.headers.get("x-user-address")

    if (!ownerAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, addresses, companyName, email, category, tags } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { error: "At least one address is required" },
        { status: 400 }
      )
    }

    // Validate all addresses
    for (const addr of addresses) {
      if (!addr.network || !addr.address) {
        return NextResponse.json(
          { error: "Each address must have network and address fields" },
          { status: 400 }
        )
      }

      const validation = validateAddress(addr.address)
      if (!validation.isValid) {
        return NextResponse.json(
          { error: `Invalid address for ${addr.network}: ${validation.error}` },
          { status: 400 }
        )
      }
    }

    // Create vendor
    const vendor = await createVendorWithAddresses({
      name: name.trim(),
      ownerAddress,
      addresses,
      companyName: companyName?.trim(),
      email: email?.trim(),
      category: category?.trim(),
      tags: tags || [],
    })

    return NextResponse.json({
      vendor,
      message: "Vendor created successfully",
    }, { status: 201 })
  } catch (error: any) {
    console.error("[API] POST /api/vendors/multi-network error:", error)

    if (error.message.includes("Invalid address")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: error.message || "Failed to create vendor" },
      { status: 500 }
    )
  }
}
