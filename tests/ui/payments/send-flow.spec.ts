import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Send Page - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/send")
    await waitForPageReady(demoPage)
  })

  test("displays Send Payment heading", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
    await expect(demoPage.getByRole("heading", { name: /Send Payment/i })).toBeVisible()
  })

  test("shows mode toggle - Personal and Business", async ({ demoPage }) => {
    await expect(demoPage.getByText("Personal").first()).toBeVisible()
    await expect(demoPage.getByText("Business").first()).toBeVisible()
  })

  test("Personal mode shows Send to Someone card", async ({ demoPage }) => {
    // Click Personal if not already selected
    await demoPage.getByText("Personal").first().click()
    await demoPage.waitForTimeout(300)
    await expect(demoPage.getByText("Send to Someone").first()).toBeVisible()
  })

  test("Personal mode shows Cross-Chain Transfer card", async ({ demoPage }) => {
    await demoPage.getByText("Personal").first().click()
    await demoPage.waitForTimeout(300)
    await expect(demoPage.getByText("Cross-Chain Transfer").first()).toBeVisible()
  })

  test("Business mode shows Batch Payment card", async ({ demoPage }) => {
    await demoPage.getByText("Business").first().click()
    await demoPage.waitForTimeout(300)
    await expect(demoPage.getByText("Batch Payment").first()).toBeVisible()
  })

  test("Business mode shows payment product cards", async ({ demoPage }) => {
    await demoPage.getByText("Business").first().click()
    await demoPage.waitForTimeout(300)
    // translateTerm() may localize individual labels, so accept any known card
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Batch Payment") ||
        content?.includes("Card Payment") ||
        content?.includes("Recurring Payments") ||
        content?.includes("Cross-Chain"),
    ).toBeTruthy()
  })

  test("Send to Someone card navigates to batch-payment", async ({ demoPage }) => {
    await demoPage.getByText("Personal").first().click()
    await demoPage.waitForTimeout(300)
    await demoPage.getByText("Send to Someone").first().click()
    await expect(demoPage).toHaveURL(/\/(batch-payment|pay)/)
  })

  test("Cross-Chain Transfer card navigates to the swap hub", async ({ demoPage }) => {
    await demoPage.getByText("Personal").first().click()
    await demoPage.waitForTimeout(300)
    await demoPage.getByText("Cross-Chain Transfer").first().click()
    // The old /omnichain hub was removed; the card now points at /swap
    await expect(demoPage).toHaveURL(/\/swap/)
  })
})
