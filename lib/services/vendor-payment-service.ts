/**
 * Vendor Payment Service
 * Manages payment-vendor relationships and vendor statistics
 */

import { createClient } from '@/lib/supabase-client';

// ============================================
// Types
// ============================================

export interface Vendor {
  id: string;
  name: string;
  wallet_address: string;
  owner_address: string;
  monthly_volume: string;
  transaction_count: number;
  created_at: string;
  updated_at: string;
}

export interface VendorPayment {
  id: string;
  vendor_id: string | null;
  from_address: string;
  to_address: string;
  amount: string;
  token: string;
  chain_id: number;
  status: string;
  tx_hash?: string;
  created_at: string;
}

export interface VendorStats {
  total_volume: number;
  transaction_count: number;
  monthly_volume: number;
  average_transaction: number;
}

// ============================================
// Vendor Payment Service
// ============================================

export class VendorPaymentService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Auto-link a payment to a vendor based on to_address
   */
  async autoLinkPayment(paymentId: string, toAddress: string): Promise<string | null> {
    const normalizedAddress = toAddress.toLowerCase();

    // Find vendor by wallet address (case-insensitive)
    const { data: vendor, error: vendorError } = await this.supabase
      .from('vendors')
      .select('id')
      .ilike('wallet_address', normalizedAddress)
      .single();

    if (vendorError || !vendor) {
      return null;
    }

    // Update payment with vendor_id
    const { error: updateError } = await this.supabase
      .from('payments')
      .update({ vendor_id: vendor.id })
      .eq('id', paymentId);

    if (updateError) {
      console.error('[VendorPayment] Failed to link payment:', updateError);
      return null;
    }

    return vendor.id;
  }

  /**
   * Update vendor statistics after a payment
   */
  async updateVendorStats(vendorId: string, amount: string): Promise<void> {
    // Get current vendor stats
    const { data: vendor, error: getError } = await this.supabase
      .from('vendors')
      .select('monthly_volume, transaction_count')
      .eq('id', vendorId)
      .single();

    if (getError || !vendor) {
      throw new Error('Vendor not found');
    }

    const newMonthlyVolume = (parseFloat(vendor.monthly_volume || '0') + parseFloat(amount)).toString();
    const newTransactionCount = (vendor.transaction_count || 0) + 1;

    // Update vendor stats
    const { error: updateError } = await this.supabase
      .from('vendors')
      .update({
        monthly_volume: newMonthlyVolume,
        transaction_count: newTransactionCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId);

    if (updateError) {
      throw new Error(`Failed to update vendor stats: ${updateError.message}`);
    }
  }

  /**
   * Get payments for a vendor
   */
  async getVendorPayments(
    vendorId: string,
    ownerAddress: string,
    options: { limit?: number; offset?: number; status?: string } = {}
  ): Promise<{ payments: VendorPayment[]; total: number }> {
    const { limit = 50, offset = 0, status } = options;

    // Verify vendor ownership
    const { data: vendor, error: vendorError } = await this.supabase
      .from('vendors')
      .select('id')
      .eq('id', vendorId)
      .eq('owner_address', ownerAddress.toLowerCase())
      .single();

    if (vendorError || !vendor) {
      throw new Error('Vendor not found or access denied');
    }

    // Build query
    let query = this.supabase
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get vendor payments: ${error.message}`);
    }

    return {
      payments: (data || []) as VendorPayment[],
      total: count || 0,
    };
  }

  /**
   * Get vendor statistics
   */
  async getVendorStats(vendorId: string, ownerAddress: string): Promise<VendorStats> {
    // Verify vendor ownership
    const { data: vendor, error: vendorError } = await this.supabase
      .from('vendors')
      .select('monthly_volume, transaction_count')
      .eq('id', vendorId)
      .eq('owner_address', ownerAddress.toLowerCase())
      .single();

    if (vendorError || !vendor) {
      throw new Error('Vendor not found or access denied');
    }

    // Get total volume from all payments
    const { data: payments, error: paymentsError } = await this.supabase
      .from('payments')
      .select('amount')
      .eq('vendor_id', vendorId)
      .eq('status', 'completed');

    if (paymentsError) {
      throw new Error(`Failed to get payment stats: ${paymentsError.message}`);
    }

    const totalVolume = (payments || []).reduce(
      (sum: number, p: { amount: string }) => sum + parseFloat(p.amount || '0'),
      0
    );

    const transactionCount = vendor.transaction_count || 0;
    const monthlyVolume = parseFloat(vendor.monthly_volume || '0');
    const averageTransaction = transactionCount > 0 ? totalVolume / transactionCount : 0;

    return {
      total_volume: totalVolume,
      transaction_count: transactionCount,
      monthly_volume: monthlyVolume,
      average_transaction: averageTransaction,
    };
  }

  /**
   * Handle vendor deletion - preserve payments but set vendor_id to null
   */
  async handleVendorDeletion(vendorId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('payments')
      .update({ vendor_id: null })
      .eq('vendor_id', vendorId)
      .select('id');

    if (error) {
      throw new Error(`Failed to unlink payments: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Reset monthly volume for all vendors (for monthly reset job)
   */
  async resetMonthlyVolumes(): Promise<number> {
    const { data, error } = await this.supabase
      .from('vendors')
      .update({
        monthly_volume: '0',
        updated_at: new Date().toISOString(),
      })
      .neq('monthly_volume', '0')
      .select('id');

    if (error) {
      throw new Error(`Failed to reset monthly volumes: ${error.message}`);
    }

    return data?.length || 0;
  }
}

// Export singleton instance
export const vendorPaymentService = new VendorPaymentService();
