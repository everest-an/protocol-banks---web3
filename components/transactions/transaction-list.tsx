"use client"

/**
 * Transaction List Component with Multi-Network Support
 * Displays payment transactions with filtering and network badges
 */

import { useState } from "react"
import { useTransactions } from "@/hooks/use-transactions"
import type { Transaction } from "@/hooks/use-transactions"
import { NetworkBadge } from "@/components/vendors/network-badge"
import { NetworkSelector, NetworkTypeSelector } from "@/components/ui/network-selector"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowUpRight, ArrowDownLeft, ExternalLink, Filter } from "lucide-react"

interface TransactionListProps {
  userAddress: string
  initialFilters?: {
    network?: string
    networkType?: string
    status?: string
    type?: string
  }
}

export function TransactionList({ userAddress, initialFilters = {} }: TransactionListProps) {
  const [showFilters, setShowFilters] = useState(false)

  const {
    transactions,
    loading,
    error,
    filters,
    setFilters,
    pagination,
    setPagination,
    refetch,
  } = useTransactions(userAddress, {
    network: initialFilters.network,
    networkType: initialFilters.networkType,
    status: initialFilters.status,
    type: initialFilters.type,
  })

  const formatAmount = (amount: string, symbol?: string) => {
    const num = parseFloat(amount)
    return `${num.toFixed(2)} ${symbol || ""}`
  }

  const formatAddress = (address: string) => {
    if (address.length <= 12) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500"
      case "pending":
        return "bg-yellow-500"
      case "failed":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getBlockExplorerUrl = (chain: string, txHash?: string) => {
    if (!txHash) return null

    const explorers: Record<string, string> = {
      ethereum: `https://etherscan.io/tx/${txHash}`,
      sepolia: `https://sepolia.etherscan.io/tx/${txHash}`,
      base: `https://basescan.org/tx/${txHash}`,
      arbitrum: `https://arbiscan.io/tx/${txHash}`,
      bsc: `https://bscscan.com/tx/${txHash}`,
      tron: `https://tronscan.org/#/transaction/${txHash}`,
      "tron-nile": `https://nile.tronscan.org/#/transaction/${txHash}`,
    }

    return explorers[chain]
  }

  const filteredTransactions = transactions.filter(tx => {
    if (!filters.search) return true
    const searchLower = filters.search.toLowerCase()
    return (
      tx.from_address.toLowerCase().includes(searchLower) ||
      tx.to_address.toLowerCase().includes(searchLower) ||
      tx.tx_hash?.toLowerCase().includes(searchLower) ||
      tx.vendor_name?.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Transactions</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="mr-2 h-4 w-4" />
          {showFilters ? "Hide Filters" : "Show Filters"}
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="grid grid-cols-1 gap-4 rounded-lg border p-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Network</label>
            <NetworkSelector
              value={filters.network}
              onChange={network => setFilters(prev => ({ ...prev, network }))}
              includeAll
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Network Type</label>
            <NetworkTypeSelector
              value={filters.networkType}
              onChange={networkType =>
                setFilters(prev => ({ ...prev, networkType }))
              }
              includeAll
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Status</label>
            <Select
              value={filters.status}
              onValueChange={status => setFilters(prev => ({ ...prev, status }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Type</label>
            <Select
              value={filters.type}
              onValueChange={type => setFilters(prev => ({ ...prev, type }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="received">Received</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-4">
            <label className="mb-2 block text-sm font-medium">Search</label>
            <Input
              placeholder="Search by address, tx hash, or vendor..."
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Transaction List */}
      {!loading && filteredTransactions.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No transactions found
        </div>
      )}

      {!loading && filteredTransactions.length > 0 && (
        <div className="space-y-2">
          {filteredTransactions.map(tx => (
            <div
              key={tx.id}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
            >
              <div className="flex items-center space-x-4">
                {/* Direction Icon */}
                <div
                  className={`rounded-full p-2 ${
                    tx.type === "sent" ? "bg-red-100" : "bg-green-100"
                  }`}
                >
                  {tx.type === "sent" ? (
                    <ArrowUpRight className="h-5 w-5 text-red-600" />
                  ) : (
                    <ArrowDownLeft className="h-5 w-5 text-green-600" />
                  )}
                </div>

                {/* Transaction Info */}
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <NetworkBadge network={tx.chain} />
                    <Badge className={`${getStatusColor(tx.status)} text-white`}>
                      {tx.status}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="font-medium">
                      {tx.type === "sent" ? "To:" : "From:"}
                    </span>
                    <code className="text-muted-foreground">
                      {formatAddress(
                        tx.type === "sent" ? tx.to_address : tx.from_address
                      )}
                    </code>
                    {tx.vendor_name && (
                      <span className="text-muted-foreground">
                        ({tx.vendor_name})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Amount and Explorer Link */}
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="font-semibold">
                    {formatAmount(tx.amount, tx.token_symbol)}
                  </div>
                  {tx.network_type === "TRON" && tx.energy_used && (
                    <div className="text-xs text-muted-foreground">
                      Energy: {tx.energy_used}
                    </div>
                  )}
                  {tx.network_type === "EVM" && tx.gas_used && (
                    <div className="text-xs text-muted-foreground">
                      Gas: {tx.gas_used}
                    </div>
                  )}
                </div>

                {tx.tx_hash && getBlockExplorerUrl(tx.chain, tx.tx_hash) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                  >
                    <a
                      href={getBlockExplorerUrl(tx.chain, tx.tx_hash)!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.hasMore && (
        <div className="flex justify-center">
          <Button
            onClick={() =>
              setPagination(prev => ({
                ...prev,
                offset: prev.offset + prev.limit,
              }))
            }
            disabled={loading}
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  )
}
