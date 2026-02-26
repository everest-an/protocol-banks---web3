import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Pay Page", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/pay")
    await waitForPageReady(demoPage)
  })

  test("renders Payments heading", async ({ demoPage }) => {
    await expect(demoPage.getByText("Payments").first()).toBeVisible()
  })

  test("has Initiate Payment button", async ({ demoPage }) => {
    await expect(demoPage.getByRole("button", { name: /Initiate Payment/i })).toBeVisible()
  })

  test("shows payment history", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Payment History/i)).toBeVisible()
  })

  test("shows demo payment entries", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Deel|Stripe|Salesforce|USDC|USDT/i).first()).toBeVisible()
  })
})
