/**
 * Agent Service Tests
 * 
 * Property-based tests for Agent Service functionality.
 * Feature: agent-link-api
 * 
 * @module lib/__tests__/agent-service.test.ts
 */

import * as fc from 'fast-check';
import { 
  agentService, 
  generateAgentApiKey, 
  hashApiKey,
  AgentType,
  CreateAgentInput 
} from '../services/agent-service';

// ============================================
// Test Helpers
// ============================================

const validAgentTypes = ['trading', 'payroll', 'expense', 'subscription', 'custom'] as AgentType[];

// Arbitrary for valid agent input
const agentInputArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  type: fc.constantFrom(...validAgentTypes),
  avatar_url: fc.option(fc.webUrl(), { nil: undefined }),
  webhook_url: fc.option(fc.webUrl(), { nil: undefined }),
  auto_execute_enabled: fc.boolean(),
  rate_limit_per_minute: fc.integer({ min: 1, max: 1000 }),
});

// Arbitrary for wallet address
const walletAddressArb = fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`);

// ============================================
// Unit Tests
// ============================================

describe('Agent Service', () => {
  beforeEach(() => {
    agentService._clearAll();
  });

  describe('generateAgentApiKey', () => {
    it('should generate key with agent_ prefix', () => {
      const { key, prefix, hash } = generateAgentApiKey();
      
      expect(key).toMatch(/^agent_[a-f0-9]{48}$/);
      expect(prefix).toBe(key.substring(0, 12));
      expect(hash).toHaveLength(64); // SHA-256 hex
    });

    it('should generate unique keys', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const { key } = generateAgentApiKey();
        expect(keys.has(key)).toBe(false);
        keys.add(key);
      }
    });
  });

  describe('hashApiKey', () => {
    it('should produce consistent hashes', () => {
      const key = 'agent_test123';
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different keys', () => {
      const hash1 = hashApiKey('agent_key1');
      const hash2 = hashApiKey('agent_key2');
      expect(hash1).not.toBe(hash2);
    });
  });

  // ============================================
  // Property Tests
  // ============================================

  describe('Property 1: Agent CRUD Round-Trip', () => {
    /**
     * Feature: agent-link-api, Property 1: Agent CRUD Round-Trip
     * 
     * For any valid agent input, creating an agent, listing agents, 
     * updating it, and then deactivating it SHALL result in the agent 
     * having status "deactivated" and its API key failing validation.
     * 
     * Validates: Requirements 1.1, 1.2, 1.3, 1.4
     */
    it('should complete full CRUD lifecycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          walletAddressArb,
          agentInputArb,
          async (ownerAddress, input) => {
            // Clear store for each iteration
            agentService._clearAll();

            // CREATE
            const createInput: CreateAgentInput = {
              owner_address: ownerAddress,
              ...input,
            };
            const { agent, apiKey } = await agentService.create(createInput);

            expect(agent.id).toBeDefined();
            expect(agent.owner_address).toBe(ownerAddress);
            expect(agent.name).toBe(input.name.trim());
            expect(agent.status).toBe('active');

            // LIST - should contain the agent
            const agents = await agentService.list(ownerAddress);
            expect(agents.some(a => a.id === agent.id)).toBe(true);

            // GET - should return the agent
            const retrieved = await agentService.get(agent.id, ownerAddress);
            expect(retrieved).not.toBeNull();
            expect(retrieved?.id).toBe(agent.id);

            // VALIDATE - API key should work
            const validation = await agentService.validate(apiKey);
            expect(validation.valid).toBe(true);
            expect(validation.agent?.id).toBe(agent.id);

            // UPDATE
            const updatedName = `Updated ${input.name.trim()}`;
            const updated = await agentService.update(agent.id, ownerAddress, {
              name: updatedName,
            });
            expect(updated.name).toBe(updatedName.trim());

            // DEACTIVATE
            await agentService.deactivate(agent.id, ownerAddress);

            // Verify deactivated
            const deactivated = await agentService.get(agent.id, ownerAddress);
            expect(deactivated?.status).toBe('deactivated');

            // API key should no longer work
            const postDeactivateValidation = await agentService.validate(apiKey);
            expect(postDeactivateValidation.valid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Agent API Key Format', () => {
    /**
     * Feature: agent-link-api, Property 2: Agent API Key Format
     * 
     * For any agent created, the generated API key SHALL have the prefix 
     * `agent_` and the stored `api_key_hash` SHALL be a valid SHA-256 hash 
     * that validates against the original key.
     * 
     * Validates: Requirements 1.5
     */
    it('should generate valid API keys with correct format', async () => {
      await fc.assert(
        fc.asyncProperty(
          walletAddressArb,
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (ownerAddress, name) => {
            agentService._clearAll();

            const { agent, apiKey } = await agentService.create({
              owner_address: ownerAddress,
              name,
            });

            // API key should have agent_ prefix
            expect(apiKey).toMatch(/^agent_/);

            // Prefix should match
            expect(agent.api_key_prefix).toBe(apiKey.substring(0, 12));

            // Hash should be valid SHA-256 (64 hex chars)
            expect(agent.api_key_hash).toMatch(/^[a-f0-9]{64}$/);

            // Hash should match the key
            const computedHash = hashApiKey(apiKey);
            expect(agent.api_key_hash).toBe(computedHash);

            // Validation should succeed
            const validation = await agentService.validate(apiKey);
            expect(validation.valid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: Agent Authentication Validation', () => {
    /**
     * Feature: agent-link-api, Property 7: Agent Authentication Validation
     * 
     * For any request with a valid agent API key where the agent is active, 
     * authentication SHALL succeed and attach the agent context. For invalid, 
     * expired, or deactivated agents, authentication SHALL return error.
     * 
     * Validates: Requirements 3.1, 3.2, 3.3
     */
    it('should validate active agents and reject inactive ones', async () => {
      await fc.assert(
        fc.asyncProperty(
          walletAddressArb,
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (ownerAddress, name) => {
            agentService._clearAll();

            // Create agent
            const { agent, apiKey } = await agentService.create({
              owner_address: ownerAddress,
              name,
            });

            // Active agent should validate
            const activeValidation = await agentService.validate(apiKey);
            expect(activeValidation.valid).toBe(true);
            expect(activeValidation.agent?.id).toBe(agent.id);

            // Pause agent
            await agentService.update(agent.id, ownerAddress, { status: 'paused' });
            const pausedValidation = await agentService.validate(apiKey);
            expect(pausedValidation.valid).toBe(false);
            expect(pausedValidation.error).toContain('paused');

            // Resume agent
            await agentService.update(agent.id, ownerAddress, { status: 'active' });
            const resumedValidation = await agentService.validate(apiKey);
            expect(resumedValidation.valid).toBe(true);

            // Deactivate agent
            await agentService.deactivate(agent.id, ownerAddress);
            const deactivatedValidation = await agentService.validate(apiKey);
            expect(deactivatedValidation.valid).toBe(false);
            // After deactivation, API key is removed from mapping
            expect(deactivatedValidation.error).toBeDefined();

            // Invalid key format
            const invalidFormatValidation = await agentService.validate('invalid_key');
            expect(invalidFormatValidation.valid).toBe(false);

            // Non-existent key
            const nonExistentValidation = await agentService.validate('agent_nonexistent123456789012345678901234567890');
            expect(nonExistentValidation.valid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 14: Emergency Pause', () => {
    /**
     * Feature: agent-link-api, Property 14: Emergency Pause
     * 
     * For any owner invoking "pause all agents", all agents owned by that 
     * address SHALL immediately have auto-execute disabled and status set 
     * to "paused".
     * 
     * Validates: Requirements 5.6
     */
    it('should pause all agents for an owner', async () => {
      await fc.assert(
        fc.asyncProperty(
          walletAddressArb,
          fc.integer({ min: 1, max: 5 }),
          async (ownerAddress, agentCount) => {
            agentService._clearAll();

            // Create multiple agents
            const agents: string[] = [];
            for (let i = 0; i < agentCount; i++) {
              const { agent } = await agentService.create({
                owner_address: ownerAddress,
                name: `Agent ${i}`,
                auto_execute_enabled: true,
              });
              agents.push(agent.id);
            }

            // Verify all are active with auto-execute
            for (const id of agents) {
              const agent = await agentService.get(id, ownerAddress);
              expect(agent?.status).toBe('active');
              expect(agent?.auto_execute_enabled).toBe(true);
            }

            // Pause all
            const pausedCount = await agentService.pauseAll(ownerAddress);
            expect(pausedCount).toBe(agentCount);

            // Verify all are paused with auto-execute disabled
            for (const id of agents) {
              const agent = await agentService.get(id, ownerAddress);
              expect(agent?.status).toBe('paused');
              expect(agent?.auto_execute_enabled).toBe(false);
            }

            // Resume all
            const resumedCount = await agentService.resumeAll(ownerAddress);
            expect(resumedCount).toBe(agentCount);

            // Verify all are active again
            for (const id of agents) {
              const agent = await agentService.get(id, ownerAddress);
              expect(agent?.status).toBe('active');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should reject empty name', async () => {
      await expect(
        agentService.create({
          owner_address: '0x1234567890123456789012345678901234567890',
          name: '',
        })
      ).rejects.toThrow('name is required');
    });

    it('should reject whitespace-only name', async () => {
      await expect(
        agentService.create({
          owner_address: '0x1234567890123456789012345678901234567890',
          name: '   ',
        })
      ).rejects.toThrow('name is required');
    });

    it('should reject missing owner_address', async () => {
      await expect(
        agentService.create({
          owner_address: '',
          name: 'Test Agent',
        })
      ).rejects.toThrow('owner_address is required');
    });

    it('should not return agents for different owner', async () => {
      const owner1 = '0x1111111111111111111111111111111111111111';
      const owner2 = '0x2222222222222222222222222222222222222222';

      const { agent } = await agentService.create({
        owner_address: owner1,
        name: 'Owner 1 Agent',
      });

      // Owner 2 should not see owner 1's agent
      const owner2Agents = await agentService.list(owner2);
      expect(owner2Agents).toHaveLength(0);

      // Owner 2 should not be able to get owner 1's agent
      const retrieved = await agentService.get(agent.id, owner2);
      expect(retrieved).toBeNull();
    });

    it('should handle case-insensitive owner address matching', async () => {
      const owner = '0xAbCdEf1234567890123456789012345678901234';
      
      const { agent } = await agentService.create({
        owner_address: owner,
        name: 'Test Agent',
      });

      // Should find with lowercase
      const agents = await agentService.list(owner.toLowerCase());
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe(agent.id);

      // Should find with uppercase
      const agents2 = await agentService.list(owner.toUpperCase());
      expect(agents2).toHaveLength(1);
    });
  });
});
