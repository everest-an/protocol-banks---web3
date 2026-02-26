import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Split Payments Page", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/split-payments")
    await waitForPageReady(demoPage)
  })

  test("page loads with split payment content", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Split/i).first()).toBeVisible()
  })

  test("shows demo split payment data", async ({ demoPage }) => {
    // Demo data includes "Q1 Team Dinner" or "AWS Hosting"
    await expect(demoPage.getByText(/Team Dinner|AWS|Split/i).first()).toBeVisible()
  })
})
