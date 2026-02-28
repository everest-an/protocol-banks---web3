import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Yield Page - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/yield")
    await waitForPageReady(demoPage)
  })

  test("yield page loads without crash", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
  })

  test("shows yield-related content", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Yield") ||
      content?.includes("APY") ||
      content?.includes("Earn") ||
      content?.includes("Stake") ||
      content?.includes("DeFi")
    ).toBeTruthy()
  })

  test("shows connect wallet prompt or yield dashboard", async ({ demoPage }) => {
    // Without wallet, shows connect prompt
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Connect your wallet") ||
      content?.includes("yield earnings") ||
      content?.includes("All Networks") ||
      content?.includes("Yield Dashboard")
    ).toBeTruthy()
  })

  test("page has meaningful content", async ({ demoPage }) => {
    const bodyText = await demoPage.textContent("body")
    expect(bodyText!.length).toBeGreaterThan(100)
  })
})
