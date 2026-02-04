/**
 * Notification Service
 * Manages push notifications and user preferences
 */

import { prisma } from '@/lib/prisma';

// Web Push types (optional dependency)
let webpush: any = null;
try {
  webpush = require('web-push');
} catch (e) {
  console.warn('[Notification] web-push not available, push notifications disabled');
}

// ============================================
// Types
// ============================================

export interface PushSubscription {
  id: string;
  user_address: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  created_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_address: string;
  payment_received: boolean;
  payment_sent: boolean;
  subscription_reminder: boolean;
  subscription_payment: boolean;
  multisig_proposal: boolean;
  multisig_executed: boolean;
  agent_proposal_created: boolean;
  agent_proposal_approved: boolean;
  agent_proposal_rejected: boolean;
  agent_payment_executed: boolean;
  agent_payment_failed: boolean;
  vendor_address_changed: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
}

export type NotificationType =
  | 'payment_received'
  | 'payment_sent'
  | 'subscription_reminder'
  | 'subscription_payment'
  | 'multisig_proposal'
  | 'multisig_executed'
  | 'agent_proposal_created'
  | 'agent_proposal_approved'
  | 'agent_proposal_rejected'
  | 'agent_payment_executed'
  | 'agent_payment_failed'
  | 'vendor_address_changed';

// ============================================
// Constants
// ============================================

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'id' | 'user_address' | 'created_at' | 'updated_at'> = {
  payment_received: true,
  payment_sent: true,
  subscription_reminder: true,
  subscription_payment: true,
  multisig_proposal: true,
  multisig_executed: true,
  agent_proposal_created: true,
  agent_proposal_approved: true,
  agent_proposal_rejected: true,
  agent_payment_executed: true,
  agent_payment_failed: true,
  vendor_address_changed: true,
};

// ============================================
// Notification Service
// ============================================

export class NotificationService {
  constructor() {
    // Configure web-push with VAPID keys (should be from env)
    if (webpush) {
      const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
      const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@protocolbanks.com';

      if (vapidPublicKey && vapidPrivateKey) {
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      }
    }
  }

  private mapPushSubscription(sub: any): PushSubscription {
      return {
          id: sub.id,
          user_address: sub.user_address,
          endpoint: sub.endpoint,
          keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
          },
          created_at: sub.created_at.toISOString()
      };
  }

  /**
   * Subscribe a user to push notifications
   */
  async subscribe(
    userAddress: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
  ): Promise<PushSubscription> {
    const normalizedAddress = userAddress.toLowerCase();

    // Check if subscription already exists
    const existing = await prisma.pushSubscription.findUnique({
         where: { endpoint: subscription.endpoint }
    });

    if (existing) {
        // If endpoint exists but user mismatches, update it
        if (existing.user_address !== normalizedAddress) {
             const updated = await prisma.pushSubscription.update({
                 where: { id: existing.id },
                 data: { user_address: normalizedAddress }
             });
             return this.mapPushSubscription(updated);
        }
        return this.mapPushSubscription(existing);
    }

    // Create new subscription
    const created = await prisma.pushSubscription.create({
      data: {
        user_address: normalizedAddress,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      }
    });

    // Ensure default preferences exist
    await this.ensurePreferences(normalizedAddress);

    return this.mapPushSubscription(created);
  }

  /**
   * Unsubscribe a user from push notifications
   */
  async unsubscribe(userAddress: string, endpoint: string): Promise<void> {
    await prisma.pushSubscription.deleteMany({
        where: {
            user_address: userAddress.toLowerCase(),
            endpoint: endpoint
        }
    });
  }

  /**
   * Unsubscribe all devices for a user
   */
  async unsubscribeAll(userAddress: string): Promise<void> {
    await prisma.pushSubscription.deleteMany({
        where: { user_address: userAddress.toLowerCase() }
    });
  }

  /**
   * Get user's notification preferences
   */
  async getPreferences(userAddress: string): Promise<NotificationPreferences> {
    const normalizedAddress = userAddress.toLowerCase();
    const prefs = await prisma.notificationPreference.findUnique({
        where: { user_address: normalizedAddress }
    });
    
    if (!prefs) {
        return this.ensurePreferences(normalizedAddress);
    }
    
    return this.mapPreferences(prefs);
  }

  /**
   * Update user's notification preferences
   */
  async updatePreferences(
    userAddress: string,
    preferences: Partial<Omit<NotificationPreferences, 'id' | 'user_address' | 'created_at' | 'updated_at'>>
  ): Promise<NotificationPreferences> {
    const normalizedAddress = userAddress.toLowerCase();

    // Ensure preferences exist
    const current = await this.ensurePreferences(normalizedAddress);

    // Merge preferences
    const { id, user_address, created_at, updated_at, ...currentJson } = current;
    const newJson = { ...currentJson, ...preferences };

    const updated = await prisma.notificationPreference.update({
        where: { user_address: normalizedAddress },
        data: { preferences: newJson, updated_at: new Date() }
    });

    return this.mapPreferences(updated);
  }

  private mapPreferences(model: any): NotificationPreferences {
      const prefs = model.preferences as any || DEFAULT_PREFERENCES;
      return {
          id: model.id,
          user_address: model.user_address,
          ...prefs,
          created_at: model.created_at.toISOString(),
          updated_at: model.updated_at.toISOString()
      };
  }

  /**
   * Send a notification to a user
   */
  async send(
    userAddress: string,
    type: NotificationType,
    payload: NotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    const normalizedAddress = userAddress.toLowerCase();
    const results = { sent: 0, failed: 0 };

    // Check preferences
    const preferences = await this.getPreferences(normalizedAddress);
    if (!this.isNotificationEnabled(preferences, type)) {
      console.log(`[Notification] Type ${type} disabled for user ${normalizedAddress}`);
      return results;
    }

    // Get all subscriptions for user
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { user_address: normalizedAddress }
    });

    if (!subscriptions || subscriptions.length === 0) {
      return results;
    }

    // Send to all subscriptions
    const sendPromises = subscriptions.map(async (sub: any) => {
      try {
        if (!webpush) {
          console.warn('[Notification] web-push not available');
          results.failed++;
          return;
        }
        
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          JSON.stringify(payload)
        );
        results.sent++;
      } catch (err: any) {
        console.error(`[Notification] Failed to send to ${sub.endpoint}:`, err.message);
        results.failed++;

        // Remove invalid subscriptions
        if (err.statusCode === 404 || err.statusCode === 410) {
          await this.unsubscribe(normalizedAddress, sub.endpoint);
        }
      }
    });

    await Promise.all(sendPromises);
    return results;
  }

  /**
   * Send notification to multiple users
   */
  async sendToMany(
    userAddresses: string[],
    type: NotificationType,
    payload: NotificationPayload
  ): Promise<{ total: number; sent: number; failed: number }> {
    const results = { total: userAddresses.length, sent: 0, failed: 0 };

    const sendPromises = userAddresses.map(async (address) => {
      const result = await this.send(address, type, payload);
      results.sent += result.sent;
      results.failed += result.failed;
    });

    await Promise.all(sendPromises);
    return results;
  }

  // ============================================
  // Notification Triggers
  // ============================================

  /**
   * Notify on payment received
   */
  async notifyPaymentReceived(
    recipientAddress: string,
    amount: string,
    token: string,
    senderAddress: string
  ): Promise<void> {
    await this.send(recipientAddress, 'payment_received', {
      title: 'Payment Received',
      body: `You received ${amount} ${token} from ${this.truncateAddress(senderAddress)}`,
      icon: '/icons/payment-received.png',
      tag: 'payment-received',
      data: { type: 'payment_received', amount, token, from: senderAddress },
    });
  }

  /**
   * Notify on payment sent
   */
  async notifyPaymentSent(
    senderAddress: string,
    amount: string,
    token: string,
    recipientAddress: string
  ): Promise<void> {
    await this.send(senderAddress, 'payment_sent', {
      title: 'Payment Sent',
      body: `You sent ${amount} ${token} to ${this.truncateAddress(recipientAddress)}`,
      icon: '/icons/payment-sent.png',
      tag: 'payment-sent',
      data: { type: 'payment_sent', amount, token, to: recipientAddress },
    });
  }

  /**
   * Notify subscription payment reminder (24h before)
   */
  async notifySubscriptionReminder(
    ownerAddress: string,
    serviceName: string,
    amount: string,
    token: string
  ): Promise<void> {
    await this.send(ownerAddress, 'subscription_reminder', {
      title: 'Subscription Payment Tomorrow',
      body: `${serviceName} subscription of ${amount} ${token} will be charged tomorrow`,
      icon: '/icons/subscription.png',
      tag: 'subscription-reminder',
      data: { type: 'subscription_reminder', serviceName, amount, token },
    });
  }

  /**
   * Notify subscription payment completed
   */
  async notifySubscriptionPayment(
    ownerAddress: string,
    serviceName: string,
    amount: string,
    token: string
  ): Promise<void> {
    await this.send(ownerAddress, 'subscription_payment', {
      title: 'Subscription Payment Completed',
      body: `${serviceName} subscription payment of ${amount} ${token} was successful`,
      icon: '/icons/subscription.png',
      tag: 'subscription-payment',
      data: { type: 'subscription_payment', serviceName, amount, token },
    });
  }

  /**
   * Notify multisig proposal created
   */
  async notifyMultisigProposal(
    signerAddresses: string[],
    multisigName: string,
    amount: string,
    token: string
  ): Promise<void> {
    await this.sendToMany(signerAddresses, 'multisig_proposal', {
      title: 'New Multisig Proposal',
      body: `New proposal for ${amount} ${token} in ${multisigName}`,
      icon: '/icons/multisig.png',
      tag: 'multisig-proposal',
      data: { type: 'multisig_proposal', multisigName, amount, token },
    });
  }

  /**
   * Notify multisig transaction executed
   */
  async notifyMultisigExecuted(
    signerAddresses: string[],
    multisigName: string,
    amount: string,
    token: string,
    txHash: string
  ): Promise<void> {
    await this.sendToMany(signerAddresses, 'multisig_executed', {
      title: 'Multisig Transaction Executed',
      body: `Transaction of ${amount} ${token} from ${multisigName} was executed`,
      icon: '/icons/multisig.png',
      tag: 'multisig-executed',
      data: { type: 'multisig_executed', multisigName, amount, token, txHash },
    });
  }

  // ============================================
  // Agent Proposal Notifications
  // ============================================

  /**
   * Notify owner when an agent creates a proposal
   */
  async notifyAgentProposalCreated(
    ownerAddress: string,
    agentName: string,
    amount: string,
    token: string,
    recipientAddress: string,
    reason: string,
    proposalId: string
  ): Promise<void> {
    await this.send(ownerAddress, 'agent_proposal_created', {
      title: 'New Agent Payment Proposal',
      body: `${agentName} requests to send ${amount} ${token} to ${this.truncateAddress(recipientAddress)}`,
      icon: '/icons/agent-proposal.png',
      tag: `agent-proposal-${proposalId}`,
      data: { 
        type: 'agent_proposal_created', 
        agentName, 
        amount, 
        token, 
        recipient: recipientAddress,
        reason,
        proposalId 
      },
    });
  }

  /**
   * Notify owner when a proposal is approved (for confirmation)
   */
  async notifyAgentProposalApproved(
    ownerAddress: string,
    agentName: string,
    amount: string,
    token: string,
    proposalId: string
  ): Promise<void> {
    await this.send(ownerAddress, 'agent_proposal_approved', {
      title: 'Proposal Approved',
      body: `You approved ${agentName}'s proposal for ${amount} ${token}`,
      icon: '/icons/agent-approved.png',
      tag: `agent-approved-${proposalId}`,
      data: { 
        type: 'agent_proposal_approved', 
        agentName, 
        amount, 
        token, 
        proposalId 
      },
    });
  }

  /**
   * Notify owner when a proposal is rejected (for confirmation)
   */
  async notifyAgentProposalRejected(
    ownerAddress: string,
    agentName: string,
    amount: string,
    token: string,
    proposalId: string,
    reason?: string
  ): Promise<void> {
    await this.send(ownerAddress, 'agent_proposal_rejected', {
      title: 'Proposal Rejected',
      body: `You rejected ${agentName}'s proposal for ${amount} ${token}${reason ? `: ${reason}` : ''}`,
      icon: '/icons/agent-rejected.png',
      tag: `agent-rejected-${proposalId}`,
      data: { 
        type: 'agent_proposal_rejected', 
        agentName, 
        amount, 
        token, 
        proposalId,
        reason 
      },
    });
  }

  /**
   * Notify owner when an agent payment is executed (including auto-execute)
   */
  async notifyAgentPaymentExecuted(
    ownerAddress: string,
    agentName: string,
    amount: string,
    token: string,
    recipientAddress: string,
    txHash: string,
    autoExecuted: boolean = false
  ): Promise<void> {
    const title = autoExecuted ? 'Auto-Executed Payment' : 'Agent Payment Executed';
    const body = autoExecuted 
      ? `${agentName} auto-executed ${amount} ${token} to ${this.truncateAddress(recipientAddress)}`
      : `${agentName}'s payment of ${amount} ${token} to ${this.truncateAddress(recipientAddress)} was executed`;

    await this.send(ownerAddress, 'agent_payment_executed', {
      title,
      body,
      icon: '/icons/agent-executed.png',
      tag: `agent-executed-${txHash}`,
      data: { 
        type: 'agent_payment_executed', 
        agentName, 
        amount, 
        token, 
        recipient: recipientAddress,
        txHash,
        autoExecuted 
      },
    });
  }

  /**
   * Notify owner when an agent payment fails
   */
  async notifyAgentPaymentFailed(
    ownerAddress: string,
    agentName: string,
    amount: string,
    token: string,
    recipientAddress: string,
    errorMessage: string,
    proposalId: string
  ): Promise<void> {
    await this.send(ownerAddress, 'agent_payment_failed', {
      title: 'Agent Payment Failed',
      body: `${agentName}'s payment of ${amount} ${token} to ${this.truncateAddress(recipientAddress)} failed`,
      icon: '/icons/agent-failed.png',
      tag: `agent-failed-${proposalId}`,
      data: { 
        type: 'agent_payment_failed', 
        agentName, 
        amount, 
        token, 
        recipient: recipientAddress,
        error: errorMessage,
        proposalId 
      },
    });
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Ensure preferences exist for a user
   */
  private async ensurePreferences(userAddress: string): Promise<NotificationPreferences> {
    const existing = await prisma.notificationPreference.findUnique({
      where: { user_address: userAddress }
    });

    if (existing) {
      return this.mapPreferences(existing);
    }

    const newPrefs = await prisma.notificationPreference.create({
      data: {
        user_address: userAddress,
        preferences: DEFAULT_PREFERENCES,
      }
    });

    return this.mapPreferences(newPrefs);
  }

  /**
   * Check if a notification type is enabled
   */
  private isNotificationEnabled(
    preferences: NotificationPreferences,
    type: NotificationType
  ): boolean {
    return preferences[type] ?? true;
  }

  /**
   * Truncate an address for display
   */
  private truncateAddress(address: string): string {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
