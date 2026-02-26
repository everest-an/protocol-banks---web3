/**
 * Single Vendor Address API
 * Manages a specific address for a vendor
 */

import { NextRequest, NextResponse } from "next/server"
import {
  updateVendorAddress,
  deleteVendorAddress,
} from "@/lib/services/vendor-multi-network.service"
import { getAuthenticatedAddress } from "@/lib/api-auth"

/**
 * PATCH /api/vendors/:id/addresses/:addressId
 * Update a vendor address
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  const { id, addressId } = await params
  try {
    const ownerAddress = await getAuthenticatedAddress(req)

    if (!ownerAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { label, isPrimary } = body

    const updatedAddress = await updateVendorAddress(
      addressId,
      ownerAddress,
      {
        label: label?.trim(),
        isPrimary,
      }
    )

    return NextResponse.json({
      address: updatedAddress,
      message: "Address updated successfully",
    })
  } catch (error: any) {
    console.error(
      `[API] PATCH /api/vendors/${id}/addresses/${addressId} error:`,
      error
    )

    if (error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: error.message || "Failed to update address" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/vendors/:id/addresses/:addressId
 * Delete a vendor address
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  const { id, addressId } = await params
  try {
    const ownerAddress = await getAuthenticatedAddress(req)

    if (!ownerAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await deleteVendorAddress(addressId, ownerAddress)

    return NextResponse.json({
      message: "Address deleted successfully",
    })
  } catch (error: any) {
    console.error(
      `[API] DELETE /api/vendors/${id}/addresses/${addressId} error:`,
      error
    )

    if (error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    if (error.message.includes("Cannot delete the last address")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: error.message || "Failed to delete address" },
      { status: 500 }
    )
  }
}
