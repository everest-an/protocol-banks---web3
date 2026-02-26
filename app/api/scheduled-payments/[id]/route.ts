import { NextRequest, NextResponse } from 'next/server';
import { scheduledPaymentService } from '@/lib/services/scheduled-payment-service';
import type { ScheduleType } from '@/types/scheduled-payment';
import { getAuthenticatedAddress } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/scheduled-payments/[id]
 * Get a specific scheduled payment
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userAddress = await getAuthenticatedAddress(request);

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 401 }
      );
    }

    const payment = await scheduledPaymentService.get(id);

    if (!payment) {
      return NextResponse.json(
        { error: 'Scheduled payment not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (payment.owner_address.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get logs
    const logs = await scheduledPaymentService.getLogs(id, 10);

    return NextResponse.json({ payment, logs });
  } catch (error: any) {
    console.error('[API] Failed to get scheduled payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get scheduled payment' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/scheduled-payments/[id]
 * Update a scheduled payment
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userAddress = await getAuthenticatedAddress(request);

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 401 }
      );
    }

    // Verify ownership
    const existing = await scheduledPaymentService.get(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Scheduled payment not found' },
        { status: 404 }
      );
    }

    if (existing.owner_address.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, recipients, total_amount, token, schedule_type, schedule_config } = body;

    // Validate schedule_type if provided
    if (schedule_type) {
      const validScheduleTypes: ScheduleType[] = ['daily', 'weekly', 'bi-weekly', 'monthly'];
      if (!validScheduleTypes.includes(schedule_type)) {
        return NextResponse.json(
          { error: 'Invalid schedule type' },
          { status: 400 }
        );
      }
    }

    const payment = await scheduledPaymentService.update(id, {
      name,
      recipients,
      total_amount: total_amount?.toString(),
      token,
      schedule_type,
      schedule_config,
    });

    return NextResponse.json({ payment });
  } catch (error: any) {
    console.error('[API] Failed to update scheduled payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update scheduled payment' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/scheduled-payments/[id]
 * Update status (pause/resume/cancel)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userAddress = await getAuthenticatedAddress(request);

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 401 }
      );
    }

    // Verify ownership
    const existing = await scheduledPaymentService.get(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Scheduled payment not found' },
        { status: 404 }
      );
    }

    if (existing.owner_address.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    let payment;
    switch (action) {
      case 'pause':
        payment = await scheduledPaymentService.pause(id);
        break;
      case 'resume':
        payment = await scheduledPaymentService.resume(id);
        break;
      case 'cancel':
        payment = await scheduledPaymentService.cancel(id);
        break;
      case 'execute':
        // Manual execution
        const result = await scheduledPaymentService.executePayment(id);
        return NextResponse.json({ result });
      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: pause, resume, cancel, or execute' },
          { status: 400 }
        );
    }

    return NextResponse.json({ payment });
  } catch (error: any) {
    console.error('[API] Failed to update scheduled payment status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update scheduled payment status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scheduled-payments/[id]
 * Delete a scheduled payment
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userAddress = await getAuthenticatedAddress(request);

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 401 }
      );
    }

    // Verify ownership
    const existing = await scheduledPaymentService.get(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Scheduled payment not found' },
        { status: 404 }
      );
    }

    if (existing.owner_address.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    await scheduledPaymentService.delete(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Failed to delete scheduled payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete scheduled payment' },
      { status: 500 }
    );
  }
}
