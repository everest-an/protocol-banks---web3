/**
 * Notification Unsubscribe Endpoint
 * DELETE /api/notifications/unsubscribe - Unsubscribe from push notifications
 */

import { type NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/services/notification-service';
import { getSupabase } from '@/lib/supabase';

const notificationService = new NotificationService();

export async function DELETE(request: NextRequest) {
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
}
