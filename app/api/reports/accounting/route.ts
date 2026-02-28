import { NextRequest, NextResponse } from 'next/server';
import { exportService } from '@/lib/services/export-service';
import type { ExportFormat } from '@/lib/services/export-service';
import { withAuth } from '@/lib/middleware/api-auth';

/**
 * GET /api/reports/accounting
 * Generate accounting report
 * Query params:
 *   - start: Start date (ISO string)
 *   - end: End date (ISO string)
 *   - format: Export format (json, csv, xlsx)
 *   - include_pending: Include pending transactions (true/false)
 */
export const GET = withAuth(async (request: NextRequest, userAddress: string) => {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const format = (searchParams.get('format') || 'json') as ExportFormat | 'json';
    const includePending = searchParams.get('include_pending') === 'true';

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (start > end) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // Generate report
    const report = await exportService.generateAccountingReport({
      owner_address: userAddress,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      include_pending: includePending,
    });

    // Return based on format
    switch (format) {
      case 'csv': {
        const csv = exportService.exportToCSV(report);
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="accounting-report-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}.csv"`,
          },
        });
      }

      case 'xlsx': {
        const blob = await exportService.exportToExcel(report);
        const buffer = await blob.arrayBuffer();
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="accounting-report-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}.xlsx"`,
          },
        });
      }

      case 'json':
      default:
        return NextResponse.json({ report });
    }
  } catch (error: any) {
    console.error('[API] Failed to generate accounting report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate accounting report' },
      { status: 500 }
    );
  }
}, { component: 'reports-accounting' })

/**
 * POST /api/reports/accounting
 * Generate accounting report with more options
 */
export const POST = withAuth(async (request: NextRequest, userAddress: string) => {
  try {
    const body = await request.json();
    const {
      start_date,
      end_date,
      format = 'json',
      include_pending = false,
      categories,
      tokens,
    } = body;

    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: 'start_date and end_date are required' },
        { status: 400 }
      );
    }

    const start = new Date(start_date);
    const end = new Date(end_date);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Generate report
    const report = await exportService.generateAccountingReport({
      owner_address: userAddress,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      include_pending,
      categories,
      tokens,
    });

    // Return based on format
    switch (format) {
      case 'csv': {
        const csv = exportService.exportToCSV(report);
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="accounting-report.csv"`,
          },
        });
      }

      case 'xlsx': {
        const blob = await exportService.exportToExcel(report);
        const buffer = await blob.arrayBuffer();
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="accounting-report.xlsx"`,
          },
        });
      }

      case 'json':
      default:
        return NextResponse.json({ report });
    }
  } catch (error: any) {
    console.error('[API] Failed to generate accounting report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate accounting report' },
      { status: 500 }
    );
  }
}, { component: 'reports-accounting' })
