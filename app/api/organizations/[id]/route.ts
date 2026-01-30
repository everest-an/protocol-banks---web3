import { type NextRequest, NextResponse } from "next/server"
import { PermissionService } from "@/lib/services/permission-service"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/organizations/[id]
 * Get organization details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const organization = await PermissionService.getOrganization(id)

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    // Get roles and member count
    const roles = await PermissionService.getOrganizationRoles(id)
    const members = await PermissionService.getOrganizationMembers(id)

    return NextResponse.json({
      success: true,
      organization,
      roles,
      memberCount: members.length,
    })
  } catch (error: any) {
    console.error("[Organizations] Get details error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get organization" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/organizations/[id]
 * Update organization settings
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { settings, userAddress } = body

    if (!userAddress) {
      return NextResponse.json(
        { error: "userAddress required" },
        { status: 400 }
      )
    }

    // Verify user is owner
    const org = await PermissionService.getOrganization(id)
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    if (org.ownerAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      )
    }

    if (settings) {
      await PermissionService.updateOrganizationSettings(id, settings)
    }

    const updated = await PermissionService.getOrganization(id)

    return NextResponse.json({
      success: true,
      organization: updated,
    })
  } catch (error: any) {
    console.error("[Organizations] Update error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update organization" },
      { status: 500 }
    )
  }
}
