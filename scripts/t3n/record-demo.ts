import { chromium } from "playwright"
import fs from "fs"
import path from "path"

const BASE = "http://localhost:3100"
const outDir = path.join(process.cwd(), ".tmp-t3n-video")
fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: outDir, size: { width: 1440, height: 900 } },
  })
  const page = await context.newPage()
  await page.goto(`${BASE}/t3n-vault`, { waitUntil: "networkidle" })
  await page.getByText("T3N agent configured").waitFor({ timeout: 15_000 })
  await page.waitForTimeout(3000)
  await page.getByRole("button", { name: "Run demo check" }).click()
  await page.getByText("All requested rules passed.").waitFor({ timeout: 20_000 })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: path.join(outDir, "confirmed.png"), fullPage: true })
  await page.waitForTimeout(3000)
  await context.close()
  await browser.close()
  const video = fs.readdirSync(outDir).find((file) => file.endsWith(".webm"))
  if (!video) throw new Error("No video")
  console.log(path.join(outDir, video))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
