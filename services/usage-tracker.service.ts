/**
 * Usage Tracker Service
 * 
 * Tracks API usage and revenue for monetized endpoints.
 * Supports both in-memory and database backends.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface UsageRecord {
  id?: string;
  walletAddress: string;
  endpoint: string;
  method: string;
  amountCharged: string;
  paymentTxHash?: string;
  timestamp: Date;
  responseStatus?: number;
  latencyMs?: number;
  tokensInput?: number;
  tokensOutput?: number;
  metadata?: Record<string, unknown>;
}

export interface UsageStats {
  totalRequests: number;
  totalRevenue: string;
  uniqueWallets: number;
  averageLatency: number;
  successRate: number;
}

export interface RevenueStats {
  daily: { date: string; revenue: string; requests: number }[];
  weekly: { week: string; revenue: string; requests: number }[];
  monthly: { month: string; revenue: string; requests: number }[];
}

export interface WalletUsage {
  walletAddress: string;
  totalRequests: number;
  totalSpent: string;
  lastRequest: Date;
}

export interface EndpointUsage {
  endpoint: string;
  totalRequests: number;
  totalRevenue: string;
  averageLatency: number;
}

export interface UsageTrackerConfig {
  /** Use database backend (requires Supabase) */
  useDatabase?: boolean;
  /** Supabase URL */
  supabaseUrl?: string;
  /** Supabase service key */
  supabaseKey?: string;
  /** Max records to keep in memory */
  maxMemoryRecords?: number;
  /** Flush interval for batch inserts (ms) */
  flushInterval?: number;
}

// ============================================================================
// In-Memory Usage Tracker
// ============================================================================

export class InMemoryUsageTracker {
  private records: UsageRecord[] = [];
  private maxRecords: number;
  
  constructor(maxRecords = 10000) {
    this.maxRecords = maxRecords;
  }
  
  async track(record: UsageRecord): Promise<void> {
    this.records.push({
      ...record,
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    });
    
    // Trim old records
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }
  
  async getRequestCount(walletAddress: string, windowMs: number): Promise<number> {
    const cutoff = Date.now() - windowMs;
    return this.records.filter(
      r => r.walletAddress.toLowerCase() === walletAddress.toLowerCase() &&
           r.timestamp.getTime() > cutoff
    ).length;
  }
  
  async getUsageStats(startDate?: Date, endDate?: Date): Promise<UsageStats> {
    let filtered = this.records;
    
    if (startDate) {
      filtered = filtered.filter(r => r.timestamp >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(r => r.timestamp <= endDate);
    }
    
    const totalRequests = filtered.length;
    const totalRevenue = filtered.reduce(
      (sum, r) => sum + parseFloat(r.amountCharged || '0'),
      0
    ).toFixed(6);
    
    const uniqueWallets = new Set(filtered.map(r => r.walletAddress.toLowerCase())).size;
    
    const latencies = filtered.filter(r => r.latencyMs).map(r => r.latencyMs!);
    const averageLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;
    
    const successCount = filtered.filter(
      r => r.responseStatus && r.responseStatus >= 200 && r.responseStatus < 300
    ).length;
    const successRate = totalRequests > 0 ? successCount / totalRequests : 0;
    
    return {
      totalRequests,
      totalRevenue,
      uniqueWallets,
      averageLatency,
      successRate,
    };
  }
  
  async getWalletUsage(walletAddress: string): Promise<WalletUsage | null> {
    const walletRecords = this.records.filter(
      r => r.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );
    
    if (walletRecords.length === 0) return null;
    
    return {
      walletAddress,
      totalRequests: walletRecords.length,
      totalSpent: walletRecords.reduce(
        (sum, r) => sum + parseFloat(r.amountCharged || '0'),
        0
      ).toFixed(6),
      lastRequest: walletRecords[walletRecords.length - 1].timestamp,
    };
  }
  
  async getEndpointUsage(): Promise<EndpointUsage[]> {
    const endpointMap = new Map<string, UsageRecord[]>();
    
    for (const record of this.records) {
      const existing = endpointMap.get(record.endpoint) ?? [];
      existing.push(record);
      endpointMap.set(record.endpoint, existing);
    }
    
    return Array.from(endpointMap.entries()).map(([endpoint, records]) => {
      const latencies = records.filter(r => r.latencyMs).map(r => r.latencyMs!);
      return {
        endpoint,
        totalRequests: records.length,
        totalRevenue: records.reduce(
          (sum, r) => sum + parseFloat(r.amountCharged || '0'),
          0
        ).toFixed(6),
        averageLatency: latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : 0,
      };
    });
  }
  
  getRecords(): UsageRecord[] {
    return [...this.records];
  }
  
  clear(): void {
    this.records = [];
  }
}

// ============================================================================
// Database Usage Tracker (Supabase)
// ============================================================================

export class DatabaseUsageTracker {
  private supabase: SupabaseClient;
  private buffer: UsageRecord[] = [];
  private flushInterval: number;
  private flushTimer?: NodeJS.Timeout;
  
  constructor(config: { supabaseUrl: string; supabaseKey: string; flushInterval?: number }) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.flushInterval = config.flushInterval ?? 5000;
    this.startFlushTimer();
  }
  
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
  }
  
  async track(record: UsageRecord): Promise<void> {
    this.buffer.push(record);
    
    // Flush immediately if buffer is large
    if (this.buffer.length >= 100) {
      await this.flush();
    }
  }
  
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const records = [...this.buffer];
    this.buffer = [];
    
    try {
      const { error } = await this.supabase
        .from('api_usage')
        .insert(records.map(r => ({
          wallet_address: r.walletAddress,
          endpoint: r.endpoint,
          method: r.method,
          amount_charged: r.amountCharged,
          payment_tx_hash: r.paymentTxHash,
          request_timestamp: r.timestamp.toISOString(),
          response_status: r.responseStatus,
          latency_ms: r.latencyMs,
          tokens_input: r.tokensInput,
          tokens_output: r.tokensOutput,
          metadata: r.metadata,
        })));
      
      if (error) {
        console.error('Failed to flush usage records:', error);
        // Re-add failed records to buffer
        this.buffer.unshift(...records);
      }
    } catch (error) {
      console.error('Failed to flush usage records:', error);
      this.buffer.unshift(...records);
    }
  }
  
  async getRequestCount(walletAddress: string, windowMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    
    const { count, error } = await this.supabase
      .from('api_usage')
      .select('*', { count: 'exact', head: true })
      .eq('wallet_address', walletAddress.toLowerCase())
      .gte('request_timestamp', cutoff);
    
    if (error) {
      console.error('Failed to get request count:', error);
      return 0;
    }
    
    return count ?? 0;
  }
  
  async getUsageStats(startDate?: Date, endDate?: Date): Promise<UsageStats> {
    let query = this.supabase
      .from('api_usage')
      .select('wallet_address, amount_charged, latency_ms, response_status');
    
    if (startDate) {
      query = query.gte('request_timestamp', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('request_timestamp', endDate.toISOString());
    }
    
    const { data, error } = await query;
    
    if (error || !data) {
      console.error('Failed to get usage stats:', error);
      return {
        totalRequests: 0,
        totalRevenue: '0',
        uniqueWallets: 0,
        averageLatency: 0,
        successRate: 0,
      };
    }
    
    const totalRequests = data.length;
    const totalRevenue = data.reduce(
      (sum, r) => sum + parseFloat(r.amount_charged || '0'),
      0
    ).toFixed(6);
    
    const uniqueWallets = new Set(data.map(r => r.wallet_address?.toLowerCase())).size;
    
    const latencies = data.filter(r => r.latency_ms).map(r => r.latency_ms);
    const averageLatency = latencies.length > 0
      ? latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length
      : 0;
    
    const successCount = data.filter(
      r => r.response_status && r.response_status >= 200 && r.response_status < 300
    ).length;
    const successRate = totalRequests > 0 ? successCount / totalRequests : 0;
    
    return {
      totalRequests,
      totalRevenue,
      uniqueWallets,
      averageLatency,
      successRate,
    };
  }
  
  async getRevenueStats(): Promise<RevenueStats> {
    // Daily stats (last 30 days)
    const { data: dailyData } = await this.supabase.rpc('get_daily_revenue', {
      days_back: 30,
    });
    
    // Weekly stats (last 12 weeks)
    const { data: weeklyData } = await this.supabase.rpc('get_weekly_revenue', {
      weeks_back: 12,
    });
    
    // Monthly stats (last 12 months)
    const { data: monthlyData } = await this.supabase.rpc('get_monthly_revenue', {
      months_back: 12,
    });
    
    return {
      daily: dailyData ?? [],
      weekly: weeklyData ?? [],
      monthly: monthlyData ?? [],
    };
  }
  
  async getWalletUsage(walletAddress: string): Promise<WalletUsage | null> {
    const { data, error } = await this.supabase
      .from('api_usage')
      .select('amount_charged, request_timestamp')
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('request_timestamp', { ascending: false });
    
    if (error || !data || data.length === 0) {
      return null;
    }
    
    return {
      walletAddress,
      totalRequests: data.length,
      totalSpent: data.reduce(
        (sum, r) => sum + parseFloat(r.amount_charged || '0'),
        0
      ).toFixed(6),
      lastRequest: new Date(data[0].request_timestamp),
    };
  }
  
  async getEndpointUsage(): Promise<EndpointUsage[]> {
    const { data, error } = await this.supabase
      .from('api_usage')
      .select('endpoint, amount_charged, latency_ms');
    
    if (error || !data) {
      return [];
    }
    
    const endpointMap = new Map<string, typeof data>();
    
    for (const record of data) {
      const existing = endpointMap.get(record.endpoint) ?? [];
      existing.push(record);
      endpointMap.set(record.endpoint, existing);
    }
    
    return Array.from(endpointMap.entries()).map(([endpoint, records]) => {
      const latencies = records.filter(r => r.latency_ms).map(r => r.latency_ms);
      return {
        endpoint,
        totalRequests: records.length,
        totalRevenue: records.reduce(
          (sum, r) => sum + parseFloat(r.amount_charged || '0'),
          0
        ).toFixed(6),
        averageLatency: latencies.length > 0
          ? latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length
          : 0,
      };
    });
  }
  
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createUsageTracker(config: UsageTrackerConfig = {}) {
  if (config.useDatabase && config.supabaseUrl && config.supabaseKey) {
    return new DatabaseUsageTracker({
      supabaseUrl: config.supabaseUrl,
      supabaseKey: config.supabaseKey,
      flushInterval: config.flushInterval,
    });
  }
  
  return new InMemoryUsageTracker(config.maxMemoryRecords);
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultTracker: InMemoryUsageTracker | DatabaseUsageTracker | null = null;

export function getUsageTracker(): InMemoryUsageTracker | DatabaseUsageTracker {
  if (!defaultTracker) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseKey) {
      defaultTracker = new DatabaseUsageTracker({
        supabaseUrl,
        supabaseKey,
      });
    } else {
      defaultTracker = new InMemoryUsageTracker();
    }
  }
  
  return defaultTracker;
}
