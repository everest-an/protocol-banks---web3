/**
 * Agent Activity Service
 * 
 * Tracks and reports agent activities for audit and analytics.
 * 
 * @module lib/services/agent-activity-service
 */

import { randomUUID } from 'crypto';

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
    const activity: AgentActivity = {
      id: randomUUID(),
      agent_id: agentId,
      owner_address: ownerAddress.toLowerCase(),
      action,
      details,
      ip_address: options?.ip_address,
      user_agent: options?.user_agent,
      created_at: new Date(),
    };

    activityStore.set(activity.id, activity);
    return activity;
  }

  /**
   * Get activities for an agent
   */
  async getActivities(agentId: string, limit: number = 50): Promise<AgentActivity[]> {
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

  /**
   * Get activities for an owner
   */
  async getOwnerActivities(ownerAddress: string, limit: number = 50): Promise<AgentActivity[]> {
    const normalizedOwner = ownerAddress.toLowerCase();
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

  /**
   * Get analytics for an owner
   */
  async getAnalytics(ownerAddress: string): Promise<AgentAnalytics> {
    const normalizedOwner = ownerAddress.toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

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
      total_agents: 0, // Would need to query agent service
      active_agents: 0,
      total_spent_today: totalSpentToday.toString(),
      total_spent_this_month: totalSpentThisMonth.toString(),
      pending_proposals: pendingProposals,
      spending_by_agent,
      top_recipients,
    };
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
