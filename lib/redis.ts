/**
 * Secure Redis Configuration
 *
 * Centralized Redis connection factory with:
 * - TLS support for production environments
 * - Password authentication
 * - Connection pooling (singleton)
 * - Automatic reconnect with exponential backoff
 * - Key prefix isolation
 *
 * Environment variables:
 *   REDIS_URL          - Connection URL (redis:// or rediss:// for TLS)
 *   REDIS_PASSWORD     - Authentication password
 *   REDIS_TLS_ENABLED  - Force TLS even with redis:// URL ("true")
 *   REDIS_KEY_PREFIX   - Global key prefix (default: "pb:")
 */

import Redis, { RedisOptions } from 'ioredis'

let sharedConnection: Redis | null = null

/**
 * Build secure Redis options from environment
 */
function buildRedisOptions(overrides?: Partial<RedisOptions>): RedisOptions {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  const password = process.env.REDIS_PASSWORD || undefined
  const tlsEnabled = process.env.REDIS_TLS_ENABLED === 'true' || redisUrl.startsWith('rediss://')

  // Parse URL to extract host/port if needed
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
    // Not a URL, treat as host:port
    const [host, port] = redisUrl.replace(/^rediss?:\/\//, '').split(':')
    parsedOptions = {
      host: host || 'localhost',
      port: parseInt(port, 10) || 6379,
      password,
    }
  }

  const options: RedisOptions = {
    ...parsedOptions,

    // TLS configuration
    ...(tlsEnabled
      ? {
          tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production',
          },
        }
      : {}),

    // Connection resilience
    retryStrategy(times: number) {
      if (times > 10) return null // Stop after 10 retries
      return Math.min(times * 200, 5000) // Exponential backoff, max 5s
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 10000,
    commandTimeout: 5000,

    // Connection naming for debugging
    connectionName: `pb-${process.env.NODE_ENV || 'dev'}`,

    // Key prefix
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'pb:',

    // Apply overrides
    ...overrides,
  }

  return options
}

/**
 * Get or create shared Redis connection (singleton)
 */
export function getRedisConnection(overrides?: Partial<RedisOptions>): Redis {
  if (typeof window !== 'undefined') {
    throw new Error('Redis cannot be used in browser environment')
  }

  if (sharedConnection && sharedConnection.status === 'ready') {
    return sharedConnection
  }

  const options = buildRedisOptions(overrides)
  sharedConnection = new Redis(options)

  sharedConnection.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message)
  })

  sharedConnection.on('connect', () => {
    console.log('[Redis] Connected successfully')
  })

  return sharedConnection
}

/**
 * Create a new Redis connection (for BullMQ workers that need separate connections)
 */
export function createRedisConnection(overrides?: Partial<RedisOptions>): Redis {
  if (typeof window !== 'undefined') {
    throw new Error('Redis cannot be used in browser environment')
  }

  const options = buildRedisOptions({
    // BullMQ requires these settings
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...overrides,
  })

  const connection = new Redis(options)

  connection.on('error', (err) => {
    console.error('[Redis] Worker connection error:', err.message)
  })

  return connection
}

/**
 * Lazy Redis getter for optional Redis usage (nonce-manager, storage)
 * Returns null if Redis is not available or not configured
 */
export async function getOptionalRedis(): Promise<Redis | null> {
  if (typeof window !== 'undefined') return null
  if (!process.env.REDIS_URL) return null

  try {
    return getRedisConnection()
  } catch {
    return null
  }
}

/**
 * Gracefully close all Redis connections
 */
export async function closeRedisConnections(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.quit()
    sharedConnection = null
  }
}
