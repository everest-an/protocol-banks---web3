import { NextRequest, NextResponse } from 'next/server';
import { splitPaymentService } from '@/lib/services/split-payment-service';
import { validateSplitRecipients } from '@/types/split-payment';
import { getAuthenticatedAddress } from '@/lib/api-auth';

/**
 * POST /api/split-payment
 * Execute a split payment
 */
export async function POST(request: NextRequest) {
  try {
    const userAddress = await getAuthenticatedAddress(request);

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { total_amount, recipients, token = 'USDT', chain_id = 42161, template_id, team_id } = body;

    if (!total_amount || total_amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid total amount' },
        { status: 400 }
      );
    }

    if (!recipients || recipients.length === 0) {
      return NextResponse.json(
        { error: 'At least one recipient is required' },
        { status: 400 }
      );
    }

    // Validate recipients (percentages must equal 100%)
    const validation = validateSplitRecipients(recipients);
    if (!validation.is_valid) {
      return NextResponse.json(
        { error: validation.errors[0] || 'Invalid recipients' },
        { status: 400 }
      );
    }

    const execution = await splitPaymentService.createSplitExecution({
      owner_address: userAddress,
      template_id,
      team_id,
      total_amount: total_amount.toString(),
      token,
      chain_id,
      recipients,
    });

    return NextResponse.json({ execution }, { status: 201 });
  } catch (error: any) {
    console.error('[API] Failed to execute split payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute split payment' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/split-payment
 * Get split payment history
 */
export async function GET(request: NextRequest) {
  try {
    const userAddress = await getAuthenticatedAddress(request);

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const executions = await splitPaymentService.getExecutionHistory(userAddress, { limit });

    return NextResponse.json({ executions });
  } catch (error: any) {
    console.error('[API] Failed to get split payment history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get split payment history' },
      { status: 500 }
    );
  }
}
