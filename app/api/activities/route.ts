/**
 * Activities API Endpoint
 * GET /api/activities - Get user's recent activities (payments, subscriptions, etc.)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware/api-auth';

// Activity types
type ActivityType =
  | "payment_sent"
  | "payment_received"
  | "batch_payment"
  | "subscription_charged"
  | "subscription_created"
  | "subscription_cancelled"
  | "multisig_proposed"
  | "multisig_signed"
  | "multisig_executed"
  | "webhook_triggered"
  | "api_key_created"
  | "vendor_added"
  | "vendor_updated";

interface Activity {
  id: string;
  type: ActivityType;
  timestamp: string;
  title: string;
  description: string;
  amount?: number;
  token?: string;
  status: "success" | "pending" | "failed";
  metadata?: {
    tx_hash?: string;
    vendor_name?: string;
    recipient_count?: number;
    subscription_name?: string;
    webhook_event?: string;
    signer_address?: string;
    threshold?: string;
  };
}

const STATUS_MAP: Record<string, "success" | "pending" | "failed"> = {
  completed: "success",
  confirmed: "success",
  success: "success",
  pending: "pending",
  processing: "pending",
  failed: "failed",
  cancelled: "failed",
};

export const GET = withAuth(async (request: NextRequest, wallet: string) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '15', 10);
    const type = searchParams.get('type'); // Filter by type: payments, subscriptions, etc.

    const walletLower = wallet.toLowerCase();
    const activities: Activity[] = [];

    // 1. Fetch payments (sent & received)
    if (!type || type === 'all' || type === 'payments') {
      try {
        const payments = await prisma.payment.findMany({
          where: {
            OR: [
              { from_address: { equals: walletLower, mode: 'insensitive' } },
              { to_address: { equals: walletLower, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            tx_hash: true,
            from_address: true,
            to_address: true,
            token_symbol: true,
            amount: true,
            amount_usd: true,
            status: true,
            created_at: true,
            notes: true,
            vendor_id: true,
            vendor: {
              select: { name: true },
            },
          },
          orderBy: { created_at: 'desc' },
          take: limit,
        });

        for (const payment of payments) {
          const isSent = payment.from_address?.toLowerCase() === walletLower;
          const vendorName = payment.vendor?.name;

          activities.push({
            id: payment.id,
            type: isSent ? 'payment_sent' : 'payment_received',
            timestamp: payment.created_at?.toISOString() || new Date().toISOString(),
            title: isSent ? 'Payment Sent' : 'Payment Received',
            description: vendorName
              ? (isSent ? `Sent to ${vendorName}` : `Received from ${vendorName}`)
              : (isSent ? `Sent to ${shortenAddress(payment.to_address)}` : `Received from ${shortenAddress(payment.from_address)}`),
            amount: parseFloat(String(payment.amount_usd ?? payment.amount ?? '0')),
            token: payment.token_symbol || 'USDC',
            status: STATUS_MAP[payment.status] || 'pending',
            metadata: {
              tx_hash: payment.tx_hash || undefined,
              vendor_name: vendorName || undefined,
            },
          });
        }
      } catch (error) {
        console.error('[Activities] Payments fetch error:', error);
      }
    }

    // 2. Fetch batch payments (raw query - table not in Prisma schema)
    if (!type || type === 'all' || type === 'batch') {
      try {
        const batchPayments = await prisma.$queryRaw<Array<{
          id: string;
          batch_name: string | null;
          total_recipients: number;
          total_amount_usd: string | null;
          status: string;
          created_at: Date;
        }>>`
          SELECT id, batch_name, total_recipients, total_amount_usd, status, created_at
          FROM batch_payments
          WHERE LOWER(wallet_address) = ${walletLower}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;

        for (const batch of batchPayments) {
          activities.push({
            id: batch.id,
            type: 'batch_payment',
            timestamp: batch.created_at?.toISOString?.() || new Date(batch.created_at).toISOString(),
            title: 'Batch Payment',
            description: batch.batch_name || `${batch.total_recipients} recipients paid`,
            amount: parseFloat(batch.total_amount_usd || '0'),
            token: 'USDC',
            status: STATUS_MAP[batch.status] || 'pending',
            metadata: {
              recipient_count: batch.total_recipients,
            },
          });
        }
      } catch (error) {
        console.error('[Activities] Batch payments fetch error:', error);
        // Table may not exist - gracefully skip
      }
    }

    // 3. Fetch subscriptions
    if (!type || type === 'all' || type === 'subscriptions') {
      try {
        const subscriptions = await prisma.subscription.findMany({
          where: {
            owner_address: { equals: walletLower, mode: 'insensitive' },
          },
          select: {
            id: true,
            service_name: true,
            amount: true,
            token: true,
            status: true,
            created_at: true,
            next_payment_date: true,
          },
          orderBy: { created_at: 'desc' },
          take: limit,
        });

        for (const sub of subscriptions) {
          activities.push({
            id: sub.id,
            type: sub.status === 'cancelled' ? 'subscription_cancelled' : 'subscription_created',
            timestamp: sub.created_at?.toISOString() || new Date().toISOString(),
            title: sub.status === 'cancelled' ? 'Subscription Cancelled' : 'Subscription Created',
            description: sub.service_name || 'Subscription',
            amount: parseFloat(sub.amount || '0'),
            token: sub.token || 'USDC',
            status: STATUS_MAP[sub.status] || 'success',
            metadata: {
              subscription_name: sub.service_name,
            },
          });
        }
      } catch (error) {
        console.error('[Activities] Subscriptions fetch error:', error);
      }

      // Fetch subscription payments
      try {
        const subPayments = await prisma.subscriptionPayment.findMany({
          where: {
            subscription: {
              owner_address: { equals: walletLower, mode: 'insensitive' },
            },
          },
          select: {
            id: true,
            subscription_id: true,
            amount: true,
            status: true,
            tx_hash: true,
            created_at: true,
            subscription: {
              select: {
                service_name: true,
                token: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          take: limit,
        });

        for (const payment of subPayments) {
          const subInfo = payment.subscription;
          if (subInfo) {
            activities.push({
              id: payment.id,
              type: 'subscription_charged',
              timestamp: payment.created_at?.toISOString() || new Date().toISOString(),
              title: 'Subscription Charged',
              description: subInfo.service_name || 'Monthly subscription',
              amount: parseFloat(payment.amount || '0'),
              token: subInfo.token || 'USDC',
              status: STATUS_MAP[payment.status] || 'success',
              metadata: {
                subscription_name: subInfo.service_name,
                tx_hash: payment.tx_hash || undefined,
              },
            });
          }
        }
      } catch (error) {
        console.error('[Activities] Subscription payments fetch error:', error);
      }
    }

    // 4. Fetch vendor additions
    if (!type || type === 'all' || type === 'vendors') {
      try {
        const vendors = await prisma.vendor.findMany({
          where: {
            created_by: { equals: walletLower, mode: 'insensitive' },
          },
          select: {
            id: true,
            name: true,
            company_name: true,
            created_at: true,
            updated_at: true,
          },
          orderBy: { created_at: 'desc' },
          take: limit,
        });

        for (const vendor of vendors) {
          activities.push({
            id: vendor.id,
            type: 'vendor_added',
            timestamp: vendor.created_at?.toISOString() || new Date().toISOString(),
            title: 'Vendor Added',
            description: `New vendor: ${vendor.name || vendor.company_name || 'Unknown'}`,  
            status: 'success',
            metadata: {
              vendor_name: vendor.name || vendor.company_name || 'Unknown',
            },
          });
        }
      } catch (error) {
        console.error('[Activities] Vendors fetch error:', error);
      }
    }

    // 5. Fetch multisig proposals (raw query - table not in Prisma schema)
    if (!type || type === 'all' || type === 'multisig') {
      try {
        const proposals = await prisma.$queryRaw<Array<{
          id: string;
          description: string | null;
          amount_usdc: string | null;
          status: string;
          threshold: number | null;
          current_signatures: number | null;
          created_at: Date;
          executed_at: Date | null;
        }>>`
          SELECT id, description, amount_usdc, status, threshold, current_signatures, created_at, executed_at
          FROM multisig_proposals
          WHERE LOWER(proposer) = ${walletLower}
             OR signers @> ARRAY[${walletLower}]
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;

        for (const proposal of proposals) {
          let activityType: ActivityType = 'multisig_proposed';
          let title = 'Multisig Proposed';

          if (proposal.status === 'executed') {
            activityType = 'multisig_executed';
            title = 'Multisig Executed';
          }

          const timestamp = proposal.executed_at || proposal.created_at;

          activities.push({
            id: proposal.id,
            type: activityType,
            timestamp: timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString(),
            title,
            description: proposal.description || 'Treasury transaction',
            amount: parseFloat(proposal.amount_usdc || '0'),
            token: 'USDC',
            status: proposal.status === 'executed' ? 'success' : 'pending',
            metadata: {
              threshold: `${proposal.current_signatures || 0}/${proposal.threshold || 0}`,
            },
          });
        }
      } catch (error) {
        console.error('[Activities] Multisig proposals fetch error:', error);
        // Table may not exist - gracefully skip
      }
    }

    // Sort all activities by timestamp (newest first)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limit total results
    const limitedActivities = activities.slice(0, limit);

    return NextResponse.json({
      success: true,
      activities: limitedActivities,
      total: limitedActivities.length,
    });

  } catch (error: any) {
    console.error('[Activities] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}, { component: 'activities' });

// Helper function to shorten wallet address
function shortenAddress(address: string): string {
  if (!address) return 'Unknown';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
