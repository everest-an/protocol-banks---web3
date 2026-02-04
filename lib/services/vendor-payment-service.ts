/**
 * Vendor Payment Service
 * Manages payment-vendor relationships and vendor statistics
 */

// Lazy import to avoid bundling pg/prisma on client side
const getPrisma = () => require('@/lib/prisma').prisma;

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
  
  constructor() {
    // Singleton, no init
  }

  /**
   * Auto-link a payment to a vendor based on to_address
   */
  async autoLinkPayment(paymentId: string, toAddress: string): Promise<string | null> {
    const normalizedAddress = toAddress.toLowerCase();

    // Find vendor by wallet address (case-insensitive)
    const vendor = await getPrisma().vendor.findFirst({
      where: {
        wallet_address: {
          mode: 'insensitive',
          equals: normalizedAddress
        }
      },
      select: { id: true }
    });

    if (!vendor) {
      return null;
    }

    // Update payment with vendor_id
    try {
      await getPrisma().payment.update({
        where: { id: paymentId },
        data: { vendor_id: vendor.id }
      });
      return vendor.id;
    } catch (error) {
      console.error('[VendorPayment] Failed to link payment:', error);
      return null;
    }
  }

  /**
   * Update vendor statistics after a payment
   */
  async updateVendorStats(vendorId: string, amount: string): Promise<void> {
    // Get current vendor stats
    const vendor = await getPrisma().vendor.findUnique({
      where: { id: vendorId },
      select: { monthly_volume: true, transaction_count: true }
    });

    if (!vendor) {
      throw new Error('Vendor not found');
    }

    const newMonthlyVolume = (parseFloat(vendor.monthly_volume || '0') + parseFloat(amount)).toString();
    const newTransactionCount = (vendor.transaction_count || 0) + 1;

    // Update vendor stats
    try {
       await getPrisma().vendor.update({
        where: { id: vendorId },
        data: {
          monthly_volume: newMonthlyVolume,
          transaction_count: newTransactionCount,
          updated_at: new Date(),
        }
      });
    } catch (error: any) {
      throw new Error(`Failed to update vendor stats: ${error.message}`);
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
    const vendor = await getPrisma().vendor.findFirst({
      where: {
        id: vendorId,
        owner_address: {
          mode: 'insensitive',
          equals: ownerAddress.toLowerCase()
        }
      },
      select: { id: true }
    });

    if (!vendor) {
      throw new Error('Vendor not found or access denied');
    }

    // Build query conditions
    const where: any = {
      vendor_id: vendorId
    };

    if (status) {
      where.status = status;
    }

    const db = getPrisma();
    const [payments, count] = await db.$transaction([
      db.payment.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.payment.count({ where })
    ]);

    // Map Prisma Payment to VendorPayment interface
    const mappedPayments: VendorPayment[] = payments.map(p => ({
      id: p.id,
      vendor_id: p.vendor_id,
      from_address: p.from_address,
      to_address: p.to_address,
      amount: p.amount,
      token: p.token,
      chain_id: parseInt(p.chain) || 0,
      status: p.status,
      tx_hash: p.tx_hash || undefined,
      created_at: p.created_at.toISOString()
    }));

    return {
      payments: mappedPayments,
      total: count,
    };
  }

  /**
   * Get vendor statistics
   */
  async getVendorStats(vendorId: string, ownerAddress: string): Promise<VendorStats> {
    // Verify vendor ownership
    const vendor = await getPrisma().vendor.findFirst({
      where: {
        id: vendorId,
        owner_address: {
          mode: 'insensitive',
          equals: ownerAddress.toLowerCase()
        }
      },
      select: {
        monthly_volume: true,
        transaction_count: true
      }
    });

    if (!vendor) {
      throw new Error('Vendor not found or access denied');
    }

    // Get total volume from all completed payments
    // Using aggregation for better performance than fetching all records
    const aggregator = await getPrisma().payment.aggregate({
      _sum: {
        amount: true
      },
      where: {
        vendor_id: vendorId,
        status: 'completed'
      }
    });

    const totalVolume = Number(aggregator._sum.amount || 0);
    const transactionCount = vendor.transaction_count || 0;
    const monthlyVolume = Number(vendor.monthly_volume || 0);
    
    // Avoid division by zero
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
    const result = await getPrisma().payment.updateMany({
      where: { vendor_id: vendorId },
      data: { vendor_id: null }
    });

    return result.count;
  }

  /**
   * Reset monthly volume for all vendors (for monthly reset job)
   */
  async resetMonthlyVolumes(): Promise<number> {
    const result = await getPrisma().vendor.updateMany({
      where: {
        monthly_volume: {
          not: 0
        }
      },
      data: {
        monthly_volume: 0,
        updated_at: new Date(),
      }
    });

    return result.count;
  }
}

// Export singleton instance
export const vendorPaymentService = new VendorPaymentService();
