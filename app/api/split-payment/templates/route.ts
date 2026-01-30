import { type NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import type { SplitTemplate, AllocationMethod } from "@/types/split-payment"

/**
 * POST /api/split-payment/templates
 * Create a new split payment template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, method, recipients, defaultToken, ownerAddress } = body

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Template name required" },
        { status: 400 }
      )
    }

    if (!ownerAddress) {
      return NextResponse.json(
        { error: "ownerAddress required" },
        { status: 400 }
      )
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: "recipients array required" },
        { status: 400 }
      )
    }

    if (!method || !["percentage", "fixed"].includes(method)) {
      return NextResponse.json(
        { error: "method must be 'percentage' or 'fixed'" },
        { status: 400 }
      )
    }

    // Validate percentage total for percentage method
    if (method === "percentage") {
      const total = recipients.reduce(
        (sum: number, r: any) => sum + Number(r.allocation || r.percentage || 0),
        0
      )
      if (Math.abs(total - 100) > 0.01) {
        return NextResponse.json(
          { error: `Percentage total must be 100%, got ${total}%` },
          { status: 400 }
        )
      }
    }

    const supabase = getSupabase()
    const templateId = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const templateRecipients = recipients.map((r: any) => ({
      address: r.address,
      allocation: Number(r.allocation || r.percentage || r.amount),
      name: r.name,
      memo: r.memo,
    }))

    const { data: template, error } = await supabase
      .from("split_templates")
      .insert({
        id: templateId,
        name: name.trim(),
        description: description?.trim() || null,
        method: method as AllocationMethod,
        recipients: templateRecipients,
        default_token: defaultToken || "USDC",
        created_by: ownerAddress.toLowerCase(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        usage_count: 0,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error("[SplitTemplate] Create error:", error)
      return NextResponse.json(
        { error: "Failed to create template" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      template,
      message: `Template "${name}" created successfully`,
    })
  } catch (error: any) {
    console.error("[SplitTemplate] Create error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create template" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/split-payment/templates?ownerAddress=xxx or ?templateId=xxx
 * Get split payment templates
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get("templateId")
    const ownerAddress = searchParams.get("ownerAddress")
    const includeInactive = searchParams.get("includeInactive") === "true"

    const supabase = getSupabase()

    if (templateId) {
      // Get specific template
      const { data: template, error } = await supabase
        .from("split_templates")
        .select("*")
        .eq("id", templateId)
        .single()

      if (error || !template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        )
      }

      return NextResponse.json({ template })
    }

    if (ownerAddress) {
      // Get all templates for owner
      let query = supabase
        .from("split_templates")
        .select("*")
        .eq("created_by", ownerAddress.toLowerCase())
        .order("usage_count", { ascending: false })

      if (!includeInactive) {
        query = query.eq("is_active", true)
      }

      const { data: templates, error } = await query.limit(100)

      if (error) {
        console.error("[SplitTemplate] Query error:", error)
        return NextResponse.json({ templates: [] })
      }

      return NextResponse.json({ templates: templates || [] })
    }

    return NextResponse.json(
      { error: "templateId or ownerAddress required" },
      { status: 400 }
    )
  } catch (error: any) {
    console.error("[SplitTemplate] Get error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PATCH /api/split-payment/templates
 * Update a split payment template
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { templateId, ownerAddress, name, description, recipients, isActive } = body

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId required" },
        { status: 400 }
      )
    }

    if (!ownerAddress) {
      return NextResponse.json(
        { error: "ownerAddress required" },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from("split_templates")
      .select("*")
      .eq("id", templateId)
      .eq("created_by", ownerAddress.toLowerCase())
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Template not found or access denied" },
        { status: 404 }
      )
    }

    // Build update object
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updates.name = name.trim()
    if (description !== undefined) updates.description = description?.trim() || null
    if (isActive !== undefined) updates.is_active = isActive
    if (recipients !== undefined) {
      updates.recipients = recipients.map((r: any) => ({
        address: r.address,
        allocation: Number(r.allocation || r.percentage || r.amount),
        name: r.name,
        memo: r.memo,
      }))
    }

    const { data: template, error } = await supabase
      .from("split_templates")
      .update(updates)
      .eq("id", templateId)
      .select()
      .single()

    if (error) {
      console.error("[SplitTemplate] Update error:", error)
      return NextResponse.json(
        { error: "Failed to update template" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      template,
      message: "Template updated successfully",
    })
  } catch (error: any) {
    console.error("[SplitTemplate] Update error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update template" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/split-payment/templates
 * Delete a split payment template (soft delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get("templateId")
    const ownerAddress = searchParams.get("ownerAddress")

    if (!templateId || !ownerAddress) {
      return NextResponse.json(
        { error: "templateId and ownerAddress required" },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from("split_templates")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", templateId)
      .eq("created_by", ownerAddress.toLowerCase())

    if (error) {
      console.error("[SplitTemplate] Delete error:", error)
      return NextResponse.json(
        { error: "Failed to delete template" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Template deleted successfully",
    })
  } catch (error: any) {
    console.error("[SplitTemplate] Delete error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete template" },
      { status: 500 }
    )
  }
}
