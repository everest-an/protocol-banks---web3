/**
 * React Hook for Monetizer Configuration
 * 
 * Manages monetizer configurations and usage statistics.
 */

import { useState, useCallback, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface MonetizeConfigInput {
  name: string;
  description?: string;
  upstreamUrl: string;
  upstreamHeaders?: Record<string, string>;
  pricingModel: 'perRequest' | 'perToken' | 'dynamic' | 'tiered';
  pricingConfig: {
    perRequest?: string;
    perInputToken?: string;
    perOutputToken?: string;
    tiers?: { upTo: number; price: string }[];
    minPrice?: string;
    maxPrice?: string;
  };
  recipientAddress: string;
  network?: 'base' | 'ethereum' | 'polygon' | 'arbitrum';
  token?: 'USDC' | 'USDT';
  rateLimitConfig?: {
    maxPerMinute?: number;
    maxPerHour?: number;
    maxPerDay?: number;
  };
  allowlist?: string[];
  blocklist?: string[];
  isActive?: boolean;
}

export interface MonetizeConfig extends MonetizeConfigInput {
  id: string;
  vendorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageStats {
  totalRequests: number;
  totalRevenue: string;
  uniqueWallets: number;
  averageLatency: number;
  successRate: string;
}

export interface RevenueData {
  date: string;
  revenue: string;
  requests: number;
}

export interface EndpointStats {
  endpoint: string;
  totalRequests: number;
  totalRevenue: string;
  averageLatency: number;
  successRate: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useMonetizeConfigs(vendorId?: string) {
  const [configs, setConfigs] = useState<MonetizeConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch configurations
  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (vendorId) params.set('vendorId', vendorId);
      
      const response = await fetch(`/api/monetize/configs?${params}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to fetch configurations');
      }
      
      setConfigs(data.configs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);
  
  // Create configuration
  const createConfig = useCallback(async (input: MonetizeConfigInput) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/monetize/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, vendorId }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create configuration');
      }
      
      setConfigs((prev: MonetizeConfig[]) => [data.config, ...prev]);
      return data.config;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [vendorId]);
  
  // Update configuration
  const updateConfig = useCallback(async (id: string, updates: Partial<MonetizeConfigInput>) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/monetize/configs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to update configuration');
      }
      
      setConfigs((prev: MonetizeConfig[]) => prev.map((c: MonetizeConfig) => c.id === id ? data.config : c));
      return data.config;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Delete configuration
  const deleteConfig = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/monetize/configs?id=${id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to delete configuration');
      }
      
      setConfigs((prev: MonetizeConfig[]) => prev.filter((c: MonetizeConfig) => c.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Toggle active status
  const toggleActive = useCallback(async (id: string) => {
    const config = configs.find((c: MonetizeConfig) => c.id === id);
    if (!config) return;
    
    return updateConfig(id, { isActive: !config.isActive });
  }, [configs, updateConfig]);
  
  // Initial fetch
  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);
  
  return {
    configs,
    loading,
    error,
    fetchConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    toggleActive,
  };
}

// ============================================================================
// Usage Stats Hook
// ============================================================================

export function useUsageStats(options?: {
  startDate?: string;
  endDate?: string;
  vendorId?: string;
}) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [revenue, setRevenue] = useState<{
    daily: RevenueData[];
    weekly: RevenueData[];
    monthly: RevenueData[];
  } | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch summary stats
  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({ type: 'summary' });
      if (options?.startDate) params.set('startDate', options.startDate);
      if (options?.endDate) params.set('endDate', options.endDate);
      if (options?.vendorId) params.set('vendorId', options.vendorId);
      
      const response = await fetch(`/api/monetize/usage?${params}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to fetch stats');
      }
      
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [options?.startDate, options?.endDate, options?.vendorId]);
  
  // Fetch revenue stats
  const fetchRevenue = useCallback(async () => {
    try {
      const response = await fetch('/api/monetize/usage?type=revenue');
      const data = await response.json();
      
      if (response.ok) {
        setRevenue(data.revenue);
      }
    } catch {
      // Ignore revenue fetch errors
    }
  }, []);
  
  // Fetch endpoint stats
  const fetchEndpoints = useCallback(async () => {
    try {
      const params = new URLSearchParams({ type: 'endpoints' });
      if (options?.vendorId) params.set('vendorId', options.vendorId);
      
      const response = await fetch(`/api/monetize/usage?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setEndpoints(data.endpoints);
      }
    } catch {
      // Ignore endpoint fetch errors
    }
  }, [options?.vendorId]);
  
  // Initial fetch
  useEffect(() => {
    fetchStats();
    fetchRevenue();
    fetchEndpoints();
  }, [fetchStats, fetchRevenue, fetchEndpoints]);
  
  return {
    stats,
    revenue,
    endpoints,
    loading,
    error,
    refresh: () => {
      fetchStats();
      fetchRevenue();
      fetchEndpoints();
    },
  };
}
