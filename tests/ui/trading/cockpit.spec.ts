import { test, expect } from "../fixtures"
import { waitForPageReady, assertNoCrash } from "../helpers"

/**
 * AI Trading cockpit — frontend ↔ backend wiring.
 *
 * Exercises the full loop on the guest demo account:
 *   UI render → /api/trading/overview contract → control actions →
 *   UI reflects the new state.
 *
 * Runs without a wallet: the guest demo account is exactly what an
 * unauthenticated visitor sees.
 */

const OVERVIEW = "/api/trading/overview"
const ACTIONS = "/api/trading/actions"

// The guest demo agent is a single shared instance in the dev server, so tests
// in this file run sequentially to avoid stomping on each other's state.
test.describe.configure({ mode: "serial" })

test.describe("trading cockpit — UI renders", () => {
  test("cockpit loads with status, account cards and controls", async ({ page }) => {
    await page.goto("/trading")
    await waitForPageReady(page)
    await assertNoCrash(page)

    // Agent status + account cards (backend data rendered)
    await expect(page.getByText(/Agent running|Paused|Stopped/).first()).toBeVisible()
    await expect(page.getByText("Total Assets").first()).toBeVisible()
    await expect(page.getByText(/Max you can lose/i).first()).toBeVisible()
    await expect(page.getByText("Equity Curve").first()).toBeVisible()

    // Controls wired to /api/trading/actions
    await expect(page.getByRole("button", { name: /Pause AI|Resume AI/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /Emergency Stop/i })).toBeVisible()

    // Entry-mode toggle (manual approval wiring)
    await expect(page.getByText(/Entry mode/i).first()).toBeVisible()
  })

  test("activity feed renders plain-language events", async ({ page }) => {
    await page.goto("/trading")
    await waitForPageReady(page)

    const feed = page.getByText(/What the AI is doing/i).first()
    await expect(feed).toBeVisible()

    // Engine events when market data is reachable; the seeded demo/activation
    // notice otherwise. Either way the feed must show plain-language entries.
    await expect(
      page
        .getByText(/Scanned \d+ markets|Risk engine|Opened |Closed |Simulated demo history|Paper account/i)
        .first(),
    ).toBeVisible()
  })

  test("share-my-PnL copies an honest card", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await page.goto("/trading")
    await waitForPageReady(page)

    await page.getByRole("button", { name: /Share my PnL/i }).click()
    await expect(page.getByText(/Share card copied/i).first()).toBeVisible()

    const clip = await page.evaluate(() => navigator.clipboard.readText())
    // Paper accounts must be labelled simulated; live accounts carry real PnL.
    expect(clip).toMatch(/paper|simulated|track record/i)
    expect(clip).toContain("protocolbanks.com")
  })
})

test.describe("trading API — contract (frontend depends on these shapes)", () => {
  test("GET /api/trading/overview returns the full cockpit contract", async ({ request }) => {
    const res = await request.get(OVERVIEW)
    expect(res.status()).toBe(200)
    const body = await res.json()

    expect(["paper", "live"]).toContain(body.mode)
    expect(body.agent).toMatchObject({
      status: expect.stringMatching(/running|paused|stopped/),
      strategy: expect.any(String),
    })
    expect(body.account).toMatchObject({
      totalEquity: expect.any(Number),
      tradingWallet: expect.any(Number),
      maxLoss: expect.any(Number),
      allTimePnl: expect.any(Number),
    })
    expect(Array.isArray(body.equity)).toBe(true)
    expect(Array.isArray(body.positions)).toBe(true)
    expect(Array.isArray(body.activity)).toBe(true)
    // Manual-approval fields the UI reads
    expect(["auto", "manual"]).toContain(body.approvalMode)
    expect(body).toHaveProperty("pendingTrade")
  })

  test("paper accounts carry the seeded demo history (>= 31 daily points)", async ({ request }) => {
    const res = await request.get(OVERVIEW)
    const body = await res.json()
    // Deterministic demo seed = 31 points; live trades may add more.
    expect(body.equity.length).toBeGreaterThanOrEqual(31)
    // Curve values are finite numbers (chart input)
    for (const p of body.equity.slice(-5)) {
      expect(typeof p.t).toBe("string")
      expect(Number.isFinite(p.v)).toBe(true)
    }
  })

  test("POST invalid action → 400; approve with nothing pending → 409", async ({ request }) => {
    const bad = await request.post(ACTIONS, { data: { action: "definitely-not-an-action" } })
    expect(bad.status()).toBe(400)

    const approve = await request.post(ACTIONS, { data: { action: "approve" } })
    // 409 when there is no pending trade (or 200 if one happens to exist)
    expect([200, 409]).toContain(approve.status())
    if (approve.status() === 409) {
      const body = await approve.json()
      expect(typeof body.actionNote).toBe("string")
    }
  })

  test("GET /api/trading/track-record is public and anonymized", async ({ request }) => {
    const res = await request.get("/api/trading/track-record", { timeout: 15_000 })
    // 503 = database unreachable in this environment (never fake zeros).
    // The contract below only applies when data is actually available.
    if (res.status() === 503) {
      const body = await res.json()
      expect(body.error).toMatch(/unavailable/i)
      return
    }
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.liveAccountCount).toEqual(expect.any(Number))
    expect(body.totalRealizedPnl).toEqual(expect.any(Number))
    expect(Array.isArray(body.accounts)).toBe(true)
    // Never expose raw wallet addresses
    expect(JSON.stringify(body)).not.toMatch(/0x[0-9a-fA-F]{40}/)
  })
})

test.describe("trading cockpit — control wiring (UI ↔ API)", () => {
  // These tests mutate the shared guest demo agent, so they must not run
  // concurrently with each other.
  test.describe.configure({ mode: "serial" })

  test.afterEach(async ({ request }) => {
    // Restore the demo account for whoever visits next
    await request.post(ACTIONS, { data: { action: "resume" } })
    await request.post(ACTIONS, { data: { action: "set_approval", mode: "auto" } })
  })

  test("entry-mode toggle switches the backend and the UI reflects it", async ({ page, request }) => {
    // Set a known starting point
    await request.post(ACTIONS, { data: { action: "set_approval", mode: "auto" } })

    await page.goto("/trading")
    await waitForPageReady(page)
    await expect(page.getByText(/Entry mode/i).first()).toBeVisible()
    await expect(page.getByText(/Automatic/).first()).toBeVisible()

    // UI action → backend. Assert the *persistent* state (button label +
    // backend mode) rather than the transient toast, which is inherently racy.
    await page.getByText(/Require my approval/i).first().click()
    await expect(page.getByText(/Entry mode: Manual approval/i).first()).toBeVisible({ timeout: 15_000 })

    // Backend actually changed
    const res = await request.get(OVERVIEW)
    expect((await res.json()).approvalMode).toBe("manual")

    // Switch back through the UI and confirm both sides follow
    await page.getByText(/Switch to auto/i).first().click()
    await expect(page.getByText(/Entry mode: Automatic/i).first()).toBeVisible({ timeout: 15_000 })

    const res2 = await request.get(OVERVIEW)
    expect((await res2.json()).approvalMode).toBe("auto")
  })

  test("pause is reflected in the controls, then resume restores it", async ({ page, request }) => {
    await request.post(ACTIONS, { data: { action: "resume" } })
    await page.goto("/trading")
    await waitForPageReady(page)
    await expect(page.getByRole("button", { name: /Pause AI/i })).toBeVisible()

    await page.getByRole("button", { name: /Pause AI/i }).click()
    // Button flips when the backend reports paused (persistent, not the toast)
    await expect(page.getByRole("button", { name: /Resume AI/i })).toBeVisible({ timeout: 15_000 })

    await page.getByRole("button", { name: /Resume AI/i }).click()
    await expect(page.getByRole("button", { name: /Pause AI/i })).toBeVisible({ timeout: 15_000 })
  })
})

test.describe("support wiring", () => {
  test("report-issue dialog offers the Discord channel", async ({ page }) => {
    await page.goto("/trading")
    await waitForPageReady(page)

    await page.getByRole("button", { name: /Report an issue/i }).click()
    const discord = page.locator('a[href*="discord.gg"]')
    await expect(discord.first()).toBeVisible()
    await expect(discord.first()).toHaveAttribute("href", /discord\.gg/)
  })
})
