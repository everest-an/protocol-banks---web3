import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { promises as fs } from 'fs';
import { parseBatchFile } from '@/lib/services/file-parser.service';
import { validateBatch } from '@/lib/services/batch-validator.service';
import { verifyCronAuth } from '@/lib/cron-auth';

// Vercel Cron Job to process batch files
// Replaces the background worker for Serverless environment

// Increase duration for processing
export const maxDuration = 60; // 60 seconds (Pro plan limit usually, optimize chunking if needed)
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  try {
    // 1. Find ONE queued job (FIFO)
    const job = await prisma.batchJob.findFirst({
      where: { status: 'QUEUED' },
      orderBy: { created_at: 'asc' }
    });

    if (!job) {
      return NextResponse.json({ message: 'No jobs in queue' }, { status: 200 });
    }

    console.log(`[CRON] Processing Job: ${job.id}`);

    // Update status to PARSING to lock it
    await prisma.batchJob.update({
        where: { id: job.id },
        data: { status: 'PARSING' }
    });

    // 2. Download File from local filesystem
    if (!job.file_url) throw new Error("File URL missing");

    let nodeBuffer: Buffer;
    try {
      nodeBuffer = await fs.readFile(job.file_url);
    } catch (readError: any) {
      throw new Error(`File read failed: ${readError.message}`);
    }
    
    // Determine file type from extension or job metadata
    // We didn't save extension in DB strictly, but file_url usually has it
    const fileExt = job.file_url.split('.').pop() || 'csv';
    
    const parsedData = await parseBatchFile(nodeBuffer as any, fileExt);

    if (!parsedData.success) {
        throw new Error(`Parsing failed: ${parsedData.errors.join(', ')}`);
    }

    const validation = validateBatch(parsedData.data as any[]);
    const validItems = validation.validItems;

    // 4. Update Stats
    await prisma.batchJob.update({
        where: { id: job.id },
        data: {
            total_lines: parsedData.data.length,
            parsed_count: validItems.length,
            invalid_count: validation.errors.length,
        }
    });

    if (validItems.length === 0) {
        throw new Error('No valid rows found after parsing');
    }

    // 5. Create Chunks (Batch Insert)
    const CHUNK_SIZE = 100;
    const chunks = [];
    
    for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
        const chunkData = validItems.slice(i, i + CHUNK_SIZE);
        chunks.push({
            job_id: job.id,
            chunk_index: Math.floor(i / CHUNK_SIZE),
            recipient_count: chunkData.length,
            status: 'PENDING',
            data: chunkData as any
        });
    }

    await prisma.batchChunk.createMany({
        data: chunks
    });

    // 6. Finish
    await prisma.batchJob.update({
        where: { id: job.id },
        data: { 
            status: 'PENDING_APPROVAL',
            chunks: chunks.length 
        }
    });

    return NextResponse.json({ 
        success: true, 
        jobId: job.id, 
        chunks: chunks.length 
    });

  } catch (error: any) {
    console.error("[CRON] Job Failed:", error);
    // Try to update job status if we have a job context (would require scoping)
    // For simplicity, simple logging. In production, we'd recover the job ID to mark FAILED.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
