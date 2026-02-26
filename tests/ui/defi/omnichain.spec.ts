import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Omnichain / Cross-Chain Hub Page", () => {
  test("displays Cross-Chain Hub heading", async ({ demoPage }) => {
    await demoPage.goto("/omnichain")
    await waitForPageReady(demoPage)
    await expect(demoPage.getByText("Cross-Chain Hub")).toBeVisible()
  })

  test("shows description text", async ({ demoPage }) => {
    await demoPage.goto("/omnichain")
    await waitForPageReady(demoPage)
    await expect(demoPage.getByText(/One address, all chains/i)).toBeVisible()
  })
})
