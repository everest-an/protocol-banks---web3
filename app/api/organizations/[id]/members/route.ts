import { type NextRequest, NextResponse } from "next/server"
import { PermissionService } from "@/lib/services/permission-service"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/organizations/[id]/members
 * Get organization members
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const members = await PermissionService.getOrganizationMembers(id)

    return NextResponse.json({
      success: true,
      members,
      count: members.length,
    })
  } catch (error: any) {
    console.error("[Members] Get error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get members" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/organizations/[id]/members
 * Invite a new member
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { invitedBy, email, walletAddress, roleId } = body

    if (!invitedBy) {
      return NextResponse.json(
        { error: "invitedBy required" },
        { status: 400 }
      )
    }

    if (!email && !walletAddress) {
      return NextResponse.json(
        { error: "email or walletAddress required" },
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
      userAddress: invitedBy,
      resource: "member",
      action: "create",
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        { error: permCheck.reason || "Unauthorized" },
        { status: 403 }
      )
    }

    const invite = await PermissionService.inviteMember(id, invitedBy, {
      email,
      walletAddress,
      roleId,
    })

    return NextResponse.json({
      success: true,
      invite,
    })
  } catch (error: any) {
    console.error("[Members] Invite error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to invite member" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/organizations/[id]/members
 * Update member role or accept invite
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, memberId, roleId, inviteId, walletAddress, userAddress } = body

    if (!userAddress) {
      return NextResponse.json(
        { error: "userAddress required" },
        { status: 400 }
      )
    }

    switch (action) {
      case "updateRole": {
        if (!memberId || !roleId) {
          return NextResponse.json(
            { error: "memberId and roleId required" },
            { status: 400 }
          )
        }

        // Check permission
        const permCheck = await PermissionService.checkPermission({
          organizationId: id,
          userAddress,
          resource: "member",
          action: "edit",
        })

        if (!permCheck.allowed) {
          return NextResponse.json(
            { error: permCheck.reason || "Unauthorized" },
            { status: 403 }
          )
        }

        await PermissionService.updateMemberRole(memberId, roleId)

        return NextResponse.json({
          success: true,
          message: "Member role updated",
        })
      }

      case "acceptInvite": {
        if (!inviteId || !walletAddress) {
          return NextResponse.json(
            { error: "inviteId and walletAddress required" },
            { status: 400 }
          )
        }

        const member = await PermissionService.acceptInvite(inviteId, walletAddress)

        return NextResponse.json({
          success: true,
          member,
        })
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error("[Members] Update error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update member" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/organizations/[id]/members?memberId=xxx&userAddress=xxx
 * Remove a member
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get("memberId")
    const userAddress = searchParams.get("userAddress")

    if (!memberId) {
      return NextResponse.json(
        { error: "memberId required" },
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
      resource: "member",
      action: "delete",
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        { error: permCheck.reason || "Unauthorized" },
        { status: 403 }
      )
    }

    await PermissionService.removeMember(memberId)

    return NextResponse.json({
      success: true,
      message: "Member removed",
    })
  } catch (error: any) {
    console.error("[Members] Remove error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to remove member" },
      { status: 500 }
    )
  }
}
