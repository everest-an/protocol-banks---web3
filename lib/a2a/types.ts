/**
 * A2A + ERC-8004 — Shared Types & Zod Schemas
 *
 * Defines Agent Card schema (ERC-8004 compatible), DID types,
 * and capability definitions used across the A2A system.
 */

import { z } from 'zod'

// ─── DID Utilities ──────────────────────────────────────────────────

/**
 * Generate a DID for an EVM address using the PKH method.
 * Format: did:pkh:eip155:<chainId>:<address>
 */
export function generateDid(address: string, chainId: number = 1): string {
  return `did:pkh:eip155:${chainId}:${address.toLowerCase()}`
}

/**
 * Extract the address from a PKH DID.
 * Returns null if the DID format is invalid.
 */
export function extractAddressFromDid(did: string): string | null {
  const match = did.match(/^did:pkh:eip155:\d+:(0x[a-fA-F0-9]{40})$/)
  return match ? match[1].toLowerCase() : null
}

/**
 * Extract chain ID from a PKH DID.
 */
export function extractChainIdFromDid(did: string): number | null {
  const match = did.match(/^did:pkh:eip155:(\d+):0x[a-fA-F0-9]{40}$/)
  return match ? parseInt(match[1], 10) : null
}

// ─── Zod Schemas ────────────────────────────────────────────────────

export const didSchema = z.string().regex(
  /^did:pkh:eip155:\d+:0x[a-fA-F0-9]{40}$/,
  'Invalid DID format. Expected: did:pkh:eip155:<chainId>:<address>'
)

export const agentSkillSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  tags: z.array(z.string()).default([]),
  examples: z.array(z.string()).optional(),
})

export const authSchemeSchema = z.object({
  type: z.enum(['apiKey', 'bearer', 'oauth2']),
  in: z.enum(['header', 'query']).optional(),
  name: z.string().optional(),
})

export const agentCapabilitiesSchema = z.object({
  skills: z.array(agentSkillSchema).default([]),
  supported_protocols: z.array(
    z.enum(['a2a', 'mcp', 'x402'])
  ).default(['a2a']),
})

export const agentCardSchema = z.object({
  did: didSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  version: z.string().default('1.0'),
  url: z.string().url().optional(),
  capabilities: agentCapabilitiesSchema,
  supported_tokens: z.array(z.string()).default([]),
  supported_chains: z.array(z.string()).default([]),
  a2a_endpoint: z.string().url().optional(),
  mcp_endpoint: z.string().url().optional(),
  auth_schemes: z.array(authSchemeSchema).optional(),
  reputation: z.object({
    score: z.number().min(0).max(100).default(0),
    total_tasks: z.number().int().default(0),
    completed_tasks: z.number().int().default(0),
  }).optional(),
  owner_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/i, 'Invalid EVM address'),
  signature: z.string().optional(),
})

// ─── TypeScript Types ───────────────────────────────────────────────

export type AgentCard = z.infer<typeof agentCardSchema>
export type AgentSkill = z.infer<typeof agentSkillSchema>
export type AgentCapabilities = z.infer<typeof agentCapabilitiesSchema>

/** Platform's default Agent Card — describes Protocol Banks as a payment agent */
export function getPlatformAgentCard(baseUrl: string): AgentCard {
  return {
    did: generateDid('0x0000000000000000000000000000000000000001', 1),
    name: 'Protocol Banks Payment Agent',
    description: 'Non-custodial stablecoin payment infrastructure. Supports USDC/USDT across Ethereum, Base, Polygon, Arbitrum, Optimism, and TRON.',
    version: '1.0',
    url: baseUrl,
    capabilities: {
      skills: [
        {
          id: 'payment',
          name: 'Stablecoin Payment',
          description: 'Send stablecoin payments to any wallet address across multiple chains.',
          tags: ['payment', 'usdc', 'usdt', 'stablecoin', 'cross-chain'],
          examples: ['Send 100 USDC to 0x...', 'Transfer 500 USDT on Base'],
        },
        {
          id: 'invoice',
          name: 'Invoice Creation',
          description: 'Create invoices for receiving payments with QR codes and payment links.',
          tags: ['invoice', 'receive', 'billing'],
          examples: ['Create invoice for $250', 'Generate payment link'],
        },
        {
          id: 'batch_payment',
          name: 'Batch Payment',
          description: 'Send payments to multiple recipients in a single transaction.',
          tags: ['batch', 'payroll', 'bulk'],
          examples: ['Pay 10 employees', 'Distribute rewards to holders'],
        },
        {
          id: 'x402',
          name: 'x402 Micropayment',
          description: 'HTTP 402-based machine-to-machine micropayments.',
          tags: ['x402', 'micropayment', 'api', 'machine-to-machine'],
          examples: ['Pay-per-API-call', 'Streaming payment for AI compute'],
        },
      ],
      supported_protocols: ['a2a', 'mcp', 'x402'],
    },
    supported_tokens: ['USDC', 'USDT', 'DAI', 'ETH'],
    supported_chains: ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'tron'],
    a2a_endpoint: `${baseUrl}/api/a2a`,
    mcp_endpoint: `${baseUrl}/api/mcp`,
    auth_schemes: [
      { type: 'bearer', in: 'header', name: 'Authorization' },
      { type: 'apiKey', in: 'header', name: 'x-api-key' },
    ],
    owner_address: '0x0000000000000000000000000000000000000001',
  }
}
