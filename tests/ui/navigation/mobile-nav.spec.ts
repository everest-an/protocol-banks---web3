import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Mobile Navigation", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test("sidebar is hidden on mobile", async ({ demoPage }) => {
    await demoPage.goto("/dashboard")
    await waitForPageReady(demoPage)
    const sidebar = demoPage.locator("aside").first()
    // Sidebar should be hidden on mobile viewport
    await expect(sidebar).toBeHidden()
  })

  test("mobile menu hamburger is visible", async ({ demoPage }) => {
    await demoPage.goto("/dashboard")
    await waitForPageReady(demoPage)
    // Look for hamburger/menu button in header
    const menuButton = demoPage.locator("header").getByRole("button").first()
    await expect(menuButton).toBeVisible()
  })

  test("bottom navigation is visible on mobile", async ({ demoPage }) => {
    await demoPage.goto("/dashboard")
    await waitForPageReady(demoPage)
    // Mobile nav should be a fixed bottom bar
    const mobileNav = demoPage.locator("nav").last()
    await expect(mobileNav).toBeVisible()
  })
})
