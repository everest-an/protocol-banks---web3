/**
 * useSubscription Hook
 * 
 * React hook for managing subscriptions and recurring payments
 */

import { useState, useCallback, useEffect } from 'react'

export interface Subscription {
  id: string
  name: string
  amount: string
  token: string
  chainId: number
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  recipientAddress: string
  recipientName?: string
  status: 'active' | 'paused' | 'cancelled' | 'expired'
  nextPaymentDate: string
  lastPaymentDate?: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface CreateSubscriptionParams {
  name: string
  amount: string
  token: string
  chainId: number
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  recipientAddress: string
  recipientName?: string
  startDate?: string
  metadata?: Record<string, unknown>
}

export interface SubscriptionListOptions {
  status?: 'active' | 'paused' | 'cancelled' | 'expired'
  limit?: number
  offset?: number
}

export function useSubscription() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch all subscriptions
   */
  const fetchSubscriptions = useCallback(async (options?: SubscriptionListOptions) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (options?.status) params.set('status', options.status)
      if (options?.limit) params.set('limit', options.limit.toString())
      if (options?.offset) params.set('offset', options.offset.toString())

      const response = await fetch(`/api/subscriptions?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions')
      }

      const data = await response.json()
      setSubscriptions(data.subscriptions || data)
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch subscriptions'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Get a single subscription
   */
  const getSubscription = useCallback(async (id: string): Promise<Subscription | null> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/subscriptions/${id}`)
      
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error('Failed to fetch subscription')
      }

      return await response.json()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch subscription'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Create a new subscription
   */
  const createSubscription = useCallback(async (params: CreateSubscriptionParams): Promise<Subscription> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to create subscription')
      }

      const subscription = await response.json()
      setSubscriptions(prev => [subscription, ...prev])
      return subscription
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create subscription'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Update subscription
   */
  const updateSubscription = useCallback(async (
    id: string, 
    updates: Partial<Pick<Subscription, 'name' | 'amount' | 'status'>>
  ): Promise<Subscription> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to update subscription')
      }

      const subscription = await response.json()
      setSubscriptions(prev => 
        prev.map(s => s.id === id ? subscription : s)
      )
      return subscription
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update subscription'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Pause subscription
   */
  const pauseSubscription = useCallback(async (id: string): Promise<Subscription> => {
    return updateSubscription(id, { status: 'paused' })
  }, [updateSubscription])

  /**
   * Resume subscription
   */
  const resumeSubscription = useCallback(async (id: string): Promise<Subscription> => {
    return updateSubscription(id, { status: 'active' })
  }, [updateSubscription])

  /**
   * Cancel subscription
   */
  const cancelSubscription = useCallback(async (id: string): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/subscriptions/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to cancel subscription')
      }

      setSubscriptions(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel subscription'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Get upcoming payments
   */
  const getUpcomingPayments = useCallback((days: number = 7): Subscription[] => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + days)

    return subscriptions
      .filter(s => {
        if (s.status !== 'active') return false
        const nextPayment = new Date(s.nextPaymentDate)
        return nextPayment <= cutoff
      })
      .sort((a, b) => 
        new Date(a.nextPaymentDate).getTime() - new Date(b.nextPaymentDate).getTime()
      )
  }, [subscriptions])

  /**
   * Calculate total monthly spend
   */
  const calculateMonthlyTotal = useCallback((currency: string = 'USDC'): number => {
    return subscriptions
      .filter(s => s.status === 'active' && s.token === currency)
      .reduce((total, sub) => {
        const amount = parseFloat(sub.amount)
        switch (sub.frequency) {
          case 'daily': return total + amount * 30
          case 'weekly': return total + amount * 4
          case 'monthly': return total + amount
          case 'yearly': return total + amount / 12
          default: return total
        }
      }, 0)
  }, [subscriptions])

  // Auto-fetch on mount
  useEffect(() => {
    fetchSubscriptions()
  }, [fetchSubscriptions])

  return {
    // State
    subscriptions,
    loading,
    error,

    // Computed
    activeSubscriptions: subscriptions.filter(s => s.status === 'active'),
    pausedSubscriptions: subscriptions.filter(s => s.status === 'paused'),
    upcomingPayments: getUpcomingPayments(),
    monthlyTotal: calculateMonthlyTotal(),

    // Actions
    fetchSubscriptions,
    getSubscription,
    createSubscription,
    updateSubscription,
    pauseSubscription,
    resumeSubscription,
    cancelSubscription,
    getUpcomingPayments,
    calculateMonthlyTotal,
  }
}

export default useSubscription
