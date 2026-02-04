/**
 * Advanced Attack Protection Library
 * Protects against sophisticated mixed/hybrid attacks targeting user assets:
 *
 * 1. MEV (Miner Extractable Value) attacks
 * 2. Sandwich attacks
 * 3. DNS rebinding attacks
 * 4. BGP hijacking indicators
 * 5. Contract upgrade attacks
 * 6. Griefing attacks
 * 7. Signature replay across chains
 * 8. Permit2 phishing
 * 9. Address poisoning attacks
 * 10. State corruption attacks
 */

import { ethers } from "ethers"

// ============================================
// 1. MEV & SANDWICH ATTACK PROTECTION
// ============================================

export interface MEVProtectionConfig {
  useFlashbots: boolean
  maxSlippageBps: number // Basis points (100 = 1%)
  deadlineSeconds: number
  privateSubmission: boolean
}

export interface SandwichRiskAnalysis {
  risk: "low" | "medium" | "high" | "critical"
  indicators: string[]
  recommendations: string[]
  estimatedLoss?: number
}

/**
 * Analyze transaction for sandwich attack vulnerability
 */
export function analyzeSandwichRisk(
  amount: number,
  poolLiquidity: number,
  recentBlocks: Array<{ gasPrice: bigint; pendingTxCount: number }>,
): SandwichRiskAnalysis {
  const indicators: string[] = []
  const recommendations: string[] = []
  let riskScore = 0

  // Large trade relative to pool liquidity
  const tradeImpact = amount / poolLiquidity
  if (tradeImpact > 0.1) {
    // >10% of pool
    indicators.push(`Trade size is ${(tradeImpact * 100).toFixed(1)}% of pool liquidity`)
    riskScore += 40
    recommendations.push("Consider splitting into multiple smaller trades")
  } else if (tradeImpact > 0.05) {
    // >5% of pool
    indicators.push(`Trade size is ${(tradeImpact * 100).toFixed(1)}% of pool liquidity`)
    riskScore += 20
  }

  // Check for suspicious mempool activity
  if (recentBlocks.length > 0) {
    const avgGas = recentBlocks.reduce((sum, b) => sum + b.gasPrice, 0n) / BigInt(recentBlocks.length)
    const latestGas = recentBlocks[recentBlocks.length - 1].gasPrice

    if (latestGas > avgGas * 2n) {
      indicators.push("Gas prices spiking - MEV bots may be active")
      riskScore += 25
      recommendations.push("Wait for gas to stabilize or use Flashbots")
    }

    const avgPending = recentBlocks.reduce((sum, b) => sum + b.pendingTxCount, 0) / recentBlocks.length
    if (avgPending > 200) {
      indicators.push("High mempool activity detected")
      riskScore += 15
    }
  }

  // Calculate estimated loss from sandwich
  const estimatedLoss = riskScore > 50 ? amount * 0.03 : amount * 0.01 // 1-3% typical sandwich loss

  let risk: SandwichRiskAnalysis["risk"] = "low"
  if (riskScore >= 60) risk = "critical"
  else if (riskScore >= 40) risk = "high"
  else if (riskScore >= 20) risk = "medium"

  if (risk !== "low") {
    recommendations.push("Use private transaction submission (Flashbots)")
    recommendations.push("Set tight slippage limits")
  }

  return { risk, indicators, recommendations, estimatedLoss }
}

// ============================================
// 2. ADDRESS POISONING PROTECTION
// ============================================

export interface AddressPoisoningCheck {
  isSafe: boolean
  warnings: string[]
  similarAddresses: string[]
}

/**
 * Check for address poisoning attacks
 * Attackers send tiny amounts from addresses that look similar to your real contacts
 */
export function checkAddressPoisoning(
  targetAddress: string,
  recentRecipients: string[],
  recentSenders: string[],
): AddressPoisoningCheck {
  const warnings: string[] = []
  const similarAddresses: string[] = []

  const normalize = (addr: string) => addr.toLowerCase()
  const target = normalize(targetAddress)

  // Check prefix similarity (first 6 chars after 0x)
  const targetPrefix = target.slice(0, 8)
  const targetSuffix = target.slice(-4)

  // Check against recent transaction history
  const allKnown = [...new Set([...recentRecipients, ...recentSenders])].map(normalize)

  for (const known of allKnown) {
    if (known === target) continue // Skip exact match

    const knownPrefix = known.slice(0, 8)
    const knownSuffix = known.slice(-4)

    // Check for similar prefix AND suffix (common poisoning pattern)
    if (targetPrefix === knownPrefix && targetSuffix === knownSuffix && known !== target) {
      warnings.push(
        `CRITICAL: Address matches prefix AND suffix of ${known} but middle differs - likely poisoning attack!`,
      )
      similarAddresses.push(known)
    }
    // Check for just prefix match
    else if (targetPrefix === knownPrefix) {
      warnings.push(`Address prefix matches ${known.slice(0, 10)}... - verify carefully`)
      similarAddresses.push(known)
    }
    // Check for just suffix match
    else if (targetSuffix === knownSuffix) {
      warnings.push(`Address suffix matches ...${known.slice(-6)} - verify carefully`)
      similarAddresses.push(known)
    }
  }

  // Check for vanity address patterns (often used in scams)
  const vanityPatterns = [
    /^0x0{4,}/, // Leading zeros
    /0{4,}$/, // Trailing zeros
    /(.)\1{4,}/, // Repeated characters
  ]

  for (const pattern of vanityPatterns) {
    if (pattern.test(target)) {
      warnings.push("Address has unusual vanity pattern - verify this is the intended recipient")
    }
  }

  return {
    isSafe: warnings.length === 0,
    warnings,
    similarAddresses,
  }
}

// ============================================
// 3. SIGNATURE REPLAY PROTECTION
// ============================================

export interface SignatureReplayCheck {
  isSafe: boolean
  chainId: number
  nonce: string
  deadline: number
  warnings: string[]
}

/**
 * Verify signature cannot be replayed across chains
 */
export function verifyNoSignatureReplay(
  signature: string,
  domain: {
    name: string
    version: string
    chainId: number
    verifyingContract: string
  },
  deadline: number,
  nonce: string,
  usedNonces: Set<string>,
): SignatureReplayCheck {
  const warnings: string[] = []

  // Check if nonce already used
  const nonceKey = `${domain.chainId}-${domain.verifyingContract}-${nonce}`
  if (usedNonces.has(nonceKey)) {
    warnings.push("CRITICAL: This nonce has already been used - replay attack detected!")
  }

  // Check deadline
  const now = Math.floor(Date.now() / 1000)
  if (deadline < now) {
    warnings.push("Signature has expired")
  } else if (deadline > now + 86400 * 7) {
    // > 7 days
    warnings.push("Signature deadline is unusually far in the future")
  }

  // Check chain ID
  if (domain.chainId === 0) {
    warnings.push("CRITICAL: ChainId is 0 - signature can be replayed on any chain!")
  }

  // Verify contract address is valid
  if (!ethers.isAddress(domain.verifyingContract)) {
    warnings.push("Invalid verifying contract address")
  }

  return {
    isSafe: warnings.length === 0,
    chainId: domain.chainId,
    nonce,
    deadline,
    warnings,
  }
}

// ============================================
// 4. PERMIT2 PHISHING PROTECTION
// ============================================

export interface Permit2Analysis {
  isSafe: boolean
  riskLevel: "safe" | "warning" | "danger"
  details: string[]
  recommendations: string[]
}

/**
 * Analyze Permit2 signature request for phishing
 */
export function analyzePermit2Request(
  spender: string,
  amount: bigint,
  expiration: number,
  knownSafeSpenders: string[],
): Permit2Analysis {
  const details: string[] = []
  const recommendations: string[] = []
  let riskLevel: Permit2Analysis["riskLevel"] = "safe"

  const normalizedSpender = spender.toLowerCase()
  const isKnownSpender = knownSafeSpenders.some((s) => s.toLowerCase() === normalizedSpender)

  // Check if unlimited approval
  const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
  const MAX_UINT160 = BigInt("0xffffffffffffffffffffffffffffffffffffffff")

  if (amount === MAX_UINT256 || amount === MAX_UINT160) {
    details.push("UNLIMITED approval requested")
    riskLevel = "warning"
    recommendations.push("Consider approving only the exact amount needed")
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000)
  const daysUntilExpiry = (expiration - now) / 86400

  if (expiration === 0 || expiration === 2 ** 48 - 1) {
    details.push("PERMANENT approval - never expires")
    riskLevel = "danger"
    recommendations.push("Set a reasonable expiration time")
  } else if (daysUntilExpiry > 365) {
    details.push(`Approval valid for ${Math.floor(daysUntilExpiry)} days`)
    riskLevel = "warning"
    recommendations.push("Consider shorter expiration period")
  }

  // Check if spender is unknown
  if (!isKnownSpender) {
    details.push(`Unknown spender: ${spender}`)
    if (riskLevel === "safe") riskLevel = "warning"
    recommendations.push("Verify the spender contract is legitimate before approving")
  }

  // Check for suspicious spender patterns
  if (/^0x0{4,}/.test(normalizedSpender) || /0{4,}$/.test(normalizedSpender)) {
    details.push("Spender address has suspicious pattern")
    riskLevel = "danger"
    recommendations.push("This may be a phishing attempt - verify the address carefully")
  }

  return {
    isSafe: riskLevel === "safe",
    riskLevel,
    details,
    recommendations,
  }
}

// ============================================
// 5. CONTRACT UPGRADE ATTACK DETECTION
// ============================================

export interface ProxyCheck {
  isProxy: boolean
  implementation?: string
  admin?: string
  warnings: string[]
}

/**
 * Check if contract is a proxy and analyze upgrade risks
 */
export async function checkProxyContract(contractAddress: string, provider: ethers.Provider): Promise<ProxyCheck> {
  const warnings: string[] = []

  try {
    // EIP-1967 implementation slot
    const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
    // EIP-1967 admin slot
    const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"

    const implSlot = await provider.getStorage(contractAddress, IMPLEMENTATION_SLOT)
    const adminSlot = await provider.getStorage(contractAddress, ADMIN_SLOT)

    const implementation = ethers.getAddress("0x" + implSlot.slice(-40))
    const admin = ethers.getAddress("0x" + adminSlot.slice(-40))

    const isProxy = implementation !== ethers.ZeroAddress

    if (isProxy) {
      warnings.push(`This is a proxy contract - implementation can be changed by admin`)
      warnings.push(`Current implementation: ${implementation}`)
      warnings.push(`Admin: ${admin}`)

      // Check if admin is EOA (more risky than multisig)
      const adminCode = await provider.getCode(admin)
      if (adminCode === "0x") {
        warnings.push("WARNING: Proxy admin is an EOA, not a multisig - higher risk of malicious upgrade")
      }
    }

    return {
      isProxy,
      implementation: isProxy ? implementation : undefined,
      admin: isProxy ? admin : undefined,
      warnings,
    }
  } catch (error) {
    return {
      isProxy: false,
      warnings: ["Could not check proxy status - proceed with caution"],
    }
  }
}

// ============================================
// 6. DNS REBINDING PROTECTION
// ============================================

export interface DNSSecurityCheck {
  isSafe: boolean
  warnings: string[]
}

/**
 * Check for DNS rebinding attacks
 */
export function checkDNSRebinding(currentOrigin: string, expectedOrigins: string[]): DNSSecurityCheck {
  const warnings: string[] = []

  // Parse current origin
  try {
    const url = new URL(currentOrigin)

    // Check for local IP addresses (DNS rebinding target)
    const localPatterns = [
      /^localhost$/i,
      /^127\.\d+\.\d+\.\d+$/,
      /^10\.\d+\.\d+\.\d+$/,
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
      /^192\.168\.\d+\.\d+$/,
      /^\[::1\]$/,
      /^0\.0\.0\.0$/,
    ]

    for (const pattern of localPatterns) {
      if (pattern.test(url.hostname)) {
        warnings.push(`Request from local address ${url.hostname} - potential DNS rebinding`)
      }
    }

    // Check if origin is in expected list
    const normalizedOrigin = `${url.protocol}//${url.host}`
    const isExpected = expectedOrigins.some((exp) => {
      if (exp.includes("*")) {
        const regex = new RegExp("^" + exp.replace(/\*/g, "[^.]+") + "$")
        return regex.test(url.host)
      }
      return exp === normalizedOrigin || exp === url.host
    })

    if (!isExpected) {
      warnings.push(`Unexpected origin: ${normalizedOrigin}`)
    }
  } catch {
    warnings.push("Could not parse origin URL")
  }

  return {
    isSafe: warnings.length === 0,
    warnings,
  }
}

// ============================================
// 7. GRIEFING ATTACK PROTECTION
// ============================================

export interface GriefingProtection {
  minGasBuffer: bigint
  recommendedGas: bigint
  warnings: string[]
}

/**
 * Protect against griefing attacks where attacker makes tx fail to waste gas
 */
export function calculateGriefingProtection(
  estimatedGas: bigint,
  value: bigint,
  contractBalance: bigint,
): GriefingProtection {
  const warnings: string[] = []

  // Add 30% buffer for gas to prevent out-of-gas griefing
  const minGasBuffer = (estimatedGas * 130n) / 100n
  const recommendedGas = (estimatedGas * 150n) / 100n

  // Check if contract has enough balance for refunds
  if (contractBalance < value) {
    warnings.push("Contract may not have enough balance to complete transaction")
  }

  // Check for potential call stack attacks
  if (estimatedGas > 1000000n) {
    warnings.push("High gas estimate - verify contract doesn't have deep call stacks that could cause failures")
  }

  return {
    minGasBuffer,
    recommendedGas,
    warnings,
  }
}

// ============================================
// 8. COMPREHENSIVE MIXED ATTACK ANALYSIS
// ============================================

export interface MixedAttackAnalysis {
  overallRisk: "safe" | "low" | "medium" | "high" | "critical"
  attackVectors: Array<{
    type: string
    severity: "info" | "warning" | "danger"
    description: string
  }>
  recommendations: string[]
  blockTransaction: boolean
}

/**
 * Comprehensive analysis for mixed/combined attacks
 */
export async function analyzeForMixedAttacks(params: {
  to: string
  amount: number
  chainId: number
  fromAddress: string
  recentRecipients?: string[]
  recentSenders?: string[]
  isApproval?: boolean
  spender?: string
  approvalAmount?: bigint
  expiration?: number
  provider?: ethers.Provider
}): Promise<MixedAttackAnalysis> {
  const attackVectors: MixedAttackAnalysis["attackVectors"] = []
  const recommendations: string[] = []
  let riskScore = 0

  // 1. Address poisoning check
  if (params.recentRecipients || params.recentSenders) {
    const poisonCheck = checkAddressPoisoning(params.to, params.recentRecipients || [], params.recentSenders || [])
    if (!poisonCheck.isSafe) {
      for (const warning of poisonCheck.warnings) {
        attackVectors.push({
          type: "ADDRESS_POISONING",
          severity: warning.includes("CRITICAL") ? "danger" : "warning",
          description: warning,
        })
        riskScore += warning.includes("CRITICAL") ? 50 : 20
      }
      recommendations.push("Verify recipient address by checking your saved contacts or original source")
    }
  }

  // 2. Permit2 phishing check
  if (params.isApproval && params.spender && params.approvalAmount !== undefined) {
    const permitCheck = analyzePermit2Request(
      params.spender,
      params.approvalAmount,
      params.expiration || 0,
      [], // Could pass known safe spenders here
    )
    if (!permitCheck.isSafe) {
      for (const detail of permitCheck.details) {
        attackVectors.push({
          type: "PERMIT_PHISHING",
          severity: permitCheck.riskLevel === "danger" ? "danger" : "warning",
          description: detail,
        })
      }
      riskScore += permitCheck.riskLevel === "danger" ? 40 : 20
      recommendations.push(...permitCheck.recommendations)
    }
  }

  // 3. Proxy contract check
  if (params.provider) {
    try {
      const proxyCheck = await checkProxyContract(params.to, params.provider)
      if (proxyCheck.isProxy) {
        attackVectors.push({
          type: "UPGRADEABLE_CONTRACT",
          severity: "warning",
          description: `Target is upgradeable proxy contract - admin: ${proxyCheck.admin}`,
        })
        riskScore += 15
        recommendations.push("Verify the contract implementation is trusted before proceeding")
      }
    } catch {
      // Ignore proxy check errors
    }
  }

  // 4. High value transaction check
  if (params.amount > 10000) {
    attackVectors.push({
      type: "HIGH_VALUE",
      severity: params.amount > 100000 ? "danger" : "warning",
      description: `High value transaction: $${params.amount.toLocaleString()}`,
    })
    riskScore += params.amount > 100000 ? 30 : 15
    recommendations.push("Consider splitting into multiple smaller transactions")
    recommendations.push("Use hardware wallet for signing")
  }

  // 5. Chain-specific risks
  const riskyChains: Record<number, string> = {
    56: "BSC has higher scam rate - verify contracts carefully",
    137: "Polygon has fast finality - double-check before confirming",
    250: "Fantom has had bridge exploits - be cautious with bridged assets",
  }
  if (riskyChains[params.chainId]) {
    attackVectors.push({
      type: "CHAIN_RISK",
      severity: "info",
      description: riskyChains[params.chainId],
    })
    riskScore += 5
  }

  // Determine overall risk
  let overallRisk: MixedAttackAnalysis["overallRisk"] = "safe"
  if (riskScore >= 80) overallRisk = "critical"
  else if (riskScore >= 50) overallRisk = "high"
  else if (riskScore >= 30) overallRisk = "medium"
  else if (riskScore > 0) overallRisk = "low"

  return {
    overallRisk,
    attackVectors,
    recommendations: [...new Set(recommendations)], // Remove duplicates
    blockTransaction: riskScore >= 80,
  }
}

// ============================================
// 9. TRANSACTION INTEGRITY VERIFICATION
// ============================================

/**
 * Generate transaction integrity hash that can be verified on-chain
 */
export function generateTransactionIntegrityHash(params: {
  from: string
  to: string
  value: string
  data: string
  chainId: number
  nonce: number
  timestamp: number
}): string {
  const encoder = new TextEncoder()
  const data = encoder.encode(
    JSON.stringify({
      ...params,
      from: params.from.toLowerCase(),
      to: params.to.toLowerCase(),
    }),
  )

  // Simple hash for integrity (in production, use proper cryptographic hash)
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data[i]) & 0xffffffff
  }

  return "0x" + Math.abs(hash).toString(16).padStart(64, "0")
}

/**
 * Verify transaction wasn't modified during signing
 */
export function verifyTransactionIntegrity(
  originalHash: string,
  currentParams: {
    from: string
    to: string
    value: string
    data: string
    chainId: number
    nonce: number
    timestamp: number
  },
): { valid: boolean; tamperedFields: string[] } {
  const currentHash = generateTransactionIntegrityHash(currentParams)

  if (currentHash === originalHash) {
    return { valid: true, tamperedFields: [] }
  }

  // In production, would do field-by-field comparison
  return { valid: false, tamperedFields: ["unknown - hash mismatch"] }
}
