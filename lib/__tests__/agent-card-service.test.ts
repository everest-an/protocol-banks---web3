/**
 * Agent Card Service Tests
 *
 * Tests for ERC-8004 Agent Card CRUD, DID generation,
 * signature verification, reputation tracking, and filtering.
 *
 * @module lib/__tests__/agent-card-service.test.ts
 */

// ============================================
// Mocks
// ============================================

const mockVerifyMessage = jest.fn()
jest.mock('viem', () => ({
  verifyMessage: (...args: unknown[]) => mockVerifyMessage(...args),
}))

const mockPrisma = {
  agent: {
    findUnique: jest.fn(),
  },
  agentCard: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
}
jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

import { agentCardService, type AgentCardRecord } from '../services/agent-card-service'

// ============================================
// Helpers
// ============================================

const ownerAddress = '0x1234567890abcdef1234567890abcdef12345678'
const agentId = 'agent-001'

function mockCardRecord(overrides?: Partial<AgentCardRecord>): AgentCardRecord {
  return {
    id: 'card-001',
    agent_id: agentId,
    did: `did:pkh:eip155:1:${ownerAddress}`,
    display_name: 'Test Agent',
    description: 'A test agent',
    version: '1.0',
    capabilities: { skills: [], supported_protocols: ['a2a'] },
    supported_tokens: ['USDC', 'USDT'],
    supported_chains: ['ethereum', 'base'],
    a2a_endpoint: 'https://example.com/api/a2a',
    mcp_endpoint: 'https://example.com/api/mcp',
    auth_schemes: [{ type: 'bearer', in: 'header', name: 'Authorization' }],
    reputation_score: 95.5,
    total_tasks: 100,
    completed_tasks: 96,
    owner_address: ownerAddress,
    signature: null,
    is_public: true,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-02-01'),
    ...overrides,
  }
}

const validInput = {
  display_name: 'Test Agent',
  description: 'A test agent',
  capabilities: { skills: [], supported_protocols: ['a2a' as const] },
  supported_tokens: ['USDC', 'USDT'],
  supported_chains: ['ethereum', 'base'],
  a2a_endpoint: 'https://example.com/api/a2a',
  mcp_endpoint: 'https://example.com/api/mcp',
  auth_schemes: [{ type: 'bearer' as const, in: 'header' as const, name: 'Authorization' }],
  is_public: true,
}

// ============================================
// Tests
// ============================================

describe('Agent Card Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createCard', () => {
    it('should create an agent card with generated DID', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({
        id: agentId,
        owner_address: ownerAddress,
      })
      mockPrisma.agentCard.create.mockResolvedValue(mockCardRecord())

      const result = await agentCardService.createCard(agentId, ownerAddress, validInput)

      expect(result.did).toContain('did:pkh:eip155:1:')
      expect(mockPrisma.agentCard.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agent_id: agentId,
          display_name: 'Test Agent',
          owner_address: ownerAddress,
          is_public: true,
        }),
      })
    })

    it('should throw if agent not found', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null)

      await expect(
        agentCardService.createCard(agentId, ownerAddress, validInput)
      ).rejects.toThrow('Agent not found')
    })

    it('should throw if owner does not match', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({
        id: agentId,
        owner_address: '0xdifferentaddress0000000000000000000000000',
      })

      await expect(
        agentCardService.createCard(agentId, ownerAddress, validInput)
      ).rejects.toThrow('Not authorized')
    })

    it('should use custom chain ID for DID', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({
        id: agentId,
        owner_address: ownerAddress,
      })
      mockPrisma.agentCard.create.mockImplementation(({ data }) => {
        return Promise.resolve({ ...mockCardRecord(), did: data.did })
      })

      const result = await agentCardService.createCard(agentId, ownerAddress, validInput, 137)
      expect(result.did).toContain(':137:')
    })
  })

  describe('getCard', () => {
    it('should return card by agent ID', async () => {
      const card = mockCardRecord()
      mockPrisma.agentCard.findUnique.mockResolvedValue(card)

      const result = await agentCardService.getCard(agentId)
      expect(result).toEqual(card)
      expect(mockPrisma.agentCard.findUnique).toHaveBeenCalledWith({
        where: { agent_id: agentId },
      })
    })

    it('should return null for non-existent card', async () => {
      mockPrisma.agentCard.findUnique.mockResolvedValue(null)

      const result = await agentCardService.getCard('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getCardByDid', () => {
    it('should return card by DID', async () => {
      const card = mockCardRecord()
      mockPrisma.agentCard.findUnique.mockResolvedValue(card)

      const did = `did:pkh:eip155:1:${ownerAddress}`
      const result = await agentCardService.getCardByDid(did)
      expect(result).toEqual(card)
    })
  })

  describe('updateCard', () => {
    it('should update card fields and invalidate signature', async () => {
      mockPrisma.agentCard.findUnique.mockResolvedValue(mockCardRecord())
      mockPrisma.agentCard.update.mockResolvedValue(mockCardRecord({
        display_name: 'Updated Name',
        signature: null,
      }))

      const result = await agentCardService.updateCard(agentId, ownerAddress, {
        display_name: 'Updated Name',
      })

      expect(mockPrisma.agentCard.update).toHaveBeenCalledWith({
        where: { agent_id: agentId },
        data: expect.objectContaining({
          display_name: 'Updated Name',
          signature: null, // invalidated
        }),
      })
    })

    it('should throw if card not found', async () => {
      mockPrisma.agentCard.findUnique.mockResolvedValue(null)

      await expect(
        agentCardService.updateCard(agentId, ownerAddress, { display_name: 'New' })
      ).rejects.toThrow('Agent Card not found')
    })

    it('should throw if owner does not match', async () => {
      mockPrisma.agentCard.findUnique.mockResolvedValue(mockCardRecord({
        owner_address: '0xdifferentaddress0000000000000000000000000',
      }))

      await expect(
        agentCardService.updateCard(agentId, ownerAddress, { display_name: 'New' })
      ).rejects.toThrow('Not authorized')
    })
  })

  describe('deleteCard', () => {
    it('should delete the card', async () => {
      mockPrisma.agentCard.findUnique.mockResolvedValue(mockCardRecord())
      mockPrisma.agentCard.delete.mockResolvedValue({})

      await agentCardService.deleteCard(agentId, ownerAddress)

      expect(mockPrisma.agentCard.delete).toHaveBeenCalledWith({
        where: { agent_id: agentId },
      })
    })

    it('should throw if card not found', async () => {
      mockPrisma.agentCard.findUnique.mockResolvedValue(null)

      await expect(
        agentCardService.deleteCard(agentId, ownerAddress)
      ).rejects.toThrow('Agent Card not found')
    })

    it('should throw if not authorized', async () => {
      mockPrisma.agentCard.findUnique.mockResolvedValue(mockCardRecord({
        owner_address: '0xdifferentaddress0000000000000000000000000',
      }))

      await expect(
        agentCardService.deleteCard(agentId, ownerAddress)
      ).rejects.toThrow('Not authorized')
    })
  })

  describe('signCard', () => {
    it('should store signature after verification', async () => {
      mockPrisma.agentCard.findUnique.mockResolvedValue(mockCardRecord())
      mockVerifyMessage.mockResolvedValue(true)
      mockPrisma.agentCard.update.mockResolvedValue(mockCardRecord({
        signature: '0xvalidsig',
      }))

      const result = await agentCardService.signCard(agentId, ownerAddress, '0xvalidsig')

      expect(result.signature).toBe('0xvalidsig')
      expect(mockVerifyMessage).toHaveBeenCalled()
      expect(mockPrisma.agentCard.update).toHaveBeenCalledWith({
        where: { agent_id: agentId },
        data: { signature: '0xvalidsig' },
      })
    })

    it('should throw if signature is invalid', async () => {
      mockPrisma.agentCard.findUnique.mockResolvedValue(mockCardRecord())
      mockVerifyMessage.mockResolvedValue(false)

      await expect(
        agentCardService.signCard(agentId, ownerAddress, '0xbadsig')
      ).rejects.toThrow('Invalid signature')
    })

    it('should throw if card not found', async () => {
      mockPrisma.agentCard.findUnique.mockResolvedValue(null)

      await expect(
        agentCardService.signCard(agentId, ownerAddress, '0xsig')
      ).rejects.toThrow('Agent Card not found')
    })
  })

  describe('buildSignableMessage', () => {
    it('should produce deterministic JSON', () => {
      const card = mockCardRecord()
      const msg1 = agentCardService.buildSignableMessage(card)
      const msg2 = agentCardService.buildSignableMessage(card)
      expect(msg1).toBe(msg2)
    })

    it('should include key card fields', () => {
      const card = mockCardRecord()
      const msg = agentCardService.buildSignableMessage(card)
      const parsed = JSON.parse(msg)

      expect(parsed.did).toBe(card.did)
      expect(parsed.display_name).toBe(card.display_name)
      expect(parsed.owner_address).toBe(card.owner_address)
      expect(parsed.supported_tokens).toEqual(card.supported_tokens)
    })
  })

  describe('verifyCardSignature', () => {
    it('should return true for valid signature', async () => {
      mockVerifyMessage.mockResolvedValue(true)
      const card = mockCardRecord({ signature: '0xvalidsig' })

      const result = await agentCardService.verifyCardSignature(card)
      expect(result).toBe(true)
    })

    it('should return false when no signature', async () => {
      const card = mockCardRecord({ signature: null })

      const result = await agentCardService.verifyCardSignature(card)
      expect(result).toBe(false)
    })

    it('should return false when verification fails', async () => {
      mockVerifyMessage.mockResolvedValue(false)
      const card = mockCardRecord({ signature: '0xbadsig' })

      const result = await agentCardService.verifyCardSignature(card)
      expect(result).toBe(false)
    })

    it('should return false when verifyMessage throws synchronously', async () => {
      mockVerifyMessage.mockImplementation(() => {
        throw new Error('crypto fail')
      })
      const card = mockCardRecord({ signature: '0xsig' })

      const result = await agentCardService.verifyCardSignature(card)
      expect(result).toBe(false)
    })

    it('should return false when verifyMessage rejects', async () => {
      mockVerifyMessage.mockRejectedValue(new Error('async crypto fail'))
      const card = mockCardRecord({ signature: '0xsig' })

      const result = await agentCardService.verifyCardSignature(card)
      expect(result).toBe(false)
    })
  })

  describe('listPublicCards', () => {
    it('should query public cards with pagination', async () => {
      mockPrisma.agentCard.findMany.mockResolvedValue([mockCardRecord()])
      mockPrisma.agentCard.count.mockResolvedValue(1)

      const result = await agentCardService.listPublicCards({ limit: 10, offset: 0 })

      expect(result.cards).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(mockPrisma.agentCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { is_public: true },
          take: 10,
          skip: 0,
        })
      )
    })

    it('should filter by token', async () => {
      mockPrisma.agentCard.findMany.mockResolvedValue([])
      mockPrisma.agentCard.count.mockResolvedValue(0)

      await agentCardService.listPublicCards({ token: 'usdc' })

      expect(mockPrisma.agentCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_public: true,
            supported_tokens: { has: 'USDC' },
          }),
        })
      )
    })

    it('should filter by chain', async () => {
      mockPrisma.agentCard.findMany.mockResolvedValue([])
      mockPrisma.agentCard.count.mockResolvedValue(0)

      await agentCardService.listPublicCards({ chain: 'Ethereum' })

      expect(mockPrisma.agentCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            supported_chains: { has: 'ethereum' },
          }),
        })
      )
    })

    it('should use default limit of 20', async () => {
      mockPrisma.agentCard.findMany.mockResolvedValue([])
      mockPrisma.agentCard.count.mockResolvedValue(0)

      await agentCardService.listPublicCards({})

      expect(mockPrisma.agentCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 })
      )
    })
  })

  describe('updateReputation', () => {
    it('should increment total_tasks and completed_tasks on success', async () => {
      mockPrisma.agentCard.findUnique.mockResolvedValue(mockCardRecord({
        total_tasks: 10,
        completed_tasks: 8,
      }))
      mockPrisma.agentCard.update.mockResolvedValue({})

      await agentCardService.updateReputation(agentId, true)

      expect(mockPrisma.agentCard.update).toHaveBeenCalledWith({
        where: { agent_id: agentId },
        data: {
          total_tasks: 11,
          completed_tasks: 9,
          reputation_score: expect.closeTo(81.82, 1), // 9/11 * 100
        },
      })
    })

    it('should only increment total_tasks on failure', async () => {
      mockPrisma.agentCard.findUnique.mockResolvedValue(mockCardRecord({
        total_tasks: 10,
        completed_tasks: 8,
      }))
      mockPrisma.agentCard.update.mockResolvedValue({})

      await agentCardService.updateReputation(agentId, false)

      expect(mockPrisma.agentCard.update).toHaveBeenCalledWith({
        where: { agent_id: agentId },
        data: {
          total_tasks: 11,
          completed_tasks: 8,
          reputation_score: expect.closeTo(72.73, 1), // 8/11 * 100
        },
      })
    })

    it('should do nothing if card not found', async () => {
      mockPrisma.agentCard.findUnique.mockResolvedValue(null)

      await agentCardService.updateReputation('nonexistent', true)

      expect(mockPrisma.agentCard.update).not.toHaveBeenCalled()
    })
  })

  describe('toPublicCard', () => {
    it('should convert DB record to public format', () => {
      const record = mockCardRecord()
      const card = agentCardService.toPublicCard(record, 'https://example.com')

      expect(card.did).toBe(record.did)
      expect(card.name).toBe(record.display_name)
      expect(card.url).toBe('https://example.com')
      expect(card.reputation).toEqual({
        score: 95.5,
        total_tasks: 100,
        completed_tasks: 96,
      })
    })

    it('should handle null optional fields', () => {
      const record = mockCardRecord({
        description: null,
        a2a_endpoint: null,
        mcp_endpoint: null,
        signature: null,
      })
      const card = agentCardService.toPublicCard(record)

      expect(card.description).toBeUndefined()
      expect(card.a2a_endpoint).toBeUndefined()
      expect(card.mcp_endpoint).toBeUndefined()
      expect(card.signature).toBeUndefined()
    })
  })
})
