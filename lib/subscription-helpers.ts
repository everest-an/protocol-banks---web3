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
 * Calculate the next payment date based on frequency.
 * When schedule_day is provided (enterprise use case), uses exact-day scheduling:
 *   - monthly: schedule_day = day of month (1-31)
 *   - weekly:  schedule_day = day of week (1=Mon..7=Sun)
 *   - daily/yearly: schedule_day ignored, uses standard offset
 * When schedule_time is provided, sets the time component (HH:mm format).
 */
export function calculateNextPaymentDate(
  fromDate: Date,
  frequency: SubscriptionFrequency,
  options?: { schedule_day?: number; schedule_time?: string }
): Date {
  const result = new Date(fromDate);
  const scheduleDay = options?.schedule_day;
  const scheduleTime = options?.schedule_time;

  switch (frequency) {
    case 'daily':
      result.setDate(result.getDate() + 1);
      break;

    case 'weekly': {
      if (scheduleDay && scheduleDay >= 1 && scheduleDay <= 7) {
        // Exact day-of-week scheduling (1=Mon..7=Sun → JS 0=Sun..6=Sat)
        const jsDay = scheduleDay % 7; // Convert: 7(Sun)→0, 1(Mon)→1, etc.
        const currentDay = result.getDay();
        let daysToAdd = (jsDay - currentDay + 7) % 7;
        if (daysToAdd === 0) daysToAdd = 7;
        result.setDate(result.getDate() + daysToAdd);
      } else {
        result.setDate(result.getDate() + 7);
      }
      break;
    }

    case 'monthly': {
      if (scheduleDay && scheduleDay >= 1 && scheduleDay <= 31) {
        // Exact day-of-month scheduling
        result.setMonth(result.getMonth() + 1);
        const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
        result.setDate(Math.min(scheduleDay, lastDay));
      } else {
        const originalDay = result.getDate();
        result.setMonth(result.getMonth() + 1);
        if (result.getDate() !== originalDay) {
          result.setDate(0);
        }
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

  // Apply schedule_time if provided (HH:mm)
  if (scheduleTime) {
    const [hours, minutes] = scheduleTime.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      result.setHours(hours, minutes, 0, 0);
    }
  }

  return result;
}

/**
 * Validate subscription input (supports both individual and enterprise auto pay)
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

  // Auto Pay authorization validation
  if (input.max_authorized_amount !== undefined) {
    const maxAuth = parseFloat(String(input.max_authorized_amount));
    if (isNaN(maxAuth) || maxAuth <= 0) {
      throw new Error('Max authorized amount must be greater than 0');
    }
    if (maxAuth < input.amount) {
      throw new Error('Max authorized amount must be >= payment amount');
    }
  }

  if (input.authorization_expires_at) {
    const expiresAt = new Date(input.authorization_expires_at);
    if (expiresAt <= new Date()) {
      throw new Error('Authorization expiry must be in the future');
    }
  }

  // Schedule validation
  if (input.schedule_day !== undefined) {
    if (input.frequency === 'monthly' && (input.schedule_day < 1 || input.schedule_day > 31)) {
      throw new Error('Schedule day must be 1-31 for monthly frequency');
    }
    if (input.frequency === 'weekly' && (input.schedule_day < 1 || input.schedule_day > 7)) {
      throw new Error('Schedule day must be 1-7 for weekly frequency');
    }
  }

  if (input.schedule_time) {
    const timeMatch = /^([01]\d|2[0-3]):[0-5]\d$/.test(input.schedule_time);
    if (!timeMatch) {
      throw new Error('Schedule time must be in HH:mm format (00:00-23:59)');
    }
  }

  // Enterprise recipients validation
  if (input.use_case === 'enterprise' && input.recipients?.length) {
    for (const r of input.recipients) {
      if (!r.address || !r.address.startsWith('0x')) {
        throw new Error(`Invalid recipient address: ${r.address}`);
      }
      const amt = parseFloat(r.amount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error(`Invalid amount for recipient ${r.address}`);
      }
    }
  }
}

/**
 * Check if a subscription's authorization is still valid
 * Returns { valid, reason } — reuses budget-service checkAvailability pattern
 */
export function checkAuthorizationValidity(subscription: UISubscription): {
  valid: boolean;
  reason?: string;
} {
  // Check authorization expiry
  if (subscription.authorization_expires_at) {
    const expiresAt = new Date(subscription.authorization_expires_at);
    if (expiresAt <= new Date()) {
      return { valid: false, reason: 'Authorization has expired' };
    }
  }

  // Check spending cap
  if (subscription.max_authorized_amount) {
    const maxAuth = parseFloat(subscription.max_authorized_amount);
    const totalPaid = parseFloat(subscription.total_paid || '0');
    const nextAmount = parseFloat(subscription.amount);

    if (totalPaid + nextAmount > maxAuth) {
      return { valid: false, reason: 'Authorization spending cap exceeded' };
    }
  }

  return { valid: true };
}

/**
 * Get remaining authorization quota
 */
export function getRemainingQuota(subscription: UISubscription): string | null {
  if (!subscription.max_authorized_amount) return null;
  const maxAuth = parseFloat(subscription.max_authorized_amount);
  const totalPaid = parseFloat(subscription.total_paid || '0');
  return Math.max(0, maxAuth - totalPaid).toFixed(2);
}

/**
 * Format subscription for display (enhanced for Auto Pay)
 */
export function formatSubscriptionForDisplay(subscription: UISubscription): {
  formattedAmount: string;
  formattedFrequency: string;
  formattedNextPayment: string;
  formattedLastPayment: string;
  formattedRemainingQuota: string | null;
  formattedAuthExpiry: string | null;
  formattedSchedule: string | null;
} {
  const frequencyLabels: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
  };

  // Remaining quota
  const remaining = getRemainingQuota(subscription);
  const formattedRemainingQuota = remaining !== null && subscription.max_authorized_amount
    ? `$${remaining} / $${subscription.max_authorized_amount} remaining`
    : null;

  // Authorization expiry
  const formattedAuthExpiry = subscription.authorization_expires_at
    ? `Valid until ${new Date(subscription.authorization_expires_at).toLocaleDateString()}`
    : null;

  // Schedule description
  let formattedSchedule: string | null = null;
  if (subscription.schedule_day) {
    const freq = subscription.frequency;
    const time = subscription.schedule_time || '09:00';
    const tz = subscription.timezone || 'UTC';

    if (freq === 'monthly') {
      const suffix = getDaySuffix(subscription.schedule_day);
      formattedSchedule = `${subscription.schedule_day}${suffix} of every month at ${time} ${tz}`;
    } else if (freq === 'weekly') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const jsDay = subscription.schedule_day % 7;
      formattedSchedule = `Every ${days[jsDay]} at ${time} ${tz}`;
    }
  }

  return {
    formattedAmount: `${subscription.amount} ${subscription.token}`,
    formattedFrequency: frequencyLabels[subscription.frequency] || subscription.frequency,
    formattedNextPayment: subscription.next_payment
      ? new Date(subscription.next_payment).toLocaleDateString()
      : 'N/A',
    formattedLastPayment: subscription.last_payment
      ? new Date(subscription.last_payment).toLocaleDateString()
      : 'Never',
    formattedRemainingQuota,
    formattedAuthExpiry,
    formattedSchedule,
  };
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
