import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Dashboard", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/dashboard")
    await waitForPageReady(demoPage)
  })

  test("displays total balance label", async ({ demoPage }) => {
    await expect(demoPage.getByText("Total Balance")).toBeVisible()
  })

  test("shows demo balance amount", async ({ demoPage }) => {
    await expect(demoPage.getByText(/145,450/)).toBeVisible()
  })

  test("shows quick action cards (Send, Receive, Swap, Batch)", async ({ demoPage }) => {
    await expect(demoPage.getByText("Send").first()).toBeVisible()
    await expect(demoPage.getByText("Receive").first()).toBeVisible()
    await expect(demoPage.getByText("Swap").first()).toBeVisible()
    await expect(demoPage.getByText("Batch").first()).toBeVisible()
  })

  test("Send quick action navigates to pay/send page", async ({ demoPage }) => {
    // The Send card is a link wrapping the card content
    const sendCard = demoPage.locator("a", { hasText: "Send" }).first()
    await sendCard.click()
    await expect(demoPage).toHaveURL(/\/pay|\/send/)
  })

  test("recent activity section is visible", async ({ demoPage }) => {
    await expect(demoPage.getByText("Recent Activity")).toBeVisible()
  })

  test("products section is visible", async ({ demoPage }) => {
    await expect(demoPage.getByText("Products").first()).toBeVisible()
  })

  test("View Details navigates to balances", async ({ demoPage }) => {
    await demoPage.getByText("View Details").first().click()
    await expect(demoPage).toHaveURL(/\/balances/)
  })
})
