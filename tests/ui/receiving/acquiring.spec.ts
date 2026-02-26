import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Acquiring Hub Page", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/acquiring")
    await waitForPageReady(demoPage)
  })

  test("page loads with acquiring content", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Acquiring|Merchant/i).first()).toBeVisible()
  })

  test("shows demo stats", async ({ demoPage }) => {
    // DEMO_STATS: totalOrders=47
    await expect(demoPage.getByText("47").first()).toBeVisible()
  })
})
