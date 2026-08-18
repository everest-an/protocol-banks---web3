import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Dashboard (merged into Wallet)", () => {
  test("redirects to the Wallet page", async ({ demoPage }) => {
    await demoPage.goto("/dashboard")
    await waitForPageReady(demoPage)
    // The legacy dashboard route now redirects to the merged Wallet view
    await expect(demoPage).toHaveURL(/\/balances/)
  })

  test("Wallet page shows total balance label", async ({ demoPage }) => {
    await demoPage.goto("/balances")
    await waitForPageReady(demoPage)
    await expect(demoPage.getByText("Total Balance")).toBeVisible()
  })

  test("Wallet page has Balances heading", async ({ demoPage }) => {
    await demoPage.goto("/balances")
    await waitForPageReady(demoPage)
    await expect(demoPage.getByRole("heading", { name: "Balances", level: 1 })).toBeVisible()
  })
})
