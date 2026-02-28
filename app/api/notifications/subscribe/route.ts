/**
 * Notification Subscribe Endpoint
 * POST /api/notifications/subscribe - Subscribe to push notifications
 */

import { type NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/services/notification-service';
import { withAuth } from '@/lib/middleware/api-auth';

const notificationService = new NotificationService();

export const POST = withAuth(async (request: NextRequest, userAddress: string) => {
  try {
    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid subscription data' },
        { status: 400 }
      );
    }

    const subscription = await notificationService.subscribe(userAddress, {
      endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        endpoint: subscription.endpoint,
      },
    });

  } catch (error: any) {
    console.error('[Notifications] Subscribe error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to subscribe' },
      { status: 500 }
    );
  }
}, { component: 'notifications-subscribe' });
