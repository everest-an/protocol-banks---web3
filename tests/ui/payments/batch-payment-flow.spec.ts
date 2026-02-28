import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Batch Payment - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/batch-payment")
    await waitForPageReady(demoPage)
  })

  test("displays Batch Payment heading", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
    await expect(demoPage.getByRole("heading", { name: /Batch Payment/i })).toBeVisible()
  })

  test("shows Create Batch Payment button", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Create Batch Payment/i).first()).toBeVisible()
  })

  test("shows batch payment management content", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("batch") ||
      content?.includes("Batch") ||
      content?.includes("payment") ||
      content?.includes("Payment")
    ).toBeTruthy()
  })

  test("shows token selection", async ({ demoPage }) => {
    // Token options should be visible in the form
    const content = await demoPage.textContent("body")
    const hasTokenOption =
      content?.includes("USDC") ||
      content?.includes("USDT") ||
      content?.includes("DAI")
    expect(hasTokenOption).toBeTruthy()
  })

  test("has batch action buttons", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    const hasBatchAction =
      content?.includes("Create Batch") ||
      content?.includes("Add Recipient") ||
      content?.includes("Execute") ||
      content?.includes("Approve")
    expect(hasBatchAction).toBeTruthy()
  })

  test("shows tabs for Details/Verification/History", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    const hasTab =
      content?.includes("Details") ||
      content?.includes("Verification") ||
      content?.includes("History")
    expect(hasTab).toBeTruthy()
  })
})
