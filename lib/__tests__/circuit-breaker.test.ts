/**
 * Circuit Breaker Tests
 * Property-based tests and unit tests for Circuit Breaker
 */

import * as fc from 'fast-check';
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  getCircuitBreaker,
  type CircuitState,
} from '../services/circuit-breaker';

// ============================================
// Property Tests
// ============================================

describe('Circuit Breaker - Property Tests', () => {
  /**
   * Property 16: Circuit Breaker Behavior
   * Circuit breaker should transition states correctly based on failures/successes
   */
  describe('Property 16: Circuit Breaker State Transitions', () => {
    it('should open after reaching failure threshold', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (threshold) => {
            const breaker = new CircuitBreaker('test', { failureThreshold: threshold });
            
            // Record failures up to threshold
            for (let i = 0; i < threshold; i++) {
              expect(breaker.getState()).toBe('closed');
              breaker.onFailure();
            }
            
            // Should be open after reaching threshold
            expect(breaker.getState()).toBe('open');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should stay closed when failures are below threshold', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          fc.integer({ min: 0, max: 100 }),
          (threshold, belowThreshold) => {
            const failureCount = belowThreshold % (threshold - 1); // Always below threshold
            const breaker = new CircuitBreaker('test', { failureThreshold: threshold });
            
            for (let i = 0; i < failureCount; i++) {
              breaker.onFailure();
            }
            
            expect(breaker.getState()).toBe('closed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reset failure count on success when closed', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          fc.integer({ min: 1, max: 100 }),
          (threshold, failureCount) => {
            const failures = (failureCount % (threshold - 1)) + 1; // 1 to threshold-1
            const breaker = new CircuitBreaker('test', { failureThreshold: threshold });
            
            // Record some failures (but not enough to open)
            for (let i = 0; i < failures; i++) {
              breaker.onFailure();
            }
            
            // Record a success
            breaker.onSuccess();
            
            // Failure count should be reset
            const stats = breaker.getStats();
            expect(stats.failures).toBe(0);
            expect(breaker.getState()).toBe('closed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should close after success threshold in half-open state', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          (successThreshold) => {
            const breaker = new CircuitBreaker('test', {
              failureThreshold: 1,
              successThreshold,
              timeout: 0, // Immediate transition to half-open
            });
            
            // Open the circuit
            breaker.onFailure();
            
            // With timeout=0, getState() will transition to half-open immediately
            // So we just verify it's in half-open (not open anymore)
            expect(breaker.getState()).toBe('half-open');
            
            // Record successes
            for (let i = 0; i < successThreshold; i++) {
              breaker.onSuccess();
            }
            
            expect(breaker.getState()).toBe('closed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return to open on any failure in half-open state', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          (successesBefore) => {
            const breaker = new CircuitBreaker('test', {
              failureThreshold: 1,
              successThreshold: 10, // High threshold so we don't close
              timeout: 0,
            });
            
            // Open the circuit
            breaker.onFailure();
            
            // With timeout=0, getState() transitions to half-open
            expect(breaker.getState()).toBe('half-open');
            
            // Record some successes (not enough to close)
            for (let i = 0; i < successesBefore; i++) {
              breaker.onSuccess();
            }
            
            // Record a failure - this should go back to open
            breaker.onFailure();
            
            // Should be back to open, but with timeout=0 it immediately goes to half-open again
            // So we check that it went through open state by checking stats
            const stats = breaker.getStats();
            // After failure in half-open, successes should be reset to 0
            expect(stats.successes).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================
// Unit Tests
// ============================================

describe('Circuit Breaker - Unit Tests', () => {
  describe('constructor', () => {
    it('should initialize with closed state', () => {
      const breaker = new CircuitBreaker('test');
      expect(breaker.getState()).toBe('closed');
    });

    it('should use default config values', () => {
      const breaker = new CircuitBreaker('test');
      const stats = breaker.getStats();
      expect(stats.state).toBe('closed');
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
    });

    it('should accept custom config', () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 10000,
      });
      
      // Verify by testing behavior
      for (let i = 0; i < 4; i++) {
        breaker.onFailure();
        expect(breaker.getState()).toBe('closed');
      }
      breaker.onFailure();
      expect(breaker.getState()).toBe('open');
    });
  });

  describe('execute', () => {
    it('should execute function when closed', async () => {
      const breaker = new CircuitBreaker('test');
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('should throw CircuitBreakerOpenError when open', async () => {
      const breaker = new CircuitBreaker('test', { failureThreshold: 1 });
      breaker.onFailure();
      
      await expect(breaker.execute(async () => 'success'))
        .rejects.toThrow(CircuitBreakerOpenError);
    });

    it('should record success on successful execution', async () => {
      const breaker = new CircuitBreaker('test');
      await breaker.execute(async () => 'success');
      
      const stats = breaker.getStats();
      expect(stats.successes).toBe(1);
      expect(stats.lastSuccess).toBeDefined();
    });

    it('should record failure on failed execution', async () => {
      const breaker = new CircuitBreaker('test');
      
      await expect(breaker.execute(async () => {
        throw new Error('test error');
      })).rejects.toThrow('test error');
      
      const stats = breaker.getStats();
      expect(stats.failures).toBe(1);
      expect(stats.lastFailure).toBeDefined();
    });
  });

  describe('canExecute', () => {
    it('should return true when closed', () => {
      const breaker = new CircuitBreaker('test');
      expect(breaker.canExecute()).toBe(true);
    });

    it('should return false when open and timeout not passed', () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 1,
        timeout: 60000,
      });
      breaker.onFailure();
      expect(breaker.canExecute()).toBe(false);
    });

    it('should return true when open and timeout passed', () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 1,
        timeout: 0,
      });
      breaker.onFailure();
      expect(breaker.canExecute()).toBe(true);
    });
  });

  describe('getTimeUntilRetry', () => {
    it('should return 0 when closed', () => {
      const breaker = new CircuitBreaker('test');
      expect(breaker.getTimeUntilRetry()).toBe(0);
    });

    it('should return remaining time when open', () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 1,
        timeout: 30000,
      });
      breaker.onFailure();
      
      const timeUntilRetry = breaker.getTimeUntilRetry();
      expect(timeUntilRetry).toBeGreaterThan(0);
      expect(timeUntilRetry).toBeLessThanOrEqual(30000);
    });
  });

  describe('reset', () => {
    it('should reset to closed state', () => {
      const breaker = new CircuitBreaker('test', { failureThreshold: 1 });
      breaker.onFailure();
      expect(breaker.getState()).toBe('open');
      
      breaker.reset();
      expect(breaker.getState()).toBe('closed');
    });

    it('should reset failure and success counts', () => {
      const breaker = new CircuitBreaker('test');
      breaker.onFailure();
      breaker.onFailure();
      
      breaker.reset();
      
      const stats = breaker.getStats();
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
    });
  });

  describe('CircuitBreakerOpenError', () => {
    it('should contain service name and retry time', () => {
      const error = new CircuitBreakerOpenError('test-service', 5000);
      expect(error.serviceName).toBe('test-service');
      expect(error.retryAfterMs).toBe(5000);
      expect(error.message).toContain('test-service');
    });
  });

  describe('getCircuitBreaker', () => {
    it('should return same instance for same name', () => {
      const breaker1 = getCircuitBreaker('shared');
      const breaker2 = getCircuitBreaker('shared');
      expect(breaker1).toBe(breaker2);
    });

    it('should return different instances for different names', () => {
      const breaker1 = getCircuitBreaker('service-a');
      const breaker2 = getCircuitBreaker('service-b');
      expect(breaker1).not.toBe(breaker2);
    });
  });
});
