import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Public Pages", () => {
  test("help page loads with guide content", async ({ demoPage }) => {
    await demoPage.goto("/help")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)
    await expect(demoPage.getByText("Usage Guide").first()).toBeVisible()
    await expect(demoPage.getByText("Getting Started")).toBeVisible()
  })

  test("privacy page loads", async ({ demoPage }) => {
    await demoPage.goto("/privacy")
    await waitForPageReady(demoPage)
    await expect(demoPage.getByRole("heading", { name: "Privacy Policy" })).toBeVisible()
  })

  test("terms page loads", async ({ demoPage }) => {
    await demoPage.goto("/terms")
    await waitForPageReady(demoPage)
    await expect(demoPage.getByRole("heading", { name: "Terms of Service" })).toBeVisible()
  })

  test("whitepaper page loads", async ({ demoPage }) => {
    await demoPage.goto("/whitepaper")
    await waitForPageReady(demoPage)
    await expect(demoPage.getByText("Protocol Bank Whitepaper")).toBeVisible()
  })

  test("contact page loads with form", async ({ demoPage }) => {
    await demoPage.goto("/contact")
    await waitForPageReady(demoPage)
    await expect(demoPage.getByRole("heading", { name: "Contact Us" })).toBeVisible()
  })

  test("security page loads", async ({ demoPage }) => {
    await demoPage.goto("/security")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)
  })

  test("fees page loads", async ({ demoPage }) => {
    await demoPage.goto("/fees")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)
  })
})
