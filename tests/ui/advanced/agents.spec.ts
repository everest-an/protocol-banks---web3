import { test, expect } from "../fixtures"
import { waitForPageReady } from "../helpers"

test.describe("AI Agents Page", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/agents")
    await waitForPageReady(demoPage)
  })

  test("displays Agents heading", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Agent/i).first()).toBeVisible()
  })

  test("shows demo agents", async ({ demoPage }) => {
    // Demo agents: Payroll Agent, DCA Bot
    await expect(demoPage.getByText(/Payroll|DCA|Agent/i).first()).toBeVisible()
  })

  test("create agent button exists", async ({ demoPage }) => {
    const createButton = demoPage.getByRole("button", { name: /Create|Add|New/i }).first()
    await expect(createButton).toBeVisible()
  })
})
