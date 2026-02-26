import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("POS Terminal Page", () => {
  test("page loads without crash", async ({ demoPage }) => {
    await demoPage.goto("/terminal")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)
  })

  test("shows POS terminal UI", async ({ demoPage }) => {
    await demoPage.goto("/terminal")
    await waitForPageReady(demoPage)
    // Default merchant: "Protocol Banks POS"
    await expect(demoPage.getByText(/Terminal|POS|Protocol Banks/i).first()).toBeVisible()
  })
})
