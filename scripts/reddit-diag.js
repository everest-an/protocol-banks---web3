/** Diagnose Reddit submit page state. */
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

  await page.goto("https://www.reddit.com", { waitUntil: "domcontentloaded", timeout: 30000 })
  await page.waitForTimeout(6000)

  const diag = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    bodySnippet: document.body.innerText.slice(0, 200),
    loginText: [...document.querySelectorAll("a,button")].some((el) => /log in|登录/i.test(el.textContent)),
    avatars: document.querySelectorAll("shreddit-profile-avatar, faceplate-img, img[alt*=avatar], a[aria-label*=profile]").length,
  }))
  console.log(JSON.stringify(diag, null, 2))
  await page.screenshot({ path: "C:/Users/ASUS/AppData/Local/Temp/opencode/reddit-home.png", fullPage: false })

  await ctx.close()
}

main().catch((e) => {
  console.error("FATAL", e)
  process.exit(1)
})
