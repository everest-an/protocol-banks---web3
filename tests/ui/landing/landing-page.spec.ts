import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Landing Page", () => {
  test("shows hero with call-to-action buttons", async ({ demoPage }) => {
    await demoPage.goto("/")
    await waitForPageReady(demoPage)
    // Two identical CTAs exist (hero + bottom) — assert the first
    await expect(demoPage.getByRole("button", { name: /Connect Wallet/i }).first()).toBeVisible()
    await expect(demoPage.getByRole("button", { name: /Try Paper Trading/i }).first()).toBeVisible()
  })

  test("shows the AI trading hero headline", async ({ demoPage }) => {
    await demoPage.goto("/")
    await waitForPageReady(demoPage)
    await expect(demoPage.getByRole("heading", { name: /Your AI trades/i })).toBeVisible()
  })

  test("Try Paper Trading navigates to the AI trading cockpit", async ({ demoPage }) => {
    await demoPage.goto("/")
    await waitForPageReady(demoPage)
    await demoPage.getByRole("button", { name: /Try Paper Trading/i }).first().click()
    await demoPage.waitForURL("**/trading")
    await expect(demoPage).toHaveURL(/\/trading/)
  })

  test("page has Protocol Bank branding", async ({ demoPage }) => {
    await demoPage.goto("/")
    await waitForPageReady(demoPage)
    await expect(demoPage.getByText(/Protocol Bank/i).first()).toBeVisible()
  })
})
