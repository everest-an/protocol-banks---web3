import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Sidebar Navigation", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/balances")
    await waitForPageReady(demoPage)
  })

  test("sidebar is visible on desktop viewport", async ({ demoPage }) => {
    const sidebar = demoPage.locator("aside").first()
    await expect(sidebar).toBeVisible()
  })

  test("sidebar has section toggles (Trading, Overview, Business)", async ({ demoPage }) => {
    const sidebar = demoPage.locator("aside")
    await expect(sidebar.getByRole("button", { name: "Trading" })).toBeVisible()
    await expect(sidebar.getByRole("button", { name: "Overview" })).toBeVisible()
    await expect(sidebar.getByRole("button", { name: /Business/ })).toBeVisible()
  })

  test("Business section is collapsed by default", async ({ demoPage }) => {
    const sidebar = demoPage.locator("aside")
    await expect(sidebar.getByText("Pay", { exact: true })).toBeHidden()
  })

  test("expanding Business reveals and navigates to /pay", async ({ demoPage }) => {
    const sidebar = demoPage.locator("aside")
    await sidebar.getByRole("button", { name: /Business/ }).click()
    await expect(sidebar.getByText("Pay", { exact: true })).toBeVisible()
    await sidebar.getByText("Pay", { exact: true }).click()
    await expect(demoPage).toHaveURL(/\/pay/)
  })

  test("expanding Business navigates to Contacts (/vendors)", async ({ demoPage }) => {
    const sidebar = demoPage.locator("aside")
    await sidebar.getByRole("button", { name: /Business/ }).click()
    await sidebar.getByText("Contacts").click()
    await expect(demoPage).toHaveURL(/\/vendors/)
  })

  test("expanding Business navigates to Swap (/swap)", async ({ demoPage }) => {
    const sidebar = demoPage.locator("aside")
    await sidebar.getByRole("button", { name: /Business/ }).click()
    await sidebar.getByText("Swap", { exact: true }).click()
    await expect(demoPage).toHaveURL(/\/swap/)
  })

  test("AI Trading link navigates to the cockpit", async ({ demoPage }) => {
    const sidebar = demoPage.locator("aside")
    await sidebar.getByText("AI Trading").click()
    await expect(demoPage).toHaveURL(/\/trading/)
  })
})
