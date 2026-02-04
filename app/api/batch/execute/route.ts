import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/batch/execute
 * Trigger execution for a parsed batch job
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {}
        }
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { jobId } = await request.json()
    if (!jobId) {
      return NextResponse.json({ error: "Job ID required" }, { status: 400 })
    }

    // 1. Fetch Job (Prisma)
    const job = await prisma.batchJob.findFirst({
      where: {
        id: jobId,
        user_id: user.id
      }
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    if (job.status !== 'PENDING_APPROVAL') {
      return NextResponse.json({ error: `Job is not in approval state (Current: ${job.status})` }, { status: 400 })
    }

    // 2. Fetch Chunks
    const chunks = await prisma.batchChunk.findMany({
      where: { job_id: jobId },
      orderBy: { chunk_index: 'asc' }
    })

    if (!chunks.length) {
      return NextResponse.json({ error: "No chunks found for this job" }, { status: 500 })
    }

    // 3. Mark for Execution (Cron or downstream system will pick up)
    // We update status to 'APPROVED'. A separate Cron or the Go Payout Engine 
    // should poll for APPROVED jobs and move them to PROCESSING.
    
    // For Vercel-only demo: We just simulate marking it.
    // In production, your Go Engine watches this table.
    
    /*
    // Previous Redis Code (Removed)
    for (const chunk of chunks) {
      await batchQueue.addToExecuteQueue(...)
    }
    */

    // 4. Update Job Status to APPROVED
    await prisma.batchJob.update({
      where: { id: jobId },
      data: { status: 'APPROVED' } // Ready for Payout Engine
    })

    return NextResponse.json({ 
      success: true, 
      message: `Job ${jobId} approved for execution (${chunks.length} chunks)` 
    })

  } catch (error: any) {
    console.error("Batch execute error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
