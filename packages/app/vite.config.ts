import { sentryVitePlugin } from "@sentry/vite-plugin"
import { defineConfig } from "vite"
import desktopPlugin from "./vite"

const sentry =
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        telemetry: false,
        release: {
          name: process.env.SENTRY_RELEASE ?? process.env.VITE_SENTRY_RELEASE,
        },
        sourcemaps: {
          assets: "./dist/**",
          filesToDeleteAfterUpload: "./dist/**/*.map",
        },
      })
    : false
const devServerUrl = process.env.OPENCODE_DEV_SERVER_URL

export default defineConfig({
  plugins: [desktopPlugin, sentry] as any,
  define: {
    "import.meta.env.VITE_OPENCODE_PROXY": JSON.stringify(!!devServerUrl),
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
    proxy: devServerUrl
      ? {
          "/api": {
            target: devServerUrl,
            changeOrigin: true,
            ws: true,
          },
        }
      : undefined,
  },
  build: {
    target: "esnext",
    sourcemap: true,
  },
})
