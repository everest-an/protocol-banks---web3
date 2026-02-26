/**
 * A2A Module — Entry Point
 *
 * Agent-to-Agent communication + ERC-8004 Agent Card system.
 */

// Types & DID utilities
export {
  generateDid,
  extractAddressFromDid,
  extractChainIdFromDid,
  agentCardSchema,
  agentSkillSchema,
  agentCapabilitiesSchema,
  getPlatformAgentCard,
} from './types'
export type { AgentCard, AgentSkill, AgentCapabilities } from './types'

// Message types
export {
  a2aEnvelopeSchema,
  A2A_METHODS,
  A2A_ERROR_CODES,
  createA2AResponse,
  createA2AError,
} from './message-types'
export type { A2AEnvelope, A2AMethod, A2AResponse } from './message-types'

// Message processing
export { routeA2AMessage } from './message-router'
export { verifyA2ASignature, canonicalizePayload } from './message-verifier'
