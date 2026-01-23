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
  description?: string;
  type: AgentType;
  avatar_url?: string;
  api_key_hash: string;
  api_key_prefix: string;
  webhook_url?: string;
  webhook_secret_hash?: string;
  status: AgentStatus;
  auto_execute_enabled: boolean;
  auto_execute_rules?: AutoExecuteRules;
  rate_limit_per_minute: number;
  created_at: Date;
  updated_at: Date;
  last_active_at?: Date;
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
// In-Memory Storage (for testing/demo)
// ============================================

const agentsStore = new Map<string, Agent>();
const apiKeyToAgentId = new Map<string, string>();

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
    const agent: Agent = {
      id: generateId(),
      owner_address: input.owner_address,
      name: input.name.trim(),
      description: input.description,
      type: input.type || 'custom',
      avatar_url: input.avatar_url,
      api_key_hash: apiKeyHash,
      api_key_prefix: prefix,
      webhook_url: input.webhook_url,
      webhook_secret_hash: webhookSecretHash,
      status: 'active',
      auto_execute_enabled: input.auto_execute_enabled || false,
      auto_execute_rules: input.auto_execute_rules,
      rate_limit_per_minute: input.rate_limit_per_minute || 60,
      created_at: now,
      updated_at: now,
    };

    // Store agent
    agentsStore.set(agent.id, agent);
    apiKeyToAgentId.set(apiKeyHash, agent.id);

    return { agent, apiKey, webhookSecret };
  },

  /**
   * List all agents for an owner
   */
  async list(ownerAddress: string): Promise<Agent[]> {
    const agents: Agent[] = [];
    for (const agent of agentsStore.values()) {
      if (agent.owner_address.toLowerCase() === ownerAddress.toLowerCase()) {
        agents.push(agent);
      }
    }
    return agents.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  },

  /**
   * Get an agent by ID
   */
  async get(id: string, ownerAddress: string): Promise<Agent | null> {
    const agent = agentsStore.get(id);
    if (!agent) return null;
    if (agent.owner_address.toLowerCase() !== ownerAddress.toLowerCase()) {
      return null;
    }
    return agent;
  },

  /**
   * Get an agent by ID (internal, no owner check)
   */
  async getById(id: string): Promise<Agent | null> {
    return agentsStore.get(id) || null;
  },

  /**
   * Update an agent
   */
  async update(id: string, ownerAddress: string, input: UpdateAgentInput): Promise<Agent> {
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
  },

  /**
   * Deactivate an agent (soft delete)
   */
  async deactivate(id: string, ownerAddress: string): Promise<void> {
    const agent = await this.get(id, ownerAddress);
    if (!agent) {
      throw new Error('Agent not found');
    }

    agent.status = 'deactivated';
    agent.updated_at = new Date();
    agentsStore.set(id, agent);

    // Remove API key mapping
    apiKeyToAgentId.delete(agent.api_key_hash);
  },

  /**
   * Validate an agent API key
   */
  async validate(apiKey: string): Promise<AgentValidationResult> {
    // Check format
    if (!apiKey || !apiKey.startsWith('agent_')) {
      return { valid: false, error: 'Invalid API key format' };
    }

    // Hash and lookup
    const hash = hashApiKey(apiKey);
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
  },

  /**
   * Update last active timestamp
   */
  async updateLastActive(id: string): Promise<void> {
    const agent = agentsStore.get(id);
    if (agent) {
      agent.last_active_at = new Date();
      agentsStore.set(id, agent);
    }
  },

  /**
   * Pause all agents for an owner
   */
  async pauseAll(ownerAddress: string): Promise<number> {
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
  },

  /**
   * Resume all agents for an owner
   */
  async resumeAll(ownerAddress: string): Promise<number> {
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
  },

  /**
   * Get agent count for an owner
   */
  async getCount(ownerAddress: string): Promise<{ total: number; active: number; paused: number }> {
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
