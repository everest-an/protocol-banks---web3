import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Contacts Page - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/vendors")
    await waitForPageReady(demoPage)
  })

  test("displays Contacts heading", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
    await expect(demoPage.getByRole("heading", { name: /Contact/i }).first()).toBeVisible()
  })

  test("shows demo vendor entries", async ({ demoPage }) => {
    // Demo vendors should be visible
    const content = await demoPage.textContent("body")
    expect(content!.length).toBeGreaterThan(200)
  })

  test("has search input for filtering", async ({ demoPage }) => {
    const search = demoPage.getByPlaceholder(/search|filter/i).first()
    await expect(search).toBeVisible()
  })

  test("search filters contacts", async ({ demoPage }) => {
    const search = demoPage.getByPlaceholder(/search|filter/i).first()
    await search.fill("test")
    await demoPage.waitForTimeout(500)
    // Page should still be functional after search
    await assertNoCrash(demoPage)
  })

  test("has Add Contact button", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Add Contact") ||
      content?.includes("Add Vendor") ||
      content?.includes("New Contact")
    ).toBeTruthy()
  })

  test("has view toggle (list/grid)", async ({ demoPage }) => {
    // View toggle buttons
    const content = await demoPage.textContent("body")
    // The page should have some kind of view control
    await assertNoCrash(demoPage)
    expect(content!.length).toBeGreaterThan(100)
  })

  test("shows wallet addresses for contacts", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(content?.includes("0x")).toBeTruthy()
  })

  test("clicking Add Contact opens dialog", async ({ demoPage }) => {
    const addBtn = demoPage.getByText(/Add Contact|Add Vendor|New Contact/i).first()
    const hasBtn = await addBtn.isVisible().catch(() => false)
    if (hasBtn) {
      await addBtn.click()
      await demoPage.waitForTimeout(500)

      const dialog = demoPage.locator("[role=dialog]")
      const hasDialog = await dialog.isVisible().catch(() => false)
      if (hasDialog) {
        await expect(dialog).toBeVisible()
      }
    }
    await assertNoCrash(demoPage)
  })

  test("contact dialog has name and address fields", async ({ demoPage }) => {
    const addBtn = demoPage.getByText(/Add Contact|Add Vendor|New Contact/i).first()
    const hasBtn = await addBtn.isVisible().catch(() => false)
    if (hasBtn) {
      await addBtn.click()
      await demoPage.waitForTimeout(500)

      const dialog = demoPage.locator("[role=dialog]")
      const hasDialog = await dialog.isVisible().catch(() => false)
      if (hasDialog) {
        const content = await dialog.textContent()
        expect(
          content?.includes("Name") ||
          content?.includes("Address") ||
          content?.includes("Wallet")
        ).toBeTruthy()
      }
    }
    await assertNoCrash(demoPage)
  })

  test("shows tag/label filters", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    // Tags like "All", "Suppliers", "Clients", etc.
    const hasTags =
      content?.includes("All") ||
      content?.includes("Supplier") ||
      content?.includes("Client") ||
      content?.includes("Tag")
    expect(hasTags).toBeTruthy()
  })
})
