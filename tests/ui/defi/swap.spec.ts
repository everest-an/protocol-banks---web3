import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Swap Page", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/swap")
    await waitForPageReady(demoPage)
  })

  test("displays Cross-Chain Swap heading", async ({ demoPage }) => {
    await expect(demoPage.getByRole("heading", { name: /Cross-Chain Swap/i })).toBeVisible()
  })

  test("shows chain selectors", async ({ demoPage }) => {
    await expect(demoPage.getByText("Ethereum").first()).toBeVisible()
  })

  test("shows token selectors", async ({ demoPage }) => {
    await expect(demoPage.getByText("ETH").first()).toBeVisible()
    await expect(demoPage.getByText("USDC").first()).toBeVisible()
  })

  test("shows Available Routes panel", async ({ demoPage }) => {
    await expect(demoPage.getByText("Available Routes").first()).toBeVisible()
  })
})
