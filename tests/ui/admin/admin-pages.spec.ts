import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash, ADMIN_PAGES } from "../helpers"

test.describe("Admin Pages", () => {
  for (const path of ADMIN_PAGES) {
    test(`${path} loads without crash`, async ({ demoPage }) => {
      await demoPage.goto(path)
      await waitForPageReady(demoPage)
      await assertNoCrash(demoPage)
    })
  }
})
