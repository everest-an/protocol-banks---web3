/**
 * Activities API Endpoint
 * GET /api/activities - Get user's recent activities (payments, subscriptions, etc.)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

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

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    
    // Get query params
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const limit = parseInt(searchParams.get('limit') || '15', 10);
    const type = searchParams.get('type'); // Filter by type: payments, subscriptions, etc.
    
    if (!wallet) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const walletLower = wallet.toLowerCase();
    const activities: Activity[] = [];

    // 1. Fetch payments (sent & received)
    if (!type || type === 'all' || type === 'payments') {
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          id,
          tx_hash,
          from_address,
          to_address,
          token_symbol,
          amount,
          amount_usd,
          status,
          timestamp,
          notes,
          vendor_id,
          vendors(name)
        `)
        .or(`from_address.ilike.${walletLower},to_address.ilike.${walletLower}`)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (!paymentsError && payments) {
        for (const payment of payments) {
          const isSent = payment.from_address?.toLowerCase() === walletLower;
          const vendorName = (payment.vendors as any)?.name;
          
          activities.push({
            id: payment.id,
            type: isSent ? 'payment_sent' : 'payment_received',
            timestamp: payment.timestamp || new Date().toISOString(),
            title: isSent ? 'Payment Sent' : 'Payment Received',
            description: vendorName 
              ? (isSent ? `Sent to ${vendorName}` : `Received from ${vendorName}`)
              : (isSent ? `Sent to ${shortenAddress(payment.to_address)}` : `Received from ${shortenAddress(payment.from_address)}`),
            amount: parseFloat(payment.amount_usd || payment.amount || '0'),
            token: payment.token_symbol || 'USDC',
            status: STATUS_MAP[payment.status] || 'pending',
            metadata: {
              tx_hash: payment.tx_hash,
              vendor_name: vendorName,
            },
          });
        }
      }
    }

    // 2. Fetch batch payments
    if (!type || type === 'all' || type === 'batch') {
      const { data: batchPayments, error: batchError } = await supabase
        .from('batch_payments')
        .select('id, batch_name, total_recipients, total_amount_usd, status, created_at')
        .ilike('wallet_address', walletLower)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!batchError && batchPayments) {
        for (const batch of batchPayments) {
          activities.push({
            id: batch.id,
            type: 'batch_payment',
            timestamp: batch.created_at,
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
      }
    }

    // 3. Fetch subscriptions
    if (!type || type === 'all' || type === 'subscriptions') {
      const { data: subscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select('id, service_name, amount, token_symbol, status, created_at, next_payment_date')
        .ilike('payer_address', walletLower)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!subsError && subscriptions) {
        for (const sub of subscriptions) {
          activities.push({
            id: sub.id,
            type: sub.status === 'cancelled' ? 'subscription_cancelled' : 'subscription_created',
            timestamp: sub.created_at,
            title: sub.status === 'cancelled' ? 'Subscription Cancelled' : 'Subscription Created',
            description: sub.service_name || 'Subscription',
            amount: parseFloat(sub.amount || '0'),
            token: sub.token_symbol || 'USDC',
            status: STATUS_MAP[sub.status] || 'success',
            metadata: {
              subscription_name: sub.service_name,
            },
          });
        }
      }

      // Fetch subscription payments
      const { data: subPayments, error: subPaymentsError } = await supabase
        .from('subscription_payments')
        .select(`
          id,
          subscription_id,
          amount,
          status,
          tx_hash,
          processed_at,
          subscriptions(service_name, token_symbol)
        `)
        .eq('subscriptions.payer_address', walletLower)
        .order('processed_at', { ascending: false })
        .limit(limit);

      if (!subPaymentsError && subPayments) {
        for (const payment of subPayments) {
          const subInfo = payment.subscriptions as any;
          if (subInfo) {
            activities.push({
              id: payment.id,
              type: 'subscription_charged',
              timestamp: payment.processed_at,
              title: 'Subscription Charged',
              description: subInfo.service_name || 'Monthly subscription',
              amount: parseFloat(payment.amount || '0'),
              token: subInfo.token_symbol || 'USDC',
              status: STATUS_MAP[payment.status] || 'success',
              metadata: {
                subscription_name: subInfo.service_name,
                tx_hash: payment.tx_hash,
              },
            });
          }
        }
      }
    }

    // 4. Fetch vendor additions
    if (!type || type === 'all' || type === 'vendors') {
      const { data: vendors, error: vendorsError } = await supabase
        .from('vendors')
        .select('id, name, created_at, updated_at')
        .ilike('created_by', walletLower)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!vendorsError && vendors) {
        for (const vendor of vendors) {
          activities.push({
            id: vendor.id,
            type: 'vendor_added',
            timestamp: vendor.created_at,
            title: 'Vendor Added',
            description: `New vendor: ${vendor.name}`,
            status: 'success',
            metadata: {
              vendor_name: vendor.name,
            },
          });
        }
      }
    }

    // 5. Fetch multisig proposals
    if (!type || type === 'all' || type === 'multisig') {
      const { data: proposals, error: proposalsError } = await supabase
        .from('multisig_proposals')
        .select('id, description, amount_usdc, status, threshold, current_signatures, created_at, executed_at')
        .or(`proposer.ilike.${walletLower},signers.cs.{${walletLower}}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!proposalsError && proposals) {
        for (const proposal of proposals) {
          let activityType: ActivityType = 'multisig_proposed';
          let title = 'Multisig Proposed';
          
          if (proposal.status === 'executed') {
            activityType = 'multisig_executed';
            title = 'Multisig Executed';
          }

          activities.push({
            id: proposal.id,
            type: activityType,
            timestamp: proposal.executed_at || proposal.created_at,
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
      { error: 'Internal Server Error', message: error.message || 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

// Helper function to shorten wallet address
function shortenAddress(address: string): string {
  if (!address) return 'Unknown';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
