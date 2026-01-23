/**
 * Agent Authentication Middleware
 * 
 * Validates agent API keys and attaches agent context to requests.
 * Supports rate limiting per agent.
 * 
 * @module lib/middleware/agent-auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentService } from '@/lib/services/agent-service';

// ============================================
// Types
// ============================================

export interface AgentAuthContext {
  agentId: string;
  ownerAddress: string;
  agentName: string;
  agentType: string;
  autoExecuteEnabled: boolean;
}

export interface AgentAuthResult {
  success: boolean;
  context?: AgentAuthContext;
  error?: string;
  statusCode?: number;
}

// ============================================
// Rate Limiting (In-Memory)
// ============================================

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Check rate limit for an agent
 */
function checkRateLimit(agentId: string, limitPerMinute: number): { allowed: boolean; remaining: number; resetAt: Date } {
  const now = Date.now();
  const entry = rateLimitStore.get(agentId);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitStore.set(agentId, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: limitPerMinute - 1,
      resetAt: new Date(now + RATE_LIMIT_WINDOW_MS),
    };
  }

  if (entry.count >= limitPerMinute) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(entry.windowStart + RATE_LIMIT_WINDOW_MS),
    };
  }

  entry.count++;
  rateLimitStore.set(agentId, entry);

  return {
    allowed: true,
    remaining: limitPerMinute - entry.count,
    resetAt: new Date(entry.windowStart + RATE_LIMIT_WINDOW_MS),
  };
}

// ============================================
// Middleware Functions
// ============================================

/**
 * Extract agent API key from request headers
 */
export function extractAgentApiKey(req: NextRequest): string | null {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return null;
  }

  // Support "Bearer agent_xxx" format
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token.startsWith('agent_')) {
      return token;
    }
  }

  // Support direct "agent_xxx" format
  if (authHeader.startsWith('agent_')) {
    return authHeader;
  }

  return null;
}

/**
 * Validate agent authentication
 */
export async function validateAgentAuth(apiKey: string): Promise<AgentAuthResult> {
  // Validate API key format
  if (!apiKey || !apiKey.startsWith('agent_')) {
    return {
      success: false,
      error: 'Invalid agent API key format',
      statusCode: 401,
    };
  }

  // Validate with agent service
  const validation = await agentService.validate(apiKey);

  if (!validation.valid || !validation.agent) {
    return {
      success: false,
      error: validation.error || 'Invalid agent API key',
      statusCode: 401,
    };
  }

  const agent = validation.agent;

  // Check rate limit
  const rateLimit = checkRateLimit(agent.id, agent.rate_limit_per_minute);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Rate limit exceeded. Try again after ${rateLimit.resetAt.toISOString()}`,
      statusCode: 429,
    };
  }

  // Update last active
  await agentService.updateLastActive(agent.id);

  return {
    success: true,
    context: {
      agentId: agent.id,
      ownerAddress: agent.owner_address,
      agentName: agent.name,
      agentType: agent.type,
      autoExecuteEnabled: agent.auto_execute_enabled,
    },
  };
}

/**
 * Agent authentication middleware for API routes
 * 
 * Usage:
 * ```typescript
 * export async function POST(req: NextRequest) {
 *   const authResult = await agentAuthMiddleware(req);
 *   if (authResult) return authResult; // Error response
 *   
 *   const agentContext = getAgentContext(req);
 *   // ... handle request
 * }
 * ```
 */
export async function agentAuthMiddleware(req: NextRequest): Promise<NextResponse | null> {
  const apiKey = extractAgentApiKey(req);

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing agent API key. Use Authorization: Bearer agent_xxx' },
      { status: 401 }
    );
  }

  const result = await validateAgentAuth(apiKey);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.statusCode || 401 }
    );
  }

  // Attach context to request headers (for downstream handlers)
  // Note: In Next.js, we can't modify request headers directly,
  // so we return null and let the handler call getAgentContext
  return null;
}

/**
 * Get agent context from a validated request
 * Call this after agentAuthMiddleware returns null
 */
export async function getAgentContext(req: NextRequest): Promise<AgentAuthContext | null> {
  const apiKey = extractAgentApiKey(req);
  if (!apiKey) return null;

  const result = await validateAgentAuth(apiKey);
  if (!result.success) return null;

  return result.context || null;
}

/**
 * Middleware that supports both agent and user authentication
 * Returns agent context if agent auth, or null for user auth
 */
export async function dualAuthMiddleware(req: NextRequest): Promise<{
  type: 'agent' | 'user' | 'none';
  agentContext?: AgentAuthContext;
  error?: string;
}> {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return { type: 'none', error: 'No authorization header' };
  }

  // Check for agent auth
  if (authHeader.includes('agent_')) {
    const apiKey = extractAgentApiKey(req);
    if (apiKey) {
      const result = await validateAgentAuth(apiKey);
      if (result.success && result.context) {
        return { type: 'agent', agentContext: result.context };
      }
      return { type: 'none', error: result.error };
    }
  }

  // Check for user API key auth (pb_ prefix)
  if (authHeader.includes('pb_')) {
    return { type: 'user' };
  }

  // Assume session-based auth
  return { type: 'user' };
}

// ============================================
// Test Helpers
// ============================================

/**
 * Clear rate limit store (for testing)
 */
export function _clearRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Get rate limit entry (for testing)
 */
export function _getRateLimitEntry(agentId: string): RateLimitEntry | undefined {
  return rateLimitStore.get(agentId);
}

export default agentAuthMiddleware;
