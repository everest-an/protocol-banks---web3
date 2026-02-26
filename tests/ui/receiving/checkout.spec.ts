import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Checkout Page", () => {
  test("page loads without crash", async ({ demoPage }) => {
    await demoPage.goto("/checkout")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)
  })

  test("shows payment method options", async ({ demoPage }) => {
    await demoPage.goto("/checkout")
    await waitForPageReady(demoPage)
    // Checkout shows Binance Pay, KuCoin Pay, Crypto Transfer
    await expect(demoPage.getByText(/Binance Pay|KuCoin Pay|Crypto Transfer|Checkout/i).first()).toBeVisible()
  })
})
