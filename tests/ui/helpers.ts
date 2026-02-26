import { type Page, expect } from "@playwright/test"

/** Wait for page to finish hydrating */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState("domcontentloaded")
  // Give React time to hydrate and render
  await page.waitForTimeout(1500)
}

/** Assert that the page did not crash (no blank page, no Next.js error overlay) */
export async function assertNoCrash(page: Page) {
  const body = page.locator("body")
  await expect(body).not.toBeEmpty()
  // Check for Next.js error overlay
  const errorOverlay = page.locator("#__next-build-error, [data-nextjs-dialog]")
  await expect(errorOverlay).toHaveCount(0)
}

/** Assert the header is present */
export async function assertHeaderPresent(page: Page) {
  const header = page.locator("header")
  await expect(header).toBeVisible()
}

/** Navigate to a page and verify basic load */
export async function navigateAndVerify(
  page: Page,
  path: string,
  expectedText?: string | RegExp,
) {
  await page.goto(path)
  await waitForPageReady(page)
  await assertNoCrash(page)
  if (expectedText) {
    await expect(page.getByText(expectedText).first()).toBeVisible()
  }
}

/** All product pages with expected visible text */
export const PRODUCT_PAGES = [
  { path: "/dashboard", text: "Total Balance" },
  { path: "/balances", text: /Balance/i },
  { path: "/analytics", text: /Analytics/i },
  { path: "/vendors", text: "Contacts" },
  { path: "/history", text: "Transaction History" },
  { path: "/products", text: "Products" },
  { path: "/pay", text: /Pay|Send/i },
  { path: "/batch-payment", text: /Batch/i },
  { path: "/split-payments", text: /Split/i },
  { path: "/subscriptions", text: "Auto Pay" },
  { path: "/reconciliation", text: /Reconciliation/i },
  { path: "/card", text: /Card/i },
  { path: "/receive", text: /Payment Link|Receive/i },
  { path: "/checkout", text: /Checkout|Payment/i },
  { path: "/terminal", text: /Terminal|POS/i },
  { path: "/acquiring", text: /Acquiring|Merchant/i },
  { path: "/swap", text: "Cross-Chain Swap" },
  { path: "/omnichain", text: "Cross-Chain Hub" },
  { path: "/yield", text: /Yield/i },
  { path: "/agents", text: /Agent/i },
  { path: "/embed", text: /Embed|SDK/i },
  { path: "/tron-demo", text: /TRON|Tron/i },
  { path: "/send", text: "Send Payment" },
] as const

export const SETTINGS_PAGES = [
  "/settings",
  "/settings/api-keys",
  "/settings/webhooks",
  "/settings/team",
  "/settings/billing",
  "/settings/preferences",
  "/settings/multisig",
  "/settings/session-keys",
  "/settings/authorizations",
] as const

export const ADMIN_PAGES = [
  "/admin",
  "/admin/monitoring",
  "/admin/contracts",
  "/admin/domains",
  "/admin/fees",
  "/admin/risk-review",
] as const

export const PUBLIC_PAGES = [
  { path: "/help", text: "Usage Guide" },
  { path: "/privacy", text: "Privacy Policy" },
  { path: "/terms", text: "Terms of Service" },
  { path: "/whitepaper", text: /Protocol Banks? Whitepaper/i },
  { path: "/contact", text: "Contact Us" },
  { path: "/security", text: /Security/i },
  { path: "/fees", text: /Fee/i },
  { path: "/offramp", text: /Off-Ramp|Offramp/i },
] as const
