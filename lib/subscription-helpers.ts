/**
 * Subscription helpers
 * Shared utilities for subscription calculations and validation
 */

import type {
  Subscription as UISubscription,
  SubscriptionInput,
  SubscriptionFrequency,
} from '@/types';

/**
 * Calculate the next payment date based on frequency
 * Handles month-end edge cases (e.g., Jan 31 → Feb 28)
 */
export function calculateNextPaymentDate(
  fromDate: Date,
  frequency: SubscriptionFrequency
): Date {
  const result = new Date(fromDate);

  switch (frequency) {
    case 'daily':
      result.setDate(result.getDate() + 1);
      break;

    case 'weekly':
      result.setDate(result.getDate() + 7);
      break;

    case 'monthly': {
      const originalDay = result.getDate();
      result.setMonth(result.getMonth() + 1);

      // Handle month-end edge cases
      // If we started on day 31 and next month has fewer days
      if (result.getDate() !== originalDay) {
        // We've overflowed into the next month, go back to last day of intended month
        result.setDate(0);
      }
      break;
    }

    case 'yearly': {
      const originalDay = result.getDate();
      const originalMonth = result.getMonth();
      result.setFullYear(result.getFullYear() + 1);

      // Handle Feb 29 → Feb 28 for non-leap years
      if (result.getMonth() !== originalMonth || result.getDate() !== originalDay) {
        result.setDate(0);
      }
      break;
    }
  }

  return result;
}

/**
 * Validate subscription input
 */
export function validateSubscription(input: SubscriptionInput): void {
  if (!input.service_name || input.service_name.trim() === '') {
    throw new Error('Service name is required');
  }

  if (!input.amount || input.amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  if (!input.recipient_address || !input.recipient_address.startsWith('0x')) {
    throw new Error('Valid recipient address is required');
  }

  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(input.frequency)) {
    throw new Error('Invalid frequency');
  }

  if (!['USDC', 'USDT', 'DAI', 'ETH'].includes(input.token)) {
    throw new Error('Invalid token');
  }
}

/**
 * Format subscription for display
 */
export function formatSubscriptionForDisplay(subscription: UISubscription): {
  formattedAmount: string;
  formattedFrequency: string;
  formattedNextPayment: string;
  formattedLastPayment: string;
} {
  const frequencyLabels: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
  };

  return {
    formattedAmount: `${subscription.amount} ${subscription.token}`,
    formattedFrequency: frequencyLabels[subscription.frequency] || subscription.frequency,
    formattedNextPayment: subscription.next_payment
      ? new Date(subscription.next_payment).toLocaleDateString()
      : 'N/A',
    formattedLastPayment: subscription.last_payment
      ? new Date(subscription.last_payment).toLocaleDateString()
      : 'Never',
  };
}
