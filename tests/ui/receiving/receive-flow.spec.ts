import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Receive Page - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/receive")
    await waitForPageReady(demoPage)
  })

  test("displays Receive Payments heading", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
    await expect(demoPage.getByRole("heading", { name: /Receive/i }).first()).toBeVisible()
  })

  test("shows x402 payment link description", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("x402") ||
      content?.includes("payment link") ||
      content?.includes("secure")
    ).toBeTruthy()
  })

  test("has recipient address input", async ({ demoPage }) => {
    const addressInput = demoPage.getByPlaceholder(/0x|EVM|TRON/i).first()
    await expect(addressInput).toBeVisible()
  })

  test("has amount input", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Amount") ||
      content?.includes("amount")
    ).toBeTruthy()
  })

  test("has token dropdown", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("USDC") ||
      content?.includes("USDT") ||
      content?.includes("DAI")
    ).toBeTruthy()
  })

  test("has link expiry selector", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Expiry") ||
      content?.includes("expiry") ||
      content?.includes("1h") ||
      content?.includes("24h") ||
      content?.includes("7d")
    ).toBeTruthy()
  })

  test("has Copy Link button", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Copy Link/i).first()).toBeVisible()
  })

  test("has Show QR button", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("QR") ||
      content?.includes("Show QR") ||
      content?.includes("Hide QR")
    ).toBeTruthy()
  })

  test("can fill recipient address", async ({ demoPage }) => {
    const addressInput = demoPage.getByPlaceholder(/0x|EVM|TRON/i).first()
    await addressInput.fill("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18")
    await expect(addressInput).toHaveValue("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18")
  })

  test("shows security features info", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Signed") ||
      content?.includes("Security") ||
      content?.includes("x402") ||
      content?.includes("Verify")
    ).toBeTruthy()
  })
})
