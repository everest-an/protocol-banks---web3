import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Allowed origins for CORS
const ALLOWED_ORIGINS = new Set([
  process.env.NEXT_PUBLIC_APP_URL || 'https://protocolbanks.com',
  'https://protocolbanks.com',
  'https://www.protocolbanks.com',
  'https://app.protocolbanks.com',
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', 'http://localhost:3001'] : []),
])

// Security headers to add to all responses
const securityHeaders = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self)",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.llamarpc.com https://*.infura.io https://*.alchemy.com wss://*.walletconnect.com https://*.walletconnect.com https://*.reown.com wss://*.reown.com https://api.web3modal.com https://api.web3modal.org https://rpc.walletconnect.com https://api.rango.exchange https://*.trongrid.io https://*.etherscan.io https://eth.llamarpc.com https://rpc.sepolia.org https://polygon-rpc.com https://mainnet.optimism.io https://mainnet.base.org https://arb1.arbitrum.io https://bsc-dataseed.binance.org https://mainnet.hsk.xyz https://*.basescan.org https://*.arbiscan.io https://*.bscscan.com https://*.polygonscan.com https://*.optimistic.etherscan.io",
    "frame-src 'self' https://www.google.com https://verify.walletconnect.com https://secure.walletconnect.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const key = ip
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) {
    return false
  }

  entry.count++
  return true
}

// Paths that require additional security checks
const protectedApiPaths = ["/api/verify-payment", "/api/audit-log", "/api/transactions"]

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const walletAddress = requestHeaders.get("x-wallet-address")
    const userAddress = requestHeaders.get("x-user-address")

    // Bridge old/new auth headers so all API routes behave consistently
    if (walletAddress && !userAddress) {
      requestHeaders.set("x-user-address", walletAddress)
    }
    if (userAddress && !walletAddress) {
      requestHeaders.set("x-wallet-address", userAddress)
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
  const path = request.nextUrl.pathname

  // Add security headers to all responses
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }

  // CORS handling for API routes
  if (path.startsWith("/api/")) {
    const origin = request.headers.get("origin")
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin)
    }
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-wallet-address, x-user-address, x-test-mode, x-api-key")
    response.headers.set("Access-Control-Max-Age", "86400")

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
  }

  // Rate limit API routes
  if (path.startsWith("/api/")) {
    const isProtected = protectedApiPaths.some((p) => path.startsWith(p))
    const limit = isProtected ? 30 : 100 // Stricter limits for protected routes
    const windowMs = 60 * 1000 // 1 minute

    if (!checkRateLimit(ip, limit, windowMs)) {
      return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
          ...securityHeaders,
        },
      })
    }
  }

  // Block suspicious user agents
  const userAgent = request.headers.get("user-agent") || ""
  const suspiciousPatterns = [/sqlmap/i, /nikto/i, /nessus/i, /nmap/i, /masscan/i, /zgrab/i]

  if (suspiciousPatterns.some((pattern) => pattern.test(userAgent))) {
    console.warn(`[Security] Blocked suspicious user agent: ${userAgent} from IP: ${ip}`)
    return new NextResponse(null, { status: 403 })
  }

  // Check for path traversal attempts
  if (path.includes("..") || path.includes("./")) {
    console.warn(`[Security] Blocked path traversal attempt: ${path} from IP: ${ip}`)
    return new NextResponse(null, { status: 400 })
  }

  // Add request ID for tracing
  response.headers.set("X-Request-ID", crypto.randomUUID())

  return response
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
