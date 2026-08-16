import { defineConfig } from "@playwright/test"

process.env.OPENCODE_DEV_SERVER_URL ??= "http://127.0.0.1:4096"
process.env.PLAYWRIGHT_PORT ??= "3444"
process.env.PLAYWRIGHT_BASE_URL ??= `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT}`
process.env.PLAYWRIGHT_REUSE_SERVER = "false"

const base = (await import("./playwright.config")).default

export default defineConfig(base, {
  testMatch: "regression/startup-server-selection.spec.ts",
})
