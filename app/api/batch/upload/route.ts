import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"
import { writeFile, mkdir } from "fs/promises"
import { tmpdir } from "os"
import path from "path"

/**
 * POST /api/batch/upload
 * Async batch file upload endpoint
 * - Saves file to local filesystem
 * - Creates Prisma Record (QUEUED)
 * - Vercel Cron will pick it up
 */
export const POST = withAuth(async (request: NextRequest, walletAddress: string) => {
  try {
    // Handle File Upload
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 })
    }

    const fileExt = file.name.split(".").pop()
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

    // Save file to local filesystem
    const uploadDir = path.join(tmpdir(), "batch-files", walletAddress.toLowerCase())
    await mkdir(uploadDir, { recursive: true })

    const filePath = path.join(uploadDir, fileName)
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, fileBuffer)

    // Create Job Record (Prisma)
    // Status "QUEUED" allows the Cron to pick it up automatically
    const job = await prisma.batchJob.create({
      data: {
        user_id: walletAddress.toLowerCase(),
        status: "QUEUED",
        file_url: filePath,
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
}, { component: 'batch-upload' })
