import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Security headers to add to all responses
const securityHeaders = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self)",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
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
  const response = NextResponse.next()
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
  const path = request.nextUrl.pathname

  // Add security headers to all responses
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
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
