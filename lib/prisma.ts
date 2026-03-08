import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

/**
 * Detect connection mode from DATABASE_URL:
 *
 * 1. DIRECT_DATABASE_URL set → direct PostgreSQL (pg adapter)
 * 2. prisma+postgres://localhost → local dev proxy, extract real URL from base64 (pg adapter)
 * 3. prisma+postgres://accelerate... → Prisma Accelerate cloud proxy
 * 4. prisma:// → Prisma Accelerate (legacy URL format)
 * 5. postgresql:// or postgres:// → direct PostgreSQL (pg adapter)
 */
function isAccelerateUrl(url: string): boolean {
  if (url.startsWith('prisma://')) return true
  if (!url.startsWith('prisma+postgres://')) return false
  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    // Local Prisma dev server is NOT accelerate
    return host !== 'localhost' && host !== '127.0.0.1'
  } catch {
    return false
  }
}

/**
 * Extract direct PostgreSQL URL from prisma+postgres:// local dev URL
 */
function extractLocalDevUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const apiKey = parsed.searchParams.get('api_key')
    if (apiKey) {
      const decoded = JSON.parse(Buffer.from(apiKey, 'base64').toString('utf-8'))
      if (decoded.databaseUrl) {
        return decoded.databaseUrl
      }
    }
  } catch {
    // fall through
  }
  return url
}

/**
 * Create PrismaClient with the correct adapter/accelerate configuration.
 *
 * Prisma 7 requires either:
 * - A driver adapter (PrismaPg) for direct PostgreSQL connections
 * - accelerateUrl for Prisma Accelerate connections
 */
function createPrismaClient(): PrismaClient {
  const directUrl = process.env.DIRECT_DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL || ''

  // ─── Mode 1: Prisma Accelerate / Prisma Postgres cloud ───
  // Prisma 7: use accelerateUrl parameter (no driver adapter needed)
  if (!directUrl && isAccelerateUrl(databaseUrl)) {
    try {
      // Try with accelerateUrl (Prisma 7 way)
      const client = new PrismaClient({
        accelerateUrl: databaseUrl,
      } as any)
      return client
    } catch {
      // Fallback: plain PrismaClient (older Prisma 7 builds)
      return new PrismaClient()
    }
  }

  // ─── Mode 2 & 3: Direct PostgreSQL connection ───
  // Use @prisma/adapter-pg for direct connections
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaPg } = require('@prisma/adapter-pg')

    let connectionString: string
    if (directUrl) {
      connectionString = directUrl
    } else if (databaseUrl.startsWith('prisma+postgres://')) {
      connectionString = extractLocalDevUrl(databaseUrl)
    } else {
      connectionString = databaseUrl
    }

    // Prisma 7: PrismaPg accepts options object directly
    let adapter: any
    try {
      // New Prisma 7 API: PrismaPg({ connectionString })
      adapter = new PrismaPg({ connectionString })
    } catch {
      // Fallback: old API with Pool
      const { Pool } = require('pg')
      const pool = new Pool({ connectionString })
      adapter = new PrismaPg(pool)
    }

    return new PrismaClient({ adapter })
  } catch (e) {
    // Last resort fallback: PrismaClient without adapter
    console.warn('[prisma] Failed to create adapter, falling back to plain PrismaClient:', e)
    return new PrismaClient()
  }
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Re-export getClient for backward compatibility
export function getClient(): PrismaClient {
  return prisma
}
