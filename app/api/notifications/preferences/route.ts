/**
 * Notification Preferences Endpoint
 * GET /api/notifications/preferences - Get notification preferences
 * PUT /api/notifications/preferences - Update notification preferences
 */

import { type NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/services/notification-service';
import { getSupabase } from '@/lib/supabase';

const notificationService = new NotificationService();

export async function GET(request: NextRequest) {
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
}

export async function PUT(request: NextRequest) {
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
}
