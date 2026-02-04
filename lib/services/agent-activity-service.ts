/**
 * Agent Activity Service
 *
 * Tracks and reports agent activities for audit and analytics.
 *
 * @module lib/services/agent-activity-service
 */

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

// ============================================
// Types
// ============================================

export type AgentAction = 
  | 'proposal_created'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'payment_executed'
  | 'payment_failed'
  | 'budget_checked'
  | 'webhook_received'
  | 'api_error';

export interface AgentActivity {
  id: string;
  agent_id: string;
  owner_address: string;
  action: AgentAction;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface AgentAnalytics {
  total_agents: number;
  active_agents: number;
  total_spent_today: string;
  total_spent_this_month: string;
  pending_proposals: number;
  spending_by_agent: { agent_id: string; agent_name: string; amount: string }[];
  top_recipients: { address: string; amount: string; count: number }[];
}

// ============================================
// In-Memory Store
// ============================================

const activityStore = new Map<string, AgentActivity>();

// Flag to enable/disable database (for testing)
let useDatabaseStorage = true;

export function setUseDatabaseStorage(enabled: boolean) {
  useDatabaseStorage = enabled;
}

function convertDbActivity(data: any): AgentActivity {
  return {
    ...data,
    created_at: new Date(data.created_at),
  };
}

// ============================================
// Agent Activity Service
// ============================================

export class AgentActivityService {
  /**
   * Log an agent activity
   */
  async log(
    agentId: string,
    ownerAddress: string,
    action: AgentAction,
    details: Record<string, any>,
    options?: { ip_address?: string; user_agent?: string }
  ): Promise<AgentActivity> {
    const activityData = {
      agent_id: agentId,
      owner_address: ownerAddress.toLowerCase(),
      action,
      details,
      ip_address: options?.ip_address,
      user_agent: options?.user_agent,
    };

    if (useDatabaseStorage) {
      try {
        const data = await prisma.agentActivity.create({
          data: activityData
        });

        return convertDbActivity(data);
      } catch (error) {
        console.error('[Activity Service] Failed to log activity:', error);
        // Don't throw - fall back to in-memory
        const activity: AgentActivity = {
          id: randomUUID(),
          ...activityData,
          created_at: new Date(),
        };
        activityStore.set(activity.id, activity);
        return activity;
      }
    } else {
      // Fallback to in-memory storage
      const activity: AgentActivity = {
        id: randomUUID(),
        ...activityData,
        created_at: new Date(),
      };

      activityStore.set(activity.id, activity);
      return activity;
    }
  }

  /**
   * Get activities for an agent
   */
  async getActivities(agentId: string, limit: number = 50): Promise<AgentActivity[]> {
    if (useDatabaseStorage) {
      try {
        const data = await prisma.agentActivity.findMany({
          where: { agent_id: agentId },
          orderBy: { created_at: 'desc' },
          take: limit
        });

        return data.map(convertDbActivity);
      } catch (error) {
        console.error('[Activity Service] Failed to get activities:', error);
        return [];
      }
    } else {
      // Fallback to in-memory storage
      const activities: AgentActivity[] = [];

      for (const activity of activityStore.values()) {
        if (activity.agent_id === agentId) {
          activities.push(activity);
        }
      }

      return activities
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, limit);
    }
  }

  /**
   * Get activities for an owner
   */
  async getOwnerActivities(ownerAddress: string, limit: number = 50): Promise<AgentActivity[]> {
    const normalizedOwner = ownerAddress.toLowerCase();

    if (useDatabaseStorage) {
      try {
        const data = await prisma.agentActivity.findMany({
          where: { owner_address: normalizedOwner },
          orderBy: { created_at: 'desc' },
          take: limit
        });

        return data.map(convertDbActivity);
      } catch (error) {
        console.error('[Activity Service] Failed to get owner activities:', error);
        return [];
      }
    } else {
      // Fallback to in-memory storage
      const activities: AgentActivity[] = [];

      for (const activity of activityStore.values()) {
        if (activity.owner_address === normalizedOwner) {
          activities.push(activity);
        }
      }

      return activities
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, limit);
    }
  }

  /**
   * Get analytics for an owner
   */
  async getAnalytics(ownerAddress: string): Promise<AgentAnalytics> {
    const normalizedOwner = ownerAddress.toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    if (useDatabaseStorage) {
      try {
        // Get payment_executed activities for spending analytics
        const paymentActivities = await prisma.agentActivity.findMany({
          where: {
            owner_address: normalizedOwner,
            action: 'payment_executed',
            created_at: { gte: monthStart }
          }
        });

        // Get pending proposals count
        const pendingCount = await prisma.paymentProposal.count({
          where: {
            owner_address: normalizedOwner,
            status: 'pending'
          }
        });

        // Get agent counts
        const agents = await prisma.agent.findMany({
          where: { owner_address: normalizedOwner },
          select: { status: true }
        });

        // Process payment data
        let totalSpentToday = 0;
        let totalSpentThisMonth = 0;
        const spendingByAgent = new Map<string, { name: string; amount: number }>();
        const recipientSpending = new Map<string, { amount: number; count: number }>();

        for (const activity of paymentActivities) {
          const details = activity.details as any;
          const amount = parseFloat(details?.amount || '0');
          const recipient = details?.recipient_address?.toLowerCase();
          const agentName = details?.agent_name || 'Unknown';
          const createdAt = new Date(activity.created_at);

          if (createdAt >= today) {
            totalSpentToday += amount;
          }
          totalSpentThisMonth += amount;

          // Track by agent
          const agData = spendingByAgent.get(activity.agent_id) || { name: agentName, amount: 0 };
          agData.amount += amount;
          spendingByAgent.set(activity.agent_id, agData);

          // Track by recipient
          if (recipient) {
            const recData = recipientSpending.get(recipient) || { amount: 0, count: 0 };
            recData.amount += amount;
            recData.count += 1;
            recipientSpending.set(recipient, recData);
          }
        }

        // Convert maps to arrays
        const spending_by_agent = Array.from(spendingByAgent.entries())
          .map(([agent_id, data]) => ({
            agent_id,
            agent_name: data.name,
            amount: data.amount.toString(),
          }))
          .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
          .slice(0, 10);

        const top_recipients = Array.from(recipientSpending.entries())
          .map(([address, data]) => ({
            address,
            amount: data.amount.toString(),
            count: data.count,
          }))
          .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
          .slice(0, 10);

        return {
          total_agents: agents.length,
          active_agents: agents.filter((a) => a.status === 'active').length,
          total_spent_today: totalSpentToday.toString(),
          total_spent_this_month: totalSpentThisMonth.toString(),
          pending_proposals: pendingCount || 0,
          spending_by_agent,
          top_recipients,
        };
      } catch (error) {
        console.error('[Activity Service] Failed to get analytics:', error);
        // Return empty analytics on error
        return {
          total_agents: 0,
          active_agents: 0,
          total_spent_today: '0',
          total_spent_this_month: '0',
          pending_proposals: 0,
          spending_by_agent: [],
          top_recipients: [],
        };
      }
    } else {
      // Fallback to in-memory storage
      let totalSpentToday = 0;
      let totalSpentThisMonth = 0;
      let pendingProposals = 0;
      const spendingByAgent = new Map<string, { name: string; amount: number }>();
      const recipientSpending = new Map<string, { amount: number; count: number }>();

      for (const activity of activityStore.values()) {
        if (activity.owner_address !== normalizedOwner) continue;

        if (activity.action === 'payment_executed') {
          const amount = parseFloat(activity.details.amount || '0');
          const recipient = activity.details.recipient_address?.toLowerCase();
          const agentName = activity.details.agent_name || 'Unknown';

          if (activity.created_at >= today) {
            totalSpentToday += amount;
          }
          if (activity.created_at >= monthStart) {
            totalSpentThisMonth += amount;
          }

          // Track by agent
          const agentData = spendingByAgent.get(activity.agent_id) || { name: agentName, amount: 0 };
          agentData.amount += amount;
          spendingByAgent.set(activity.agent_id, agentData);

          // Track by recipient
          if (recipient) {
            const recipientData = recipientSpending.get(recipient) || { amount: 0, count: 0 };
            recipientData.amount += amount;
            recipientData.count += 1;
            recipientSpending.set(recipient, recipientData);
          }
        }

        if (activity.action === 'proposal_created' && activity.details.status === 'pending') {
          pendingProposals++;
        }
      }

      // Convert maps to arrays
      const spending_by_agent = Array.from(spendingByAgent.entries())
        .map(([agent_id, data]) => ({
          agent_id,
          agent_name: data.name,
          amount: data.amount.toString(),
        }))
        .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
        .slice(0, 10);

      const top_recipients = Array.from(recipientSpending.entries())
        .map(([address, data]) => ({
          address,
          amount: data.amount.toString(),
          count: data.count,
        }))
        .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
        .slice(0, 10);

      return {
        total_agents: 0,
        active_agents: 0,
        total_spent_today: totalSpentToday.toString(),
        total_spent_this_month: totalSpentThisMonth.toString(),
        pending_proposals: pendingProposals,
        spending_by_agent,
        top_recipients,
      };
    }
  }

  /**
   * Clear all activities (for testing)
   */
  _clearAll(): void {
    activityStore.clear();
  }

  /**
   * Get activity count (for testing)
   */
  _getCount(): number {
    return activityStore.size;
  }
}

// Export singleton instance
export const agentActivityService = new AgentActivityService();
