import { type NextRequest, NextResponse } from "next/server"
import { PermissionService } from "@/lib/services/permission-service"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/organizations/[id]/approvals
 * Get pending approvals
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userAddress = searchParams.get("userAddress")

    const approvals = await PermissionService.getPendingApprovals(
      id,
      userAddress || undefined
    )

    return NextResponse.json({
      success: true,
      approvals,
      count: approvals.length,
    })
  } catch (error: any) {
    console.error("[Approvals] Get error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get approvals" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/organizations/[id]/approvals
 * Create approval request or process approval
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, userAddress } = body

    if (!userAddress) {
      return NextResponse.json(
        { error: "userAddress required" },
        { status: 400 }
      )
    }

    switch (action) {
      case "create": {
        const { ruleId, resourceType, resourceId, metadata } = body

        if (!ruleId || !resourceType || !resourceId) {
          return NextResponse.json(
            { error: "ruleId, resourceType, and resourceId required" },
            { status: 400 }
          )
        }

        const request = await PermissionService.createApprovalRequest(
          id,
          ruleId,
          resourceType,
          resourceId,
          userAddress,
          metadata
        )

        return NextResponse.json({
          success: true,
          request,
        })
      }

      case "approve":
      case "reject": {
        const { requestId, comment } = body

        if (!requestId) {
          return NextResponse.json(
            { error: "requestId required" },
            { status: 400 }
          )
        }

        const updated = await PermissionService.processApproval(
          requestId,
          userAddress,
          action,
          comment
        )

        return NextResponse.json({
          success: true,
          request: updated,
          message: action === "approve" ? "Approved" : "Rejected",
        })
      }

      default:
        return NextResponse.json(
          { error: "action must be 'create', 'approve', or 'reject'" },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error("[Approvals] Process error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process approval" },
      { status: 500 }
    )
  }
}
