/**
 * Dashboard Activity Service
 * Provides recent activity data for the dashboard
 */

import { createClient } from '@/lib/supabase-client';

// ============================================
// Types
// ============================================

export interface ActivityItem {
  id: string;
  type: 'sent' | 'received';
  amount: string;
  token: string;
  chain_id: number;
  counterparty: string;
  counterparty_name?: string;
  vendor_id?: string;
  vendor_name?: string;
  tx_hash?: string;
  status: string;
  created_at: string;
}

export interface DashboardActivity {
  items: ActivityItem[];
  total_sent: number;
  total_received: number;
  has_more: boolean;
}

// ============================================
// Dashboard Activity Service
// ============================================

export class DashboardActivityService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Get recent activity for a user
   */
  async getRecentActivity(
    userAddress: string,
    limit: number = 5
  ): Promise<DashboardActivity> {
    const normalizedAddress = userAddress.toLowerCase();

    // Get sent payments
    const { data: sentPayments, error: sentError } = await this.supabase
      .from('payments')
      .select(`
        id,
        to_address,
        amount,
        token,
        chain_id,
        tx_hash,
        status,
        vendor_id,
        created_at,
        vendors(name)
      `)
      .eq('from_address', normalizedAddress)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sentError) {
      console.error('[DashboardActivity] Sent payments error:', sentError);
    }

    // Get received payments
    const { data: receivedPayments, error: receivedError } = await this.supabase
      .from('payments')
      .select(`
        id,
        from_address,
        amount,
        token,
        chain_id,
        tx_hash,
        status,
        vendor_id,
        created_at,
        vendors(name)
      `)
      .eq('to_address', normalizedAddress)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (receivedError) {
      console.error('[DashboardActivity] Received payments error:', receivedError);
    }

    // Combine and sort
    const sentItems: ActivityItem[] = (sentPayments || []).map((p: any) => ({
      id: p.id,
      type: 'sent' as const,
      amount: p.amount,
      token: p.token,
      chain_id: p.chain_id,
      counterparty: p.to_address,
      vendor_id: p.vendor_id,
      vendor_name: p.vendors?.name,
      tx_hash: p.tx_hash,
      status: p.status,
      created_at: p.created_at,
    }));

    const receivedItems: ActivityItem[] = (receivedPayments || []).map((p: any) => ({
      id: p.id,
      type: 'received' as const,
      amount: p.amount,
      token: p.token,
      chain_id: p.chain_id,
      counterparty: p.from_address,
      vendor_id: p.vendor_id,
      vendor_name: p.vendors?.name,
      tx_hash: p.tx_hash,
      status: p.status,
      created_at: p.created_at,
    }));

    // Merge and sort by date
    const allItems = [...sentItems, ...receivedItems]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    // Calculate totals
    const totalSent = sentItems
      .filter(i => i.status === 'completed')
      .reduce((sum, i) => sum + parseFloat(i.amount || '0'), 0);

    const totalReceived = receivedItems
      .filter(i => i.status === 'completed')
      .reduce((sum, i) => sum + parseFloat(i.amount || '0'), 0);

    return {
      items: allItems,
      total_sent: totalSent,
      total_received: totalReceived,
      has_more: sentItems.length === limit || receivedItems.length === limit,
    };
  }

  /**
   * Get activity summary for dashboard
   */
  async getActivitySummary(userAddress: string): Promise<{
    today_count: number;
    week_count: number;
    month_count: number;
    pending_count: number;
  }> {
    const normalizedAddress = userAddress.toLowerCase();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Get counts
    const [todayResult, weekResult, monthResult, pendingResult] = await Promise.all([
      this.supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .or(`from_address.eq.${normalizedAddress},to_address.eq.${normalizedAddress}`)
        .gte('created_at', todayStart),
      this.supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .or(`from_address.eq.${normalizedAddress},to_address.eq.${normalizedAddress}`)
        .gte('created_at', weekStart),
      this.supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .or(`from_address.eq.${normalizedAddress},to_address.eq.${normalizedAddress}`)
        .gte('created_at', monthStart),
      this.supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .or(`from_address.eq.${normalizedAddress},to_address.eq.${normalizedAddress}`)
        .eq('status', 'pending'),
    ]);

    return {
      today_count: todayResult.count || 0,
      week_count: weekResult.count || 0,
      month_count: monthResult.count || 0,
      pending_count: pendingResult.count || 0,
    };
  }

  /**
   * Format activity item for display
   */
  formatActivityItem(item: ActivityItem): {
    direction: string;
    description: string;
    amount_display: string;
    time_ago: string;
  } {
    const direction = item.type === 'sent' ? 'Sent' : 'Received';
    const counterpartyDisplay = item.vendor_name || this.truncateAddress(item.counterparty);
    const description = item.type === 'sent'
      ? `To ${counterpartyDisplay}`
      : `From ${counterpartyDisplay}`;

    return {
      direction,
      description,
      amount_display: `${item.type === 'sent' ? '-' : '+'}${item.amount} ${item.token}`,
      time_ago: this.getTimeAgo(new Date(item.created_at)),
    };
  }

  /**
   * Truncate address for display
   */
  private truncateAddress(address: string): string {
    if (!address || address.length <= 10) return address || '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Get human-readable time ago string
   */
  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }
}

// Export singleton instance
export const dashboardActivityService = new DashboardActivityService();
