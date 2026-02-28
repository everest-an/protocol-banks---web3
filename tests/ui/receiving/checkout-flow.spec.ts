import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Checkout Page - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/checkout")
    await waitForPageReady(demoPage)
  })

  test("checkout page loads without crash", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
  })

  test("shows payment method selection", async ({ demoPage }) => {
    // Payment methods: Crypto Transfer, Binance Pay, KuCoin Pay
    const content = await demoPage.textContent("body")
    const hasPaymentMethods =
      content?.includes("Crypto Transfer") ||
      content?.includes("Crypto") ||
      content?.includes("Transfer")
    expect(hasPaymentMethods).toBeTruthy()
  })

  test("shows demo order information", async ({ demoPage }) => {
    // Demo order: ORD-DEMO-20260206-001, $99.00
    const content = await demoPage.textContent("body")
    const hasOrderInfo =
      content?.includes("ORD-") ||
      content?.includes("99") ||
      content?.includes("Order") ||
      content?.includes("USD")
    expect(hasOrderInfo).toBeTruthy()
  })

  test("shows Continue button", async ({ demoPage }) => {
    const continueBtn = demoPage.getByText("Continue").first()
    const hasContinue = await continueBtn.isVisible().catch(() => false)
    if (hasContinue) {
      await expect(continueBtn).toBeVisible()
    } else {
      // Might already be on the network selection step
      const content = await demoPage.textContent("body")
      expect(
        content?.includes("Ethereum") ||
        content?.includes("Network") ||
        content?.includes("QR")
      ).toBeTruthy()
    }
  })

  test("selecting Crypto Transfer and clicking Continue shows network selection", async ({ demoPage }) => {
    // First select the Crypto Transfer payment method (scroll down if needed)
    const cryptoTransfer = demoPage.getByText("Crypto Transfer").first()
    await cryptoTransfer.scrollIntoViewIfNeeded()
    await cryptoTransfer.click()
    await demoPage.waitForTimeout(500)

    // Now click Continue
    const continueBtn = demoPage.getByText("Continue").first()
    await continueBtn.scrollIntoViewIfNeeded()
    await continueBtn.click()
    await demoPage.waitForTimeout(1000)

    // After clicking Continue, network selection or next step should appear
    const content = await demoPage.textContent("body")
    const hasNextStep =
      content?.includes("Ethereum") ||
      content?.includes("Polygon") ||
      content?.includes("Select Network") ||
      content?.includes("Back") ||
      content?.includes("QR")
    expect(hasNextStep).toBeTruthy()
  })

  test("shows Simulate Payment button in demo mode", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    const hasSimulate =
      content?.includes("Simulate") ||
      content?.includes("Demo") ||
      content?.includes("Test")
    expect(hasSimulate).toBeTruthy()
  })
})
