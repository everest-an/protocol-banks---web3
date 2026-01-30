import { type NextRequest, NextResponse } from "next/server"
import { PermissionService } from "@/lib/services/permission-service"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/organizations/[id]/roles
 * Get organization roles
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const roles = await PermissionService.getOrganizationRoles(id)

    return NextResponse.json({
      success: true,
      roles,
      count: roles.length,
    })
  } catch (error: any) {
    console.error("[Roles] Get error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get roles" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/organizations/[id]/roles
 * Create a new role
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { userAddress, name, description, type, permissions } = body

    if (!userAddress) {
      return NextResponse.json(
        { error: "userAddress required" },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { error: "name required" },
        { status: 400 }
      )
    }

    // Check permission
    const permCheck = await PermissionService.checkPermission({
      organizationId: id,
      userAddress,
      resource: "role",
      action: "create",
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        { error: permCheck.reason || "Unauthorized" },
        { status: 403 }
      )
    }

    const role = await PermissionService.createRole(id, {
      name,
      description,
      type: type || "custom",
      permissions,
    })

    return NextResponse.json({
      success: true,
      role,
    })
  } catch (error: any) {
    console.error("[Roles] Create error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create role" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/organizations/[id]/roles
 * Update role permissions
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { userAddress, roleId, permissions } = body

    if (!userAddress) {
      return NextResponse.json(
        { error: "userAddress required" },
        { status: 400 }
      )
    }

    if (!roleId) {
      return NextResponse.json(
        { error: "roleId required" },
        { status: 400 }
      )
    }

    // Check permission
    const permCheck = await PermissionService.checkPermission({
      organizationId: id,
      userAddress,
      resource: "role",
      action: "edit",
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        { error: permCheck.reason || "Unauthorized" },
        { status: 403 }
      )
    }

    await PermissionService.updateRolePermissions(roleId, permissions)

    return NextResponse.json({
      success: true,
      message: "Role updated",
    })
  } catch (error: any) {
    console.error("[Roles] Update error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update role" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/organizations/[id]/roles?roleId=xxx&userAddress=xxx
 * Delete a role
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const roleId = searchParams.get("roleId")
    const userAddress = searchParams.get("userAddress")

    if (!roleId) {
      return NextResponse.json(
        { error: "roleId required" },
        { status: 400 }
      )
    }

    if (!userAddress) {
      return NextResponse.json(
        { error: "userAddress required" },
        { status: 400 }
      )
    }

    // Check permission
    const permCheck = await PermissionService.checkPermission({
      organizationId: id,
      userAddress,
      resource: "role",
      action: "delete",
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        { error: permCheck.reason || "Unauthorized" },
        { status: 403 }
      )
    }

    await PermissionService.deleteRole(roleId)

    return NextResponse.json({
      success: true,
      message: "Role deleted",
    })
  } catch (error: any) {
    console.error("[Roles] Delete error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete role" },
      { status: 500 }
    )
  }
}
