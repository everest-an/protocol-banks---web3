import { test, expect } from "../fixtures"
import {
  PRODUCT_PAGES,
  SETTINGS_PAGES,
  ADMIN_PAGES,
  PUBLIC_PAGES,
  waitForPageReady,
  assertNoCrash,
  navigateAndVerify,
} from "../helpers"

test.describe("Smoke: All product pages load", () => {
  for (const { path, text } of PRODUCT_PAGES) {
    test(`${path} loads without crash`, async ({ demoPage }) => {
      await navigateAndVerify(demoPage, path, text)
    })
  }
})

test.describe("Smoke: Settings pages load", () => {
  for (const path of SETTINGS_PAGES) {
    test(`${path} loads without crash`, async ({ demoPage }) => {
      await demoPage.goto(path)
      await waitForPageReady(demoPage)
      await assertNoCrash(demoPage)
    })
  }
})

test.describe("Smoke: Admin pages load", () => {
  for (const path of ADMIN_PAGES) {
    test(`${path} loads without crash`, async ({ demoPage }) => {
      await demoPage.goto(path)
      await waitForPageReady(demoPage)
      await assertNoCrash(demoPage)
    })
  }
})

test.describe("Smoke: Public pages load", () => {
  for (const { path, text } of PUBLIC_PAGES) {
    test(`${path} loads without crash`, async ({ demoPage }) => {
      await navigateAndVerify(demoPage, path, text)
    })
  }
})
