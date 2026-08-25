/** Verify X login state + account identity with the copied session. */
const { chromium } = require("@playwright/test")

const USER_DATA_DIR = "C:/Users/ASUS/AppData/Local/Temp/opencode/chrome-profile/User Data"

async function main() {
  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1280, height: 900 },
    args: ["--no-first-run", "--no-default-browser-check"],
  })
  const page = ctx.pages()[0] || (await ctx.newPage())

  await page.goto("https://x.com", { waitUntil: "domcontentloaded", timeout: 30000 })
  await page.waitForTimeout(6000)

  const diag = await page.evaluate(() => {
    const loginLink = [...document.querySelectorAll("a")].some((a) => /log in|sign in/i.test(a.textContent.trim()) && a.textContent.length < 30)
    const composeBtn = document.querySelector('a[href="/compose/post"], [data-testid="SideNav_NewTweet_Button"]')
    // account switcher shows the display name
    const accountBtn = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]')
    const accountName = accountBtn ? accountBtn.textContent.trim().slice(0, 80) : null
    return { url: location.href, loggedIn: !loginLink && !!composeBtn, accountName, hasCompose: !!composeBtn }
  })
  console.log(JSON.stringify(diag, null, 2))
  await page.screenshot({ path: "C:/Users/ASUS/AppData/Local/Temp/opencode/x-state.png" })

  await ctx.close()
}

main().catch((e) => {
  console.error("FATAL", e)
  process.exit(1)
})
