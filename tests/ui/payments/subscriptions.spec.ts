import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("Subscriptions / Auto Pay Page", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/subscriptions")
    await waitForPageReady(demoPage)
  })

  test("shows Auto Pay heading", async ({ demoPage }) => {
    await expect(demoPage.getByRole("heading", { name: "Auto Pay" })).toBeVisible()
  })

  test("shows demo subscriptions", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Netflix|Spotify|AWS/i).first()).toBeVisible()
  })

  test("create button exists", async ({ demoPage }) => {
    const createButton = demoPage.getByRole("button", { name: /Create|Add|New/i }).first()
    await expect(createButton).toBeVisible()
  })

  test("create dialog opens on click", async ({ demoPage }) => {
    const createButton = demoPage.getByRole("button", { name: /Create|Add|New/i }).first()
    await createButton.click()
    await expect(demoPage.getByRole("dialog")).toBeVisible()
  })
})
