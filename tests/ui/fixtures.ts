import { test as base, expect, type Page } from "@playwright/test"

export const test = base.extend<{ demoPage: Page }>({
  demoPage: async ({ page }, use) => {
    // Inject demo mode into localStorage before any page JS runs
    await page.addInitScript(() => {
      window.localStorage.setItem("protocol-bank-test-mode", "true")
    })
    // eslint-disable-next-line react-hooks/rules-of-hooks -- `use` is Playwright's fixture callback, not React's use hook
    await use(page)
  },
})

export { expect }
