import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/batch/upload
 * Async batch file upload endpoint
 * - Uploads to Storage
 * - Creates Prisma Record (QUEUED)
 * - Vercel Cron will pick it up
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Auth Check (Using Supabase Auth Cookies for verification)
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {},
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Handle File Upload
    const formData = await request.formData()
    const file = formData.get("file") as File
    
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 })
    }

    const fileExt = file.name.split(".").pop()
    const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

    // 3. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from("batch-files")
      .upload(fileName, file)

    if (uploadError) {
      console.error("Upload failed:", uploadError)
      return NextResponse.json({ error: "Failed to store file" }, { status: 500 })
    }

    // 4. Create Job Record (Prisma)
    // Status "QUEUED" allows the Cron to pick it up automatically
    const job = await prisma.batchJob.create({
      data: {
        user_id: user.id,
        status: "QUEUED", 
        file_url: uploadData.path,
        total_lines: 0
      }
    })

    // No Redis push needed! Vercel Cron checks DB every minute.

    return NextResponse.json({ 
      jobId: job.id, 
      status: "queued", 
      message: "File uploaded. Processing will start shortly." 
    })

  } catch (error: any) {
    console.error("Upload API Error:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
