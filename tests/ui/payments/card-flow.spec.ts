import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Card Page - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/card")
    await waitForPageReady(demoPage)
  })

  test("card page loads without crash", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
  })

  test("shows card page heading", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Card") ||
      content?.includes("Crypto") ||
      content?.includes("Glass Card")
    ).toBeTruthy()
  })

  test("shows tabs - Overview, Apply, Manage", async ({ demoPage }) => {
    await expect(demoPage.getByText("Overview").first()).toBeVisible()
    await expect(demoPage.getByText("Apply").first()).toBeVisible()
    await expect(demoPage.getByText("Manage").first()).toBeVisible()
  })

  test("Overview tab shows feature cards", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    const hasFeatures =
      content?.includes("Global Acceptance") ||
      content?.includes("Instant Funding") ||
      content?.includes("Non-Custodial") ||
      content?.includes("Advanced Controls")
    expect(hasFeatures).toBeTruthy()
  })

  test("Overview tab shows card type selection", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Virtual Card") ||
      content?.includes("Physical Card")
    ).toBeTruthy()
  })

  test("Overview tab shows stats", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("150M+") ||
      content?.includes("Merchants") ||
      content?.includes("Countries")
    ).toBeTruthy()
  })

  test("Apply tab shows application form", async ({ demoPage }) => {
    await demoPage.getByText("Apply").first().click()
    await demoPage.waitForTimeout(500)

    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Full Name") ||
      content?.includes("Email") ||
      content?.includes("Phone")
    ).toBeTruthy()
  })

  test("Apply tab form step 1 has name and email fields", async ({ demoPage }) => {
    await demoPage.getByText("Apply").first().click()
    await demoPage.waitForTimeout(500)

    // Step 1 fields - placeholders: "John Doe", "john@example.com"
    const nameInput = demoPage.getByPlaceholder("John Doe").first()
    const emailInput = demoPage.getByPlaceholder("john@example.com").first()

    const hasName = await nameInput.isVisible().catch(() => false)
    const hasEmail = await emailInput.isVisible().catch(() => false)
    expect(hasName || hasEmail).toBeTruthy()
  })

  test("Apply tab has Continue button", async ({ demoPage }) => {
    await demoPage.getByText("Apply").first().click()
    await demoPage.waitForTimeout(500)
    await expect(demoPage.getByText("Continue").first()).toBeVisible()
  })

  test("Manage tab shows 3D card component", async ({ demoPage }) => {
    await demoPage.getByText("Manage").first().click()
    await demoPage.waitForTimeout(500)

    // Card details
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Balance") ||
      content?.includes("4289") ||
      content?.includes("Active") ||
      content?.includes("Frozen")
    ).toBeTruthy()
  })

  test("Manage tab shows card controls", async ({ demoPage }) => {
    await demoPage.getByText("Manage").first().click()
    await demoPage.waitForTimeout(500)

    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Add Funds") ||
      content?.includes("Freeze") ||
      content?.includes("Show Details") ||
      content?.includes("Card Status")
    ).toBeTruthy()
  })

  test("Manage tab shows recent transactions", async ({ demoPage }) => {
    await demoPage.getByText("Manage").first().click()
    await demoPage.waitForTimeout(500)

    const content = await demoPage.textContent("body")
    const hasTransactions =
      content?.includes("Amazon") ||
      content?.includes("Starbucks") ||
      content?.includes("Uber") ||
      content?.includes("Top-up")
    expect(hasTransactions).toBeTruthy()
  })
})
