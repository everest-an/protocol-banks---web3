/**
 * Check which social platforms are logged in via the copied Chrome session.
 * Run: node scripts/social-check.js
 */
const { chromium } = require("@playwright/test")

const USER_DATA_DIR = "C:/Users/ASUS/AppData/Local/Temp/opencode/chrome-profile/User Data"

async function checkPlatform(ctx, name, url, detect) {
  const page = await ctx.newPage()
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
    await page.waitForTimeout(4000)
    const state = await page.evaluate(detect)
    console.log(`${name}: ${JSON.stringify(state)}`)
    await page.close()
    return state
  } catch (e) {
    console.log(`${name}: ERROR ${e.message.slice(0, 120)}`)
    await page.close().catch(() => {})
    return null
  }
}

async function main() {
  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1280, height: 800 },
    args: ["--no-first-run", "--no-default-browser-check"],
  })

  await checkPlatform(ctx, "X", "https://x.com", () => {
    const loginBtn = [...document.querySelectorAll("a,button,span")].some(
      (el) => el.textContent.trim().toLowerCase() === "log in" || el.textContent.trim().toLowerCase() === "sign in",
    )
    const compose = !!document.querySelector('a[href="/compose/post"]') || !!document.querySelector('[data-testid="SideNav_NewTweet_Button"]')
    const accountLabel = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]')
    return { loggedIn: !loginBtn || !!compose || !!accountLabel, hasCompose: compose }
  })

  await checkPlatform(ctx, "Reddit", "https://www.reddit.com", () => {
    const loginBtn = [...document.querySelectorAll("a,button")].some((el) => /log in/i.test(el.textContent))
    const avatar = document.querySelector("shreddit-user-profile-redesign") || document.querySelector('faceplate-img[alt*="avatar"]')
    return { loggedIn: !loginBtn || !!avatar }
  })

  await checkPlatform(ctx, "ProductHunt", "https://www.producthunt.com", () => {
    const loginBtn = [...document.querySelectorAll("a,button")].some((el) => /sign in/i.test(el.textContent))
    return { loggedIn: !loginBtn }
  })

  await ctx.close()
}

main().catch((e) => {
  console.error("FATAL", e)
  process.exit(1)
})
