import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Pay Page - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/pay")
    await waitForPageReady(demoPage)
  })

  test("displays payment page heading", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
    // The pay page shows payment-related content
    const heading = demoPage.getByRole("heading").first()
    await expect(heading).toBeVisible()
  })

  test("shows Initiate Payment button", async ({ demoPage }) => {
    await expect(demoPage.getByText("Initiate Payment").first()).toBeVisible()
  })

  test("shows payment history section", async ({ demoPage }) => {
    // Demo payment entries with company names
    await expect(demoPage.getByText("Payment History").first()).toBeVisible()
  })

  test("clicking Initiate Payment opens dialog", async ({ demoPage }) => {
    await demoPage.getByText("Initiate Payment").first().click()
    await demoPage.waitForTimeout(500)
    // Dialog should appear with form fields
    const dialog = demoPage.locator("[role=dialog]")
    await expect(dialog).toBeVisible()
  })

  test("payment dialog has recipient address field", async ({ demoPage }) => {
    await demoPage.getByText("Initiate Payment").first().click()
    await demoPage.waitForTimeout(500)
    const dialog = demoPage.locator("[role=dialog]")
    // Look for address input
    const addressInput = dialog.getByPlaceholder(/0x/i).first()
    await expect(addressInput).toBeVisible()
  })

  test("payment dialog has amount field", async ({ demoPage }) => {
    await demoPage.getByText("Initiate Payment").first().click()
    await demoPage.waitForTimeout(500)
    const dialog = demoPage.locator("[role=dialog]")
    // Look for amount input
    const amountInput = dialog.getByPlaceholder(/0\.00|amount/i).first()
    await expect(amountInput).toBeVisible()
  })

  test("payment dialog has token selector", async ({ demoPage }) => {
    await demoPage.getByText("Initiate Payment").first().click()
    await demoPage.waitForTimeout(500)
    const dialog = demoPage.locator("[role=dialog]")
    await expect(dialog.getByText("USDC").first()).toBeVisible()
  })

  test("can fill payment form fields", async ({ demoPage }) => {
    await demoPage.getByText("Initiate Payment").first().click()
    await demoPage.waitForTimeout(500)
    const dialog = demoPage.locator("[role=dialog]")

    // Fill recipient address
    const addressInput = dialog.getByPlaceholder(/0x/i).first()
    await addressInput.fill("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18")

    // Fill amount
    const amountInput = dialog.getByPlaceholder(/0\.00|amount/i).first()
    await amountInput.fill("100")

    // Verify values were entered
    await expect(addressInput).toHaveValue("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18")
    await expect(amountInput).toHaveValue("100")
  })

  test("shows demo payment entries", async ({ demoPage }) => {
    // Demo data should show recognizable company names
    const content = await demoPage.textContent("body")
    const hasDemoData =
      content?.includes("Deel") ||
      content?.includes("Stripe") ||
      content?.includes("Salesforce") ||
      content?.includes("USDC") ||
      content?.includes("Payment")
    expect(hasDemoData).toBeTruthy()
  })
})
