import { test, expect } from "@playwright/test"

test.describe("Vendors graph smoke", () => {
  test("tag filter links list and graph stats", async ({ page }) => {
    await page.goto("/vendors")

    const whaleFilter = page.getByRole("button", { name: /Whale\s*\(\d+\)/ })
    const whaleLabel = (await whaleFilter.textContent()) || "Whale (0)"
    const whaleCount = Number(whaleLabel.match(/\((\d+)\)/)?.[1] || "0")

    await whaleFilter.click()

    const totalContactsCard = page.locator("div").filter({ hasText: /^Total Contacts/ }).first()
    await expect(totalContactsCard).toContainText(String(whaleCount))
  })

  test("view toggle controls are interactive", async ({ page }) => {
    await page.goto("/vendors")

    const contactsHeading = page.getByRole("heading", { name: "Contacts" })
    await expect(contactsHeading).toBeVisible()

    await page.getByTitle("Network Dashboard").click()
    await page.getByTitle("Contact List").click()

    await expect(contactsHeading).toBeVisible()
  })

  test("batch page avoids legacy unscoped draft key", async ({ page }) => {
    await page.goto("/batch-payment")

    const keys = await page.evaluate(() => Object.keys(localStorage))
    expect(keys).not.toContain("batchPaymentDraft")
  })
})
