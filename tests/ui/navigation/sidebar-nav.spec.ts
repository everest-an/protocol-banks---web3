import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Sidebar Navigation", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/dashboard")
    await waitForPageReady(demoPage)
  })

  test("sidebar is visible on desktop viewport", async ({ demoPage }) => {
    const sidebar = demoPage.locator("aside").first()
    await expect(sidebar).toBeVisible()
  })

  test("sidebar has section headers", async ({ demoPage }) => {
    const sidebar = demoPage.locator("aside")
    // Section headers are h3 elements with CSS text-transform: uppercase
    await expect(sidebar.locator("h3", { hasText: "Overview" })).toBeVisible()
    await expect(sidebar.locator("h3", { hasText: "Payments" })).toBeVisible()
    await expect(sidebar.locator("h3", { hasText: "Receiving" })).toBeVisible()
  })

  test("clicking Contacts navigates to /vendors", async ({ demoPage }) => {
    await demoPage.locator("aside").getByText("Contacts").click()
    await expect(demoPage).toHaveURL(/\/vendors/)
  })

  test("clicking Pay navigates to /pay", async ({ demoPage }) => {
    await demoPage.locator("aside").getByText("Pay", { exact: true }).click()
    await expect(demoPage).toHaveURL(/\/pay/)
  })

  test("clicking Swap navigates to /swap", async ({ demoPage }) => {
    await demoPage.locator("aside").getByText("Swap").click()
    await expect(demoPage).toHaveURL(/\/swap/)
  })
})
