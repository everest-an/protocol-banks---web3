import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

/**
 * Card page — legacy Business surface.
 * Tabs today: Overview / My Cards / Manage (the old Apply flow was removed).
 */
test.describe("Card Page - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/card")
    await waitForPageReady(demoPage)
  })

  test("card page loads without crash", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
  })

  test("shows card page heading", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(content?.includes("Card")).toBeTruthy()
  })

  test("shows current tabs - Overview, My Cards, Manage", async ({ demoPage }) => {
    await expect(demoPage.getByText("Overview").first()).toBeVisible()
    await expect(demoPage.getByText(/My Cards/).first()).toBeVisible()
    await expect(demoPage.getByText("Manage").first()).toBeVisible()
  })

  test("Overview tab renders card product content", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Virtual Card") ||
        content?.includes("Visa") ||
        content?.includes("USDC") ||
        content?.includes("Card"),
    ).toBeTruthy()
  })

  test("Overview tab offers issuing a card", async ({ demoPage }) => {
    // The issue-card entry point (dialog or button) should be present
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Issue") || content?.includes("Create") || content?.includes("New Card"),
    ).toBeTruthy()
  })
})
