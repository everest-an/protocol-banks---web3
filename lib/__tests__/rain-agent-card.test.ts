const mockRain = {
  createUserApplication: jest.fn(),
  createUserContract: jest.fn(),
  getUserContracts: jest.fn(),
  issueCard: jest.fn(),
  getCardSecrets: jest.fn(),
  isConfigured: jest.fn(),
}

jest.mock("@/lib/services/rain-card.service", () => ({ rainCardService: mockRain }))

const mockGetAccount = jest.fn()
const mockSaveAccount = jest.fn()
jest.mock("@/lib/services/card-provider-account.service", () => ({
  getCardProviderAccount: (...args: unknown[]) => mockGetAccount(...args),
  saveCardProviderAccount: (...args: unknown[]) => mockSaveAccount(...args),
  toPublicCardProviderAccount: (record: unknown) => record,
}))

const mockPrisma = {
  agentVirtualCard: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
}
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import {
  issueRainCard,
  submitRainKyc,
  getRainCardSecrets,
} from "../services/rain-agent-card.service"

const OWNER = "0x" + "1".repeat(40)
const AGENT = "agent-1"
const ACCOUNT = {
  ownerAddress: OWNER,
  provider: "RAIN",
  providerUserId: "rain-user-1",
  status: "approved",
  rawStatus: "approved",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe("rain agent cards", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSaveAccount.mockImplementation(async (record) => record)
  })

  it("submits KYC and stores only the provider user id and status", async () => {
    mockRain.createUserApplication.mockResolvedValue({
      userId: "rain-user-1",
      applicationStatus: "approved",
    })

    const account = await submitRainKyc(OWNER, {
      firstName: "MUNING",
      lastName: "AN",
      email: "e@awareness.market",
      walletAddress: OWNER,
      birthDate: "1990-01-01",
      nationalId: "A1234567",
      countryOfIssue: "HK",
      address: { line1: "Unit 1021", city: "Hong Kong", region: "HK", postalCode: "000000", countryCode: "HK" },
      ipAddress: "127.0.0.1",
      phoneCountryCode: "+86",
      phoneNumber: "13653649378",
      annualSalary: "100000",
      accountPurpose: "agent payments",
      expectedMonthlyVolume: "50000",
      isTermsOfServiceAccepted: true,
    })

    expect(account.status).toBe("approved")
    expect(mockSaveAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerAddress: OWNER,
        provider: "RAIN",
        providerUserId: "rain-user-1",
      }),
    )
  })

  it("issues a Rain card for an agent with an approved account", async () => {
    mockGetAccount.mockResolvedValue(ACCOUNT)
    mockPrisma.agentVirtualCard.findUnique.mockResolvedValue(null)
    mockRain.issueCard.mockResolvedValue({ id: "rain-card-1", status: "active", last4: "4242" })
    mockPrisma.agentVirtualCard.create.mockResolvedValue({
      id: "db-card-1",
      agent_id: AGENT,
      card_provider: "RAIN",
      provider_card_id: "rain-card-1",
      last4: "4242",
      status: "ACTIVE",
      balance: 0,
      currency: "USD",
      label: "Agent card",
      created_at: new Date("2026-01-01"),
      updated_at: new Date("2026-01-01"),
    })

    const card = await issueRainCard(AGENT, OWNER, "Agent card")

    expect(card).toMatchObject({
      id: "db-card-1",
      provider: "RAIN",
      providerCardId: "rain-card-1",
      last4: "4242",
      status: "ACTIVE",
    })
    expect(mockRain.issueCard).toHaveBeenCalledWith("rain-user-1", {
      displayName: "Agent card",
    })
  })

  it("refuses to issue without a Rain account", async () => {
    mockGetAccount.mockResolvedValue(null)
    await expect(issueRainCard(AGENT, OWNER)).rejects.toThrow("Rain KYC is required")
  })

  it("relays encrypted secrets only for Rain cards", async () => {
    mockPrisma.agentVirtualCard.findFirst.mockResolvedValueOnce({
      id: "db-card-1",
      card_provider: "YATIVO",
      provider_card_id: "yativo-1",
      agent: { owner_address: OWNER },
    })
    await expect(getRainCardSecrets("db-card-1", OWNER, "session-1")).rejects.toThrow(
      "only available for Rain",
    )

    mockPrisma.agentVirtualCard.findFirst.mockResolvedValueOnce({
      id: "db-card-1",
      card_provider: "RAIN",
      provider_card_id: "rain-card-1",
      agent: { owner_address: OWNER },
    })
    mockRain.getCardSecrets.mockResolvedValue({ encryptedPan: "pan", encryptedCvc: "cvc" })

    await expect(getRainCardSecrets("db-card-1", OWNER, "session-1")).resolves.toEqual({
      encryptedPan: "pan",
      encryptedCvc: "cvc",
    })
  })
})
