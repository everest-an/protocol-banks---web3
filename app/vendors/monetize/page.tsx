'use client';

/**
 * API Monetizer Configuration Page
 * 
 * Allows vendors to create and manage monetized API endpoints.
 */

import React, { useState } from 'react';
import { useMonetizeConfigs, useUsageStats, type MonetizeConfigInput, type MonetizeConfig, type EndpointStats } from '@/hooks/use-monetizer-config';

// ============================================================================
// Types
// ============================================================================

type PricingModel = 'perRequest' | 'perToken' | 'tiered';

// ============================================================================
// Main Page Component
// ============================================================================

export default function MonetizePage() {
  const { configs, loading, error, createConfig, updateConfig, deleteConfig, toggleActive } = useMonetizeConfigs();
  const { stats, revenue, endpoints } = useUsageStats();
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              API Monetizer
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Monetize your APIs with x402 payments
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + New Configuration
          </button>
        </div>
        
        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <StatCard title="Total Requests" value={stats.totalRequests.toLocaleString()} />
            <StatCard title="Total Revenue" value={`$${stats.totalRevenue}`} />
            <StatCard title="Unique Wallets" value={stats.uniqueWallets.toLocaleString()} />
            <StatCard title="Avg Latency" value={`${stats.averageLatency}ms`} />
            <StatCard title="Success Rate" value={stats.successRate} />
          </div>
        )}
        
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}
        
        {/* Create Form Modal */}
        {showCreateForm && (
          <CreateConfigModal
            onClose={() => setShowCreateForm(false)}
            onCreate={async (config) => {
              await createConfig(config);
              setShowCreateForm(false);
            }}
          />
        )}
        
        {/* Configurations List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Configurations
            </h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : configs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No configurations yet. Create one to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {configs.map((config: MonetizeConfig) => (
                <ConfigRow
                  key={config.id}
                  config={config}
                  onToggle={() => toggleActive(config.id)}
                  onDelete={() => deleteConfig(config.id)}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Endpoint Stats */}
        {endpoints.length > 0 && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Endpoint Statistics
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Endpoint
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Requests
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Avg Latency
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Success Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {endpoints.map((ep: EndpointStats) => (
                    <tr key={ep.endpoint}>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-mono">
                        {ep.endpoint}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 text-right">
                        {ep.totalRequests.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 text-right">
                        ${ep.totalRevenue}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 text-right">
                        {ep.averageLatency}ms
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 text-right">
                        {ep.successRate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Stat Card Component
// ============================================================================

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}

// ============================================================================
// Config Row Component
// ============================================================================

function ConfigRow({
  config,
  onToggle,
  onDelete,
}: {
  config: {
    id: string;
    name: string;
    upstreamUrl: string;
    pricingModel: string;
    recipientAddress: string;
    network?: string;
    token?: string;
    isActive?: boolean;
  };
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  
  return (
    <div className="px-6 py-4 flex items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h3 className="font-medium text-gray-900 dark:text-white">{config.name}</h3>
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            config.isActive
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {config.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">
          {config.upstreamUrl}
        </p>
        <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Model: {config.pricingModel}</span>
          <span>Network: {config.network ?? 'base'}</span>
          <span>Token: {config.token ?? 'USDC'}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          {config.isActive ? 'Disable' : 'Enable'}
        </button>
        
        {showDelete ? (
          <div className="flex gap-2">
            <button
              onClick={onDelete}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowDelete(false)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowDelete(true)}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Create Config Modal
// ============================================================================

function CreateConfigModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (config: MonetizeConfigInput) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [upstreamUrl, setUpstreamUrl] = useState('');
  const [pricingModel, setPricingModel] = useState<PricingModel>('perRequest');
  const [perRequest, setPerRequest] = useState('0.01');
  const [perInputToken, setPerInputToken] = useState('0.00001');
  const [perOutputToken, setPerOutputToken] = useState('0.00003');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [network, setNetwork] = useState<'base' | 'ethereum' | 'polygon'>('base');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const config: MonetizeConfigInput = {
        name,
        upstreamUrl,
        pricingModel,
        pricingConfig: pricingModel === 'perRequest'
          ? { perRequest }
          : { perInputToken, perOutputToken },
        recipientAddress,
        network,
        token: 'USDC',
        isActive: true,
      };
      
      await onCreate(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create configuration');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            New Monetizer Configuration
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="My API Monetizer"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Upstream API URL
            </label>
            <input
              type="url"
              value={upstreamUrl}
              onChange={(e) => setUpstreamUrl(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              placeholder="https://api.example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pricing Model
            </label>
            <select
              value={pricingModel}
              onChange={(e) => setPricingModel(e.target.value as PricingModel)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="perRequest">Per Request</option>
              <option value="perToken">Per Token (AI APIs)</option>
              <option value="tiered">Tiered</option>
            </select>
          </div>
          
          {pricingModel === 'perRequest' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Price per Request (USD)
              </label>
              <input
                type="text"
                value={perRequest}
                onChange={(e) => setPerRequest(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0.01"
              />
            </div>
          )}
          
          {pricingModel === 'perToken' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price per Input Token (USD)
                </label>
                <input
                  type="text"
                  value={perInputToken}
                  onChange={(e) => setPerInputToken(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.00001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price per Output Token (USD)
                </label>
                <input
                  type="text"
                  value={perOutputToken}
                  onChange={(e) => setPerOutputToken(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.00003"
                />
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Recipient Address
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              required
              pattern="^0x[a-fA-F0-9]{40}$"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              placeholder="0x..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Network
            </label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as 'base' | 'ethereum' | 'polygon')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="base">Base (0 fees)</option>
              <option value="ethereum">Ethereum</option>
              <option value="polygon">Polygon</option>
            </select>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
