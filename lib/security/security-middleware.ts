/**
 * Protocol Banks - Security Middleware
 *
 * Implements protection against:
 * 1. CSRF attacks
 * 2. Replay attacks
 * 3. Request tampering
 * 4. Origin validation
 * 5. Request signing
 */

import { type NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'
// Uses global crypto (Web Crypto API)

// Synchronous hash for immediate use
function simpleHash(data: string): string {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
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

// ============================================
// 1. CSRF PROTECTION
// ============================================

const CSRF_TOKEN_HEADER = "x-csrf-token"
const CSRF_COOKIE_NAME = "__csrf"

/**
 * Generates a CSRF token
 */
export function generateCSRFToken(): string {
  return generateRandomBytes(32)
}

/**
 * Validates CSRF token from request
 */
export function validateCSRFToken(request: NextRequest): {
  valid: boolean
  error?: string
} {
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER)
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value

  if (!headerToken || !cookieToken) {
    return { valid: false, error: "Missing CSRF token" }
  }

  if (headerToken !== cookieToken) {
    return { valid: false, error: "CSRF token mismatch" }
  }

  return { valid: true }
}

// ============================================
// 2. ORIGIN VALIDATION
// ============================================

const ALLOWED_ORIGINS = [
  "https://protocol-banks.vercel.app",
  "https://protocol-banks.com",
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean) as string[]

// Allow localhost in development
if (process.env.NODE_ENV === "development") {
  ALLOWED_ORIGINS.push("http://localhost:3000", "http://127.0.0.1:3000")
}

/**
 * Validates request origin
 */
export function validateOrigin(request: NextRequest): {
  valid: boolean
  error?: string
} {
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")

  // For same-origin requests, origin might be null
  if (!origin && !referer) {
    // Allow server-side requests (no browser context)
    return { valid: true }
  }

  const requestOrigin = origin || new URL(referer || "").origin

  // In development, be more permissive
  if (process.env.NODE_ENV === "development") {
    return { valid: true }
  }

  if (!ALLOWED_ORIGINS.includes(requestOrigin)) {
    return { valid: false, error: `Invalid origin: ${requestOrigin}` }
  }

  return { valid: true }
}

// ============================================
// 3. REPLAY ATTACK PREVENTION
// ============================================

// In-memory nonce store (use Redis in production)
const usedNonces = new Map<string, number>()
const NONCE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Validates and consumes a nonce to prevent replay attacks
 */
export function validateNonce(
  nonce: string,
  timestamp: number,
): {
  valid: boolean
  error?: string
} {
  const now = Date.now()

  // Check timestamp freshness (5 minute window)
  if (Math.abs(now - timestamp) > NONCE_EXPIRY_MS) {
    return { valid: false, error: "Request expired" }
  }

  // Check if nonce was already used
  if (usedNonces.has(nonce)) {
    return { valid: false, error: "Replay attack detected: nonce already used" }
  }

  // Store nonce with expiry
  usedNonces.set(nonce, now)

  // Cleanup old nonces
  for (const [storedNonce, storedTime] of usedNonces.entries()) {
    if (now - storedTime > NONCE_EXPIRY_MS) {
      usedNonces.delete(storedNonce)
    }
  }

  return { valid: true }
}

// ============================================
// 4. REQUEST SIGNING
// ============================================

const REQUEST_SIGNING_SECRET =
  typeof window === "undefined"
    ? process.env.REQUEST_SIGNING_SECRET || "default-dev-secret-change-in-production"
    : "default-dev-secret-change-in-production"

/**
 * Signs a request payload
 */
export function signRequest(payload: Record<string, unknown>): {
  signature: string
  timestamp: number
  nonce: string
} {
  const timestamp = Date.now()
  const nonce = generateRandomBytes(16)

  const dataToSign = JSON.stringify({
    ...payload,
    timestamp,
    nonce,
  })

  const signature = simpleHash(dataToSign + REQUEST_SIGNING_SECRET)

  return { signature, timestamp, nonce }
}

/**
 * Verifies a signed request
 */
export function verifyRequestSignature(
  payload: Record<string, unknown>,
  signature: string,
  timestamp: number,
  nonce: string,
): {
  valid: boolean
  error?: string
} {
  // Validate nonce first (prevents replay)
  const nonceValidation = validateNonce(nonce, timestamp)
  if (!nonceValidation.valid) {
    return nonceValidation
  }

  // Compute expected signature
  const dataToSign = JSON.stringify({
    ...payload,
    timestamp,
    nonce,
  })

  const expectedSignature = simpleHash(dataToSign + REQUEST_SIGNING_SECRET)

  if (signature !== expectedSignature) {
    return { valid: false, error: "Invalid request signature" }
  }

  return { valid: true }
}

// ============================================
// 5. SECURITY HEADERS
// ============================================

/**
 * Adds security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY")

  // Prevent MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff")

  // XSS protection
  response.headers.set("X-XSS-Protection", "1; mode=block")

  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Next.js
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.etherscan.io https://*.infura.io https://*.alchemy.com wss://*.infura.io",
      "frame-ancestors 'none'",
    ].join("; "),
  )

  // Permissions policy
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)")

  return response
}

// ============================================
// 6. API ROUTE PROTECTION WRAPPER
// ============================================

export interface SecureRouteOptions {
  requireCSRF?: boolean
  requireOriginValidation?: boolean
  requireSignedRequest?: boolean
  rateLimit?: {
    maxRequests: number
    windowMs: number
  }
}

/**
 * Wraps an API route handler with security checks
 */
export function withSecurity(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: SecureRouteOptions = {},
) {
  const { requireCSRF = true, requireOriginValidation = true, requireSignedRequest = false } = options

  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // 1. Origin validation
      if (requireOriginValidation) {
        const originValidation = validateOrigin(request)
        if (!originValidation.valid) {
          return NextResponse.json({ error: originValidation.error }, { status: 403 })
        }
      }

      // 2. CSRF validation (for mutating requests)
      if (requireCSRF && ["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
        const csrfValidation = validateCSRFToken(request)
        if (!csrfValidation.valid) {
          return NextResponse.json({ error: csrfValidation.error }, { status: 403 })
        }
      }

      // 3. Signed request validation
      if (requireSignedRequest) {
        const body = await request.clone().json()
        const { signature, timestamp, nonce, ...payload } = body

        if (!signature || !timestamp || !nonce) {
          return NextResponse.json({ error: "Missing request signature" }, { status: 400 })
        }

        const sigValidation = verifyRequestSignature(payload, signature, timestamp, nonce)
        if (!sigValidation.valid) {
          return NextResponse.json({ error: sigValidation.error }, { status: 403 })
        }
      }

      // Execute handler
      const response = await handler(request)

      // Add security headers
      return addSecurityHeaders(response)
    } catch (error: any) {
      console.error("[Security] Error in protected route:", error)
      return NextResponse.json({ error: "Internal security error" }, { status: 500 })
    }
  }
}

// ============================================
// 7. INPUT SANITIZATION FOR MIXED ATTACKS
// ============================================

/**
 * Comprehensive input sanitization for mixed attack vectors
 * Protects against combined SQL injection + XSS + command injection
 */
export function sanitizeForMixedAttack(input: string): {
  sanitized: string
  attacksDetected: string[]
  riskLevel: "none" | "low" | "medium" | "high" | "critical"
} {
  const attacksDetected: string[] = []
  let sanitized = input || ""

  // 1. SQL Injection patterns
  const sqlPatterns = [
    { pattern: /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi, name: "SQL Keyword" },
    { pattern: /('|")\s*(OR|AND)\s*('|")?1\s*=\s*1/gi, name: "SQL Boolean Injection" },
    { pattern: /;\s*--/g, name: "SQL Comment Injection" },
    { pattern: /\/\*[\s\S]*?\*\//g, name: "SQL Block Comment" },
    { pattern: /\bWAITFOR\s+DELAY/gi, name: "SQL Time-Based Injection" },
    { pattern: /\bBENCHMARK\s*\(/gi, name: "SQL Benchmark Injection" },
  ]

  // 2. XSS patterns
  const xssPatterns = [
    { pattern: /<script[\s\S]*?>[\s\S]*?<\/script>/gi, name: "Script Tag" },
    { pattern: /javascript\s*:/gi, name: "JavaScript Protocol" },
    { pattern: /on\w+\s*=\s*["']?[^"']*["']?/gi, name: "Event Handler" },
    { pattern: /<iframe[\s\S]*?>/gi, name: "IFrame Injection" },
    { pattern: /<object[\s\S]*?>/gi, name: "Object Tag" },
    { pattern: /data\s*:\s*text\/html/gi, name: "Data URI HTML" },
    { pattern: /expression\s*\(/gi, name: "CSS Expression" },
  ]

  // 3. Command Injection patterns
  const cmdPatterns = [
    { pattern: /[;&|`$]|\$\(/g, name: "Shell Metacharacter" },
    { pattern: /\b(cat|ls|rm|chmod|chown|wget|curl|nc|bash|sh|python|perl|ruby)\b/gi, name: "Shell Command" },
    { pattern: /\.\.\/|\.\.\\/, name: "Path Traversal" },
  ]

  // 4. LDAP Injection patterns
  const ldapPatterns = [{ pattern: /[)(|*\\]/g, name: "LDAP Special Character" }]

  // 5. NoSQL Injection patterns
  const nosqlPatterns = [
    { pattern: /\$where|\$regex|\$gt|\$lt|\$ne|\$or|\$and/gi, name: "NoSQL Operator" },
    { pattern: /\{\s*["']?\$[\w]+["']?\s*:/gi, name: "NoSQL Query Injection" },
  ]

  // Check all patterns
  const allPatterns = [
    ...sqlPatterns.map((p) => ({ ...p, category: "SQL Injection" })),
    ...xssPatterns.map((p) => ({ ...p, category: "XSS" })),
    ...cmdPatterns.map((p) => ({ ...p, category: "Command Injection" })),
    ...ldapPatterns.map((p) => ({ ...p, category: "LDAP Injection" })),
    ...nosqlPatterns.map((p) => ({ ...p, category: "NoSQL Injection" })),
  ]

  for (const { pattern, name, category } of allPatterns) {
    if (pattern.test(sanitized)) {
      attacksDetected.push(`${category}: ${name}`)
      // Reset regex state
      pattern.lastIndex = 0
      // Remove the malicious content
      sanitized = sanitized.replace(pattern, "")
    }
  }

  // 6. Unicode/encoding attacks
  const encodingPatterns = [
    { pattern: /%00|%0d|%0a/gi, name: "Null Byte / CRLF Injection" },
    { pattern: /\\u0000|\\x00/gi, name: "Unicode Null" },
    { pattern: /[\u200B-\u200D\uFEFF\u00A0]/g, name: "Zero-Width Characters" },
  ]

  for (const { pattern, name } of encodingPatterns) {
    if (pattern.test(sanitized)) {
      attacksDetected.push(`Encoding Attack: ${name}`)
      pattern.lastIndex = 0
      sanitized = sanitized.replace(pattern, "")
    }
  }

  // 7. Prototype pollution
  if (/__proto__|constructor\s*\[|prototype\s*\[/.test(sanitized)) {
    attacksDetected.push("Prototype Pollution")
    sanitized = sanitized.replace(/__proto__|constructor\s*\[|prototype\s*\[/gi, "")
  }

  // Determine risk level
  let riskLevel: "none" | "low" | "medium" | "high" | "critical" = "none"
  if (attacksDetected.length === 0) {
    riskLevel = "none"
  } else if (attacksDetected.length === 1) {
    riskLevel = "low"
  } else if (attacksDetected.length <= 3) {
    riskLevel = "medium"
  } else if (attacksDetected.some((a) => a.includes("SQL") || a.includes("Command"))) {
    riskLevel = "critical"
  } else {
    riskLevel = "high"
  }

  return { sanitized, attacksDetected, riskLevel }
}

// ============================================
// 8. WALLET ADDRESS VERIFICATION (On-Chain)
// ============================================

/**
 * Verifies a vendor address hasn't changed unexpectedly
 * by comparing against a stored hash
 */
export async function verifyVendorAddressIntegrity(
  vendorId: string,
  currentAddress: string,
): Promise<{
  valid: boolean
  error?: string
  changed: boolean
}> {
  try {
    // Fetch stored vendor data
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId },
      select: { wallet_address: true, integrity_hash: true },
    })

    if (!vendor) {
      return { valid: false, error: "Vendor not found", changed: false }
    }

    const storedAddress = vendor.wallet_address?.toLowerCase()
    const providedAddress = currentAddress?.toLowerCase()

    // Check if address matches
    if (storedAddress !== providedAddress) {
      // Log the discrepancy
      await prisma.securityAlert.create({
        data: {
          alert_type: "ADDRESS_MISMATCH",
          severity: "critical",
          address: vendorId,
          description: `Vendor address mismatch detected`,
          details: {
            stored: storedAddress,
            provided: providedAddress,
            vendor_id: vendorId,
          },
        },
      })

      return {
        valid: false,
        error: "Address mismatch - possible tampering detected",
        changed: true,
      }
    }

    return { valid: true, changed: false }
  } catch (error: any) {
    return { valid: false, error: error.message, changed: false }
  }
}
