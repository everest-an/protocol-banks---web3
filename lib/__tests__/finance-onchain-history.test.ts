jest.mock("@/lib/finance/prices", () => ({
  getTokenUsdPrices: jest.fn(async () => ({ ETH: 2000, USDC: 1 })),
}))

import { collectOnchainHistoryRows } from "@/lib/finance/providers/onchain-history"

const wallet = "0x1111111111111111111111111111111111111111"
const other = "0x2222222222222222222222222222222222222222"

describe("finance onchain history", () => {
  const originalKey = process.env.ETHERSCAN_API_KEY
  const originalChains = process.env.ONCHAIN_HISTORY_CHAINS

  beforeEach(() => {
    process.env.ETHERSCAN_API_KEY = "test-key"
    process.env.ONCHAIN_HISTORY_CHAINS = "ethereum"
  })

  afterAll(() => {
    if (originalKey === undefined) delete process.env.ETHERSCAN_API_KEY
    else process.env.ETHERSCAN_API_KEY = originalKey
    if (originalChains === undefined) delete process.env.ONCHAIN_HISTORY_CHAINS
    else process.env.ONCHAIN_HISTORY_CHAINS = originalChains
  })

  it("maps native and token transfers with stable dedupe keys", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const result = url.includes("action=tokentx")
        ? [{
            hash: "0xdef",
            from: other,
            to: wallet,
            value: "2500000",
            tokenDecimal: "6",
            tokenSymbol: "USDC",
            timeStamp: "1700000100",
            transactionIndex: "2",
          }]
        : [{
            hash: "0xabc",
            from: wallet,
            to: other,
            value: "1000000000000000",
            timeStamp: "1700000000",
            isError: "0",
            transactionIndex: "1",
          }]
      return { ok: true, json: async () => ({ status: "1", result }) } as Response
    }) as jest.Mock

    const rows = await collectOnchainHistoryRows(wallet)
    expect(rows).toHaveLength(2)

    const native = rows.find((row) => row.metadata && (row.metadata as { native?: boolean }).native)
    const token = rows.find((row) => row.metadata && !(row.metadata as { native?: boolean }).native)

    expect(native).toMatchObject({
      source: "onchain",
      direction: "out",
      amount_usd: 2,
      dedupe_key: "onchain:ethereum:0xabc:ETH:native",
    })
    expect(token).toMatchObject({
      source: "onchain",
      direction: "in",
      amount_usd: 2.5,
      dedupe_key: "onchain:ethereum:0xdef:USDC:2",
    })
  })
})
