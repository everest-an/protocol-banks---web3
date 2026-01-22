/**
 * Analytics Service
 * Provides payment analytics and reporting
 */

import { createClient } from '@/lib/supabase-client';

// ============================================
// Types
// ============================================

export interface AnalyticsSummary {
  total_volume: number;
  total_count: number;
  volume_growth_percent: number;
  count_growth_percent: number;
  average_transaction: number;
  period: string;
}

export interface MonthlyData {
  month: string;
  volume: number;
  count: number;
}

export interface VendorAnalytics {
  vendor_id: string;
  vendor_name: string;
  volume: number;
  count: number;
  percentage: number;
}

export interface ChainAnalytics {
  chain_id: number;
  chain_name: string;
  volume: number;
  count: number;
  percentage: number;
}

export interface DateRange {
  start_date?: string;
  end_date?: string;
}

// ============================================
// Constants
// ============================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum',
  10: 'Optimism',
  43114: 'Avalanche',
};

// ============================================
// Analytics Service
// ============================================

export class AnalyticsService {
  private supabase;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Get analytics summary
   */
  async getSummary(ownerAddress: string, dateRange?: DateRange): Promise<AnalyticsSummary> {
    const cacheKey = `summary:${ownerAddress}:${JSON.stringify(dateRange)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Get current period data
    const currentData = await this.getPaymentStats(ownerAddress, dateRange);
    
    // Get previous period data for comparison
    const previousRange = this.getPreviousPeriod(dateRange);
    const previousData = await this.getPaymentStats(ownerAddress, previousRange);

    const summary: AnalyticsSummary = {
      total_volume: currentData.volume,
      total_count: currentData.count,
      volume_growth_percent: this.calculateGrowth(previousData.volume, currentData.volume),
      count_growth_percent: this.calculateGrowth(previousData.count, currentData.count),
      average_transaction: currentData.count > 0 ? currentData.volume / currentData.count : 0,
      period: dateRange?.start_date && dateRange?.end_date 
        ? `${dateRange.start_date} to ${dateRange.end_date}`
        : 'all time',
    };

    this.setCache(cacheKey, summary);
    return summary;
  }

  /**
   * Get monthly data for the past 12 months
   */
  async getMonthlyData(ownerAddress: string): Promise<MonthlyData[]> {
    const cacheKey = `monthly:${ownerAddress}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const months: MonthlyData[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startDate = date.toISOString().slice(0, 10);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);

      const stats = await this.getPaymentStats(ownerAddress, { start_date: startDate, end_date: endDate });
      
      months.push({
        month: date.toISOString().slice(0, 7), // YYYY-MM format
        volume: stats.volume,
        count: stats.count,
      });
    }

    this.setCache(cacheKey, months);
    return months;
  }

  /**
   * Get analytics by vendor
   */
  async getByVendor(ownerAddress: string, dateRange?: DateRange): Promise<VendorAnalytics[]> {
    const cacheKey = `by-vendor:${ownerAddress}:${JSON.stringify(dateRange)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    let query = this.supabase
      .from('payments')
      .select(`
        vendor_id,
        amount,
        vendors!inner(name)
      `)
      .eq('created_by', ownerAddress.toLowerCase())
      .eq('status', 'completed')
      .not('vendor_id', 'is', null);

    if (dateRange?.start_date) {
      query = query.gte('created_at', dateRange.start_date);
    }
    if (dateRange?.end_date) {
      query = query.lte('created_at', dateRange.end_date);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Analytics] By vendor error:', error);
      return [];
    }

    // Aggregate by vendor
    const vendorMap = new Map<string, { name: string; volume: number; count: number }>();
    let totalVolume = 0;

    for (const payment of data || []) {
      const vendorId = payment.vendor_id;
      const amount = parseFloat(payment.amount) || 0;
      const vendorName = (payment.vendors as any)?.name || 'Unknown';

      if (!vendorMap.has(vendorId)) {
        vendorMap.set(vendorId, { name: vendorName, volume: 0, count: 0 });
      }

      const vendor = vendorMap.get(vendorId)!;
      vendor.volume += amount;
      vendor.count += 1;
      totalVolume += amount;
    }

    const result: VendorAnalytics[] = Array.from(vendorMap.entries())
      .map(([vendor_id, data]) => ({
        vendor_id,
        vendor_name: data.name,
        volume: data.volume,
        count: data.count,
        percentage: totalVolume > 0 ? (data.volume / totalVolume) * 100 : 0,
      }))
      .sort((a, b) => b.volume - a.volume);

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Get analytics by chain
   */
  async getByChain(ownerAddress: string, dateRange?: DateRange): Promise<ChainAnalytics[]> {
    const cacheKey = `by-chain:${ownerAddress}:${JSON.stringify(dateRange)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    let query = this.supabase
      .from('payments')
      .select('chain_id, amount')
      .eq('created_by', ownerAddress.toLowerCase())
      .eq('status', 'completed');

    if (dateRange?.start_date) {
      query = query.gte('created_at', dateRange.start_date);
    }
    if (dateRange?.end_date) {
      query = query.lte('created_at', dateRange.end_date);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Analytics] By chain error:', error);
      return [];
    }

    // Aggregate by chain
    const chainMap = new Map<number, { volume: number; count: number }>();
    let totalVolume = 0;

    for (const payment of data || []) {
      const chainId = payment.chain_id || 1;
      const amount = parseFloat(payment.amount) || 0;

      if (!chainMap.has(chainId)) {
        chainMap.set(chainId, { volume: 0, count: 0 });
      }

      const chain = chainMap.get(chainId)!;
      chain.volume += amount;
      chain.count += 1;
      totalVolume += amount;
    }

    const result: ChainAnalytics[] = Array.from(chainMap.entries())
      .map(([chain_id, data]) => ({
        chain_id,
        chain_name: CHAIN_NAMES[chain_id] || `Chain ${chain_id}`,
        volume: data.volume,
        count: data.count,
        percentage: totalVolume > 0 ? (data.volume / totalVolume) * 100 : 0,
      }))
      .sort((a, b) => b.volume - a.volume);

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Get payment stats for a period
   */
  private async getPaymentStats(
    ownerAddress: string,
    dateRange?: DateRange
  ): Promise<{ volume: number; count: number }> {
    let query = this.supabase
      .from('payments')
      .select('amount')
      .eq('created_by', ownerAddress.toLowerCase())
      .eq('status', 'completed');

    if (dateRange?.start_date) {
      query = query.gte('created_at', dateRange.start_date);
    }
    if (dateRange?.end_date) {
      query = query.lte('created_at', dateRange.end_date);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Analytics] Stats error:', error);
      return { volume: 0, count: 0 };
    }

    const payments = data || [];
    const volume = payments.reduce((sum: number, p: { amount: string }) => sum + (parseFloat(p.amount) || 0), 0);

    return {
      volume,
      count: payments.length,
    };
  }

  /**
   * Calculate growth percentage
   */
  private calculateGrowth(previous: number, current: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  }

  /**
   * Get previous period for comparison
   */
  private getPreviousPeriod(dateRange?: DateRange): DateRange | undefined {
    if (!dateRange?.start_date || !dateRange?.end_date) {
      return undefined;
    }

    const start = new Date(dateRange.start_date);
    const end = new Date(dateRange.end_date);
    const duration = end.getTime() - start.getTime();

    return {
      start_date: new Date(start.getTime() - duration).toISOString().slice(0, 10),
      end_date: new Date(start.getTime() - 1).toISOString().slice(0, 10),
    };
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cache
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
