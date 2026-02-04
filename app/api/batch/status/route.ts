import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const jobId = searchParams.get('id');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing job ID' }, { status: 400 });
  }

  // Get job details using Prisma
  const job = await prisma.batchJob.findUnique({
    where: { id: jobId }
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    totalLines: job.total_lines,
    parsedCount: job.parsed_count,
    invalidCount: job.invalid_count,
    chunks: job.chunks,
    createdAt: job.created_at,
    error: job.error_message,
  });
}
