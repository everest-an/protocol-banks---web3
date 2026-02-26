import { NextRequest, NextResponse } from 'next/server';
import { splitPaymentService } from '@/lib/services/split-payment-service';
import { validateSplitRecipients } from '@/types/split-payment';
import { getAuthenticatedAddress } from '@/lib/api-auth';

/**
 * GET /api/split-payment/templates
 * List all split payment templates
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

    const templates = await splitPaymentService.listTemplates(userAddress);

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('[API] Failed to list templates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/split-payment/templates
 * Create a new split payment template
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
    const { name, description, recipients, team_id } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    if (!recipients || recipients.length === 0) {
      return NextResponse.json(
        { error: 'At least one recipient is required' },
        { status: 400 }
      );
    }

    // Validate recipients
    const validation = validateSplitRecipients(recipients);
    if (!validation.is_valid) {
      return NextResponse.json(
        { error: validation.errors[0] || 'Invalid recipients' },
        { status: 400 }
      );
    }

    const template = await splitPaymentService.createTemplate(userAddress, {
      name,
      description,
      recipients,
      team_id,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error: any) {
    console.error('[API] Failed to create template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    );
  }
}
