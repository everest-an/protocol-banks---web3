import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Settings Pages - Business Flows", () => {
  test("settings hub shows all setting categories", async ({ demoPage }) => {
    await demoPage.goto("/settings")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)

    const content = await demoPage.textContent("body")
    const hasCategories =
      content?.includes("API") ||
      content?.includes("Team") ||
      content?.includes("Billing") ||
      content?.includes("Webhook") ||
      content?.includes("Security")
    expect(hasCategories).toBeTruthy()
  })

  test("API Keys page shows key management", async ({ demoPage }) => {
    await demoPage.goto("/settings/api-keys")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)

    const content = await demoPage.textContent("body")
    expect(
      content?.includes("API") ||
      content?.includes("Key") ||
      content?.includes("Create")
    ).toBeTruthy()
  })

  test("Team page loads and shows connect prompt", async ({ demoPage }) => {
    await demoPage.goto("/settings/team")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)

    // Without wallet connected, shows connect prompt
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("connect your wallet") ||
      content?.includes("Team Management") ||
      content?.includes("manage teams")
    ).toBeTruthy()
  })

  test("Billing page shows billing info", async ({ demoPage }) => {
    await demoPage.goto("/settings/billing")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)

    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Billing") ||
      content?.includes("Plan") ||
      content?.includes("Subscription") ||
      content?.includes("Usage")
    ).toBeTruthy()
  })

  test("Webhooks page loads and shows connect prompt", async ({ demoPage }) => {
    await demoPage.goto("/settings/webhooks")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)

    // Without wallet connected, shows connect prompt
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("connect your wallet") ||
      content?.includes("Webhooks") ||
      content?.includes("manage webhooks")
    ).toBeTruthy()
  })

  test("Session Keys page loads", async ({ demoPage }) => {
    await demoPage.goto("/settings/session-keys")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)
  })
})
