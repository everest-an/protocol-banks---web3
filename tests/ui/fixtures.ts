import { test as base, expect, type Page } from "@playwright/test"

export const test = base.extend<{ demoPage: Page }>({
  demoPage: async ({ page }, use) => {
    // Inject demo mode into localStorage before any page JS runs
    await page.addInitScript(() => {
      window.localStorage.setItem("protocol-bank-test-mode", "true")
    })
    await use(page)
  },
})

export { expect }
