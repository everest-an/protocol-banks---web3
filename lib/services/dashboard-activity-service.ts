/**
 * Dashboard Activity Service
 * Provides recent activity data for the dashboard
 */

import { prisma } from '@/lib/prisma';

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
  constructor() {}

  /**
   * Get recent activity for a user
   */
  async getRecentActivity(
    userAddress: string,
    limit: number = 5
  ): Promise<DashboardActivity> {
    const normalizedAddress = userAddress.toLowerCase();

    // Get sent payments
    const sentPayments = await prisma.payment.findMany({
      where: {
        from_address: normalizedAddress
      },
      select: {
          id: true,
          to_address: true,
          amount: true,
          token: true,
          chain: true, // Prisma model has 'chain', not 'chain_id' for some reason? Let's check schema.
          tx_hash: true,
          status: true,
          vendor_id: true,
          created_at: true,
          vendor: {
              select: { name: true }
          }
      },
      orderBy: { created_at: 'desc' },
      take: limit
    });
    // Schema has 'chain' String. Interface 'ActivityItem' needs 'chain_id' number. 
    // And 'Payment' in schema has 'chain' String. 
    // I need to parse 'chain'.

    // Get received payments
    const receivedPayments = await prisma.payment.findMany({
      where: {
        to_address: normalizedAddress
      },
      select: {
          id: true,
          from_address: true,
          amount: true,
          token: true,
          chain: true,
          tx_hash: true,
          status: true,
          vendor_id: true,
          created_at: true,
          vendor: {
              select: { name: true }
          }
      },
      orderBy: { created_at: 'desc' },
      take: limit
    });

    // Combine and sort
    const sentItems: ActivityItem[] = sentPayments.map((p: any) => ({
      id: p.id,
      type: 'sent' as const,
      amount: p.amount,
      token: p.token,
      chain_id: parseInt(p.chain) || 0, // Fallback parsing
      counterparty: p.to_address,
      vendor_id: p.vendor_id,
      vendor_name: p.vendor?.name,
      tx_hash: p.tx_hash,
      status: p.status,
      created_at: p.created_at.toISOString(),
    }));

    const receivedItems: ActivityItem[] = receivedPayments.map((p: any) => ({
      id: p.id,
      type: 'received' as const,
      amount: p.amount,
      token: p.token,
      chain_id: parseInt(p.chain) || 0,
      counterparty: p.from_address,
      vendor_id: p.vendor_id,
      vendor_name: p.vendor?.name,
      tx_hash: p.tx_hash,
      status: p.status,
      created_at: p.created_at.toISOString(),
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
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const whereUserInvolved = {
        OR: [
            { from_address: normalizedAddress },
            { to_address: normalizedAddress }
        ]
    };

    // Get counts
    const [todayCount, weekCount, monthCount, pendingCount] = await Promise.all([
      prisma.payment.count({
          where: {
              ...whereUserInvolved,
              created_at: { gte: todayStart }
          }
      }),
      prisma.payment.count({
          where: {
              ...whereUserInvolved,
              created_at: { gte: weekStart }
          }
      }),
      prisma.payment.count({
          where: {
              ...whereUserInvolved,
              created_at: { gte: monthStart }
          }
      }),
      prisma.payment.count({
          where: {
              ...whereUserInvolved,
              status: 'pending'
          }
      })
    ]);

    return {
      today_count: todayCount,
      week_count: weekCount,
      month_count: monthCount,
      pending_count: pendingCount,
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
