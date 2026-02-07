/**
 * Storage Abstraction Layer
 * 
 * Provides a unified interface for data storage that can be backed by
 * in-memory Map (development) or Redis (production).
 * 
 * Usage:
 *   const store = createStore<MyType>('my-store')
 *   await store.set('key', value)
 *   const value = await store.get('key')
 */

export interface Store<T> {
  get(key: string): Promise<T | undefined>
  set(key: string, value: T, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<boolean>
  has(key: string): Promise<boolean>
  clear(): Promise<void>
  keys(): Promise<string[]>
  values(): Promise<T[]>
}

// In-memory store implementation
class MemoryStore<T> implements Store<T> {
  private store = new Map<string, { value: T; expiresAt?: number }>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(private prefix: string) {
    // Periodic cleanup of expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
  }

  async get(key: string): Promise<T | undefined> {
    const entry = this.store.get(`${this.prefix}:${key}`)
    if (!entry) return undefined
    
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(`${this.prefix}:${key}`)
      return undefined
    }
    
    return entry.value
  }

  async set(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const entry: { value: T; expiresAt?: number } = { value }
    if (ttlSeconds) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000
    }
    this.store.set(`${this.prefix}:${key}`, entry)
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(`${this.prefix}:${key}`)
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== undefined
  }

  async clear(): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(`${this.prefix}:`)) {
        this.store.delete(key)
      }
    }
  }

  async keys(): Promise<string[]> {
    const prefix = `${this.prefix}:`
    return Array.from(this.store.keys())
      .filter(k => k.startsWith(prefix))
      .map(k => k.slice(prefix.length))
  }

  async values(): Promise<T[]> {
    const result: T[] = []
    for (const [key, entry] of this.store) {
      if (key.startsWith(`${this.prefix}:`)) {
        if (!entry.expiresAt || Date.now() <= entry.expiresAt) {
          result.push(entry.value)
        }
      }
    }
    return result
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key)
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}

// Redis store implementation (uses centralized secure connection)
class RedisStore<T> implements Store<T> {
  private client: any = null

  constructor(private prefix: string) {
    this.initRedis()
  }

  private async initRedis() {
    if (typeof window !== 'undefined') return // Skip in browser

    try {
      const { getRedisConnection } = await import('@/lib/redis')
      this.client = getRedisConnection()
    } catch {
      console.log('[RedisStore] Redis not available, using memory store')
      this.client = null
    }
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`
  }

  async get(key: string): Promise<T | undefined> {
    if (!this.client) return undefined
    
    try {
      const data = await this.client.get(this.getKey(key))
      return data ? JSON.parse(data) : undefined
    } catch (error) {
      console.error('[RedisStore] Get error:', error)
      return undefined
    }
  }

  async set(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.client) return
    
    try {
      const data = JSON.stringify(value)
      if (ttlSeconds) {
        await this.client.setex(this.getKey(key), ttlSeconds, data)
      } else {
        await this.client.set(this.getKey(key), data)
      }
    } catch (error) {
      console.error('[RedisStore] Set error:', error)
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.client) return false
    
    try {
      const result = await this.client.del(this.getKey(key))
      return result > 0
    } catch (error) {
      console.error('[RedisStore] Delete error:', error)
      return false
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.client) return false
    
    try {
      const result = await this.client.exists(this.getKey(key))
      return result > 0
    } catch (error) {
      return false
    }
  }

  async clear(): Promise<void> {
    if (!this.client) return
    
    try {
      const keys = await this.client.keys(`${this.prefix}:*`)
      if (keys.length > 0) {
        await this.client.del(...keys)
      }
    } catch (error) {
      console.error('[RedisStore] Clear error:', error)
    }
  }

  async keys(): Promise<string[]> {
    if (!this.client) return []
    
    try {
      const keys = await this.client.keys(`${this.prefix}:*`)
      return keys.map((k: string) => k.slice(this.prefix.length + 1))
    } catch (error) {
      console.error('[RedisStore] Keys error:', error)
      return []
    }
  }

  async values(): Promise<T[]> {
    if (!this.client) return []
    
    try {
      const keys = await this.client.keys(`${this.prefix}:*`)
      if (keys.length === 0) return []
      
      const values = await this.client.mget(...keys)
      return values
        .filter((v: string | null) => v !== null)
        .map((v: string) => JSON.parse(v))
    } catch (error) {
      console.error('[RedisStore] Values error:', error)
      return []
    }
  }
}

// Factory function
const stores = new Map<string, Store<any>>()

export function createStore<T>(prefix: string): Store<T> {
  if (stores.has(prefix)) {
    return stores.get(prefix)!
  }

  const useRedis = process.env.USE_REDIS === 'true' || process.env.REDIS_URL
  const store = useRedis ? new RedisStore<T>(prefix) : new MemoryStore<T>(prefix)
  
  stores.set(prefix, store)
  return store
}

// Rate limiter helper
export interface RateLimitEntry {
  count: number
  resetAt: number
}

export async function checkRateLimit(
  store: Store<RateLimitEntry>,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now()
  const entry = await store.get(key)

  if (!entry || now > entry.resetAt) {
    // New window
    const resetAt = now + windowSeconds * 1000
    await store.set(key, { count: 1, resetAt }, windowSeconds)
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  // Increment counter
  entry.count++
  await store.set(key, entry, Math.ceil((entry.resetAt - now) / 1000))
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

// Nonce tracker helper
export async function trackNonce(
  store: Store<Set<string>>,
  address: string,
  nonce: string,
  ttlSeconds: number = 3600
): Promise<boolean> {
  const key = address.toLowerCase()
  let nonces = await store.get(key)
  
  if (!nonces) {
    nonces = new Set<string>()
  }

  if (nonces.has(nonce)) {
    return false // Nonce already used
  }

  nonces.add(nonce)
  await store.set(key, nonces, ttlSeconds)
  return true
}
