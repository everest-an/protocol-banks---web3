import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Transaction History Page", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/history")
    await waitForPageReady(demoPage)
  })

  test("displays Transaction History heading", async ({ demoPage }) => {
    await expect(demoPage.getByRole("heading", { name: "Transaction History" })).toBeVisible()
  })

  test("shows demo transactions with USDC", async ({ demoPage }) => {
    await expect(demoPage.getByText("USDC").first()).toBeVisible()
  })

  test("search field is present", async ({ demoPage }) => {
    const search = demoPage.getByPlaceholder(/Search/i)
    await expect(search).toBeVisible()
  })

  test("filter buttons exist", async ({ demoPage }) => {
    // Tab-like filter buttons: All, Sent, Received, Groups, Cross-Chain
    await expect(demoPage.getByText("Sent", { exact: true }).first()).toBeVisible()
    await expect(demoPage.getByText("Received", { exact: true }).first()).toBeVisible()
    await expect(demoPage.getByText("Cross-Chain", { exact: true }).first()).toBeVisible()
  })

  test("export CSV button is present", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Export CSV/i)).toBeVisible()
  })
})
