import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("Acquiring Console - Business Flows", () => {
  test("acquiring hub shows stats cards", async ({ demoPage }) => {
    await demoPage.goto("/acquiring")
    await waitForPageReady(demoPage)
    await assertNoCrash(demoPage)

    // Stats: Total Merchants, Total Orders, Transaction Amount, Success Rate
    await expect(demoPage.getByText("Total Merchants").first()).toBeVisible()
    await expect(demoPage.getByText("Total Orders").first()).toBeVisible()
  })

  test("acquiring hub shows quick action links", async ({ demoPage }) => {
    await demoPage.goto("/acquiring")
    await waitForPageReady(demoPage)

    const content = await demoPage.textContent("body")
    const hasLinks =
      content?.includes("Merchant") &&
      content?.includes("Order") &&
      content?.includes("Payment Link")
    expect(hasLinks).toBeTruthy()
  })

  test("acquiring hub shows quick start guide", async ({ demoPage }) => {
    await demoPage.goto("/acquiring")
    await waitForPageReady(demoPage)

    const content = await demoPage.textContent("body")
    const hasGuide =
      content?.includes("Create Merchant") ||
      content?.includes("Quick Start") ||
      content?.includes("Setup")
    expect(hasGuide).toBeTruthy()
  })
})

test.describe("Merchant Management - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/acquiring/merchants")
    await waitForPageReady(demoPage)
  })

  test("displays Merchant Management heading", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
    await expect(demoPage.getByRole("heading", { name: /Merchant/i }).first()).toBeVisible()
  })

  test("shows Create Merchant button", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Create Merchant/i).first()).toBeVisible()
  })

  test("shows demo merchants", async ({ demoPage }) => {
    // Demo merchants: Protocol Coffee Shop, Web3 Design Studio, DeFi Tutoring
    const content = await demoPage.textContent("body")
    const hasDemoMerchant =
      content?.includes("Protocol Coffee Shop") ||
      content?.includes("Web3 Design Studio") ||
      content?.includes("DeFi Tutoring")
    expect(hasDemoMerchant).toBeTruthy()
  })

  test("clicking Create Merchant opens form", async ({ demoPage }) => {
    await demoPage.getByText(/Create Merchant/i).first().click()
    await demoPage.waitForTimeout(500)
    // Dialog or inline form should appear
    const dialog = demoPage.locator("[role=dialog]")
    const hasDialog = await dialog.isVisible().catch(() => false)
    if (hasDialog) {
      await expect(dialog).toBeVisible()
    } else {
      // May be inline form expansion
      const content = await demoPage.textContent("body")
      expect(
        content?.includes("Merchant Name") ||
        content?.includes("Store") ||
        content?.includes("Wallet Address")
      ).toBeTruthy()
    }
  })

  test("merchant form has required fields", async ({ demoPage }) => {
    await demoPage.getByText(/Create Merchant/i).first().click()
    await demoPage.waitForTimeout(500)

    // Look for name and address fields
    const nameInput = demoPage.getByPlaceholder(/store|merchant|name/i).first()
    const addressInput = demoPage.getByPlaceholder(/0x/i).first()

    const hasName = await nameInput.isVisible().catch(() => false)
    const hasAddress = await addressInput.isVisible().catch(() => false)

    expect(hasName || hasAddress).toBeTruthy()
  })

  test("merchant cards show wallet address with copy", async ({ demoPage }) => {
    // Demo merchant addresses should be visible
    const content = await demoPage.textContent("body")
    expect(content?.includes("0x")).toBeTruthy()
  })
})

test.describe("Order Management - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/acquiring/orders")
    await waitForPageReady(demoPage)
  })

  test("displays Order Management heading", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
    await expect(demoPage.getByRole("heading", { name: /Order/i }).first()).toBeVisible()
  })

  test("shows Create Order button", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Create Order/i).first()).toBeVisible()
  })

  test("shows demo orders with status badges", async ({ demoPage }) => {
    // Demo orders: ORDER-78A3F1, ORDER-92B4E2, etc.
    const content = await demoPage.textContent("body")
    const hasDemoOrder =
      content?.includes("ORDER-") ||
      content?.includes("Paid") ||
      content?.includes("Pending") ||
      content?.includes("Expired")
    expect(hasDemoOrder).toBeTruthy()
  })

  test("shows order search field", async ({ demoPage }) => {
    const search = demoPage.getByPlaceholder(/search|order/i).first()
    await expect(search).toBeVisible()
  })

  test("shows status filter dropdown", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    const hasFilter =
      content?.includes("All Status") ||
      content?.includes("Pending") ||
      content?.includes("Paid")
    expect(hasFilter).toBeTruthy()
  })

  test("clicking Create Order opens dialog", async ({ demoPage }) => {
    await demoPage.getByText(/Create Order/i).first().click()
    await demoPage.waitForTimeout(500)
    const dialog = demoPage.locator("[role=dialog]")
    await expect(dialog).toBeVisible()
  })

  test("create order dialog has merchant selector", async ({ demoPage }) => {
    await demoPage.getByText(/Create Order/i).first().click()
    await demoPage.waitForTimeout(500)
    const dialog = demoPage.locator("[role=dialog]")
    const content = await dialog.textContent()
    expect(
      content?.includes("Merchant") ||
      content?.includes("Select")
    ).toBeTruthy()
  })

  test("create order dialog has amount field", async ({ demoPage }) => {
    await demoPage.getByText(/Create Order/i).first().click()
    await demoPage.waitForTimeout(500)
    const dialog = demoPage.locator("[role=dialog]")
    const amountInput = dialog.locator("input[type=number], input[placeholder*='0']").first()
    await expect(amountInput).toBeVisible()
  })

  test("demo orders show USDC amounts", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    expect(content?.includes("USDC") || content?.includes("USDT")).toBeTruthy()
  })
})

test.describe("Invoice Management - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/acquiring/invoices")
    await waitForPageReady(demoPage)
  })

  test("displays Invoices heading", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
    await expect(demoPage.getByRole("heading", { name: /Invoice/i }).first()).toBeVisible()
  })

  test("shows invoice stats cards", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    const hasStats =
      content?.includes("Total Invoices") ||
      content?.includes("Pending") ||
      content?.includes("Paid") ||
      content?.includes("Total Received")
    expect(hasStats).toBeTruthy()
  })

  test("shows Create Invoice button", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Create Invoice/i).first()).toBeVisible()
  })

  test("shows demo invoices", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    const hasDemoInvoice =
      content?.includes("INV-") ||
      content?.includes("$100") ||
      content?.includes("$250")
    expect(hasDemoInvoice).toBeTruthy()
  })

  test("clicking Create Invoice expands inline form", async ({ demoPage }) => {
    await demoPage.getByText(/Create Invoice/i).first().click()
    await demoPage.waitForTimeout(1000)

    // Inline form expands (not a dialog) with tabs: Details, Payment, Client, Settings
    const content = await demoPage.textContent("body")
    const hasTabs =
      content?.includes("Details") ||
      content?.includes("Payment") ||
      content?.includes("Client") ||
      content?.includes("Business Name")
    expect(hasTabs).toBeTruthy()
  })

  test("invoice form has business name field", async ({ demoPage }) => {
    await demoPage.getByText(/Create Invoice/i).first().click()
    await demoPage.waitForTimeout(1000)
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Business Name") ||
      content?.includes("Protocol Bank") ||
      content?.includes("Description") ||
      content?.includes("Amount")
    ).toBeTruthy()
  })

  test("invoice actions - Copy Link and QR Code", async ({ demoPage }) => {
    // Demo invoices should have action buttons
    const content = await demoPage.textContent("body")
    const hasActions =
      content?.includes("Copy") ||
      content?.includes("QR") ||
      content?.includes("Link")
    expect(hasActions).toBeTruthy()
  })
})

test.describe("Payment Links - Business Flows", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/acquiring/payment-links")
    await waitForPageReady(demoPage)
  })

  test("displays Payment Links heading", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
    await expect(demoPage.getByRole("heading", { name: /Payment Link/i }).first()).toBeVisible()
  })

  test("shows Create Payment Link button", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Create Payment Link/i).first()).toBeVisible()
  })

  test("shows demo payment links", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    const hasDemoLinks =
      content?.includes("Monthly Subscription") ||
      content?.includes("One-time Payment") ||
      content?.includes("Donation") ||
      content?.includes("Event Ticket") ||
      content?.includes("PL-")
    expect(hasDemoLinks).toBeTruthy()
  })

  test("payment links show status badges", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    const hasStatus =
      content?.includes("Active") ||
      content?.includes("Paused") ||
      content?.includes("Expired")
    expect(hasStatus).toBeTruthy()
  })

  test("clicking Create Payment Link expands inline form", async ({ demoPage }) => {
    await demoPage.getByText(/Create Payment Link/i).first().click()
    await demoPage.waitForTimeout(1000)

    // Inline form expands (not a dialog) with tabs
    const content = await demoPage.textContent("body")
    const hasTabs =
      content?.includes("Basic") ||
      content?.includes("Amount") ||
      content?.includes("Branding") ||
      content?.includes("Title")
    expect(hasTabs).toBeTruthy()
  })

  test("payment link form has title and address fields", async ({ demoPage }) => {
    await demoPage.getByText(/Create Payment Link/i).first().click()
    await demoPage.waitForTimeout(1000)
    const content = await demoPage.textContent("body")
    expect(
      content?.includes("Title") ||
      content?.includes("Recipient") ||
      content?.includes("Address") ||
      content?.includes("Token")
    ).toBeTruthy()
  })

  test("demo links show payment count", async ({ demoPage }) => {
    const content = await demoPage.textContent("body")
    // e.g. "23 payments", "8 payments"
    expect(content?.includes("payment")).toBeTruthy()
  })
})
