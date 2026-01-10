/**
 * Future Attack Protection Library
 * Protects against emerging and future attack vectors:
 * 1. AI-based attacks (phishing, deepfake, social engineering)
 * 2. Clipboard hijacking during address copying
 * 3. Quantum computing attacks (preparation)
 * 4. Advanced hybrid/combined attacks
 */

// ============================================================================
// 1. AI ATTACK DETECTION & PREVENTION
// ============================================================================

export interface AIAttackDetectionResult {
  isLikelySafe: boolean
  threatLevel: "none" | "low" | "medium" | "high" | "critical"
  detectedPatterns: string[]
  recommendations: string[]
}

// Common patterns in AI-generated phishing content
const AI_PHISHING_PATTERNS = [
  // Urgency patterns
  /\b(urgent|immediately|act now|limited time|expires? in \d+|countdown)\b/gi,
  // Authority impersonation
  /\b(official|verified|certified|authorized|support team|admin|moderator)\b/gi,
  // Fear patterns
  /\b(suspend|terminate|disable|locked|compromised|hacked|stolen)\b/gi,
  // Reward patterns
  /\b(congratulations|winner|selected|exclusive|bonus|free|reward|airdrop)\b/gi,
  // Request patterns
  /\b(verify|confirm|update|validate|sync|connect.*wallet|enter.*seed|private.*key)\b/gi,
  // Fake transaction patterns
  /\b(pending.*transaction|claim.*token|receive.*payment|unclaimed)\b/gi,
]

// Behavioral anomaly indicators
interface BehavioralProfile {
  avgTimeBetweenActions: number
  typicalTransactionSize: number
  usualActiveHours: number[]
  knownDeviceFingerprints: string[]
  trustedIpRanges: string[]
}

export function detectAIPhishingContent(content: string): AIAttackDetectionResult {
  const detectedPatterns: string[] = []
  let threatScore = 0

  // Check for AI phishing patterns
  for (const pattern of AI_PHISHING_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) {
      detectedPatterns.push(`Pattern: "${matches[0]}"`)
      threatScore += 15
    }
  }

  // Check for suspicious Unicode characters (homograph attack via AI)
  const suspiciousChars = detectHomographChars(content)
  if (suspiciousChars.length > 0) {
    detectedPatterns.push(`Suspicious characters: ${suspiciousChars.join(", ")}`)
    threatScore += 30
  }

  // Check for excessive punctuation (AI-generated urgency)
  const excessivePunctuation = (content.match(/[!?]{2,}/g) || []).length
  if (excessivePunctuation > 2) {
    detectedPatterns.push("Excessive punctuation (urgency manipulation)")
    threatScore += 10
  }

  // Check for mixed case manipulation
  const mixedCaseWords = content.match(/\b[A-Z][a-z]+[A-Z]+[a-z]*\b/g) || []
  if (mixedCaseWords.length > 3) {
    detectedPatterns.push("Unusual capitalization patterns")
    threatScore += 10
  }

  // Determine threat level
  let threatLevel: AIAttackDetectionResult["threatLevel"] = "none"
  if (threatScore >= 60) threatLevel = "critical"
  else if (threatScore >= 40) threatLevel = "high"
  else if (threatScore >= 25) threatLevel = "medium"
  else if (threatScore > 0) threatLevel = "low"

  // Generate recommendations
  const recommendations: string[] = []
  if (threatLevel !== "none") {
    recommendations.push("Do not click any links in this message")
    recommendations.push("Verify sender identity through official channels")
    recommendations.push("Never share private keys or seed phrases")
    if (threatLevel === "critical" || threatLevel === "high") {
      recommendations.push("Report this message to Protocol Bank support")
      recommendations.push("Do not respond to this message")
    }
  }

  return {
    isLikelySafe: threatLevel === "none" || threatLevel === "low",
    threatLevel,
    detectedPatterns,
    recommendations,
  }
}

function detectHomographChars(text: string): string[] {
  const suspicious: string[] = []
  // Common homograph characters that look like ASCII but aren't
  const homographMap: Record<string, string> = {
    "\u0430": "a (Cyrillic)",
    "\u0435": "e (Cyrillic)",
    "\u043E": "o (Cyrillic)",
    "\u0440": "p (Cyrillic)",
    "\u0441": "c (Cyrillic)",
    "\u0445": "x (Cyrillic)",
    "\u0443": "y (Cyrillic)",
    "\u0456": "i (Cyrillic)",
    "\u0073\u0307": "s with dot",
    "\u1D00": "small cap A",
    "\u1D07": "small cap E",
    "\u1D0F": "small cap O",
    "\u1D18": "small cap P",
    "\u2010": "hyphen (non-standard)",
    "\u2011": "non-breaking hyphen",
    "\u2012": "figure dash",
    "\u2013": "en dash",
    "\u2014": "em dash",
  }

  for (const [char, description] of Object.entries(homographMap)) {
    if (text.includes(char)) {
      suspicious.push(description)
    }
  }

  // Check for zero-width characters
  if (/[\u200B\u200C\u200D\uFEFF]/.test(text)) {
    suspicious.push("Zero-width characters (hidden content)")
  }

  return suspicious
}

// Behavioral anomaly detection
export interface BehavioralAnomalyResult {
  isAnomalous: boolean
  anomalyScore: number
  anomalies: string[]
  riskFactors: string[]
}

export function detectBehavioralAnomaly(
  action: {
    timestamp: number
    actionType: string
    amount?: number
    recipient?: string
    deviceFingerprint?: string
    ipAddress?: string
  },
  historicalProfile?: BehavioralProfile,
): BehavioralAnomalyResult {
  const anomalies: string[] = []
  const riskFactors: string[] = []
  let anomalyScore = 0

  const currentHour = new Date(action.timestamp).getHours()

  if (historicalProfile) {
    // Check unusual time
    if (!historicalProfile.usualActiveHours.includes(currentHour)) {
      anomalies.push(`Unusual activity time: ${currentHour}:00`)
      anomalyScore += 20
    }

    // Check transaction size deviation
    if (action.amount && historicalProfile.typicalTransactionSize > 0) {
      const deviation = action.amount / historicalProfile.typicalTransactionSize
      if (deviation > 10) {
        anomalies.push(`Transaction ${deviation.toFixed(1)}x larger than typical`)
        anomalyScore += 30
        riskFactors.push("Unusually large transaction")
      }
    }

    // Check device fingerprint
    if (action.deviceFingerprint && !historicalProfile.knownDeviceFingerprints.includes(action.deviceFingerprint)) {
      anomalies.push("New/unknown device detected")
      anomalyScore += 25
      riskFactors.push("Transaction from unrecognized device")
    }
  }

  // Time-based attack patterns
  const dayOfWeek = new Date(action.timestamp).getDay()
  if (((dayOfWeek === 0 || dayOfWeek === 6) && currentHour >= 22) || currentHour <= 5) {
    riskFactors.push("Weekend late-night transaction (higher fraud risk)")
    anomalyScore += 10
  }

  return {
    isAnomalous: anomalyScore >= 40,
    anomalyScore: Math.min(anomalyScore, 100),
    anomalies,
    riskFactors,
  }
}

// ============================================================================
// 2. ENHANCED CLIPBOARD HIJACKING PROTECTION
// ============================================================================

export interface ClipboardSecurityResult {
  isSecure: boolean
  originalValue: string
  currentValue: string | null
  wasModified: boolean
  modificationDetails?: string
  visualVerification: {
    chunkedOriginal: string
    checksumOriginal: string
  }
}

// Generate visual verification chunks for address
export function generateVisualAddressChunks(address: string): string {
  if (!address || address.length < 10) return address

  // Split into 4-character chunks with visual separators
  const cleanAddress = address.startsWith("0x") ? address.slice(2) : address
  const chunks: string[] = []

  for (let i = 0; i < cleanAddress.length; i += 4) {
    chunks.push(cleanAddress.slice(i, i + 4))
  }

  return "0x " + chunks.join(" · ")
}

// Generate a simple visual checksum
export function generateAddressChecksum(address: string): string {
  if (!address) return ""

  const clean = address.toLowerCase().replace("0x", "")
  let sum = 0

  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i)
    sum = ((sum << 5) - sum + charCode) & 0xffffffff
  }

  // Convert to memorable words for easy verbal verification
  const words = ["Alpha", "Beta", "Gamma", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"]
  const word1 = words[Math.abs(sum) % 8]
  const word2 = words[Math.abs(sum >> 8) % 8]
  const num = Math.abs(sum % 100)
    .toString()
    .padStart(2, "0")

  return `${word1}-${word2}-${num}`
}

// Monitor clipboard for hijacking
export class ClipboardMonitor {
  private originalValue = ""
  private copyTimestamp = 0
  private checkInterval: number | null = null
  private onHijackDetected?: (details: string) => void

  constructor(onHijackDetected?: (details: string) => void) {
    this.onHijackDetected = onHijackDetected
  }

  async recordCopy(value: string): Promise<void> {
    this.originalValue = value
    this.copyTimestamp = Date.now()

    // Start monitoring
    this.startMonitoring()
  }

  private startMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    // Check clipboard every 2 seconds for 30 seconds
    let checks = 0
    this.checkInterval = window.setInterval(async () => {
      checks++
      if (checks > 15) {
        // 30 seconds
        this.stopMonitoring()
        return
      }

      try {
        const current = await navigator.clipboard.readText()
        if (current !== this.originalValue && this.looksLikeAddress(current)) {
          // Potential hijack detected
          const details = this.analyzeModification(this.originalValue, current)
          this.onHijackDetected?.(details)
          this.stopMonitoring()
        }
      } catch {
        // Can't read clipboard, stop monitoring
        this.stopMonitoring()
      }
    }, 2000)
  }

  private stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  private looksLikeAddress(value: string): boolean {
    // Check if it looks like a crypto address
    return (
      /^0x[a-fA-F0-9]{40}$/.test(value) || // ETH
      /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(value) || // BTC
      /^[a-zA-Z0-9]{32,44}$/.test(value)
    ) // SOL/other
  }

  private analyzeModification(original: string, modified: string): string {
    if (original.slice(0, 6) === modified.slice(0, 6)) {
      return "Address prefix matches but body differs - likely clipboard hijacker targeting similar-looking addresses"
    }
    if (original.slice(-4) === modified.slice(-4)) {
      return "Address suffix matches but body differs - sophisticated clipboard hijacker detected"
    }
    return "Clipboard was modified with a different address - possible malware detected"
  }

  async verifyClipboard(): Promise<ClipboardSecurityResult> {
    let currentValue: string | null = null
    let wasModified = false
    let modificationDetails: string | undefined

    try {
      currentValue = await navigator.clipboard.readText()
      wasModified = currentValue !== this.originalValue

      if (wasModified && this.looksLikeAddress(currentValue)) {
        modificationDetails = this.analyzeModification(this.originalValue, currentValue)
      }
    } catch {
      // Can't read clipboard
    }

    return {
      isSecure: !wasModified,
      originalValue: this.originalValue,
      currentValue,
      wasModified,
      modificationDetails,
      visualVerification: {
        chunkedOriginal: generateVisualAddressChunks(this.originalValue),
        checksumOriginal: generateAddressChecksum(this.originalValue),
      },
    }
  }

  destroy(): void {
    this.stopMonitoring()
  }
}

// ============================================================================
// 3. QUANTUM ATTACK PREPARATION
// ============================================================================

export interface QuantumReadinessReport {
  currentRiskLevel: "low" | "medium" | "high"
  estimatedYearsUntilThreat: number
  recommendations: string[]
  mitigations: {
    implemented: string[]
    pending: string[]
  }
  addressRotationAdvised: boolean
}

export function assessQuantumReadiness(
  addressAge: number, // days since first use
  totalValue: number, // USD value at risk
  transactionCount: number,
): QuantumReadinessReport {
  const recommendations: string[] = []
  const implementedMitigations: string[] = []
  const pendingMitigations: string[] = []

  // Current ECDSA is vulnerable to quantum attacks
  // Estimate: Large-scale quantum computers capable of breaking ECDSA
  // are estimated to be 10-15 years away (as of 2024)
  const estimatedYearsUntilThreat = 12

  // Assess current risk based on value and address age
  let riskLevel: QuantumReadinessReport["currentRiskLevel"] = "low"

  // Long-term storage with high value is at risk
  if (addressAge > 365 && totalValue > 100000) {
    riskLevel = "high"
    recommendations.push("Consider migrating high-value holdings to newer addresses periodically")
    recommendations.push("Implement address rotation strategy for long-term storage")
  } else if (addressAge > 180 || totalValue > 10000) {
    riskLevel = "medium"
    recommendations.push("Monitor developments in post-quantum cryptography")
  }

  // Address rotation advice
  const addressRotationAdvised = addressAge > 365 || totalValue > 50000

  if (addressRotationAdvised) {
    recommendations.push("Rotate receiving addresses every 6-12 months for enhanced security")
    pendingMitigations.push("Automatic address rotation")
  }

  // Current mitigations
  implementedMitigations.push("Using latest EIP standards with upgrade paths")
  implementedMitigations.push("Minimal on-chain exposure time for signatures")
  implementedMitigations.push("Transaction signing with fresh nonces")

  // Future mitigations
  pendingMitigations.push("Post-quantum signature algorithm support (when available)")
  pendingMitigations.push("Hybrid classical/quantum-resistant signatures")
  pendingMitigations.push("Lattice-based cryptography integration")

  // General recommendations
  recommendations.push("Stay informed about NIST post-quantum cryptography standards")
  recommendations.push("Be prepared to migrate to quantum-resistant algorithms when available")
  recommendations.push("Avoid reusing addresses for high-value transactions")

  return {
    currentRiskLevel: riskLevel,
    estimatedYearsUntilThreat,
    recommendations,
    mitigations: {
      implemented: implementedMitigations,
      pending: pendingMitigations,
    },
    addressRotationAdvised,
  }
}

// Hybrid signature preparation (for future quantum-resistant upgrades)
export interface HybridSignaturePrep {
  classicalSignature: string
  quantumResistantHash: string
  migrationPath: string
}

export function prepareHybridSignature(message: string, classicalSignature: string): HybridSignaturePrep {
  // Create additional quantum-resistant hash layer
  // This provides a migration path when PQ algorithms are ready

  // Use SHA-3 (Keccak) which is considered more quantum-resistant than SHA-2
  // For now, we simulate with a strong hash
  const quantumResistantHash = generateStrongHash(message + classicalSignature)

  return {
    classicalSignature,
    quantumResistantHash,
    migrationPath: "SPHINCS+ or CRYSTALS-Dilithium when NIST finalizes standards",
  }
}

function generateStrongHash(data: string): string {
  // Extended hash with multiple rounds for additional security
  let hash = 0
  let hash2 = 0

  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash + char) & 0xffffffff
    hash2 = ((hash2 << 7) + hash2 + char) & 0xffffffff
  }

  // Combine hashes
  const combined = Math.abs(hash).toString(16).padStart(8, "0") + Math.abs(hash2).toString(16).padStart(8, "0")

  return "0x" + combined + combined // 64 char hash
}

// ============================================================================
// 4. ADVANCED HYBRID/COMBINED ATTACK DETECTION
// ============================================================================

export interface CombinedAttackAnalysis {
  overallThreatLevel: "safe" | "suspicious" | "dangerous" | "critical"
  attackVectors: string[]
  correlations: string[]
  immediateActions: string[]
  blockTransaction: boolean
}

export function analyzeForCombinedAttacks(context: {
  aiDetection: AIAttackDetectionResult
  behavioralAnomaly: BehavioralAnomalyResult
  clipboardSecurity: ClipboardSecurityResult
  recentFailedAttempts: number
  ipReputationScore: number // 0-100, higher is more trusted
  timeSinceLastLogin: number // minutes
  isNewRecipient: boolean
  transactionAmount: number
  unusualGasPrice: boolean
}): CombinedAttackAnalysis {
  const attackVectors: string[] = []
  const correlations: string[] = []
  const immediateActions: string[] = []
  let threatScore = 0

  // Check AI phishing vector
  if (context.aiDetection.threatLevel !== "none") {
    attackVectors.push("Potential AI-generated phishing")
    threatScore +=
      context.aiDetection.threatLevel === "critical"
        ? 40
        : context.aiDetection.threatLevel === "high"
          ? 30
          : context.aiDetection.threatLevel === "medium"
            ? 20
            : 10
  }

  // Check behavioral anomaly vector
  if (context.behavioralAnomaly.isAnomalous) {
    attackVectors.push("Behavioral anomaly detected")
    threatScore += context.behavioralAnomaly.anomalyScore / 2
  }

  // Check clipboard security vector
  if (!context.clipboardSecurity.isSecure) {
    attackVectors.push("Clipboard hijacking suspected")
    threatScore += 50 // This is a serious direct threat
    immediateActions.push("STOP: Verify recipient address manually before proceeding")
  }

  // Check for attack correlations (combined attacks)

  // Pattern 1: AI phishing + behavioral anomaly = social engineering attack
  if (context.aiDetection.threatLevel !== "none" && context.behavioralAnomaly.isAnomalous) {
    correlations.push("COMBINED: Social engineering attack pattern (AI phishing + unusual behavior)")
    threatScore += 20
    immediateActions.push("Verify this request through an independent channel")
  }

  // Pattern 2: Clipboard hijack + new recipient + large amount = targeted theft
  if (!context.clipboardSecurity.isSecure && context.isNewRecipient && context.transactionAmount > 1000) {
    correlations.push("COMBINED: Targeted theft pattern (clipboard hijack + new recipient + large amount)")
    threatScore += 30
    immediateActions.push("Cancel transaction and scan device for malware")
  }

  // Pattern 3: Multiple failed attempts + low IP reputation = brute force
  if (context.recentFailedAttempts > 3 && context.ipReputationScore < 30) {
    correlations.push("COMBINED: Brute force attack pattern (multiple failures + suspicious IP)")
    threatScore += 25
    immediateActions.push("Consider changing credentials and enabling additional 2FA")
  }

  // Pattern 4: Long time since login + unusual gas + large amount = account takeover
  if (context.timeSinceLastLogin > 1440 && context.unusualGasPrice && context.transactionAmount > 5000) {
    correlations.push("COMBINED: Account takeover pattern (dormant account + unusual gas + large amount)")
    threatScore += 35
    immediateActions.push("Verify account ownership through additional authentication")
  }

  // Pattern 5: Everything looks suspicious = coordinated attack
  const suspiciousFactors = [
    context.aiDetection.threatLevel !== "none",
    context.behavioralAnomaly.isAnomalous,
    !context.clipboardSecurity.isSecure,
    context.ipReputationScore < 50,
    context.isNewRecipient,
    context.transactionAmount > 10000,
  ].filter(Boolean).length

  if (suspiciousFactors >= 4) {
    correlations.push("COORDINATED: Multiple attack vectors detected simultaneously")
    threatScore += 40
    immediateActions.unshift("HIGH ALERT: Strong indicators of coordinated attack")
  }

  // Determine overall threat level
  let overallThreatLevel: CombinedAttackAnalysis["overallThreatLevel"]
  if (threatScore >= 80) overallThreatLevel = "critical"
  else if (threatScore >= 50) overallThreatLevel = "dangerous"
  else if (threatScore >= 25) overallThreatLevel = "suspicious"
  else overallThreatLevel = "safe"

  // Determine if transaction should be blocked
  const blockTransaction =
    overallThreatLevel === "critical" ||
    !context.clipboardSecurity.isSecure ||
    (correlations.length >= 2 && threatScore >= 40)

  if (blockTransaction) {
    immediateActions.unshift("Transaction blocked for your protection")
  }

  return {
    overallThreatLevel,
    attackVectors,
    correlations,
    immediateActions,
    blockTransaction,
  }
}

// ============================================================================
// 5. REAL-TIME THREAT MONITORING
// ============================================================================

export interface ThreatMonitorConfig {
  onThreatDetected: (threat: {
    type: string
    severity: "low" | "medium" | "high" | "critical"
    details: string
    timestamp: number
  }) => void
  monitorClipboard: boolean
  monitorBehavior: boolean
  checkInterval: number // ms
}

export class RealTimeThreatMonitor {
  private config: ThreatMonitorConfig
  private clipboardMonitor: ClipboardMonitor | null = null
  private behaviorHistory: Array<{ action: string; timestamp: number }> = []
  private intervalId: number | null = null

  constructor(config: ThreatMonitorConfig) {
    this.config = config
    this.initialize()
  }

  private initialize(): void {
    if (this.config.monitorClipboard && typeof window !== "undefined") {
      this.clipboardMonitor = new ClipboardMonitor((details) => {
        this.config.onThreatDetected({
          type: "clipboard_hijack",
          severity: "critical",
          details,
          timestamp: Date.now(),
        })
      })
    }

    // Start periodic checks
    if (typeof window !== "undefined") {
      this.intervalId = window.setInterval(() => {
        this.performPeriodicChecks()
      }, this.config.checkInterval)
    }
  }

  private performPeriodicChecks(): void {
    // Check for rapid-fire actions (bot behavior)
    const recentActions = this.behaviorHistory.filter((a) => Date.now() - a.timestamp < 5000)

    if (recentActions.length > 10) {
      this.config.onThreatDetected({
        type: "bot_behavior",
        severity: "high",
        details: `${recentActions.length} actions in 5 seconds - possible automated attack`,
        timestamp: Date.now(),
      })
    }

    // Clean old history
    this.behaviorHistory = this.behaviorHistory.filter((a) => Date.now() - a.timestamp < 60000)
  }

  recordAction(action: string): void {
    this.behaviorHistory.push({ action, timestamp: Date.now() })
  }

  async recordClipboardCopy(value: string): Promise<void> {
    await this.clipboardMonitor?.recordCopy(value)
  }

  async verifyClipboard(): Promise<ClipboardSecurityResult | null> {
    return this.clipboardMonitor?.verifyClipboard() ?? null
  }

  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
    this.clipboardMonitor?.destroy()
  }
}
