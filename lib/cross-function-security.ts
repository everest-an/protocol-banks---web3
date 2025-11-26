/**
 * Cross-Function Security Module
 * Protects against mixed attacks that exploit interactions between different modules
 */

// Synchronous HMAC-like function for immediate use
function simpleHmac(key: string, data: string): string {
  let hash = 0
  const combined = key + data + key
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  const hex = Math.abs(hash).toString(16)
  return hex.padStart(64, "0").slice(0, 64)
}

// Generate random bytes using Web Crypto API
function generateRandomBytes(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// ============================================================================
// 1. STATE INTEGRITY VERIFICATION
// Prevents state desync attacks between client state and actual blockchain/DB state
// ============================================================================

interface StateSnapshot {
  walletAddress: string | null
  chainId: number
  balances: Record<string, string>
  timestamp: number
  nonce: string
}

const STATE_SNAPSHOTS = new Map<string, StateSnapshot>()
const STATE_MAX_AGE_MS = 30000 // 30 seconds

export function createStateSnapshot(
  sessionId: string,
  wallet: string | null,
  chainId: number,
  balances: Record<string, string>,
): string {
  const nonce = generateRandomBytes(16)
  const snapshot: StateSnapshot = {
    walletAddress: wallet,
    chainId,
    balances,
    timestamp: Date.now(),
    nonce,
  }
  STATE_SNAPSHOTS.set(sessionId, snapshot)
  return nonce
}

export function verifyStateConsistency(
  sessionId: string,
  currentWallet: string | null,
  currentChainId: number,
  expectedNonce?: string,
): { valid: boolean; errors: string[]; requiresRefresh: boolean } {
  const errors: string[] = []
  const snapshot = STATE_SNAPSHOTS.get(sessionId)

  if (!snapshot) {
    return { valid: false, errors: ["No state snapshot found - session may be hijacked"], requiresRefresh: true }
  }

  // Check snapshot age
  if (Date.now() - snapshot.timestamp > STATE_MAX_AGE_MS) {
    errors.push("State snapshot expired - potential replay attack")
    return { valid: false, errors, requiresRefresh: true }
  }

  // Verify nonce if provided
  if (expectedNonce && snapshot.nonce !== expectedNonce) {
    errors.push("State nonce mismatch - state may have been tampered")
    return { valid: false, errors, requiresRefresh: true }
  }

  // Verify wallet consistency
  if (snapshot.walletAddress !== currentWallet) {
    errors.push(`Wallet mismatch: expected ${snapshot.walletAddress}, got ${currentWallet}`)
  }

  // Verify chain consistency
  if (snapshot.chainId !== currentChainId) {
    errors.push(`Chain mismatch: expected ${snapshot.chainId}, got ${currentChainId}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    requiresRefresh: errors.length > 0,
  }
}

// ============================================================================
// 2. FUNCTION CALL CHAIN VALIDATION
// Ensures security functions are called in correct order
// ============================================================================

interface CallChainStep {
  functionName: string
  timestamp: number
  params: Record<string, unknown>
  result: "success" | "failure" | "pending"
}

const CALL_CHAINS = new Map<string, CallChainStep[]>()

const REQUIRED_CALL_SEQUENCES: Record<string, string[]> = {
  executePayment: ["validateAddress", "validateAmount", "checkRateLimit", "verifyBalance", "createAuditLog"],
  batchPayment: [
    "validateAllAddresses",
    "validateTotalAmount",
    "checkBatchLimit",
    "verifyTotalBalance",
    "createBatchAudit",
  ],
  approveToken: ["checkExistingApproval", "validateSpender", "calculateSafeAmount", "createApprovalAudit"],
  bridgeTransfer: [
    "validateSourceChain",
    "validateDestChain",
    "verifyBridgeContract",
    "checkLiquidity",
    "createBridgeAudit",
  ],
  signMessage: ["analyzeSignatureRequest", "checkPhishingPatterns", "getUserConfirmation", "createSignatureAudit"],
}

export function initCallChain(transactionId: string): void {
  CALL_CHAINS.set(transactionId, [])
}

export function recordCallStep(
  transactionId: string,
  functionName: string,
  params: Record<string, unknown>,
  result: "success" | "failure" | "pending",
): void {
  const chain = CALL_CHAINS.get(transactionId)
  if (!chain) {
    console.error(`[Security] No call chain found for transaction ${transactionId}`)
    return
  }

  chain.push({
    functionName,
    timestamp: Date.now(),
    params,
    result,
  })
}

export function validateCallChain(
  transactionId: string,
  operationType: keyof typeof REQUIRED_CALL_SEQUENCES,
): { valid: boolean; missingSteps: string[]; outOfOrderSteps: string[] } {
  const chain = CALL_CHAINS.get(transactionId)
  const requiredSequence = REQUIRED_CALL_SEQUENCES[operationType]

  if (!chain || !requiredSequence) {
    return { valid: false, missingSteps: requiredSequence || [], outOfOrderSteps: [] }
  }

  const executedFunctions = chain.filter((step) => step.result === "success").map((step) => step.functionName)

  const missingSteps: string[] = []
  const outOfOrderSteps: string[] = []

  let lastIndex = -1
  for (const required of requiredSequence) {
    const currentIndex = executedFunctions.indexOf(required)
    if (currentIndex === -1) {
      missingSteps.push(required)
    } else if (currentIndex < lastIndex) {
      outOfOrderSteps.push(required)
    }
    lastIndex = Math.max(lastIndex, currentIndex)
  }

  return {
    valid: missingSteps.length === 0 && outOfOrderSteps.length === 0,
    missingSteps,
    outOfOrderSteps,
  }
}

export function cleanupCallChain(transactionId: string): void {
  CALL_CHAINS.delete(transactionId)
}

// ============================================================================
// 3. PROVIDER AUTHENTICITY VERIFICATION
// Detects fake/malicious wallet providers
// ============================================================================

interface ProviderFingerprint {
  isMetaMask: boolean
  isCoinbaseWallet: boolean
  isWalletConnect: boolean
  hasMultipleProviders: boolean
  providerCount: number
  chainMethods: string[]
  suspiciousProperties: string[]
}

export function verifyProviderAuthenticity(): {
  authentic: boolean
  fingerprint: ProviderFingerprint
  warnings: string[]
} {
  const warnings: string[] = []

  if (typeof window === "undefined" || !window.ethereum) {
    return {
      authentic: false,
      fingerprint: {
        isMetaMask: false,
        isCoinbaseWallet: false,
        isWalletConnect: false,
        hasMultipleProviders: false,
        providerCount: 0,
        chainMethods: [],
        suspiciousProperties: [],
      },
      warnings: ["No Ethereum provider detected"],
    }
  }

  const eth = window.ethereum as any
  const fingerprint: ProviderFingerprint = {
    isMetaMask: !!eth.isMetaMask,
    isCoinbaseWallet: !!eth.isCoinbaseWallet,
    isWalletConnect: !!eth.isWalletConnect,
    hasMultipleProviders: Array.isArray(eth.providers),
    providerCount: eth.providers?.length || 1,
    chainMethods: [],
    suspiciousProperties: [],
  }

  // Check for expected methods
  const expectedMethods = ["request", "on", "removeListener", "isConnected"]
  for (const method of expectedMethods) {
    if (typeof eth[method] === "function") {
      fingerprint.chainMethods.push(method)
    }
  }

  // Check for suspicious properties that legitimate providers don't have
  const suspiciousProps = ["interceptRequests", "modifyTransactions", "capturePrivateKey", "redirectTo"]
  for (const prop of suspiciousProps) {
    if (prop in eth) {
      fingerprint.suspiciousProperties.push(prop)
      warnings.push(`Suspicious property detected: ${prop}`)
    }
  }

  // Verify MetaMask specific properties
  if (eth.isMetaMask) {
    if (!eth._metamask || typeof eth._metamask.isUnlocked !== "function") {
      warnings.push("MetaMask claims to be MetaMask but missing internal API")
    }
  }

  // Check for provider wrapping (potential MITM)
  if (eth.__proto__ && eth.__proto__.constructor.name === "Proxy") {
    warnings.push("Provider appears to be wrapped in a Proxy - potential interception")
  }

  // Multiple providers can indicate extension conflicts or attacks
  if (fingerprint.hasMultipleProviders && fingerprint.providerCount > 3) {
    warnings.push(`Unusually high number of providers detected: ${fingerprint.providerCount}`)
  }

  return {
    authentic: warnings.length === 0 && fingerprint.suspiciousProperties.length === 0,
    fingerprint,
    warnings,
  }
}

// ============================================================================
// 4. CROSS-CONTEXT DATA VALIDATION
// Ensures data consistency between Web3 context and database
// ============================================================================

interface CrossContextValidation {
  web3Wallet: string | null
  dbUserId: string | null
  web3ChainId: number
  dbPreferredChain: number | null
  web3Balances: Record<string, string>
  dbCachedBalances: Record<string, string>
}

export function validateCrossContextData(data: CrossContextValidation): {
  valid: boolean
  inconsistencies: string[]
  recommendations: string[]
} {
  const inconsistencies: string[] = []
  const recommendations: string[] = []

  // Wallet address should match database user
  if (data.web3Wallet && data.dbUserId) {
    // In a real implementation, you'd verify the wallet is associated with the user
    // For now, we just check they both exist
  }

  // Chain preferences should be consistent
  if (data.dbPreferredChain && data.web3ChainId !== data.dbPreferredChain) {
    inconsistencies.push(`Chain mismatch: Web3 on ${data.web3ChainId}, DB prefers ${data.dbPreferredChain}`)
    recommendations.push("Consider syncing chain preference or prompting user to switch")
  }

  // Balance discrepancies (allow 5% tolerance for timing)
  for (const [token, web3Balance] of Object.entries(data.web3Balances)) {
    const dbBalance = data.dbCachedBalances[token]
    if (dbBalance) {
      const web3Num = Number.parseFloat(web3Balance)
      const dbNum = Number.parseFloat(dbBalance)
      if (Math.abs(web3Num - dbNum) / Math.max(web3Num, dbNum, 1) > 0.05) {
        inconsistencies.push(`Balance discrepancy for ${token}: Web3=${web3Balance}, DB=${dbBalance}`)
        recommendations.push(`Refresh cached balance for ${token}`)
      }
    }
  }

  return {
    valid: inconsistencies.length === 0,
    inconsistencies,
    recommendations,
  }
}

// ============================================================================
// 5. EVENT HANDLER INTEGRITY
// Protects against event spoofing attacks
// ============================================================================

interface EventSignature {
  eventType: string
  timestamp: number
  hash: string
}

const EVENT_SIGNATURES = new Map<string, EventSignature>()
const EVENT_SECRET =
  typeof window === "undefined" ? process.env.EVENT_SECRET || generateRandomBytes(32) : generateRandomBytes(32)

export function signEvent(eventType: string, data: unknown): string {
  const timestamp = Date.now()
  const payload = JSON.stringify({ eventType, data, timestamp })
  const hash = simpleHmac(EVENT_SECRET, payload)

  EVENT_SIGNATURES.set(hash, { eventType, timestamp, hash })

  // Cleanup old signatures (keep last 1000)
  if (EVENT_SIGNATURES.size > 1000) {
    const oldestKey = EVENT_SIGNATURES.keys().next().value
    if (oldestKey) EVENT_SIGNATURES.delete(oldestKey)
  }

  return hash
}

export function verifyEventOrigin(
  eventType: string,
  expectedHash: string,
  maxAgeMs = 60000,
): { valid: boolean; error?: string } {
  const signature = EVENT_SIGNATURES.get(expectedHash)

  if (!signature) {
    return { valid: false, error: "Unknown event signature - possible spoofed event" }
  }

  if (signature.eventType !== eventType) {
    return { valid: false, error: `Event type mismatch: expected ${eventType}, got ${signature.eventType}` }
  }

  if (Date.now() - signature.timestamp > maxAgeMs) {
    return { valid: false, error: "Event signature expired - possible replay attack" }
  }

  return { valid: true }
}

// ============================================================================
// 6. DEMO MODE SECURITY
// Prevents demo mode from being exploited in production
// ============================================================================

const DEMO_MODE_TOKENS = new Map<string, { createdAt: number; ip: string }>()

export function secureDemoModeToggle(
  currentState: boolean,
  requestIp: string,
  userAgent: string,
): { allowed: boolean; error?: string } {
  // In production, demo mode should be disabled
  if (typeof window === "undefined" && process.env.NODE_ENV === "production" && !process.env.ALLOW_DEMO_MODE) {
    return { allowed: false, error: "Demo mode disabled in production" }
  }

  // Rate limit demo mode toggles (max 5 per minute per IP)
  const ipToggles = Array.from(DEMO_MODE_TOKENS.values()).filter(
    (t) => t.ip === requestIp && Date.now() - t.createdAt < 60000,
  )

  if (ipToggles.length >= 5) {
    return { allowed: false, error: "Too many demo mode toggles - rate limited" }
  }

  // Record this toggle
  const token = generateRandomBytes(16)
  DEMO_MODE_TOKENS.set(token, { createdAt: Date.now(), ip: requestIp })

  // Cleanup old tokens
  for (const [key, value] of DEMO_MODE_TOKENS) {
    if (Date.now() - value.createdAt > 300000) {
      DEMO_MODE_TOKENS.delete(key)
    }
  }

  return { allowed: true }
}

// ============================================================================
// 7. BALANCE FRESHNESS VERIFICATION
// Prevents stale balance exploitation
// ============================================================================

interface BalanceRecord {
  value: string
  fetchedAt: number
  blockNumber?: number
}

const BALANCE_CACHE = new Map<string, BalanceRecord>()
const MAX_BALANCE_AGE_MS = 15000 // 15 seconds for payment operations
const MAX_BALANCE_AGE_DISPLAY_MS = 60000 // 60 seconds for display

export function recordBalance(wallet: string, token: string, value: string, blockNumber?: number): void {
  const key = `${wallet}:${token}`
  BALANCE_CACHE.set(key, {
    value,
    fetchedAt: Date.now(),
    blockNumber,
  })
}

export function verifyBalanceFreshness(
  wallet: string,
  token: string,
  forPayment = true,
): { fresh: boolean; age: number; staleReason?: string } {
  const key = `${wallet}:${token}`
  const record = BALANCE_CACHE.get(key)

  if (!record) {
    return { fresh: false, age: Number.POSITIVE_INFINITY, staleReason: "No cached balance - fetch required" }
  }

  const age = Date.now() - record.fetchedAt
  const maxAge = forPayment ? MAX_BALANCE_AGE_MS : MAX_BALANCE_AGE_DISPLAY_MS

  if (age > maxAge) {
    return {
      fresh: false,
      age,
      staleReason: `Balance is ${Math.round(age / 1000)}s old (max: ${Math.round(maxAge / 1000)}s)`,
    }
  }

  return { fresh: true, age }
}

export function getBalanceWithFreshness(
  wallet: string,
  token: string,
): { value: string | null; fresh: boolean; age: number } {
  const key = `${wallet}:${token}`
  const record = BALANCE_CACHE.get(key)

  if (!record) {
    return { value: null, fresh: false, age: Number.POSITIVE_INFINITY }
  }

  const age = Date.now() - record.fetchedAt
  return {
    value: record.value,
    fresh: age < MAX_BALANCE_AGE_DISPLAY_MS,
    age,
  }
}

// ============================================================================
// 8. COMBINED ATTACK PATTERN DETECTION
// Detects sophisticated multi-vector attacks
// ============================================================================

interface AttackPattern {
  name: string
  indicators: string[]
  severity: "low" | "medium" | "high" | "critical"
  mitigation: string
}

const KNOWN_ATTACK_PATTERNS: AttackPattern[] = [
  {
    name: "State Desync + Balance Exploitation",
    indicators: ["state_mismatch", "stale_balance", "high_value_transaction"],
    severity: "critical",
    mitigation: "Force state refresh and balance re-fetch before proceeding",
  },
  {
    name: "Provider Injection + Signature Capture",
    indicators: ["suspicious_provider", "personal_sign_request", "unlimited_approval"],
    severity: "critical",
    mitigation: "Block transaction and warn user about potential phishing",
  },
  {
    name: "Demo Mode Escape",
    indicators: ["demo_mode_toggle", "real_transaction_attempt", "production_env"],
    severity: "high",
    mitigation: "Force demo mode OFF for real transactions in production",
  },
  {
    name: "Cross-Chain Confusion",
    indicators: ["chain_mismatch", "cross_chain_transfer", "similar_address"],
    severity: "high",
    mitigation: "Require explicit chain confirmation before cross-chain operations",
  },
  {
    name: "Rate Limit Circumvention",
    indicators: ["multiple_sessions", "ip_rotation", "rapid_requests"],
    severity: "medium",
    mitigation: "Implement global rate limiting with fingerprinting",
  },
  {
    name: "Event Replay Attack",
    indicators: ["duplicate_event_hash", "expired_signature", "out_of_order_events"],
    severity: "medium",
    mitigation: "Validate event signatures and enforce ordering",
  },
]

export function detectCombinedAttack(observedIndicators: string[]): {
  detected: AttackPattern[]
  riskScore: number
  recommendations: string[]
} {
  const detected: AttackPattern[] = []
  const recommendations: string[] = []

  for (const pattern of KNOWN_ATTACK_PATTERNS) {
    const matchedIndicators = pattern.indicators.filter((i) => observedIndicators.includes(i))
    if (matchedIndicators.length >= 2) {
      detected.push(pattern)
      recommendations.push(pattern.mitigation)
    }
  }

  // Calculate risk score (0-100)
  const severityScores = { low: 10, medium: 25, high: 50, critical: 100 }
  const riskScore = Math.min(
    100,
    detected.reduce((sum, p) => sum + severityScores[p.severity], 0),
  )

  return { detected, riskScore, recommendations }
}

// ============================================================================
// 9. TRANSACTION DEPENDENCY GRAPH
// Ensures transaction dependencies are respected
// ============================================================================

interface TransactionNode {
  id: string
  type: string
  status: "pending" | "confirmed" | "failed"
  dependsOn: string[]
  createdAt: number
}

const TX_DEPENDENCY_GRAPH = new Map<string, TransactionNode>()

export function registerTransaction(
  id: string,
  type: string,
  dependsOn: string[] = [],
): { success: boolean; error?: string } {
  // Verify all dependencies exist and are confirmed
  for (const depId of dependsOn) {
    const dep = TX_DEPENDENCY_GRAPH.get(depId)
    if (!dep) {
      return { success: false, error: `Dependency ${depId} not found` }
    }
    if (dep.status === "failed") {
      return { success: false, error: `Dependency ${depId} failed - cannot proceed` }
    }
    if (dep.status === "pending") {
      return { success: false, error: `Dependency ${depId} still pending - wait for confirmation` }
    }
  }

  TX_DEPENDENCY_GRAPH.set(id, {
    id,
    type,
    status: "pending",
    dependsOn,
    createdAt: Date.now(),
  })

  return { success: true }
}

export function updateTransactionStatus(id: string, status: "confirmed" | "failed"): void {
  const tx = TX_DEPENDENCY_GRAPH.get(id)
  if (tx) {
    tx.status = status
  }
}

export function canExecuteTransaction(id: string): { allowed: boolean; blockedBy?: string[] } {
  const tx = TX_DEPENDENCY_GRAPH.get(id)
  if (!tx) {
    return { allowed: false, blockedBy: ["Transaction not registered"] }
  }

  const blockedBy: string[] = []
  for (const depId of tx.dependsOn) {
    const dep = TX_DEPENDENCY_GRAPH.get(depId)
    if (!dep || dep.status !== "confirmed") {
      blockedBy.push(depId)
    }
  }

  return { allowed: blockedBy.length === 0, blockedBy }
}

// ============================================================================
// 10. SESSION BINDING
// Binds transactions to authenticated sessions
// ============================================================================

interface BoundSession {
  sessionId: string
  walletAddress: string
  createdAt: number
  lastActivity: number
  transactionCount: number
  bindingProof: string
}

const BOUND_SESSIONS = new Map<string, BoundSession>()
const SESSION_MAX_AGE_MS = 3600000 // 1 hour
const SESSION_MAX_TRANSACTIONS = 50

export function bindSessionToWallet(
  sessionId: string,
  walletAddress: string,
): { success: boolean; bindingProof: string; error?: string } {
  // Check for existing binding
  const existing = BOUND_SESSIONS.get(sessionId)
  if (existing && existing.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
    return {
      success: false,
      bindingProof: "",
      error: "Session already bound to different wallet",
    }
  }

  const bindingProof = simpleHmac(sessionId, walletAddress.toLowerCase() + Date.now().toString())

  const session: BoundSession = {
    sessionId,
    walletAddress: walletAddress.toLowerCase(),
    createdAt: existing?.createdAt || Date.now(),
    lastActivity: Date.now(),
    transactionCount: existing?.transactionCount || 0,
    bindingProof,
  }

  BOUND_SESSIONS.set(sessionId, session)
  return { success: true, bindingProof }
}

export function verifySessionBinding(sessionId: string, walletAddress: string): { valid: boolean; error?: string } {
  const session = BOUND_SESSIONS.get(sessionId)

  if (!session) {
    return { valid: false, error: "Session not bound - please reconnect wallet" }
  }

  if (session.walletAddress !== walletAddress.toLowerCase()) {
    return { valid: false, error: "Wallet address mismatch - session hijacking detected" }
  }

  if (Date.now() - session.createdAt > SESSION_MAX_AGE_MS) {
    BOUND_SESSIONS.delete(sessionId)
    return { valid: false, error: "Session expired - please reconnect" }
  }

  if (session.transactionCount >= SESSION_MAX_TRANSACTIONS) {
    return { valid: false, error: "Session transaction limit reached - please reconnect" }
  }

  // Update activity
  session.lastActivity = Date.now()
  session.transactionCount++

  return { valid: true }
}

export function unbindSession(sessionId: string): void {
  BOUND_SESSIONS.delete(sessionId)
}

// Cleanup expired sessions periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [id, session] of BOUND_SESSIONS) {
      if (now - session.createdAt > SESSION_MAX_AGE_MS) {
        BOUND_SESSIONS.delete(id)
      }
    }
  }, 300000) // Every 5 minutes
}
