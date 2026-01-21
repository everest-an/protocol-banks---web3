/**
 * Relayer Client Service
 * Submits transactions to the x402 relayer network
 */

export interface RelayerSubmission {
  chainId: number
  tokenAddress: string
  from: string
  to: string
  value: string
  validAfter: number
  validBefore: number
  nonce: string
  signature: string
}

export interface RelayerResponse {
  success: boolean
  transactionHash?: string
  error?: string
  estimatedConfirmation?: number
}

export interface RelayerStatus {
  available: boolean
  supportedChains: number[]
  currentQueue: number
  estimatedWaitTime: number
}

// Relayer endpoints by chain
const RELAYER_ENDPOINTS: Record<number, string> = {
  1: 'https://relayer.x402.org/ethereum',
  137: 'https://relayer.x402.org/polygon',
  42161: 'https://relayer.x402.org/arbitrum',
  10: 'https://relayer.x402.org/optimism',
  8453: 'https://relayer.x402.org/base',
}

/**
 * Get relayer endpoint for chain
 */
function getRelayerEndpoint(chainId: number): string | undefined {
  return RELAYER_ENDPOINTS[chainId]
}

/**
 * Submit transaction to relayer
 */
export async function submitToRelayer(
  submission: RelayerSubmission
): Promise<RelayerResponse> {
  const endpoint = getRelayerEndpoint(submission.chainId)
  
  if (!endpoint) {
    return {
      success: false,
      error: `Relayer not available for chain ${submission.chainId}`,
    }
  }
  
  try {
    const response = await fetch(`${endpoint}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: submission.tokenAddress,
        from: submission.from,
        to: submission.to,
        value: submission.value,
        validAfter: submission.validAfter,
        validBefore: submission.validBefore,
        nonce: submission.nonce,
        signature: submission.signature,
      }),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.message || `Relayer returned status ${response.status}`,
      }
    }
    
    const data = await response.json()
    return {
      success: true,
      transactionHash: data.transactionHash,
      estimatedConfirmation: data.estimatedConfirmation,
    }
  } catch (err) {
    return {
      success: false,
      error: `Failed to submit to relayer: ${err}`,
    }
  }
}

/**
 * Check relayer status
 */
export async function checkRelayerStatus(chainId: number): Promise<RelayerStatus> {
  const endpoint = getRelayerEndpoint(chainId)
  
  if (!endpoint) {
    return {
      available: false,
      supportedChains: Object.keys(RELAYER_ENDPOINTS).map(Number),
      currentQueue: 0,
      estimatedWaitTime: 0,
    }
  }
  
  try {
    const response = await fetch(`${endpoint}/status`)
    
    if (!response.ok) {
      return {
        available: false,
        supportedChains: Object.keys(RELAYER_ENDPOINTS).map(Number),
        currentQueue: 0,
        estimatedWaitTime: 0,
      }
    }
    
    const data = await response.json()
    return {
      available: true,
      supportedChains: data.supportedChains || Object.keys(RELAYER_ENDPOINTS).map(Number),
      currentQueue: data.queueLength || 0,
      estimatedWaitTime: data.estimatedWaitTime || 30,
    }
  } catch {
    return {
      available: false,
      supportedChains: Object.keys(RELAYER_ENDPOINTS).map(Number),
      currentQueue: 0,
      estimatedWaitTime: 0,
    }
  }
}

/**
 * Submit batch to relayer
 */
export async function submitBatchToRelayer(
  submissions: RelayerSubmission[]
): Promise<{
  success: boolean
  results: RelayerResponse[]
  successCount: number
  failureCount: number
}> {
  const results = await Promise.all(
    submissions.map(sub => submitToRelayer(sub))
  )
  
  const successCount = results.filter(r => r.success).length
  const failureCount = results.length - successCount
  
  return {
    success: failureCount === 0,
    results,
    successCount,
    failureCount,
  }
}

/**
 * Get supported chains
 */
export function getSupportedChains(): number[] {
  return Object.keys(RELAYER_ENDPOINTS).map(Number)
}
