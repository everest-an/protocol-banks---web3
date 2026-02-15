/**
 * Redis Client Configuration
 *
 * Primary client: node-redis (general purpose)
 * Secondary client: ioredis (BullMQ only - BullMQ requires ioredis)
 *
 * Environment variables:
 *   REDIS_URL          - Connection URL (redis:// or rediss:// for TLS)
 *   REDIS_PASSWORD     - Authentication password
 *   REDIS_KEY_PREFIX   - Global key prefix (default: "pb:")
 */

import { createClient, type RedisClientType } from 'redis'
import IORedis, { type RedisOptions } from 'ioredis'

// ────────────────────────────────────────────────────────────
// node-redis client (primary, for general purpose use)
// ────────────────────────────────────────────────────────────

let sharedClient: RedisClientType | null = null

/**
 * Get or create shared node-redis client (singleton)
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (typeof window !== 'undefined') {
    throw new Error('Redis cannot be used in browser environment')
  }

  if (sharedClient && sharedClient.isOpen) {
    return sharedClient
  }

  const url = process.env.REDIS_URL || 'redis://localhost:6379'

  sharedClient = createClient({ url })

  sharedClient.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message)
  })

  sharedClient.on('connect', () => {
    console.log('[Redis] Connected successfully')
  })

  await sharedClient.connect()
  return sharedClient
}

/**
 * Lazy Redis getter - returns null if Redis is not available
 */
export async function getOptionalRedis(): Promise<RedisClientType | null> {
  if (typeof window !== 'undefined') return null
  if (!process.env.REDIS_URL) return null

  try {
    return await getRedisClient()
  } catch {
    return null
  }
}

/**
 * Gracefully close all Redis connections
 */
export async function closeRedisConnections(): Promise<void> {
  if (sharedClient) {
    await sharedClient.quit()
    sharedClient = null
  }
}

// ────────────────────────────────────────────────────────────
// ioredis client (secondary, for BullMQ only)
// ────────────────────────────────────────────────────────────

/**
 * Build ioredis options from environment (for BullMQ)
 */
function buildIORedisOptions(overrides?: Partial<RedisOptions>): RedisOptions {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  const password = process.env.REDIS_PASSWORD || undefined
  const tlsEnabled = redisUrl.startsWith('rediss://')

  let parsedOptions: Partial<RedisOptions> = {}
  try {
    const url = new URL(redisUrl)
    parsedOptions = {
      host: url.hostname || 'localhost',
      port: parseInt(url.port, 10) || 6379,
      username: url.username || undefined,
      password: url.password || password,
      db: url.pathname ? parseInt(url.pathname.slice(1), 10) || 0 : 0,
    }
  } catch {
    const [host, port] = redisUrl.replace(/^rediss?:\/\//, '').split(':')
    parsedOptions = {
      host: host || 'localhost',
      port: parseInt(port, 10) || 6379,
      password,
    }
  }

  return {
    ...parsedOptions,
    ...(tlsEnabled ? { tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' } } : {}),
    retryStrategy(times: number) {
      if (times > 10) return null
      return Math.min(times * 200, 5000)
    },
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 10000,
    commandTimeout: 5000,
    connectionName: `pb-bullmq-${process.env.NODE_ENV || 'dev'}`,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'pb:',
    ...overrides,
  }
}

/**
 * Create ioredis connection for BullMQ (requires separate connections)
 */
export function createRedisConnection(overrides?: Partial<RedisOptions>): IORedis {
  if (typeof window !== 'undefined') {
    throw new Error('Redis cannot be used in browser environment')
  }

  const options = buildIORedisOptions(overrides)
  const connection = new IORedis(options)

  connection.on('error', (err) => {
    console.error('[Redis/BullMQ] Connection error:', err.message)
  })

  return connection
}

// Legacy alias - some files may still reference this
export function getRedisConnection(overrides?: Partial<RedisOptions>): IORedis {
  return createRedisConnection(overrides)
}
