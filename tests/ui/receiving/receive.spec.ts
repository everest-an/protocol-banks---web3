import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Receive / Payment Links Page", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/receive")
    await waitForPageReady(demoPage)
  })

  test("page loads with receive content", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Payment Link|Receive/i).first()).toBeVisible()
  })

  test("has amount input field", async ({ demoPage }) => {
    const inputs = demoPage.locator("input")
    const inputCount = await inputs.count()
    expect(inputCount).toBeGreaterThanOrEqual(1)
  })
})
