import { type NextRequest, NextResponse } from "next/server"
import { PermissionService } from "@/lib/services/permission-service"

/**
 * GET /api/organizations
 * Get user's organizations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userAddress = searchParams.get("userAddress")

    if (!userAddress) {
      return NextResponse.json(
        { error: "userAddress required" },
        { status: 400 }
      )
    }

    const organizations = await PermissionService.getUserOrganizations(userAddress)

    return NextResponse.json({
      success: true,
      organizations,
      count: organizations.length,
    })
  } catch (error: any) {
    console.error("[Organizations] Get error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get organizations" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/organizations
 * Create a new organization
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ownerAddress, name, slug, description, logo, settings } = body

    if (!ownerAddress) {
      return NextResponse.json(
        { error: "ownerAddress required" },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { error: "name required" },
        { status: 400 }
      )
    }

    const organization = await PermissionService.createOrganization(ownerAddress, {
      name,
      slug,
      description,
      logo,
      settings,
    })

    return NextResponse.json({
      success: true,
      organization,
    })
  } catch (error: any) {
    console.error("[Organizations] Create error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create organization" },
      { status: 500 }
    )
  }
}
