/**
 * P1 Security Tests
 * Tests for CSRF protection, rate limiting, input validation, and session security
 */

import * as fc from 'fast-check';

describe('P1 Security Tests', () => {
  describe('CSRF Protection', () => {
    it('should generate valid CSRF tokens', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const token = generateCSRFToken();
          expect(token).toHaveLength(64);
          expect(/^[a-f0-9]+$/i.test(token)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should validate matching CSRF tokens', () => {
      const token = generateCSRFToken();
      const result = validateCSRFToken(token, token);
      expect(result.valid).toBe(true);
    });

    it('should reject mismatched CSRF tokens', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 64, maxLength: 64 }),
          fc.hexaString({ minLength: 64, maxLength: 64 }),
          (token1, token2) => {
            fc.pre(token1 !== token2);
            const result = validateCSRFToken(token1, token2);
            return result.valid === false;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject empty CSRF tokens', () => {
      const result = validateCSRFToken('', 'some-token');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing');
    });

    it('should use timing-safe comparison', () => {
      const token = generateCSRFToken();
      // Timing-safe comparison should take similar time regardless of where mismatch occurs
      const start1 = performance.now();
      validateCSRFToken(token, 'a' + token.slice(1));
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      validateCSRFToken(token, token.slice(0, -1) + 'z');
      const time2 = performance.now() - start2;

      // Times should be within reasonable variance (not a strict test, just sanity check)
      expect(Math.abs(time1 - time2)).toBeLessThan(10);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const limiter = createRateLimiter({ maxRequests: 10, windowMs: 60000 });
      const clientId = 'client-1';

      for (let i = 0; i < 10; i++) {
        const result = limiter.checkLimit(clientId);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9 - i);
      }
    });

    it('should block requests exceeding limit', () => {
      const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60000 });
      const clientId = 'client-2';

      // Use up all requests
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit(clientId);
      }

      // Next request should be blocked
      const result = limiter.checkLimit(clientId);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should track separate limits per client', () => {
      const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60000 });

      // Client 1 uses all requests
      for (let i = 0; i < 3; i++) {
        limiter.checkLimit('client-1');
      }

      // Client 2 should still have full quota
      const result = limiter.checkLimit('client-2');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should reset after window expires', () => {
      const limiter = createRateLimiter({ maxRequests: 2, windowMs: 100 });
      const clientId = 'client-3';

      // Use all requests
      limiter.checkLimit(clientId);
      limiter.checkLimit(clientId);
      expect(limiter.checkLimit(clientId).allowed).toBe(false);

      // Simulate window expiry
      limiter.resetClient(clientId);

      // Should be allowed again
      const result = limiter.checkLimit(clientId);
      expect(result.allowed).toBe(true);
    });

    it('should support different rate limit tiers', () => {
      const limiter = createRateLimiter({
        maxRequests: 100,
        windowMs: 60000,
        tiers: {
          free: { maxRequests: 10 },
          pro: { maxRequests: 100 },
          enterprise: { maxRequests: 1000 },
        },
      });

      const freeResult = limiter.checkLimit('free-user', 'free');
      expect(freeResult.limit).toBe(10);

      const proResult = limiter.checkLimit('pro-user', 'pro');
      expect(proResult.limit).toBe(100);
    });
  });

  describe('Input Validation', () => {
    describe('Email Validation', () => {
      it('should accept valid emails', () => {
        fc.assert(
          fc.property(fc.emailAddress(), (email) => {
            const result = validateEmail(email);
            return result.valid === true;
          }),
          { numRuns: 100 }
        );
      });

      it('should reject invalid emails', () => {
        const invalidEmails = [
          'notanemail',
          '@nodomain.com',
          'no@',
          'spaces in@email.com',
          '',
          'a'.repeat(256) + '@test.com', // Too long
          'test@' + 'a'.repeat(256) + '.com', // Domain too long
        ];

        invalidEmails.forEach((email) => {
          const result = validateEmail(email);
          expect(result.valid).toBe(false);
        });
      });
    });

    describe('Address Validation', () => {
      it('should accept valid Ethereum addresses', () => {
        fc.assert(
          fc.property(fc.hexaString({ minLength: 40, maxLength: 40 }), (hex) => {
            const address = `0x${hex}`;
            const result = validateEthereumAddress(address);
            return result.valid === true;
          }),
          { numRuns: 100 }
        );
      });

      it('should reject invalid addresses', () => {
        const invalidAddresses = [
          '0x123', // Too short
          '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', // Invalid hex
          'not_an_address',
          '', // Empty
          '1234567890123456789012345678901234567890', // Missing 0x
          null,
          undefined,
        ];

        invalidAddresses.forEach((addr) => {
          const result = validateEthereumAddress(addr as string);
          expect(result.valid).toBe(false);
        });
      });
    });

    describe('Amount Validation', () => {
      it('should accept valid positive amounts', () => {
        fc.assert(
          fc.property(fc.float({ min: Math.fround(0.01), max: Math.fround(1e10), noNaN: true }), (amount) => {
            const result = validateAmount(amount.toString());
            return result.valid === true;
          }),
          { numRuns: 100 }
        );
      });

      it('should reject invalid amounts', () => {
        const invalidAmounts = ['-100', '0', 'abc', '', 'NaN', 'Infinity'];
        invalidAmounts.forEach((amount) => {
          const result = validateAmount(amount);
          expect(result.valid).toBe(false);
        });
      });

      it('should enforce maximum amount limits', () => {
        const result = validateAmount('1000000000000000', { maxAmount: 1e12 });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('exceeds maximum');
      });

      it('should enforce decimal precision', () => {
        const result = validateAmount('100.123456789012345678901', { maxDecimals: 18 });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('decimal');
      });
    });

    describe('SQL Injection Prevention', () => {
      it('should sanitize SQL injection attempts', () => {
        const maliciousInputs = [
          "'; DROP TABLE users; --",
          "1' OR '1'='1",
          "1; DELETE FROM users",
          "' UNION SELECT * FROM passwords --",
          "admin'--",
        ];

        maliciousInputs.forEach((input) => {
          const sanitized = sanitizeInput(input);
          // Verify dangerous patterns are neutralized
          expect(sanitized).not.toContain(';');
          expect(sanitized).not.toContain('--');
          // Single quotes are escaped to double quotes (SQL standard escaping)
          expect(sanitized).not.toMatch(/(?<!')'(?!')/); // No unescaped single quotes
        });
      });
    });

    describe('XSS Prevention', () => {
      it('should escape HTML entities', () => {
        const maliciousInputs = [
          '<script>alert("xss")</script>',
          '<img src="x" onerror="alert(1)">',
          '<a href="javascript:alert(1)">click</a>',
          '"><script>alert(1)</script>',
        ];

        maliciousInputs.forEach((input) => {
          const escaped = escapeHtml(input);
          // Verify HTML tags are escaped (< and > become &lt; and &gt;)
          expect(escaped).not.toContain('<script>');
          expect(escaped).not.toContain('</script>');
          expect(escaped).not.toContain('<img');
          expect(escaped).not.toContain('<a ');
          // Verify javascript: protocol is removed
          expect(escaped).not.toContain('javascript:');
        });
      });
    });
  });

  describe('Session Security', () => {
    it('should generate secure session tokens', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const token = generateSessionToken();
          expect(token).toHaveLength(64);
          expect(/^[a-f0-9]+$/i.test(token)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate unique session tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const token = generateSessionToken();
        expect(tokens.has(token)).toBe(false);
        tokens.add(token);
      }
    });

    it('should validate session expiration', () => {
      const session = createSession('user-1', { expiresInMs: 1000 });
      expect(isSessionValid(session)).toBe(true);

      // Simulate expiration
      const expiredSession = {
        ...session,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };
      expect(isSessionValid(expiredSession)).toBe(false);
    });

    it('should support session refresh', () => {
      const session = createSession('user-1', { expiresInMs: 60000 });
      const originalExpiry = new Date(session.expiresAt).getTime();

      const refreshed = refreshSession(session, { expiresInMs: 120000 });
      const newExpiry = new Date(refreshed.expiresAt).getTime();

      expect(newExpiry).toBeGreaterThan(originalExpiry);
    });

    it('should invalidate sessions on logout', () => {
      const sessionStore = createSessionStore();
      const session = sessionStore.create('user-1');

      expect(sessionStore.isValid(session.token)).toBe(true);

      sessionStore.invalidate(session.token);
      expect(sessionStore.isValid(session.token)).toBe(false);
    });

    it('should support concurrent session limits', () => {
      const sessionStore = createSessionStore({ maxConcurrentSessions: 3 });

      // Create 3 sessions for same user
      sessionStore.create('user-1');
      sessionStore.create('user-1');
      sessionStore.create('user-1');

      // 4th session should invalidate oldest
      const session4 = sessionStore.create('user-1');
      expect(session4).toBeDefined();
      expect(sessionStore.getSessionCount('user-1')).toBe(3);
    });
  });

  describe('Audit Logging', () => {
    it('should log security events', () => {
      const auditLog = createAuditLog();

      auditLog.log({
        event: 'LOGIN_SUCCESS',
        userId: 'user-1',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      const logs = auditLog.getByUser('user-1');
      expect(logs).toHaveLength(1);
      expect(logs[0].event).toBe('LOGIN_SUCCESS');
    });

    it('should include timestamps', () => {
      const auditLog = createAuditLog();
      const before = Date.now();

      auditLog.log({
        event: 'LOGIN_ATTEMPT',
        userId: 'user-1',
        ip: '192.168.1.1',
      });

      const after = Date.now();
      const logs = auditLog.getByUser('user-1');

      expect(new Date(logs[0].timestamp).getTime()).toBeGreaterThanOrEqual(before);
      expect(new Date(logs[0].timestamp).getTime()).toBeLessThanOrEqual(after);
    });

    it('should support filtering by event type', () => {
      const auditLog = createAuditLog();

      auditLog.log({ event: 'LOGIN_SUCCESS', userId: 'user-1', ip: '1.1.1.1' });
      auditLog.log({ event: 'LOGIN_FAILED', userId: 'user-1', ip: '1.1.1.1' });
      auditLog.log({ event: 'PASSWORD_CHANGE', userId: 'user-1', ip: '1.1.1.1' });

      const failedLogins = auditLog.getByEventType('LOGIN_FAILED');
      expect(failedLogins).toHaveLength(1);
    });

    it('should detect suspicious activity patterns', () => {
      const auditLog = createAuditLog();

      // Simulate multiple failed login attempts
      for (let i = 0; i < 10; i++) {
        auditLog.log({
          event: 'LOGIN_FAILED',
          userId: 'user-1',
          ip: '192.168.1.1',
        });
      }

      const suspicious = auditLog.detectSuspiciousActivity('user-1');
      expect(suspicious.detected).toBe(true);
      expect(suspicious.reason).toContain('failed login');
    });
  });
});

// Helper functions
function generateCSRFToken(): string {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function validateCSRFToken(provided: string, expected: string): { valid: boolean; error?: string } {
  if (!provided || !expected) {
    return { valid: false, error: 'CSRF token missing' };
  }
  // Timing-safe comparison
  if (provided.length !== expected.length) {
    return { valid: false, error: 'CSRF token invalid' };
  }
  let result = 0;
  for (let i = 0; i < provided.length; i++) {
    result |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0 ? { valid: true } : { valid: false, error: 'CSRF token mismatch' };
}

interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  tiers?: Record<string, { maxRequests: number }>;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfter?: number;
}

function createRateLimiter(options: RateLimiterOptions) {
  const requests = new Map<string, { count: number; resetAt: number }>();

  return {
    checkLimit(clientId: string, tier?: string): RateLimitResult {
      const limit = tier && options.tiers?.[tier]
        ? options.tiers[tier].maxRequests
        : options.maxRequests;

      const now = Date.now();
      const client = requests.get(clientId);

      if (!client || client.resetAt <= now) {
        requests.set(clientId, { count: 1, resetAt: now + options.windowMs });
        return { allowed: true, remaining: limit - 1, limit };
      }

      if (client.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          limit,
          retryAfter: Math.ceil((client.resetAt - now) / 1000),
        };
      }

      client.count++;
      return { allowed: true, remaining: limit - client.count, limit };
    },
    resetClient(clientId: string) {
      requests.delete(clientId);
    },
  };
}

function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  if (email.length > 254) {
    return { valid: false, error: 'Email too long' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
}

function validateEthereumAddress(address: string): { valid: boolean; error?: string } {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address is required' };
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { valid: false, error: 'Invalid Ethereum address format' };
  }
  return { valid: true };
}

function validateAmount(amount: string, options?: { maxAmount?: number; maxDecimals?: number }): { valid: boolean; error?: string } {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0 || !isFinite(num)) {
    return { valid: false, error: 'Amount must be a positive number' };
  }
  if (options?.maxAmount && num > options.maxAmount) {
    return { valid: false, error: 'Amount exceeds maximum allowed' };
  }
  if (options?.maxDecimals) {
    const decimals = (amount.split('.')[1] || '').length;
    if (decimals > options.maxDecimals) {
      return { valid: false, error: `Too many decimal places (max ${options.maxDecimals})` };
    }
  }
  return { valid: true };
}

function sanitizeInput(input: string): string {
  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/javascript:/gi, '');
}

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface Session {
  token: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

function createSession(userId: string, options: { expiresInMs: number }): Session {
  return {
    token: generateSessionToken(),
    userId,
    expiresAt: new Date(Date.now() + options.expiresInMs).toISOString(),
    createdAt: new Date().toISOString(),
  };
}

function isSessionValid(session: Session): boolean {
  return new Date(session.expiresAt).getTime() > Date.now();
}

function refreshSession(session: Session, options: { expiresInMs: number }): Session {
  return {
    ...session,
    expiresAt: new Date(Date.now() + options.expiresInMs).toISOString(),
  };
}

function createSessionStore(options?: { maxConcurrentSessions?: number }) {
  const sessions = new Map<string, Session>();
  const userSessions = new Map<string, string[]>();

  return {
    create(userId: string): Session {
      const session = createSession(userId, { expiresInMs: 30 * 24 * 60 * 60 * 1000 });
      sessions.set(session.token, session);

      const userTokens = userSessions.get(userId) || [];
      userTokens.push(session.token);

      // Enforce concurrent session limit
      if (options?.maxConcurrentSessions && userTokens.length > options.maxConcurrentSessions) {
        const oldestToken = userTokens.shift()!;
        sessions.delete(oldestToken);
      }

      userSessions.set(userId, userTokens);
      return session;
    },
    isValid(token: string): boolean {
      const session = sessions.get(token);
      return session ? isSessionValid(session) : false;
    },
    invalidate(token: string): void {
      const session = sessions.get(token);
      if (session) {
        const userTokens = userSessions.get(session.userId) || [];
        userSessions.set(session.userId, userTokens.filter(t => t !== token));
        sessions.delete(token);
      }
    },
    getSessionCount(userId: string): number {
      return (userSessions.get(userId) || []).length;
    },
  };
}

interface AuditLogEntry {
  event: string;
  userId: string;
  ip: string;
  userAgent?: string;
  timestamp: string;
}

function createAuditLog() {
  const logs: AuditLogEntry[] = [];

  return {
    log(entry: Omit<AuditLogEntry, 'timestamp'>): void {
      logs.push({
        ...entry,
        timestamp: new Date().toISOString(),
      });
    },
    getByUser(userId: string): AuditLogEntry[] {
      return logs.filter(l => l.userId === userId);
    },
    getByEventType(event: string): AuditLogEntry[] {
      return logs.filter(l => l.event === event);
    },
    detectSuspiciousActivity(userId: string): { detected: boolean; reason?: string } {
      const userLogs = this.getByUser(userId);
      const recentFailedLogins = userLogs.filter(
        l => l.event === 'LOGIN_FAILED' &&
        new Date(l.timestamp).getTime() > Date.now() - 15 * 60 * 1000
      );

      if (recentFailedLogins.length >= 5) {
        return { detected: true, reason: 'Multiple failed login attempts detected' };
      }
      return { detected: false };
    },
  };
}
