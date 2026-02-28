import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Subscriptions (Auto Pay) - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/subscriptions")
    await waitForPageReady(demoPage)
  })

  test("displays Auto Pay heading", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
    await expect(demoPage.getByRole("heading", { name: /Auto Pay/i })).toBeVisible()
  })

  test("shows stats cards", async ({ demoPage }) => {
    // Stats: Active, Next Payment, Monthly Total, etc.
    const content = await demoPage.textContent("body")
    const hasStats =
      content?.includes("Active") ||
      content?.includes("Next Payment") ||
      content?.includes("Monthly Total") ||
      content?.includes("Remaining Quota")
    expect(hasStats).toBeTruthy()
  })

  test("shows filter tabs - All, Enterprise, Individual", async ({ demoPage }) => {
    await expect(demoPage.getByText("All").first()).toBeVisible()
    // Enterprise and Individual tabs
    const content = await demoPage.textContent("body")
    const hasTabs =
      content?.includes("Enterprise") && content?.includes("Individual")
    expect(hasTabs).toBeTruthy()
  })

  test("New Auto Pay button is visible", async ({ demoPage }) => {
    await expect(demoPage.getByText(/New Auto Pay/i).first()).toBeVisible()
  })

  test("clicking New Auto Pay opens dialog", async ({ demoPage }) => {
    await demoPage.getByText(/New Auto Pay/i).first().click()
    await demoPage.waitForTimeout(500)
    const dialog = demoPage.locator("[role=dialog]")
    await expect(dialog).toBeVisible()
  })

  test("create dialog has Individual/Enterprise toggle", async ({ demoPage }) => {
    await demoPage.getByText(/New Auto Pay/i).first().click()
    await demoPage.waitForTimeout(500)
    const dialog = demoPage.locator("[role=dialog]")
    await expect(dialog.getByText("Individual").first()).toBeVisible()
    await expect(dialog.getByText("Enterprise").first()).toBeVisible()
  })

  test("create dialog has amount and token fields", async ({ demoPage }) => {
    await demoPage.getByText(/New Auto Pay/i).first().click()
    await demoPage.waitForTimeout(500)
    const dialog = demoPage.locator("[role=dialog]")
    // Amount input
    const amountInput = dialog.locator("input[type=number], input[placeholder*='0']").first()
    await expect(amountInput).toBeVisible()
    // Token selector
    await expect(dialog.getByText("USDC").first()).toBeVisible()
  })

  test("create dialog has frequency selector", async ({ demoPage }) => {
    await demoPage.getByText(/New Auto Pay/i).first().click()
    await demoPage.waitForTimeout(500)
    const dialog = demoPage.locator("[role=dialog]")
    // Frequency: Daily, Weekly, Monthly, Yearly
    const content = await dialog.textContent()
    const hasFrequency =
      content?.includes("Daily") ||
      content?.includes("Weekly") ||
      content?.includes("Monthly") ||
      content?.includes("Frequency")
    expect(hasFrequency).toBeTruthy()
  })

  test("create dialog has chain selector", async ({ demoPage }) => {
    await demoPage.getByText(/New Auto Pay/i).first().click()
    await demoPage.waitForTimeout(500)
    const dialog = demoPage.locator("[role=dialog]")
    const content = await dialog.textContent()
    const hasChain =
      content?.includes("Ethereum") ||
      content?.includes("Base") ||
      content?.includes("Chain") ||
      content?.includes("Arbitrum")
    expect(hasChain).toBeTruthy()
  })

  test("create dialog has recipient address field", async ({ demoPage }) => {
    await demoPage.getByText(/New Auto Pay/i).first().click()
    await demoPage.waitForTimeout(500)
    const dialog = demoPage.locator("[role=dialog]")
    const addressInput = dialog.getByPlaceholder(/0x|address|recipient/i).first()
    await expect(addressInput).toBeVisible()
  })

  test("can fill Individual subscription form", async ({ demoPage }) => {
    await demoPage.getByText(/New Auto Pay/i).first().click()
    await demoPage.waitForTimeout(500)
    const dialog = demoPage.locator("[role=dialog]")

    // Click Individual tab
    await dialog.getByText("Individual").first().click()
    await demoPage.waitForTimeout(300)

    // Fill name field
    const nameInput = dialog.locator("input").first()
    await nameInput.fill("Netflix Subscription")
    await expect(nameInput).toHaveValue("Netflix Subscription")
  })
})
