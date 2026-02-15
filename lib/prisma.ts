import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

/**
 * Detect connection mode from DATABASE_URL:
 *
 * 1. DIRECT_DATABASE_URL set → direct PostgreSQL (pg adapter)
 * 2. prisma+postgres://localhost → local dev proxy, extract real URL from base64 (pg adapter)
 * 3. prisma+postgres://accelerate... → Prisma Accelerate cloud proxy (native PrismaClient)
 * 4. postgresql:// or postgres:// → direct PostgreSQL (pg adapter)
 */
function isCloudPrismaUrl(url: string): boolean {
  if (!url.startsWith('prisma+postgres://')) return false
  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    // Local Prisma dev server
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

const prismaClientSingleton = async () => {
  const directUrl = process.env.DIRECT_DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL || ''

  // Mode 1: Prisma Accelerate / Prisma Postgres cloud
  // Use native PrismaClient (no pg adapter needed — Prisma handles the proxy)
  if (!directUrl && isCloudPrismaUrl(databaseUrl)) {
    return new PrismaClient()
  }

  // Mode 2 & 3: Direct PostgreSQL connection (local dev or direct URL)
  // Use @prisma/adapter-pg for direct connections
  const { Pool } = await import('pg')
  const { PrismaPg } = await import('@prisma/adapter-pg')

  let connectionString: string
  if (directUrl) {
    connectionString = directUrl
  } else if (databaseUrl.startsWith('prisma+postgres://')) {
    connectionString = extractLocalDevUrl(databaseUrl)
  } else {
    connectionString = databaseUrl
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

// Use a sync wrapper that initializes once
let clientPromise: Promise<PrismaClient> | null = null

function getClient(): PrismaClient {
  // If already resolved, return the cached client
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  // Create a sync PrismaClient for the common case
  // The async initialization only matters for the pg adapter path
  const directUrl = process.env.DIRECT_DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL || ''

  if (!directUrl && isCloudPrismaUrl(databaseUrl)) {
    // Cloud Prisma — synchronous initialization
    const client = new PrismaClient()
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = client
    }
    return client
  }

  // Direct PostgreSQL — need pg adapter (dynamic import)
  // For the sync export, create without adapter first, then lazy-swap
  // This handles the edge case where pg isn't available at import time
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool } = require('pg')
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

    const pool = new Pool({ connectionString })
    const adapter = new PrismaPg(pool)
    const client = new PrismaClient({ adapter })

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = client
    }
    return client
  } catch {
    // Fallback: use PrismaClient without adapter
    const client = new PrismaClient()
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = client
    }
    return client
  }
}

export const prisma = globalForPrisma.prisma || getClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
