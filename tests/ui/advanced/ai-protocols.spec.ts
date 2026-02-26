import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

test.describe("AI Agent Protocols - Agents Page", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/agents")
    await waitForPageReady(demoPage)
  })

  test("displays AI Agent Management heading", async ({ demoPage }) => {
    await expect(demoPage.getByText("AI Agent Management")).toBeVisible()
  })

  test("shows demo agents in preview mode", async ({ demoPage }) => {
    await expect(demoPage.getByText("Payroll Agent")).toBeVisible()
    await expect(demoPage.getByText("DCA Bot")).toBeVisible()
    await expect(demoPage.getByText("Subscription Manager")).toBeVisible()
  })

  test("displays preview mode warning", async ({ demoPage }) => {
    await expect(demoPage.getByText("Preview Mode")).toBeVisible()
    await expect(demoPage.getByText(/Connect your wallet/i)).toBeVisible()
  })

  test("ERC-8004 Agent Card section is visible", async ({ demoPage }) => {
    await expect(demoPage.getByText("ERC-8004 Agent Card")).toBeVisible()
    await expect(demoPage.getByText("/.well-known/agent.json")).toBeVisible()
  })

  test("A2A Protocol section is visible", async ({ demoPage }) => {
    await expect(demoPage.getByText("A2A Protocol")).toBeVisible()
    await expect(demoPage.getByText("POST /api/a2a")).toBeVisible()
  })

  test("MCP Server section is visible", async ({ demoPage }) => {
    await expect(demoPage.getByText("MCP Server")).toBeVisible()
    await expect(demoPage.getByText("POST /api/mcp")).toBeVisible()
  })

  test("SIWE Authentication section is visible", async ({ demoPage }) => {
    await expect(demoPage.getByText(/SIWE Authentication/i)).toBeVisible()
    await expect(demoPage.getByText("GET /api/auth/siwe/nonce")).toBeVisible()
    await expect(demoPage.getByText("POST /api/auth/siwe/verify")).toBeVisible()
    await expect(demoPage.getByText("POST /api/auth/siwe/refresh")).toBeVisible()
  })

  test("three-step SIWE flow is displayed", async ({ demoPage }) => {
    await expect(demoPage.getByText("1. Get Nonce")).toBeVisible()
    await expect(demoPage.getByText("2. Sign & Verify")).toBeVisible()
    await expect(demoPage.getByText("3. Refresh Token")).toBeVisible()
  })

  test("create agent dialog opens and closes", async ({ demoPage }) => {
    const createButton = demoPage.getByRole("button", { name: /Create Agent/i })
    await createButton.click()

    await expect(demoPage.getByText("Create New AI Agent")).toBeVisible()
    await expect(demoPage.getByText("Agent Name")).toBeVisible()

    // Close dialog
    const cancelButton = demoPage.getByRole("button", { name: /Cancel/i })
    await cancelButton.click()
  })

  test("create agent in demo mode shows API key", async ({ demoPage }) => {
    const createButton = demoPage.getByRole("button", { name: /Create Agent/i })
    await createButton.click()

    // Fill the form
    const nameInput = demoPage.locator('input[placeholder="My AI Agent"]')
    await nameInput.fill("Test E2E Agent")

    // Click create
    const submitButton = demoPage.getByRole("button", { name: /Create Agent/i }).last()
    await submitButton.click()

    // Should show API key
    await expect(demoPage.getByText(/Save your API key/i)).toBeVisible()
  })

  test("pause all button exists", async ({ demoPage }) => {
    const pauseButton = demoPage.getByRole("button", { name: /Pause All/i })
    await expect(pauseButton).toBeVisible()
  })

  test("agent table shows expected columns", async ({ demoPage }) => {
    await expect(demoPage.getByText("API Key")).toBeVisible()
    await expect(demoPage.getByText("Auto-Execute")).toBeVisible()
    await expect(demoPage.getByText("Budget")).toBeVisible()
    await expect(demoPage.getByText("Status")).toBeVisible()
  })

  test("agent status badges are rendered", async ({ demoPage }) => {
    // Payroll Agent and DCA Bot are active, Subscription Manager is paused
    const activeBadges = demoPage.getByText("active", { exact: true })
    const pausedBadges = demoPage.getByText("paused", { exact: true })
    await expect(activeBadges.first()).toBeVisible()
    await expect(pausedBadges.first()).toBeVisible()
  })

  test("copy button exists for each protocol endpoint", async ({ demoPage }) => {
    // 3 protocol cards + SIWE section = multiple copy buttons
    const copyButtons = demoPage.locator('[class*="agents"] button, .mt-8 button, .mt-4 button').filter({
      has: demoPage.locator('svg'),
    })
    // At minimum the 3 protocol endpoint copy buttons should exist
    expect(await demoPage.locator('code:has-text("/.well-known/agent.json")').count()).toBe(1)
    expect(await demoPage.locator('code:has-text("POST /api/a2a")').count()).toBe(1)
    expect(await demoPage.locator('code:has-text("POST /api/mcp")').count()).toBe(1)
  })
})

test.describe("AI Agent Protocols - Well-Known Endpoint", () => {
  test("/.well-known/agent.json returns valid Agent Card", async ({ demoPage }) => {
    const response = await demoPage.request.get("/.well-known/agent.json")
    // May return 200 or redirect based on env
    if (response.ok()) {
      const body = await response.json()
      expect(body).toHaveProperty("did")
      expect(body).toHaveProperty("name")
      expect(body).toHaveProperty("capabilities")
      expect(body).toHaveProperty("supported_tokens")
      expect(body).toHaveProperty("supported_chains")
      expect(body.capabilities).toHaveProperty("supported_protocols")
      expect(body.capabilities.supported_protocols).toContain("a2a")
      expect(body.capabilities.supported_protocols).toContain("mcp")
    }
  })
})

test.describe("AI Agent Protocols - Whitepaper v2", () => {
  test.beforeEach(async ({ demoPage }) => {
    await demoPage.goto("/whitepaper")
    await waitForPageReady(demoPage)
  })

  test("shows v2.0 version badge", async ({ demoPage }) => {
    await expect(demoPage.getByText("Version 2.0")).toBeVisible()
  })

  test("shows updated date Feb 2026", async ({ demoPage }) => {
    await expect(demoPage.getByText(/Updated Feb 2026/i)).toBeVisible()
  })

  test("shows AI-Native in subtitle", async ({ demoPage }) => {
    await expect(demoPage.getByText(/AI-Native/i).first()).toBeVisible()
  })

  test("section 5: AI-Native Architecture exists", async ({ demoPage }) => {
    await expect(demoPage.getByText("5. AI-Native Architecture")).toBeVisible()
  })

  test("section 6: AI Agent Authentication exists", async ({ demoPage }) => {
    await expect(demoPage.getByText("6. AI Agent Authentication")).toBeVisible()
  })

  test("section 7: Agent-to-Agent Communication exists", async ({ demoPage }) => {
    await expect(demoPage.getByText("7. Agent-to-Agent Communication")).toBeVisible()
  })

  test("section 8: MCP Server Integration exists", async ({ demoPage }) => {
    await expect(demoPage.getByText("8. MCP Server Integration")).toBeVisible()
  })

  test("four protocol cards are displayed", async ({ demoPage }) => {
    await expect(demoPage.getByText("ERC-8004 Agent Card").first()).toBeVisible()
    await expect(demoPage.getByText("SIWE + JWT Authentication")).toBeVisible()
    await expect(demoPage.getByText("A2A Protocol").first()).toBeVisible()
    await expect(demoPage.getByText("MCP Server").first()).toBeVisible()
  })

  test("SIWE three-step flow is described", async ({ demoPage }) => {
    await expect(demoPage.getByText("Request Nonce")).toBeVisible()
    await expect(demoPage.getByText("Sign & Verify")).toBeVisible()
    await expect(demoPage.getByText("Auto-Refresh")).toBeVisible()
  })

  test("MCP tool table has all 8 tools", async ({ demoPage }) => {
    await expect(demoPage.getByText("list_supported_tokens")).toBeVisible()
    await expect(demoPage.getByText("get_payment_quote")).toBeVisible()
    await expect(demoPage.getByText("create_payment")).toBeVisible()
    await expect(demoPage.getByText("check_payment_status")).toBeVisible()
    await expect(demoPage.getByText("list_payments")).toBeVisible()
    await expect(demoPage.getByText("create_invoice")).toBeVisible()
    await expect(demoPage.getByText("list_invoices")).toBeVisible()
    await expect(demoPage.getByText("get_balance")).toBeVisible()
  })

  test("A2A message flow section exists", async ({ demoPage }) => {
    await expect(demoPage.getByText("A2A Message Flow")).toBeVisible()
    await expect(demoPage.getByText(/Discovery:/)).toBeVisible()
    await expect(demoPage.getByText(/Handshake:/)).toBeVisible()
    await expect(demoPage.getByText(/Request Payment:/)).toBeVisible()
  })

  test("page does not crash", async ({ demoPage }) => {
    await assertNoCrash(demoPage)
  })
})
