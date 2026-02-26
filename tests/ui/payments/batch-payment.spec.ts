import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Batch Payment Page", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/batch-payment")
    await waitForPageReady(demoPage)
  })

  test("page loads with batch heading", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Batch/i).first()).toBeVisible()
  })

  test("avoids legacy unscoped draft key in localStorage", async ({ demoPage }) => {
    const keys = await demoPage.evaluate(() => Object.keys(localStorage))
    expect(keys).not.toContain("batchPaymentDraft")
  })

  test("has interactive elements", async ({ demoPage }) => {
    // Should have buttons for adding recipients or uploading CSV
    const buttons = demoPage.getByRole("button")
    const buttonCount = await buttons.count()
    expect(buttonCount).toBeGreaterThanOrEqual(1)
  })
})
