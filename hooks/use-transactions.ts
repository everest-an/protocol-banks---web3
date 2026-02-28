"use client"

import { useState, useEffect, useCallback } from "react"
import { authHeaders } from "@/lib/authenticated-fetch"

export interface Transaction {
  id: string
  from_address: string
  to_address: string
  amount: string
  token_symbol?: string
  chain: string
  network_type?: string
  status: string
  type: string
  tx_hash?: string
  created_at: string
  vendor_name?: string
  gas_used?: string
  gas_price?: string
  energy_used?: string
  bandwidth_used?: string
}

export interface TransactionFilters {
  network: string
  networkType: string
  status: string
  type: string
  search: string
}

interface Pagination {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

const DEFAULT_FILTERS: TransactionFilters = {
  network: "all",
  networkType: "all",
  status: "all",
  type: "all",
  search: "",
}

export function useTransactions(
  userAddress: string,
  initialFilters: Partial<TransactionFilters> = {}
) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TransactionFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  })
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  })

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      })

      if (filters.network && filters.network !== "all") params.append("network", filters.network)
      if (filters.networkType && filters.networkType !== "all") params.append("network_type", filters.networkType)
      if (filters.status && filters.status !== "all") params.append("status", filters.status)
      if (filters.type && filters.type !== "all") params.append("type", filters.type)

      const response = await fetch(`/api/payments?${params.toString()}`, {
        headers: authHeaders(userAddress),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || "Failed to fetch transactions")

      setTransactions(data.payments || [])
      setPagination((prev) => ({
        ...prev,
        total: data.total || 0,
        hasMore: data.hasMore || false,
      }))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userAddress, filters, pagination.offset, pagination.limit])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  return {
    transactions,
    loading,
    error,
    filters,
    setFilters,
    pagination,
    setPagination,
    refetch: fetchTransactions,
  }
}
