import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Vendors / Contacts Page", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/vendors")
    await waitForPageReady(demoPage)
  })

  test("displays Contacts heading", async ({ demoPage }) => {
    await expect(demoPage.getByRole("heading", { name: "Contacts" })).toBeVisible()
  })

  test("search field is present", async ({ demoPage }) => {
    const search = demoPage.getByPlaceholder(/Search/i)
    await expect(search).toBeVisible()
  })

  test("search field filters results", async ({ demoPage }) => {
    const search = demoPage.getByPlaceholder(/Search/i)
    await search.fill("APAC")
    // Should show filtered results
    await expect(demoPage.getByText("APAC").first()).toBeVisible()
  })

  test("view toggle controls are interactive", async ({ demoPage }) => {
    const networkDashboard = demoPage.getByTitle("Network Dashboard")
    const contactList = demoPage.getByTitle("Contact List")
    if (await networkDashboard.isVisible()) {
      await networkDashboard.click()
      await contactList.click()
      await expect(demoPage.getByRole("heading", { name: "Contacts" })).toBeVisible()
    }
  })

  test("add contact button exists", async ({ demoPage }) => {
    const addButton = demoPage.getByRole("button", { name: /Add|New/i }).first()
    await expect(addButton).toBeVisible()
  })
})
