/**
 * useX402Payment Hook
 * 
 * React hook for handling x402 payment flows
 */

import { useState, useCallback } from 'react'
import { Address, Hex } from 'viem'

export type X402PaymentStep = 'idle' | 'authorizing' | 'signing' | 'executing' | 'verifying' | 'complete' | 'error'

export interface X402PaymentState {
  step: X402PaymentStep
  paymentId: string | null
  transactionHash: Hex | null
  error: string | null
}

export interface X402PaymentParams {
  amount: string
  currency: string
  recipient: Address
  chainId: number
  memo?: string
  useRelayer?: boolean
}

export function useX402Payment() {
  const [state, setState] = useState<X402PaymentState>({
    step: 'idle',
    paymentId: null,
    transactionHash: null,
    error: null,
  })

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      paymentId: null,
      transactionHash: null,
      error: null,
    })
  }, [])

  const setStep = useCallback((step: X402PaymentStep) => {
    setState(prev => ({ ...prev, step }))
  }, [])

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, step: 'error', error }))
  }, [])

  /**
   * Authorize payment
   */
  const authorize = useCallback(async (params: X402PaymentParams) => {
    setState(prev => ({ ...prev, step: 'authorizing', error: null }))

    try {
      const response = await fetch('/api/x402/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Authorization failed')
      }

      const data = await response.json()
      setState(prev => ({
        ...prev,
        paymentId: data.paymentId,
        step: 'signing',
      }))

      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authorization failed'
      setError(message)
      throw err
    }
  }, [setError])

  /**
   * Execute payment with optional signed transaction
   */
  const execute = useCallback(async (options?: {
    signedTransaction?: Hex
    relayerMode?: boolean
  }) => {
    if (!state.paymentId) {
      throw new Error('No payment authorized')
    }

    setState(prev => ({ ...prev, step: 'executing' }))

    try {
      const response = await fetch('/api/x402/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: state.paymentId,
          ...options,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Execution failed')
      }

      const data = await response.json()
      setState(prev => ({
        ...prev,
        transactionHash: data.transactionHash,
        step: 'verifying',
      }))

      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution failed'
      setError(message)
      throw err
    }
  }, [state.paymentId, setError])

  /**
   * Verify payment completion
   */
  const verify = useCallback(async () => {
    if (!state.paymentId) {
      throw new Error('No payment to verify')
    }

    try {
      const response = await fetch('/api/x402/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: state.paymentId,
          transactionHash: state.transactionHash,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Verification failed')
      }

      const data = await response.json()
      
      if (data.valid && (data.status === 'confirmed' || data.status === 'settled')) {
        setState(prev => ({ ...prev, step: 'complete' }))
      }

      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed'
      setError(message)
      throw err
    }
  }, [state.paymentId, state.transactionHash, setError])

  /**
   * Complete payment flow (authorize + execute + verify)
   */
  const pay = useCallback(async (params: X402PaymentParams) => {
    reset()

    try {
      // Authorize
      const auth = await authorize(params)

      // Execute with relayer if requested
      const exec = await execute({
        relayerMode: params.useRelayer ?? true,
      })

      // Verify
      const verification = await verify()

      return {
        paymentId: auth.paymentId,
        transactionHash: exec.transactionHash,
        verified: verification.valid,
      }
    } catch {
      // Error already set in state
      return null
    }
  }, [reset, authorize, execute, verify])

  /**
   * Poll for confirmation
   */
  const waitForConfirmation = useCallback(async (maxAttempts = 30, intervalMs = 2000) => {
    if (!state.paymentId) {
      throw new Error('No payment to wait for')
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`/api/x402/execute?paymentId=${state.paymentId}`)
        const data = await response.json()

        if (data.status === 'confirmed' || data.status === 'settled') {
          await verify()
          return true
        }

        if (data.status === 'failed') {
          setError('Payment failed')
          return false
        }
      } catch {
        // Continue polling on error
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    setError('Confirmation timeout')
    return false
  }, [state.paymentId, verify, setError])

  return {
    // State
    ...state,
    isLoading: ['authorizing', 'signing', 'executing', 'verifying'].includes(state.step),
    isComplete: state.step === 'complete',
    hasError: state.step === 'error',

    // Actions
    authorize,
    execute,
    verify,
    pay,
    waitForConfirmation,
    reset,
    setStep,
  }
}

export default useX402Payment
