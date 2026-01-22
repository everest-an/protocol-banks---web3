/**
 * Circuit Breaker Implementation
 * Prevents cascading failures when external services are unavailable
 */

// ============================================
// Types
// ============================================

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  successThreshold: number;      // Number of successes in half-open to close
  timeout: number;               // Time in ms before trying half-open
  resetTimeout: number;          // Time in ms to reset failure count when closed
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  lastStateChange: Date;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000,        // 30 seconds
  resetTimeout: 60000,   // 60 seconds
};

// ============================================
// Circuit Breaker Class
// ============================================

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailure?: Date;
  private lastSuccess?: Date;
  private lastStateChange: Date = new Date();
  private config: CircuitBreakerConfig;
  private name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitBreakerOpenError(this.name, this.getTimeUntilRetry());
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if execution is allowed
   */
  canExecute(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      // Check if timeout has passed to transition to half-open
      const timeSinceLastFailure = Date.now() - (this.lastFailure?.getTime() || 0);
      if (timeSinceLastFailure >= this.config.timeout) {
        this.transitionTo('half-open');
        return true;
      }
      return false;
    }

    // half-open: allow limited requests
    return true;
  }

  /**
   * Record a successful execution
   */
  onSuccess(): void {
    this.lastSuccess = new Date();
    this.successes++;

    if (this.state === 'half-open') {
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success
      this.failures = 0;
    }
  }

  /**
   * Record a failed execution
   */
  onFailure(): void {
    this.lastFailure = new Date();
    this.failures++;
    this.successes = 0;

    if (this.state === 'half-open') {
      // Any failure in half-open goes back to open
      this.transitionTo('open');
    } else if (this.state === 'closed') {
      if (this.failures >= this.config.failureThreshold) {
        this.transitionTo('open');
      }
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = new Date();

    if (newState === 'closed') {
      this.failures = 0;
      this.successes = 0;
    } else if (newState === 'half-open') {
      this.successes = 0;
    }

    console.log(`[CircuitBreaker:${this.name}] State transition: ${oldState} -> ${newState}`);
  }

  /**
   * Get time until retry is allowed (when open)
   */
  getTimeUntilRetry(): number {
    if (this.state !== 'open' || !this.lastFailure) {
      return 0;
    }
    const elapsed = Date.now() - this.lastFailure.getTime();
    return Math.max(0, this.config.timeout - elapsed);
  }

  /**
   * Get current stats
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      lastStateChange: this.lastStateChange,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    // Check for automatic transition from open to half-open
    if (this.state === 'open' && this.lastFailure) {
      const timeSinceLastFailure = Date.now() - this.lastFailure.getTime();
      if (timeSinceLastFailure >= this.config.timeout) {
        this.transitionTo('half-open');
      }
    }
    return this.state;
  }

  /**
   * Force reset the circuit breaker
   */
  reset(): void {
    this.transitionTo('closed');
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.getState() === 'open';
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.getState() === 'closed';
  }
}

// ============================================
// Custom Error
// ============================================

export class CircuitBreakerOpenError extends Error {
  public readonly serviceName: string;
  public readonly retryAfterMs: number;

  constructor(serviceName: string, retryAfterMs: number) {
    super(`Circuit breaker is open for service: ${serviceName}. Retry after ${retryAfterMs}ms`);
    this.name = 'CircuitBreakerOpenError';
    this.serviceName = serviceName;
    this.retryAfterMs = retryAfterMs;
  }
}

// ============================================
// Circuit Breaker Registry
// ============================================

const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a service
 */
export function getCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, config));
  }
  return circuitBreakers.get(name)!;
}

/**
 * Get all circuit breaker stats
 */
export function getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  const stats: Record<string, CircuitBreakerStats> = {};
  for (const [name, breaker] of circuitBreakers) {
    stats[name] = breaker.getStats();
  }
  return stats;
}
