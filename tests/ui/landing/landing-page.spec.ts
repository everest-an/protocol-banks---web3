import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Landing Page", () => {
  test("shows hero with call-to-action buttons", async ({ demoPage }) => {
    await demoPage.goto("/")
    await waitForPageReady(demoPage)
    // Actual buttons: "Start Now" and "Try Live Test"
    await expect(demoPage.getByRole("button", { name: /Start Now/i }).or(demoPage.getByRole("link", { name: /Start Now/i }))).toBeVisible()
    await expect(demoPage.getByText(/Try Live Test/i)).toBeVisible()
  })

  test("Try Live Test navigates to dashboard", async ({ demoPage }) => {
    await demoPage.goto("/")
    await waitForPageReady(demoPage)
    await demoPage.getByText(/Try Live Test/i).click()
    await demoPage.waitForURL("**/dashboard")
    await expect(demoPage).toHaveURL(/\/dashboard/)
  })

  test("page has Protocol Bank branding", async ({ demoPage }) => {
    await demoPage.goto("/")
    await waitForPageReady(demoPage)
    await expect(demoPage.getByText(/Protocol Bank/i).first()).toBeVisible()
  })
})
