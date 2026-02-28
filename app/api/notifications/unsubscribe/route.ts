/**
 * Notification Unsubscribe Endpoint
 * DELETE /api/notifications/unsubscribe - Unsubscribe from push notifications
 */

import { type NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/services/notification-service';
import { withAuth } from '@/lib/middleware/api-auth';

const notificationService = new NotificationService();

export const DELETE = withAuth(async (request: NextRequest, userAddress: string) => {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    const all = searchParams.get('all') === 'true';

    if (all) {
      await notificationService.unsubscribeAll(userAddress);
    } else if (endpoint) {
      await notificationService.unsubscribe(userAddress, endpoint);
    } else {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Endpoint or all=true required' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: all ? 'Unsubscribed from all notifications' : 'Unsubscribed successfully',
    });

  } catch (error: any) {
    console.error('[Notifications] Unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}, { component: 'notifications-unsubscribe' });
