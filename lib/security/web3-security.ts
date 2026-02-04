/**
 * Web3 Security Module
 * Protections against: Proxy backdoors, signature phishing, flash loans,
 * cross-chain attacks, double spending, malicious approvals, and more.
 */

import { ethers } from "ethers"

// ============================================================================
// 1. CONTRACT VERIFICATION - Detect Proxy Backdoors & Malicious Contracts
// ============================================================================

// Known malicious contract patterns (bytecode signatures)
const MALICIOUS_BYTECODE_PATTERNS = [
  "selfdestruct", // Self-destruct capability
  "delegatecall", // Potential proxy backdoor if uncontrolled
  "0x5c60da1b", // implementation() selector - proxy pattern
  "0x3659cfe6", // upgradeTo() selector - upgradeable proxy
  "0x4f1ef286", // upgradeToAndCall() selector
]

// Verified official contract addresses (checksummed)
export const VERIFIED_CONTRACTS: Record<number, Record<string, string>> = {
  // Mainnet
  1: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    CCTP_MESSENGER: "0xBd3fa81B58Ba92a82136038B25aDec7066af3155",
  },
  // Base
  8453: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    CCTP_MESSENGER: "0x1682Ae6375C4E4A97e4B583BC394c861A46D8962",
  },
  // Sepolia
  11155111: {
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    CCTP_MESSENGER: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
  },
}

export interface ContractVerificationResult {
  isVerified: boolean
  isProxy: boolean
  hasUpgradeability: boolean
  hasSelfDestruct: boolean
  hasDangerousDelegatecall: boolean
  riskLevel: "safe" | "low" | "medium" | "high" | "critical"
  warnings: string[]
}

export async function verifyContractSafety(
  contractAddress: string,
  chainId: number,
  provider: ethers.Provider,
): Promise<ContractVerificationResult> {
  const warnings: string[] = []
  let riskLevel: ContractVerificationResult["riskLevel"] = "safe"

  // 1. Check against known verified addresses
  const verifiedAddresses = VERIFIED_CONTRACTS[chainId]
  const isKnownVerified = verifiedAddresses
    ? Object.values(verifiedAddresses).some((addr) => addr.toLowerCase() === contractAddress.toLowerCase())
    : false

  if (isKnownVerified) {
    return {
      isVerified: true,
      isProxy: false,
      hasUpgradeability: false,
      hasSelfDestruct: false,
      hasDangerousDelegatecall: false,
      riskLevel: "safe",
      warnings: [],
    }
  }

  // 2. Get contract bytecode
  const bytecode = await provider.getCode(contractAddress)

  if (bytecode === "0x" || bytecode === "0x0") {
    return {
      isVerified: false,
      isProxy: false,
      hasUpgradeability: false,
      hasSelfDestruct: false,
      hasDangerousDelegatecall: false,
      riskLevel: "critical",
      warnings: ["Contract does not exist or is an EOA"],
    }
  }

  // 3. Check for proxy patterns
  const hasImplementationSlot = bytecode.includes("360894a13ba1a3210667c828492db98dca3e2076")
  const hasAdminSlot = bytecode.includes("b53127684a568b3173ae13b9f8a6016e243e63b6")
  const isProxy = hasImplementationSlot || hasAdminSlot

  if (isProxy) {
    warnings.push("Contract is a proxy - implementation can be changed by admin")
    riskLevel = "medium"
  }

  // 4. Check for upgrade functions
  const hasUpgradeTo = bytecode.includes("3659cfe6")
  const hasUpgradeToAndCall = bytecode.includes("4f1ef286")
  const hasUpgradeability = hasUpgradeTo || hasUpgradeToAndCall

  if (hasUpgradeability) {
    warnings.push("Contract has upgrade functions - behavior can change")
    riskLevel = riskLevel === "safe" ? "medium" : "high"
  }

  // 5. Check for self-destruct (SELFDESTRUCT opcode = 0xff)
  const hasSelfDestruct = bytecode.toLowerCase().includes("ff")
  if (hasSelfDestruct) {
    // Note: This is a rough check, could have false positives
    // Real check would need full bytecode analysis
    warnings.push("Contract may contain selfdestruct - funds could be permanently locked")
  }

  // 6. Check for unprotected delegatecall
  const delegatecallCount = (bytecode.match(/f4/g) || []).length
  const hasDangerousDelegatecall = delegatecallCount > 2 && !isProxy

  if (hasDangerousDelegatecall) {
    warnings.push("Contract has multiple delegatecalls - potential backdoor risk")
    riskLevel = "high"
  }

  return {
    isVerified: false,
    isProxy,
    hasUpgradeability,
    hasSelfDestruct,
    hasDangerousDelegatecall,
    riskLevel,
    warnings,
  }
}

// ============================================================================
// 2. SIGNATURE PHISHING PROTECTION
// ============================================================================

export interface SignatureRequest {
  domain: {
    name: string
    version: string
    chainId: number
    verifyingContract: string
  }
  types: Record<string, Array<{ name: string; type: string }>>
  message: Record<string, any>
}

// Known safe EIP-712 domain names
const SAFE_DOMAIN_NAMES = ["USD Coin", "USDC", "Dai Stablecoin", "Tether USD", "Circle"]

// Dangerous function signatures that should trigger warnings
const DANGEROUS_SIGNATURES = [
  "setApprovalForAll", // NFT blanket approval
  "approve", // Token approval (check amount)
  "permit", // EIP-2612 permit
  "increaseAllowance",
  "decreaseAllowance",
]

export interface SignatureAnalysis {
  isSafe: boolean
  riskLevel: "safe" | "warning" | "danger"
  warnings: string[]
  isUnlimitedApproval: boolean
  approvalAmount?: string
  spenderAddress?: string
}

export function analyzeSignatureRequest(request: SignatureRequest): SignatureAnalysis {
  const warnings: string[] = []
  let riskLevel: SignatureAnalysis["riskLevel"] = "safe"
  let isUnlimitedApproval = false
  let approvalAmount: string | undefined
  let spenderAddress: string | undefined

  // 1. Check domain name
  const domainName = request.domain.name
  if (!SAFE_DOMAIN_NAMES.some((name) => domainName.toLowerCase().includes(name.toLowerCase()))) {
    warnings.push(`Unknown domain: "${domainName}" - verify this is the correct contract`)
    riskLevel = "warning"
  }

  // 2. Check verifying contract against known addresses
  const verifiedForChain = VERIFIED_CONTRACTS[request.domain.chainId]
  if (verifiedForChain) {
    const isVerifiedContract = Object.values(verifiedForChain).some(
      (addr) => addr.toLowerCase() === request.domain.verifyingContract.toLowerCase(),
    )
    if (!isVerifiedContract) {
      warnings.push("Contract address not in verified list - double check before signing")
      riskLevel = "warning"
    }
  }

  // 3. Check message content for dangerous patterns
  const message = request.message

  // Check for unlimited approval (max uint256)
  const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935"
  if (message.value?.toString() === MAX_UINT256 || message.amount?.toString() === MAX_UINT256) {
    warnings.push("DANGER: This requests UNLIMITED approval - consider approving exact amount instead")
    riskLevel = "danger"
    isUnlimitedApproval = true
  }

  // Extract approval details
  if (message.value) approvalAmount = message.value.toString()
  if (message.spender) spenderAddress = message.spender

  // 4. Check for TransferWithAuthorization specifics
  if (request.types["TransferWithAuthorization"]) {
    // This is ERC-3009, generally safe if amount is reasonable
    if (message.to && message.value) {
      // Verify the recipient isn't a known malicious address
      // (would need a blacklist database in production)
    }
  }

  // 5. Check for Permit (EIP-2612)
  if (request.types["Permit"]) {
    if (isUnlimitedApproval) {
      warnings.push("Permit with unlimited approval detected - this grants permanent access to your tokens")
    }
  }

  return {
    isSafe: riskLevel === "safe",
    riskLevel,
    warnings,
    isUnlimitedApproval,
    approvalAmount,
    spenderAddress,
  }
}

// ============================================================================
// 3. APPROVAL MANAGEMENT - Prevent Malicious Unlimited Approvals
// ============================================================================

export const APPROVAL_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]

export interface ApprovalInfo {
  spender: string
  allowance: bigint
  isUnlimited: boolean
  tokenAddress: string
  tokenSymbol: string
}

const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
const SAFE_APPROVAL_THRESHOLD = BigInt("1000000000000000000000000") // 1 million tokens with 18 decimals

export async function checkExistingApprovals(
  walletAddress: string,
  tokenAddress: string,
  provider: ethers.Provider,
): Promise<ApprovalInfo[]> {
  // Note: In production, you would query an indexer like Etherscan API
  // to get all approval events for this wallet/token combination

  // For now, we check known spenders (common DEXes, bridges)
  const knownSpenders = [
    "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch v5
    "0xDef1C0ded9bec7F1a1670819833240f027b25EfF", // 0x Exchange Proxy
    "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Uniswap Router
  ]

  const approvals: ApprovalInfo[] = []
  const contract = new ethers.Contract(tokenAddress, APPROVAL_ABI, provider)

  for (const spender of knownSpenders) {
    try {
      const allowance = await contract.allowance(walletAddress, spender)
      if (allowance > 0n) {
        approvals.push({
          spender,
          allowance,
          isUnlimited: allowance >= MAX_UINT256 / 2n,
          tokenAddress,
          tokenSymbol: "Unknown", // Would need to fetch
        })
      }
    } catch {
      // Skip if call fails
    }
  }

  return approvals
}

export function calculateSafeApprovalAmount(
  transferAmount: bigint,
  buffer = 1.05, // 5% buffer
): bigint {
  // Never approve more than needed + small buffer
  return BigInt(Math.ceil(Number(transferAmount) * buffer))
}

// ============================================================================
// 4. FLASH LOAN ATTACK DETECTION
// ============================================================================

export interface FlashLoanRisk {
  isRisky: boolean
  riskFactors: string[]
  recommendation: string
}

export function assessFlashLoanRisk(
  transactionType: "transfer" | "approve" | "swap" | "provide_liquidity",
  amount: bigint,
  tokenDecimals: number,
  priceImpact?: number,
): FlashLoanRisk {
  const riskFactors: string[] = []

  // 1. Large transaction check
  const humanAmount = Number(amount) / Math.pow(10, tokenDecimals)
  if (humanAmount > 100000) {
    riskFactors.push("Large transaction amount may attract MEV/flash loan attacks")
  }

  // 2. High price impact
  if (priceImpact && priceImpact > 1) {
    riskFactors.push(`High price impact (${priceImpact.toFixed(2)}%) - vulnerable to sandwich attacks`)
  }

  // 3. Liquidity provision specific
  if (transactionType === "provide_liquidity") {
    riskFactors.push("Liquidity provision can be target of flash loan manipulation")
  }

  return {
    isRisky: riskFactors.length > 0,
    riskFactors,
    recommendation:
      riskFactors.length > 0
        ? "Consider splitting into smaller transactions or using private mempools"
        : "Transaction appears safe from flash loan attacks",
  }
}

// ============================================================================
// 5. CROSS-CHAIN BRIDGE SECURITY
// ============================================================================

export interface BridgeTransaction {
  sourceChainId: number
  destinationChainId: number
  tokenAddress: string
  amount: bigint
  recipientAddress: string
  bridgeContract: string
}

export interface BridgeSecurityCheck {
  isSafe: boolean
  warnings: string[]
  verifications: {
    sourceContractVerified: boolean
    destinationSupported: boolean
    amountWithinLimits: boolean
    recipientValid: boolean
  }
}

// CCTP specific limits (example values)
const CCTP_LIMITS = {
  minAmount: BigInt(1e6), // 1 USDC
  maxAmount: BigInt(1e12), // 1 million USDC
}

export async function validateBridgeTransaction(
  tx: BridgeTransaction,
  provider: ethers.Provider,
): Promise<BridgeSecurityCheck> {
  const warnings: string[] = []

  // 1. Verify source bridge contract
  const contractCheck = await verifyContractSafety(tx.bridgeContract, tx.sourceChainId, provider)
  const sourceContractVerified = contractCheck.isVerified || contractCheck.riskLevel === "safe"

  if (!sourceContractVerified) {
    warnings.push("Bridge contract not in verified list - proceed with caution")
  }

  // 2. Check destination chain support
  const supportedDestinations = [1, 8453, 11155111] // Mainnet, Base, Sepolia
  const destinationSupported = supportedDestinations.includes(tx.destinationChainId)

  if (!destinationSupported) {
    warnings.push("Destination chain may not be supported by CCTP")
  }

  // 3. Validate amount limits
  const amountWithinLimits = tx.amount >= CCTP_LIMITS.minAmount && tx.amount <= CCTP_LIMITS.maxAmount

  if (tx.amount < CCTP_LIMITS.minAmount) {
    warnings.push("Amount below minimum bridge limit")
  }
  if (tx.amount > CCTP_LIMITS.maxAmount) {
    warnings.push("Amount exceeds maximum bridge limit - may require multiple transactions")
  }

  // 4. Validate recipient address
  const recipientValid = ethers.isAddress(tx.recipientAddress)
  if (!recipientValid) {
    warnings.push("Invalid recipient address")
  }

  // 5. Check for same address on different chains (potential user error)
  // This is actually fine for CCTP, but warn anyway

  return {
    isSafe: warnings.length === 0,
    warnings,
    verifications: {
      sourceContractVerified,
      destinationSupported,
      amountWithinLimits,
      recipientValid,
    },
  }
}

// ============================================================================
// 6. DOUBLE SPEND PREVENTION
// ============================================================================

interface PendingTransaction {
  hash: string
  nonce: number
  from: string
  to: string
  value: bigint
  timestamp: number
}

// In-memory cache of pending transactions (would use Redis in production)
const pendingTransactions = new Map<string, PendingTransaction[]>()

export function trackPendingTransaction(tx: PendingTransaction): void {
  const key = tx.from.toLowerCase()
  const existing = pendingTransactions.get(key) || []
  existing.push(tx)
  pendingTransactions.set(key, existing)

  // Clean up old entries (older than 10 minutes)
  const cutoff = Date.now() - 10 * 60 * 1000
  pendingTransactions.set(
    key,
    existing.filter((t) => t.timestamp > cutoff),
  )
}

export function checkDoubleSpendRisk(
  from: string,
  nonce: number,
  to: string,
  value: bigint,
): { isRisky: boolean; warning?: string } {
  const key = from.toLowerCase()
  const pending = pendingTransactions.get(key) || []

  // Check for same nonce with different parameters
  const sameNonce = pending.find((tx) => tx.nonce === nonce)
  if (sameNonce) {
    if (sameNonce.to !== to || sameNonce.value !== value) {
      return {
        isRisky: true,
        warning: "Potential double spend: Transaction with same nonce but different parameters pending",
      }
    }
  }

  // Check for rapid identical transactions (within 30 seconds)
  const recentIdentical = pending.find((tx) => tx.to === to && tx.value === value && Date.now() - tx.timestamp < 30000)
  if (recentIdentical) {
    return {
      isRisky: true,
      warning: "Duplicate transaction detected - identical transaction sent within last 30 seconds",
    }
  }

  return { isRisky: false }
}

// ============================================================================
// 7. TRANSACTION SIMULATION
// ============================================================================

export interface SimulationResult {
  success: boolean
  gasUsed: bigint
  balanceChanges: Array<{
    address: string
    token: string
    before: bigint
    after: bigint
    change: bigint
  }>
  warnings: string[]
  revertReason?: string
}

export async function simulateTransaction(
  provider: ethers.Provider,
  tx: {
    from: string
    to: string
    data: string
    value?: bigint
  },
): Promise<SimulationResult> {
  try {
    // Use eth_call to simulate
    const result = await provider.call({
      from: tx.from,
      to: tx.to,
      data: tx.data,
      value: tx.value,
    })

    // Estimate gas
    const gasEstimate = await provider.estimateGas({
      from: tx.from,
      to: tx.to,
      data: tx.data,
      value: tx.value,
    })

    return {
      success: true,
      gasUsed: gasEstimate,
      balanceChanges: [], // Would need trace_call for full balance changes
      warnings: [],
    }
  } catch (error: any) {
    // Parse revert reason
    let revertReason = "Unknown error"
    if (error.reason) {
      revertReason = error.reason
    } else if (error.data) {
      try {
        // Try to decode error
        const iface = new ethers.Interface(["error Error(string)"])
        const decoded = iface.parseError(error.data)
        if (decoded) {
          revertReason = decoded.args[0]
        }
      } catch {
        revertReason = error.message
      }
    }

    return {
      success: false,
      gasUsed: 0n,
      balanceChanges: [],
      warnings: ["Transaction simulation failed"],
      revertReason,
    }
  }
}

// ============================================================================
// 8. COMPREHENSIVE PRE-TRANSACTION SECURITY CHECK
// ============================================================================

export interface PreTransactionCheckResult {
  canProceed: boolean
  overallRisk: "safe" | "low" | "medium" | "high" | "critical"
  checks: {
    contractSafety: ContractVerificationResult
    approvalAnalysis?: SignatureAnalysis
    flashLoanRisk: FlashLoanRisk
    doubleSpendCheck: { isRisky: boolean; warning?: string }
    bridgeSecurity?: BridgeSecurityCheck
  }
  allWarnings: string[]
  blockers: string[]
}

export async function performPreTransactionCheck(
  provider: ethers.Provider,
  params: {
    type: "transfer" | "approve" | "bridge" | "swap"
    from: string
    to: string
    tokenAddress: string
    amount: bigint
    chainId: number
    nonce?: number
    destinationChainId?: number
    signatureRequest?: SignatureRequest
  },
): Promise<PreTransactionCheckResult> {
  const allWarnings: string[] = []
  const blockers: string[] = []

  // 1. Contract safety check
  const contractSafety = await verifyContractSafety(params.tokenAddress, params.chainId, provider)
  allWarnings.push(...contractSafety.warnings)

  if (contractSafety.riskLevel === "critical") {
    blockers.push("Contract verification failed - do not proceed")
  }

  // 2. Signature analysis (if applicable)
  let approvalAnalysis: SignatureAnalysis | undefined
  if (params.signatureRequest) {
    approvalAnalysis = analyzeSignatureRequest(params.signatureRequest)
    allWarnings.push(...approvalAnalysis.warnings)

    if (approvalAnalysis.isUnlimitedApproval) {
      allWarnings.push("Consider approving exact amount instead of unlimited")
    }
  }

  // 3. Flash loan risk
  const flashLoanRisk = assessFlashLoanRisk(
    params.type as any,
    params.amount,
    6, // Assuming USDC decimals
  )
  allWarnings.push(...flashLoanRisk.riskFactors)

  // 4. Double spend check
  const doubleSpendCheck =
    params.nonce !== undefined
      ? checkDoubleSpendRisk(params.from, params.nonce, params.to, params.amount)
      : { isRisky: false }

  if (doubleSpendCheck.isRisky && doubleSpendCheck.warning) {
    blockers.push(doubleSpendCheck.warning)
  }

  // 5. Bridge security (if applicable)
  let bridgeSecurity: BridgeSecurityCheck | undefined
  if (params.type === "bridge" && params.destinationChainId) {
    bridgeSecurity = await validateBridgeTransaction(
      {
        sourceChainId: params.chainId,
        destinationChainId: params.destinationChainId,
        tokenAddress: params.tokenAddress,
        amount: params.amount,
        recipientAddress: params.to,
        bridgeContract: params.to, // Assuming to is bridge contract
      },
      provider,
    )
    allWarnings.push(...bridgeSecurity.warnings)
  }

  // Calculate overall risk
  let overallRisk: PreTransactionCheckResult["overallRisk"] = "safe"
  if (allWarnings.length > 0) overallRisk = "low"
  if (allWarnings.length > 2) overallRisk = "medium"
  if (contractSafety.riskLevel === "high" || approvalAnalysis?.riskLevel === "danger") {
    overallRisk = "high"
  }
  if (blockers.length > 0) overallRisk = "critical"

  return {
    canProceed: blockers.length === 0,
    overallRisk,
    checks: {
      contractSafety,
      approvalAnalysis,
      flashLoanRisk,
      doubleSpendCheck,
      bridgeSecurity,
    },
    allWarnings,
    blockers,
  }
}
