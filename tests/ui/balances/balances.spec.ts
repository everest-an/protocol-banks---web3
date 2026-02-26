import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Balances Page", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/balances")
    await waitForPageReady(demoPage)
  })

  test("displays demo balance total", async ({ demoPage }) => {
    await expect(demoPage.getByText(/145,450/)).toBeVisible()
  })

  test("shows chain names", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Ethereum/).first()).toBeVisible()
  })

  test("shows token symbols", async ({ demoPage }) => {
    await expect(demoPage.getByText("USDC").first()).toBeVisible()
  })

  test("tabs are interactive if present", async ({ demoPage }) => {
    const tabs = demoPage.getByRole("tab")
    const tabCount = await tabs.count()
    if (tabCount > 1) {
      await tabs.nth(1).click()
    }
  })
})
