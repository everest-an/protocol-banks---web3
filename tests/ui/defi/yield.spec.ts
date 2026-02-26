import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Yield Page", () => {
  test("page loads without crash", async ({ demoPage }) => {
    await demoPage.goto("/yield")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)
  })

  test("shows yield-related content", async ({ demoPage }) => {
    await demoPage.goto("/yield")
    await waitForPageReady(demoPage)
    await expect(demoPage.getByText(/Yield/i).first()).toBeVisible()
  })
})
