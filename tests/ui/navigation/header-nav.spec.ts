import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Header Navigation", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/balances")
    await waitForPageReady(demoPage)
  })

  test("header is visible", async ({ demoPage }) => {
    await expect(demoPage.locator("header")).toBeVisible()
  })

  test("TEST badge is shown in demo mode", async ({ demoPage }) => {
    // The header shows a "TEST" badge next to the logo
    await expect(demoPage.locator("header").getByText("TEST", { exact: true })).toBeVisible()
  })

  test("header has AI Trading nav item", async ({ demoPage }) => {
    await expect(demoPage.locator("header").getByText("AI Trading").first()).toBeVisible()
  })

  test("header has Wallet nav item", async ({ demoPage }) => {
    await expect(demoPage.locator("header").getByText("Wallet").first()).toBeVisible()
  })

  test("Transactions nav item navigates to /history", async ({ demoPage }) => {
    await demoPage.locator("header").locator("a", { hasText: "Transactions" }).first().click()
    await expect(demoPage).toHaveURL(/\/history/)
  })
})
