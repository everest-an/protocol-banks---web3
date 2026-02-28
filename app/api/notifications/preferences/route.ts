/**
 * Notification Preferences Endpoint
 * GET /api/notifications/preferences - Get notification preferences
 * PUT /api/notifications/preferences - Update notification preferences
 */

import { type NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/services/notification-service';
import { withAuth } from '@/lib/middleware/api-auth';

const notificationService = new NotificationService();

export const GET = withAuth(async (request: NextRequest, userAddress: string) => {
  try {
    const preferences = await notificationService.getPreferences(userAddress);

    return NextResponse.json({
      success: true,
      preferences,
    });

  } catch (error: any) {
    console.error('[Notifications] Get preferences error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to get preferences' },
      { status: 500 }
    );
  }
}, { component: 'notifications-preferences' });

export const PUT = withAuth(async (request: NextRequest, userAddress: string) => {
  try {
    const body = await request.json();
    const validKeys = [
      'payment_received',
      'payment_sent',
      'subscription_reminder',
      'subscription_payment',
      'multisig_proposal',
      'multisig_executed',
    ];

    const updates: Record<string, boolean> = {};
    for (const key of validKeys) {
      if (typeof body[key] === 'boolean') {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'No valid preference updates provided' },
        { status: 400 }
      );
    }

    const preferences = await notificationService.updatePreferences(userAddress, updates);

    return NextResponse.json({
      success: true,
      preferences,
    });

  } catch (error: any) {
    console.error('[Notifications] Update preferences error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to update preferences' },
      { status: 500 }
    );
  }
}, { component: 'notifications-preferences' });
