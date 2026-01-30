import { type NextRequest, NextResponse } from "next/server"
import { PermissionService } from "@/lib/services/permission-service"
import type { PermissionAction, ResourceType } from "@/types/permission"

/**
 * POST /api/permissions/check
 * Check user permissions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, userAddress, resource, action, resourceId, checks } = body

    if (!organizationId || !userAddress) {
      return NextResponse.json(
        { error: "organizationId and userAddress required" },
        { status: 400 }
      )
    }

    // Single permission check
    if (resource && action) {
      const result = await PermissionService.checkPermission({
        organizationId,
        userAddress,
        resource: resource as ResourceType,
        action: action as PermissionAction,
        resourceId,
      })

      return NextResponse.json({
        success: true,
        ...result,
      })
    }

    // Batch permission check
    if (checks && Array.isArray(checks)) {
      const results = await PermissionService.checkPermissions(
        organizationId,
        userAddress,
        checks.map((c: any) => ({
          resource: c.resource as ResourceType,
          action: c.action as PermissionAction,
        }))
      )

      return NextResponse.json({
        success: true,
        permissions: results,
      })
    }

    return NextResponse.json(
      { error: "Either (resource + action) or checks array required" },
      { status: 400 }
    )
  } catch (error: any) {
    console.error("[Permissions] Check error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to check permissions" },
      { status: 500 }
    )
  }
}
