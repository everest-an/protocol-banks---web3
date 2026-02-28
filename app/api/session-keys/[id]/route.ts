/**
 * Session Key Detail API
 * GET /api/session-keys/[id] - Get a specific session key
 * PATCH /api/session-keys/[id] - Update session key (activate/deactivate)
 * DELETE /api/session-keys/[id] - Delete/revoke a session key
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - Get specific session key
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(async (req, walletAddress) => {
    try {
      const { id } = await params

      // Fetch session key
      const sessionKey = await prisma.sessionKey.findFirst({
        where: {
          id,
          owner_address: walletAddress.toLowerCase(),
        },
      })

      if (!sessionKey) {
        return NextResponse.json({ success: false, error: "Session key not found" }, { status: 404 })
      }

      // Return safe response
      return NextResponse.json({
        success: true,
        sessionKey: {
          id: sessionKey.id,
          owner_address: sessionKey.owner_address,
          session_key_address: sessionKey.session_address,
          chain_id: sessionKey.chain_id,
          spending_limit: sessionKey.spending_limit,
          spent_amount: sessionKey.amount_spent,
          allowed_tokens: sessionKey.allowed_tokens,
          expires_at: sessionKey.expires_at,
          is_active: sessionKey.is_active,
          created_at: sessionKey.created_at,
          last_used_at: sessionKey.last_used_at,
        },
      })
    } catch (error) {
      console.error("[SessionKeys] Error:", error)
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      )
    }
  }, { component: 'session-keys-id' })(request);
}

// PATCH - Update session key (toggle active status)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAuth(async (req, walletAddress) => {
    try {
      const { id } = await params

      // Verify ownership first
      const existing = await prisma.sessionKey.findFirst({
        where: {
          id,
          owner_address: walletAddress.toLowerCase(),
        },
      })

      if (!existing) {
        return NextResponse.json({ success: false, error: "Session key not found or update failed" }, { status: 404 })
      }

      // Parse request body
      const body = await req.json()

      // Build update object
      const updateData: Record<string, any> = {}

      if (typeof body.is_active === "boolean") {
        updateData.is_active = body.is_active
      }

      if (body.spending_limit) {
        updateData.spending_limit = body.spending_limit
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 })
      }

      // Update session key
      const sessionKey = await prisma.sessionKey.update({
        where: { id },
        data: updateData,
      })

      return NextResponse.json({
        success: true,
        sessionKey: {
          id: sessionKey.id,
          owner_address: sessionKey.owner_address,
          session_key_address: sessionKey.session_address,
          chain_id: sessionKey.chain_id,
          spending_limit: sessionKey.spending_limit,
          spent_amount: sessionKey.amount_spent,
          allowed_tokens: sessionKey.allowed_tokens,
          expires_at: sessionKey.expires_at,
          is_active: sessionKey.is_active,
          created_at: sessionKey.created_at,
          last_used_at: sessionKey.last_used_at,
        },
      })
    } catch (error) {
      console.error("[SessionKeys] Error:", error)
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      )
    }
  }, { component: 'session-keys-id' })(request);
}

// DELETE - Revoke/delete session key
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(async (req, walletAddress) => {
    try {
      const { id } = await params

      // Verify ownership first
      const existing = await prisma.sessionKey.findFirst({
        where: {
          id,
          owner_address: walletAddress.toLowerCase(),
        },
      })

      if (!existing) {
        return NextResponse.json({ success: false, error: "Session key not found" }, { status: 404 })
      }

      // Delete session key
      await prisma.sessionKey.delete({
        where: { id },
      })

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[SessionKeys] Error:", error)
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      )
    }
  }, { component: 'session-keys-id' })(request);
}
