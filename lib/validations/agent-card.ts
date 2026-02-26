/**
 * Agent Card API Validation Schemas
 *
 * Zod schemas for Agent Card CRUD API input validation.
 */

import { z } from 'zod'
import { agentSkillSchema, authSchemeSchema } from '@/lib/a2a/types'

/** Create or update an Agent Card */
export const createAgentCardSchema = z.object({
  display_name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  capabilities: z.object({
    skills: z.array(agentSkillSchema).default([]),
    supported_protocols: z.array(z.enum(['a2a', 'mcp', 'x402'])).default(['a2a']),
  }),
  supported_tokens: z.array(z.string()).default([]),
  supported_chains: z.array(z.string()).default([]),
  a2a_endpoint: z.string().url().optional(),
  mcp_endpoint: z.string().url().optional(),
  auth_schemes: z.array(authSchemeSchema).optional(),
  is_public: z.boolean().default(false),
})

export type CreateAgentCardInput = z.infer<typeof createAgentCardSchema>

/** Sign an Agent Card */
export const signAgentCardSchema = z.object({
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid hex signature'),
})

/** Query public Agent Cards */
export const queryAgentCardsSchema = z.object({
  skill: z.string().optional(),
  token: z.string().optional(),
  chain: z.string().optional(),
  protocol: z.enum(['a2a', 'mcp', 'x402']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

/** Resolve external Agent Card by DID */
export const resolveAgentCardSchema = z.object({
  did: z.string().regex(/^did:pkh:eip155:\d+:0x[a-fA-F0-9]{40}$/, 'Invalid DID format'),
})

/** Format Zod error for API response */
export function formatValidationError(error: z.ZodError): string {
  return error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
}
