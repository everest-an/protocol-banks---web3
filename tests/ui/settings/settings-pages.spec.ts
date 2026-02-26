import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash, SETTINGS_PAGES } from "../helpers"

test.describe("Settings Pages", () => {
  test("main settings page loads", async ({ demoPage }) => {
    await demoPage.goto("/settings")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)
    await expect(demoPage.getByText(/Settings/i).first()).toBeVisible()
  })

  test("API keys page loads", async ({ demoPage }) => {
    await demoPage.goto("/settings/api-keys")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)
    await expect(demoPage.getByText(/API/i).first()).toBeVisible()
  })

  test("webhooks page loads", async ({ demoPage }) => {
    await demoPage.goto("/settings/webhooks")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)
    await expect(demoPage.getByText(/Webhook/i).first()).toBeVisible()
  })

  test("team page loads", async ({ demoPage }) => {
    await demoPage.goto("/settings/team")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)
  })

  test("billing page loads", async ({ demoPage }) => {
    await demoPage.goto("/settings/billing")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)
  })
})
