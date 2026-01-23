/**
 * Agent Authentication Middleware Tests
 * 
 * Property-based tests for Agent Authentication functionality.
 * Feature: agent-link-api
 * 
 * @module lib/__tests__/agent-auth.test.ts
 */

import * as fc from 'fast-check';
import { NextRequest } from 'next/server';
import {
  extractAgentApiKey,
  validateAgentAuth,
  agentAuthMiddleware,
  getAgentContext,
  dualAuthMiddleware,
  _clearRateLimits,
  _getRateLimitEntry,
} from '../middleware/agent-auth';
import { agentService } from '../services/agent-service';

// ============================================
// Test Helpers
// ============================================

function createMockRequest(headers: Record<string, string> = {}): NextRequest {
  const url = 'http://localhost:3000/api/agents/proposals';
  const req = new NextRequest(url, {
    method: 'POST',
    headers: new Headers(headers),
  });
  return req;
}

// Arbitrary for wallet address
const walletAddressArb = fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`);

// Arbitrary for agent name
const agentNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

// ============================================
// Unit Tests
// ============================================

describe('Agent Auth Middleware', () => {
  beforeEach(() => {
    agentService._clearAll();
    _clearRateLimits();
  });

  describe('extractAgentApiKey', () => {
    it('should extract key from Bearer header', () => {
      const req = createMockRequest({
        'Authorization': 'Bearer agent_abc123def456789012345678901234567890123456',
      });
      const key = extractAgentApiKey(req);
      expect(key).toBe('agent_abc123def456789012345678901234567890123456');
    });

    it('should extract key from direct header', () => {
      const req = createMockRequest({
        'Authorization': 'agent_abc123def456789012345678901234567890123456',
      });
      const key = extractAgentApiKey(req);
      expect(key).toBe('agent_abc123def456789012345678901234567890123456');
    });

    it('should return null for missing header', () => {
      const req = createMockRequest({});
      const key = extractAgentApiKey(req);
      expect(key).toBeNull();
    });

    it('should return null for non-agent Bearer token', () => {
      const req = createMockRequest({
        'Authorization': 'Bearer pb_user_key_123',
      });
      const key = extractAgentApiKey(req);
      expect(key).toBeNull();
    });

    it('should return null for invalid format', () => {
      const req = createMockRequest({
        'Authorization': 'Basic dXNlcjpwYXNz',
      });
      const key = extractAgentApiKey(req);
      expect(key).toBeNull();
    });
  });

  describe('validateAgentAuth', () => {
    it('should reject invalid key format', async () => {
      const result = await validateAgentAuth('invalid_key');
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toContain('Invalid agent API key format');
    });

    it('should reject non-existent agent', async () => {
      const result = await validateAgentAuth('agent_nonexistent123456789012345678901234567890');
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('should validate active agent', async () => {
      const { apiKey } = await agentService.create({
        owner_address: '0x1234567890123456789012345678901234567890',
        name: 'Test Agent',
      });

      const result = await validateAgentAuth(apiKey);
      expect(result.success).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.context?.agentName).toBe('Test Agent');
    });
  });

  // ============================================
  // Property Tests
  // ============================================

  describe('Property 7: Agent Authentication Validation', () => {
    /**
     * Feature: agent-link-api, Property 7: Agent Authentication Validation
     * 
     * For any request with a valid agent API key where the agent is active, 
     * authentication SHALL succeed and attach the agent context. For invalid, 
     * expired, or deactivated agents, authentication SHALL return HTTP 401.
     * 
     * Validates: Requirements 3.1, 3.2, 3.3
     */
    it('should validate active agents and reject inactive ones', async () => {
      await fc.assert(
        fc.asyncProperty(
          walletAddressArb,
          agentNameArb,
          async (ownerAddress, name) => {
            agentService._clearAll();
            _clearRateLimits();

            // Create agent
            const { agent, apiKey } = await agentService.create({
              owner_address: ownerAddress,
              name,
            });

            // Active agent should validate
            const activeResult = await validateAgentAuth(apiKey);
            expect(activeResult.success).toBe(true);
            expect(activeResult.context?.agentId).toBe(agent.id);
            expect(activeResult.context?.ownerAddress.toLowerCase()).toBe(ownerAddress.toLowerCase());

            // Pause agent - should fail validation
            await agentService.update(agent.id, ownerAddress, { status: 'paused' });
            _clearRateLimits(); // Clear rate limit to allow another request
            const pausedResult = await validateAgentAuth(apiKey);
            expect(pausedResult.success).toBe(false);
            expect(pausedResult.statusCode).toBe(401);

            // Resume agent - should validate again
            await agentService.update(agent.id, ownerAddress, { status: 'active' });
            _clearRateLimits();
            const resumedResult = await validateAgentAuth(apiKey);
            expect(resumedResult.success).toBe(true);

            // Deactivate agent - should fail validation
            await agentService.deactivate(agent.id, ownerAddress);
            _clearRateLimits();
            const deactivatedResult = await validateAgentAuth(apiKey);
            expect(deactivatedResult.success).toBe(false);
            expect(deactivatedResult.statusCode).toBe(401);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid API key formats', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.startsWith('agent_')),
          async (invalidKey) => {
            const result = await validateAgentAuth(invalidKey);
            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(401);
            expect(result.error).toContain('Invalid agent API key format');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Agent Permission Enforcement', () => {
    /**
     * Feature: agent-link-api, Property 8: Agent Permission Enforcement
     * 
     * For any agent attempting an operation outside its configured permissions 
     * or rate limits, the service SHALL return HTTP 403 or HTTP 429 respectively.
     * 
     * Validates: Requirements 3.4, 3.6
     */
    it('should enforce rate limits', async () => {
      await fc.assert(
        fc.asyncProperty(
          walletAddressArb,
          agentNameArb,
          fc.integer({ min: 1, max: 10 }),
          async (ownerAddress, name, rateLimit) => {
            agentService._clearAll();
            _clearRateLimits();

            // Create agent with specific rate limit
            const { apiKey } = await agentService.create({
              owner_address: ownerAddress,
              name,
              rate_limit_per_minute: rateLimit,
            });

            // Make requests up to the limit - all should succeed
            for (let i = 0; i < rateLimit; i++) {
              const result = await validateAgentAuth(apiKey);
              expect(result.success).toBe(true);
            }

            // Next request should be rate limited
            const rateLimitedResult = await validateAgentAuth(apiKey);
            expect(rateLimitedResult.success).toBe(false);
            expect(rateLimitedResult.statusCode).toBe(429);
            expect(rateLimitedResult.error).toContain('Rate limit exceeded');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track rate limit remaining correctly', async () => {
      const ownerAddress = '0x1234567890123456789012345678901234567890';
      const rateLimit = 5;

      const { agent, apiKey } = await agentService.create({
        owner_address: ownerAddress,
        name: 'Rate Limit Test Agent',
        rate_limit_per_minute: rateLimit,
      });

      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        await validateAgentAuth(apiKey);
      }

      // Check rate limit entry
      const entry = _getRateLimitEntry(agent.id);
      expect(entry).toBeDefined();
      expect(entry?.count).toBe(3);
    });
  });

  describe('agentAuthMiddleware', () => {
    it('should return 401 for missing API key', async () => {
      const req = createMockRequest({});
      const response = await agentAuthMiddleware(req);
      
      expect(response).not.toBeNull();
      expect(response?.status).toBe(401);
      
      const body = await response?.json();
      expect(body.error).toContain('Missing agent API key');
    });

    it('should return 401 for invalid API key', async () => {
      const req = createMockRequest({
        'Authorization': 'Bearer agent_invalid123456789012345678901234567890',
      });
      const response = await agentAuthMiddleware(req);
      
      expect(response).not.toBeNull();
      expect(response?.status).toBe(401);
    });

    it('should return null for valid API key', async () => {
      const { apiKey } = await agentService.create({
        owner_address: '0x1234567890123456789012345678901234567890',
        name: 'Test Agent',
      });

      const req = createMockRequest({
        'Authorization': `Bearer ${apiKey}`,
      });
      const response = await agentAuthMiddleware(req);
      
      expect(response).toBeNull();
    });

    it('should return 429 when rate limited', async () => {
      const { apiKey } = await agentService.create({
        owner_address: '0x1234567890123456789012345678901234567890',
        name: 'Test Agent',
        rate_limit_per_minute: 1,
      });

      const req = createMockRequest({
        'Authorization': `Bearer ${apiKey}`,
      });

      // First request should succeed
      const response1 = await agentAuthMiddleware(req);
      expect(response1).toBeNull();

      // Second request should be rate limited
      const response2 = await agentAuthMiddleware(req);
      expect(response2).not.toBeNull();
      expect(response2?.status).toBe(429);
    });
  });

  describe('getAgentContext', () => {
    it('should return context for valid request', async () => {
      const { agent, apiKey } = await agentService.create({
        owner_address: '0x1234567890123456789012345678901234567890',
        name: 'Context Test Agent',
        auto_execute_enabled: true,
      });

      const req = createMockRequest({
        'Authorization': `Bearer ${apiKey}`,
      });

      const context = await getAgentContext(req);
      expect(context).not.toBeNull();
      expect(context?.agentId).toBe(agent.id);
      expect(context?.agentName).toBe('Context Test Agent');
      expect(context?.autoExecuteEnabled).toBe(true);
    });

    it('should return null for invalid request', async () => {
      const req = createMockRequest({});
      const context = await getAgentContext(req);
      expect(context).toBeNull();
    });
  });

  describe('dualAuthMiddleware', () => {
    it('should identify agent auth', async () => {
      const { apiKey } = await agentService.create({
        owner_address: '0x1234567890123456789012345678901234567890',
        name: 'Dual Auth Test Agent',
      });

      const req = createMockRequest({
        'Authorization': `Bearer ${apiKey}`,
      });

      const result = await dualAuthMiddleware(req);
      expect(result.type).toBe('agent');
      expect(result.agentContext).toBeDefined();
    });

    it('should identify user auth with pb_ prefix', async () => {
      const req = createMockRequest({
        'Authorization': 'Bearer pb_user_api_key_123',
      });

      const result = await dualAuthMiddleware(req);
      expect(result.type).toBe('user');
    });

    it('should identify user auth without agent prefix', async () => {
      const req = createMockRequest({
        'Authorization': 'Bearer some_session_token',
      });

      const result = await dualAuthMiddleware(req);
      expect(result.type).toBe('user');
    });

    it('should return none for missing auth', async () => {
      const req = createMockRequest({});

      const result = await dualAuthMiddleware(req);
      expect(result.type).toBe('none');
      expect(result.error).toBeDefined();
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle empty Authorization header', async () => {
      const req = createMockRequest({
        'Authorization': '',
      });
      const key = extractAgentApiKey(req);
      expect(key).toBeNull();
    });

    it('should handle Bearer without token', async () => {
      const req = createMockRequest({
        'Authorization': 'Bearer ',
      });
      const key = extractAgentApiKey(req);
      expect(key).toBeNull();
    });

    it('should handle case sensitivity in Bearer', async () => {
      const { apiKey } = await agentService.create({
        owner_address: '0x1234567890123456789012345678901234567890',
        name: 'Case Test Agent',
      });

      // Lowercase bearer should not work (standard is "Bearer")
      const req = createMockRequest({
        'Authorization': `bearer ${apiKey}`,
      });
      const key = extractAgentApiKey(req);
      expect(key).toBeNull();
    });

    it('should update last_active_at on successful validation', async () => {
      const { agent, apiKey } = await agentService.create({
        owner_address: '0x1234567890123456789012345678901234567890',
        name: 'Last Active Test Agent',
      });

      const initialLastActive = agent.last_active_at;

      // Wait a bit and validate
      await new Promise(resolve => setTimeout(resolve, 10));
      await validateAgentAuth(apiKey);

      const updatedAgent = await agentService.get(agent.id, agent.owner_address);
      expect(updatedAgent?.last_active_at).not.toBe(initialLastActive);
    });
  });
});
