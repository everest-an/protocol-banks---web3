import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Swap Page - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/swap")
    await waitForPageReady(demoPage)
  })

  test("displays Cross-Chain Swap heading", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
    await expect(demoPage.getByRole("heading", { name: /Cross-Chain Swap/i })).toBeVisible()
  })

  test("shows source chain selector with Ethereum", async ({ demoPage }) => {
    await expect(demoPage.getByText("Ethereum").first()).toBeVisible()
  })

  test("shows source token selector", async ({ demoPage }) => {
    await expect(demoPage.getByText("ETH").first()).toBeVisible()
  })

  test("shows destination token USDC", async ({ demoPage }) => {
    await expect(demoPage.getByText("USDC").first()).toBeVisible()
  })

  test("has amount input field", async ({ demoPage }) => {
    const amountInput = demoPage.locator("input[type=number], input[placeholder*='0']").first()
    await expect(amountInput).toBeVisible()
  })

  test("can enter swap amount", async ({ demoPage }) => {
    const amountInput = demoPage.locator("input[type=number], input[placeholder*='0']").first()
    await amountInput.fill("1.5")
    await expect(amountInput).toHaveValue("1.5")
  })

  test("shows Available Routes panel", async ({ demoPage }) => {
    await expect(demoPage.getByText("Available Routes").first()).toBeVisible()
  })

  test("shows multiple chain options", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    const chainCount = [
      content?.includes("Ethereum"),
      content?.includes("Polygon"),
      content?.includes("Arbitrum"),
      content?.includes("Base"),
      content?.includes("BNB"),
    ].filter(Boolean).length
    expect(chainCount).toBeGreaterThanOrEqual(2)
  })

  test("shows multiple token options", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    const tokenCount = [
      content?.includes("ETH"),
      content?.includes("USDC"),
      content?.includes("USDT"),
    ].filter(Boolean).length
    expect(tokenCount).toBeGreaterThanOrEqual(2)
  })
})
