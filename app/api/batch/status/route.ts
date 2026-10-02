import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware/api-auth';

/**
 * GET /api/batch/status?id=...
 *
 * Returns the state of a batch import job — for its owner.
 *
 * This endpoint was public and looked the job up by id alone, so any caller
 * (authenticated or not) who had an id could read another user's job: status,
 * line counts, chunk breakdown and error text.
 */
export const GET = withAuth(async (req, callerAddress) => {
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

  if (job.user_id.toLowerCase() !== callerAddress.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
}, { component: 'batch-status' });
