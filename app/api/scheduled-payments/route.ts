import { NextRequest, NextResponse } from 'next/server';
import { scheduledPaymentService } from '@/lib/services/scheduled-payment-service';
import type { ScheduleType } from '@/types/scheduled-payment';
import { withAuth } from '@/lib/middleware/api-auth';

/**
 * GET /api/scheduled-payments
 * List all scheduled payments for the user
 */
export const GET = withAuth(async (request: NextRequest, userAddress: string) => {
  try {
    const payments = await scheduledPaymentService.list(userAddress);

    return NextResponse.json({ payments });
  } catch (error: any) {
    console.error('[API] Failed to list scheduled payments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list scheduled payments' },
      { status: 500 }
    );
  }
}, { component: 'scheduled-payments' })

/**
 * POST /api/scheduled-payments
 * Create a new scheduled payment
 */
export const POST = withAuth(async (request: NextRequest, userAddress: string) => {
  try {
    const body = await request.json();
    const {
      name,
      recipients,
      total_amount,
      token = 'USDT',
      chain_id = 42161,
      schedule_type,
      schedule_config,
      team_id,
    } = body;

    // Validation
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!recipients || recipients.length === 0) {
      return NextResponse.json(
        { error: 'At least one recipient is required' },
        { status: 400 }
      );
    }

    if (!total_amount || total_amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid total amount' },
        { status: 400 }
      );
    }

    const validScheduleTypes: ScheduleType[] = ['daily', 'weekly', 'bi-weekly', 'monthly'];
    if (!validScheduleTypes.includes(schedule_type)) {
      return NextResponse.json(
        { error: 'Invalid schedule type. Must be: daily, weekly, bi-weekly, or monthly' },
        { status: 400 }
      );
    }

    const payment = await scheduledPaymentService.create(userAddress, {
      name,
      recipients,
      total_amount: total_amount.toString(),
      token,
      chain_id,
      schedule_type,
      schedule_config: schedule_config || {},
      team_id,
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error: any) {
    console.error('[API] Failed to create scheduled payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create scheduled payment' },
      { status: 500 }
    );
  }
}, { component: 'scheduled-payments' })
