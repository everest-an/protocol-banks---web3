import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Embed / SDK Page", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/embed")
    await waitForPageReady(demoPage)
  })

  test("page loads with embed content", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Embed|SDK/i).first()).toBeVisible()
  })

  test("has configuration inputs", async ({ demoPage }) => {
    const inputs = demoPage.locator("input")
    const inputCount = await inputs.count()
    expect(inputCount).toBeGreaterThanOrEqual(1)
  })

  test("shows embed code preview", async ({ demoPage }) => {
    // Should show an iframe or code snippet area
    await expect(demoPage.getByText(/iframe|embed|code|Pay Now/i).first()).toBeVisible()
  })
})
