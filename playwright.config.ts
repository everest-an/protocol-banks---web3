import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/ui",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm dev -p 3100",
    url: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
