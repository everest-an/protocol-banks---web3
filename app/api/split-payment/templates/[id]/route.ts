import { NextRequest, NextResponse } from 'next/server';
import { splitPaymentService } from '@/lib/services/split-payment-service';
import { validateSplitRecipients } from '@/types/split-payment';
import { getAuthenticatedAddress } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/split-payment/templates/[id]
 * Get a specific template
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

    const template = await splitPaymentService.getTemplate(id);

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (template.owner_address.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({ template });
  } catch (error: any) {
    console.error('[API] Failed to get template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get template' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/split-payment/templates/[id]
 * Update a template
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
    const existing = await splitPaymentService.getTemplate(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found' },
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
    const { name, description, recipients, is_active } = body;

    // Validate recipients if provided
    if (recipients) {
      const validation = validateSplitRecipients(recipients);
      if (!validation.is_valid) {
        return NextResponse.json(
          { error: validation.errors[0] || 'Invalid recipients' },
          { status: 400 }
        );
      }
    }

    const template = await splitPaymentService.updateTemplate(id, userAddress, {
      name,
      description,
      recipients,
      is_active,
    });

    return NextResponse.json({ template });
  } catch (error: any) {
    console.error('[API] Failed to update template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/split-payment/templates/[id]
 * Delete a template
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
    const existing = await splitPaymentService.getTemplate(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    if (existing.owner_address.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    await splitPaymentService.deleteTemplate(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Failed to delete template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    );
  }
}
