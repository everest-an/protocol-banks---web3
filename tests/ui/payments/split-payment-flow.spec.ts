import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Split Payment - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/split-payment")
    await waitForPageReady(demoPage)
  })

  test("split payment page loads without crash", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
  })

  test("shows split payment content", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Split") ||
      content?.includes("Payment") ||
      content?.includes("split")
    ).toBeTruthy()
  })

  test("page has meaningful content", async ({ demoPage }) => {
    const bodyText = await demoPage.textContent("body")
    expect(bodyText!.length).toBeGreaterThan(100)
  })
})
