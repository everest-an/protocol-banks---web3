/**
 * Agent Service
 *
 * Manages AI agent registration, authentication, and lifecycle.
 * Agents can request budgets, propose payments, and execute transactions
 * with human oversight.
 *
 * @module lib/services/agent-service
 */

import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

// ============================================
// Types
// ============================================

export type AgentType = 'trading' | 'payroll' | 'expense' | 'subscription' | 'custom';
export type AgentStatus = 'active' | 'paused' | 'deactivated';

export interface AutoExecuteRules {
  max_single_amount?: string;
  max_daily_amount?: string;
  allowed_tokens?: string[];
  allowed_recipients?: string[];
  allowed_chains?: number[];
}

export interface Agent {
  id: string;
  owner_address: string;
  name: string;
  description?: string | null;
  type: AgentType;
  avatar_url?: string | null;
  api_key_hash: string;
  api_key_prefix: string;
  webhook_url?: string | null;
  webhook_secret_hash?: string | null;
  status: AgentStatus;
  auto_execute_enabled: boolean;
  auto_execute_rules?: AutoExecuteRules | null;
  rate_limit_per_minute: number;
  created_at: Date;
  updated_at: Date;
  last_active_at?: Date | null;
}

export interface CreateAgentInput {
  owner_address: string;
  name: string;
  description?: string;
  type?: AgentType;
  avatar_url?: string;
  webhook_url?: string;
  auto_execute_enabled?: boolean;
  auto_execute_rules?: AutoExecuteRules;
  rate_limit_per_minute?: number;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  type?: AgentType;
  avatar_url?: string;
  webhook_url?: string;
  status?: AgentStatus;
  auto_execute_enabled?: boolean;
  auto_execute_rules?: AutoExecuteRules;
  rate_limit_per_minute?: number;
}

export interface AgentValidationResult {
  valid: boolean;
  agent?: Agent;
  error?: string;
}

// ============================================
// In-Memory Storage (for fallback/testing)
// ============================================

// Legacy in-memory storage - only used for testing
const agentsStore = new Map<string, Agent>();
const apiKeyToAgentId = new Map<string, string>();

// Flag to enable/disable database (for testing)
let useDatabaseStorage = true;

export function setUseDatabaseStorage(enabled: boolean) {
  useDatabaseStorage = enabled;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a secure API key with agent_ prefix
 */
export function generateAgentApiKey(): { key: string; prefix: string; hash: string } {
  const randomPart = randomBytes(24).toString('hex');
  const key = `agent_${randomPart}`;
  const prefix = key.substring(0, 12); // agent_xxxx
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a webhook secret
 */
export function generateWebhookSecret(): { secret: string; hash: string } {
  const secret = `whsec_${randomBytes(24).toString('hex')}`;
  const hash = hashApiKey(secret);
  return { secret, hash };
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${randomBytes(8).toString('hex')}`;
}

// ============================================
// Agent Service
// ============================================

export const agentService = {
  /**
   * Create a new agent
   */
  async create(input: CreateAgentInput): Promise<{ agent: Agent; apiKey: string; webhookSecret?: string }> {
    // Validate input
    if (!input.owner_address) {
      throw new Error('owner_address is required');
    }
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('name is required');
    }

    // Generate API key
    const { key: apiKey, prefix, hash: apiKeyHash } = generateAgentApiKey();

    // Generate webhook secret if webhook URL provided
    let webhookSecret: string | undefined;
    let webhookSecretHash: string | undefined;
    if (input.webhook_url) {
      const webhookData = generateWebhookSecret();
      webhookSecret = webhookData.secret;
      webhookSecretHash = webhookData.hash;
    }

    const now = new Date();
    const agentData = {
      owner_address: input.owner_address.toLowerCase(),
      name: input.name.trim(),
      description: input.description,
      type: input.type || 'custom',
      avatar_url: input.avatar_url,
      api_key_hash: apiKeyHash,
      api_key_prefix: prefix,
      webhook_url: input.webhook_url,
      webhook_secret_hash: webhookSecretHash,
      status: 'active' as AgentStatus,
      auto_execute_enabled: input.auto_execute_enabled || false,
      auto_execute_rules: input.auto_execute_rules,
      rate_limit_per_minute: input.rate_limit_per_minute || 60,
    };

    // Use database or fallback to in-memory
    if (useDatabaseStorage) {
      try {
        // Insert agent
        const data = await prisma.agent.create({
          data: {
             ...agentData,
             status: agentData.status as string,
             auto_execute_rules: agentData.auto_execute_rules as any
          }
        });

        // Convert database dates to Date objects
        const agent: Agent = {
          ...data,
          type: data.type as AgentType,
          status: data.status as AgentStatus,
          auto_execute_rules: data.auto_execute_rules as AutoExecuteRules,
          created_at: data.created_at,
          updated_at: data.updated_at,
          last_active_at: data.last_active_at ? data.last_active_at : undefined,
        };

        return { agent, apiKey, webhookSecret };
      } catch (error) {
        console.error('[Agent Service] Failed to create agent in database:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const agent: Agent = {
        id: generateId(),
        ...agentData,
        created_at: now,
        updated_at: now,
      };

      agentsStore.set(agent.id, agent);
      apiKeyToAgentId.set(apiKeyHash, agent.id);

      return { agent, apiKey, webhookSecret };
    }
  },

  /**
   * List all agents for an owner
   */
  async list(ownerAddress: string): Promise<Agent[]> {
    if (useDatabaseStorage) {
      try {
        const data = await prisma.agent.findMany({
            where: { owner_address: ownerAddress.toLowerCase() },
            orderBy: { created_at: 'desc' }
        });

        // Convert database dates to Date objects
        return data.map((agent) => ({
          ...agent,
          type: agent.type as AgentType,
          status: agent.status as AgentStatus,
          auto_execute_rules: agent.auto_execute_rules as AutoExecuteRules,
          created_at: agent.created_at,
          updated_at: agent.updated_at,
          last_active_at: agent.last_active_at ? agent.last_active_at : undefined,
        }));
      } catch (error) {
        console.error('[Agent Service] Failed to list agents:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const agents: Agent[] = [];
      for (const agent of agentsStore.values()) {
        if (agent.owner_address.toLowerCase() === ownerAddress.toLowerCase()) {
          agents.push(agent);
        }
      }
      return agents.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    }
  },

  /**
   * Get an agent by ID
   */
  async get(id: string, ownerAddress: string): Promise<Agent | null> {
    if (useDatabaseStorage) {
      try {
        const data = await prisma.agent.findFirst({
            where: {
                id: id,
                owner_address: ownerAddress.toLowerCase()
            }
        });

        if (!data) return null;

        // Convert database dates to Date objects
        return {
          ...data,
          type: data.type as AgentType,
          status: data.status as AgentStatus,
          auto_execute_rules: data.auto_execute_rules as AutoExecuteRules,
          created_at: data.created_at,
          updated_at: data.updated_at,
          last_active_at: data.last_active_at ? data.last_active_at : undefined,
        };
      } catch (error) {
        console.error('[Agent Service] Failed to get agent:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const agent = agentsStore.get(id);
      if (!agent) return null;
      if (agent.owner_address.toLowerCase() !== ownerAddress.toLowerCase()) {
        return null;
      }
      return agent;
    }
  },

  /**
   * Get an agent by ID (internal, no owner check)
   */
  async getById(id: string): Promise<Agent | null> {
    if (useDatabaseStorage) {
      try {
        const data = await prisma.agent.findUnique({
            where: { id: id }
        });

        if (!data) return null;

        // Convert database dates to Date objects
        return {
          ...data,
          type: data.type as AgentType,
          status: data.status as AgentStatus,
          auto_execute_rules: data.auto_execute_rules as AutoExecuteRules,
          created_at: data.created_at,
          updated_at: data.updated_at,
          last_active_at: data.last_active_at ? data.last_active_at : undefined,
        };
      } catch (error) {
        console.error('[Agent Service] Failed to get agent by id:', error);
        return null;
      }
    } else {
      // Fallback to in-memory storage
      return agentsStore.get(id) || null;
    }
  },

  /**
   * Update an agent
   */
  async update(id: string, ownerAddress: string, input: UpdateAgentInput): Promise<Agent> {
    if (useDatabaseStorage) {
      try {
        // Check agent exists
        const agent = await this.get(id, ownerAddress);
        if (!agent) {
          throw new Error('Agent not found');
        }

        // Build update object
        const updates: Record<string, any> = {};
        if (input.name !== undefined) updates.name = input.name.trim();
        if (input.description !== undefined) updates.description = input.description;
        if (input.type !== undefined) updates.type = input.type;
        if (input.avatar_url !== undefined) updates.avatar_url = input.avatar_url;
        if (input.webhook_url !== undefined) {
          updates.webhook_url = input.webhook_url;
          // Generate new webhook secret if URL changed
          if (input.webhook_url) {
            const { hash } = generateWebhookSecret();
            updates.webhook_secret_hash = hash;
          }
        }
        if (input.status !== undefined) updates.status = input.status;
        if (input.auto_execute_enabled !== undefined) updates.auto_execute_enabled = input.auto_execute_enabled;
        if (input.auto_execute_rules !== undefined) updates.auto_execute_rules = input.auto_execute_rules;
        if (input.rate_limit_per_minute !== undefined) updates.rate_limit_per_minute = input.rate_limit_per_minute;

        // Update in database
        const data = await prisma.agent.update({
          where: { id },
          data: updates
        });

        // Convert database dates to Date objects
        return {
          ...data,
          type: data.type as AgentType,
          status: data.status as AgentStatus,
          auto_execute_rules: data.auto_execute_rules as AutoExecuteRules,
          created_at: data.created_at,
          updated_at: data.updated_at,
          last_active_at: data.last_active_at ? data.last_active_at : undefined,
        };
      } catch (error) {
        console.error('[Agent Service] Failed to update agent:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const agent = await this.get(id, ownerAddress);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Update fields
      if (input.name !== undefined) agent.name = input.name.trim();
      if (input.description !== undefined) agent.description = input.description;
      if (input.type !== undefined) agent.type = input.type;
      if (input.avatar_url !== undefined) agent.avatar_url = input.avatar_url;
      if (input.webhook_url !== undefined) {
        agent.webhook_url = input.webhook_url;
        // Generate new webhook secret if URL changed
        if (input.webhook_url) {
          const { hash } = generateWebhookSecret();
          agent.webhook_secret_hash = hash;
        }
      }
      if (input.status !== undefined) agent.status = input.status;
      if (input.auto_execute_enabled !== undefined) agent.auto_execute_enabled = input.auto_execute_enabled;
      if (input.auto_execute_rules !== undefined) agent.auto_execute_rules = input.auto_execute_rules;
      if (input.rate_limit_per_minute !== undefined) agent.rate_limit_per_minute = input.rate_limit_per_minute;

      agent.updated_at = new Date();
      agentsStore.set(id, agent);

      return agent;
    }
  },

  /**
   * Deactivate an agent (soft delete)
   */
  async deactivate(id: string, ownerAddress: string): Promise<void> {
    if (useDatabaseStorage) {
      try {
        // Check agent exists
        const agent = await this.get(id, ownerAddress);
        if (!agent) {
          throw new Error('Agent not found');
        }

        // Update status to deactivated
        await prisma.agent.update({
          where: { id },
          data: { status: 'deactivated' }
        });

      } catch (error) {
        console.error('[Agent Service] Failed to deactivate agent:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const agent = await this.get(id, ownerAddress);
      if (!agent) {
        throw new Error('Agent not found');
      }

      agent.status = 'deactivated';
      agent.updated_at = new Date();
      agentsStore.set(id, agent);

      // Remove API key mapping
      apiKeyToAgentId.delete(agent.api_key_hash);
    }
  },

  /**
   * Validate an agent API key
   */
  async validate(apiKey: string): Promise<AgentValidationResult> {
    // Check format
    if (!apiKey || !apiKey.startsWith('agent_')) {
      return { valid: false, error: 'Invalid API key format' };
    }

    // Hash the API key
    const hash = hashApiKey(apiKey);

    if (useDatabaseStorage) {
      try {
        // Find agent by API key hash
        const data = await prisma.agent.findUnique({
          where: { api_key_hash: hash }
        });

        if (!data) {
          return { valid: false, error: 'API key not found' };
        }

        const agent: Agent = {
          ...data,
          type: data.type as AgentType,
          status: data.status as AgentStatus,
          auto_execute_rules: data.auto_execute_rules as AutoExecuteRules,
          created_at: data.created_at,
          updated_at: data.updated_at,
          last_active_at: data.last_active_at ? data.last_active_at : undefined,
        };

        // Check status
        if (agent.status === 'deactivated') {
          return { valid: false, error: 'Agent is deactivated' };
        }

        if (agent.status === 'paused') {
          return { valid: false, error: 'Agent is paused' };
        }

        return { valid: true, agent };
      } catch (error) {
        console.error('[Agent Service] Failed to validate API key:', error);
        return { valid: false, error: 'Failed to validate API key' };
      }
    } else {
      // Fallback to in-memory storage
      const agentId = apiKeyToAgentId.get(hash);

      if (!agentId) {
        return { valid: false, error: 'API key not found' };
      }

      const agent = agentsStore.get(agentId);
      if (!agent) {
        return { valid: false, error: 'Agent not found' };
      }

      // Check status
      if (agent.status === 'deactivated') {
        return { valid: false, error: 'Agent is deactivated' };
      }

      if (agent.status === 'paused') {
        return { valid: false, error: 'Agent is paused' };
      }

      return { valid: true, agent };
    }
  },

  /**
   * Update last active timestamp
   */
  async updateLastActive(id: string): Promise<void> {
    if (useDatabaseStorage) {
      try {
        await prisma.agent.update({
          where: { id },
          data: { last_active_at: new Date() }
        });
      } catch (error) {
        console.error('[Agent Service] Failed to update last active:', error);
        // Don't throw error for this non-critical operation
      }
    } else {
      // Fallback to in-memory storage
      const agent = agentsStore.get(id);
      if (agent) {
        agent.last_active_at = new Date();
        agentsStore.set(id, agent);
      }
    }
  },

  /**
   * Pause all agents for an owner
   */
  async pauseAll(ownerAddress: string): Promise<number> {
    if (useDatabaseStorage) {
      try {
        const { count } = await prisma.agent.updateMany({
          where: {
            owner_address: ownerAddress.toLowerCase(),
            status: 'active'
          },
          data: {
            status: 'paused',
            auto_execute_enabled: false,
            updated_at: new Date()
          }
        });

        return count;
      } catch (error) {
        console.error('[Agent Service] Failed to pause all agents:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      let count = 0;
      for (const agent of agentsStore.values()) {
        if (agent.owner_address.toLowerCase() === ownerAddress.toLowerCase() && agent.status === 'active') {
          agent.status = 'paused';
          agent.auto_execute_enabled = false;
          agent.updated_at = new Date();
          agentsStore.set(agent.id, agent);
          count++;
        }
      }
      return count;
    }
  },

  /**
   * Resume all agents for an owner
   */
  async resumeAll(ownerAddress: string): Promise<number> {
    if (useDatabaseStorage) {
      try {
        const { count } = await prisma.agent.updateMany({
          where: {
            owner_address: ownerAddress.toLowerCase(),
            status: 'paused'
          },
          data: {
            status: 'active',
            updated_at: new Date()
          }
        });

        return count;
      } catch (error) {
        console.error('[Agent Service] Failed to resume all agents:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      let count = 0;
      for (const agent of agentsStore.values()) {
        if (agent.owner_address.toLowerCase() === ownerAddress.toLowerCase() && agent.status === 'paused') {
          agent.status = 'active';
          agent.updated_at = new Date();
          agentsStore.set(agent.id, agent);
          count++;
        }
      }
      return count;
    }
  },

  /**
   * Get agent count for an owner
   */
  async getCount(ownerAddress: string): Promise<{ total: number; active: number; paused: number }> {
    if (useDatabaseStorage) {
      try {
        const total = await prisma.agent.count({
          where: { owner_address: ownerAddress.toLowerCase() }
        });
        const active = await prisma.agent.count({
          where: { owner_address: ownerAddress.toLowerCase(), status: 'active' }
        });
        const paused = await prisma.agent.count({
          where: { owner_address: ownerAddress.toLowerCase(), status: 'paused' }
        });

        return { total, active, paused };
      } catch (error) {
        console.error('[Agent Service] Failed to get agent count:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      let total = 0;
      let active = 0;
      let paused = 0;

      for (const agent of agentsStore.values()) {
        if (agent.owner_address.toLowerCase() === ownerAddress.toLowerCase()) {
          total++;
          if (agent.status === 'active') active++;
          if (agent.status === 'paused') paused++;
        }
      }

      return { total, active, paused };
    }
  },

  // ============================================
  // DID / Agent Card Queries
  // ============================================

  /**
   * Get an agent by its Agent Card DID.
   * Used by the A2A protocol to resolve incoming messages.
   */
  async getAgentByDid(did: string): Promise<Agent | null> {
    if (!useDatabaseStorage) return null
    try {
      const card = await prisma.agentCard.findUnique({
        where: { did },
        select: { agent_id: true },
      })
      if (!card) return null
      return this.getById(card.agent_id)
    } catch (error) {
      console.error('[Agent Service] Failed to get agent by DID:', error)
      return null
    }
  },

  /**
   * Get an agent together with its Agent Card (if any).
   */
  async getAgentWithCard(id: string, ownerAddress: string): Promise<(Agent & { card?: unknown }) | null> {
    if (!useDatabaseStorage) return null
    try {
      const data = await prisma.agent.findFirst({
        where: { id, owner_address: ownerAddress.toLowerCase() },
        include: { card: true },
      })
      if (!data) return null
      return {
        ...data,
        type: data.type as AgentType,
        status: data.status as AgentStatus,
        auto_execute_rules: data.auto_execute_rules as AutoExecuteRules,
        last_active_at: data.last_active_at ?? undefined,
      }
    } catch (error) {
      console.error('[Agent Service] Failed to get agent with card:', error)
      return null
    }
  },

  // ============================================
  // Test Helpers (for unit tests)
  // ============================================

  /**
   * Clear all agents (for testing)
   */
  _clearAll(): void {
    agentsStore.clear();
    apiKeyToAgentId.clear();
  },

  /**
   * Get store size (for testing)
   */
  _getStoreSize(): number {
    return agentsStore.size;
  },
};

export default agentService;
