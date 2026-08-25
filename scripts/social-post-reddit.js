/**
 * Post the launch announcement to Reddit using the copied Chrome session.
 * Run: pnpm exec node scripts/social-post-reddit.js
 */
const { chromium } = require("@playwright/test")

const USER_DATA_DIR = "C:/Users/ASUS/AppData/Local/Temp/opencode/chrome-profile/User Data"

const POST = {
  title:
    "I built a non-custodial AI trading agent — the AI can trade but can never withdraw. Paper mode is free.",
  body: `Long-time lurker here. I've been burned by trading bots that promised the moon and rugged. So I built one with the opposite philosophy:

- The AI holds a trading-only agent wallet on Hyperliquid. It physically cannot withdraw funds.
- Your trading budget = your maximum loss, shown on screen at all times.
- Every trade is logged in plain language with the reason ("Opened BTC long (momentum z=1.6, funding -0.001%/h)").
- Stop-losses ±2.5% and daily circuit breakers are enforced before orders.

Paper mode uses real market data with simulated money — free to try:
protocolbanks.com

The architecture: SIWE login, EIP-712 approveAgent, AES-256-GCM key custody, per-user isolation. AMA about the technical side.`,
}

async function main() {
  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1280, height: 900 },
    args: ["--no-first-run", "--no-default-browser-check"],
  })
  const page = ctx.pages()[0] || (await ctx.newPage())

  // 1. Check account state
  await page.goto("https://www.reddit.com", { waitUntil: "domcontentloaded", timeout: 30000 })
  await page.waitForTimeout(4000)
  const account = await page.evaluate(() => {
    const userBtn = document.querySelector("shreddit-user-profile-redesign, button[aria-label*='profile'], faceplate-profile-link")
    return { hasProfile: !!userBtn }
  })
  console.log("account:", JSON.stringify(account))

  // 2. Open the submit page for the subreddit
  await page.goto("https://www.reddit.com/r/CryptoCurrency/submit", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  })
  await page.waitForTimeout(5000)

  // 3. Fill title (textarea with placeholder "Title")
  const titleFilled = await page.evaluate(() => {
    const titleEl = document.querySelector('textarea[placeholder*="Title"], textarea[name="title"], input[name="title"]')
    if (titleEl) {
      titleEl.value = ""
      titleEl.dispatchEvent(new Event("input", { bubbles: true }))
      return true
    }
    return false
  })
  console.log("title field found:", titleFilled)

  if (titleFilled) {
    await page.evaluate(() => {
      const titleEl = document.querySelector('textarea[placeholder*="Title"], textarea[name="title"], input[name="title"]')
      titleEl.value = ""
      titleEl.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await page.keyboard.type(POST.title, { delay: 5 })
    await page.waitForTimeout(1000)

    // 4. Fill body (rich text editor)
    const bodyFilled = await page.evaluate(() => {
      const editor = document.querySelector('div[contenteditable="true"], .ql-editor, div[role="textbox"]')
      if (editor) {
        editor.focus()
        return true
      }
      return false
    })
    console.log("body editor found:", bodyFilled)
    if (bodyFilled) {
      await page.keyboard.type(POST.body, { delay: 3 })
      await page.waitForTimeout(1500)
    }

    // 5. Screenshot before submitting (evidence)
    await page.screenshot({ path: "C:/Users/ASUS/AppData/Local/Temp/opencode/reddit-before-post.png" })
    console.log("screenshot saved")

    // 6. Click Post button
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")]
      const postBtn = btns.find((b) => /^post$/i.test(b.textContent.trim()) && b.offsetParent !== null)
      if (postBtn) {
        postBtn.click()
        return true
      }
      return false
    })
    console.log("post button clicked:", clicked)
    await page.waitForTimeout(8000)
    await page.screenshot({ path: "C:/Users/ASUS/AppData/Local/Temp/opencode/reddit-after-post.png" })
    console.log("current url:", page.url())
  } else {
    console.log("Could not find the title field — the submit page layout may have changed. Aborting post.")
  }

  await ctx.close()
}

main().catch((e) => {
  console.error("FATAL", e)
  process.exit(1)
})
