/**
 * Notification Subscribe Endpoint
 * POST /api/notifications/subscribe - Subscribe to push notifications
 */

import { type NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/services/notification-service';
import { getSupabase } from '@/lib/supabase';

const notificationService = new NotificationService();

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const userAddress = user.user_metadata?.wallet_address || user.email;
    if (!userAddress) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'No wallet address associated with account' },
        { status: 400 }
      );
    }

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
}
