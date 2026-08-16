#!/usr/bin/env bun

import { join } from "path"
import { fileURLToPath } from "url"

const root = fileURLToPath(new URL("../../..", import.meta.url))
const localUrl = "http://localhost:4444"

const server = backendServer()
await requireBackend(server)
await requireLocalPort()
const vite = startVite(server)

const stop = () => vite.kill()
process.on("SIGINT", stop)
process.on("SIGTERM", stop)

try {
  await waitForVite(vite)
  await openBrowser()
  process.exitCode = await vite.exited
} finally {
  process.off("SIGINT", stop)
  process.off("SIGTERM", stop)
  if (vite.exitCode === null) vite.kill()
  await vite.exited
}

function backendServer() {
  const value = process.env.OPENCODE_DEV_SERVER_URL ?? "http://127.0.0.1:4096"
  if (!URL.canParse(value)) throw new Error("OPENCODE_DEV_SERVER_URL must be a valid HTTP origin URL.")
  const server = new URL(value)
  if (server.protocol !== "http:" || !server.hostname) {
    throw new Error("OPENCODE_DEV_SERVER_URL must be a valid HTTP origin URL.")
  }
  if (server.username || server.password || server.pathname !== "/" || server.search || server.hash) {
    throw new Error("OPENCODE_DEV_SERVER_URL must be a valid HTTP origin URL.")
  }
  return server
}

async function requireBackend(server: URL) {
  const response = await fetch(new URL("/api/health", server), { redirect: "manual" }).catch(() => undefined)
  if (response?.ok || (response?.status === 401 && response.headers.get("www-authenticate")?.startsWith("Basic"))) {
    await response.body?.cancel()
    return
  }
  await response?.body?.cancel()
  throw new Error(`The OpenCode server at ${server.origin} is unavailable. Start it separately and retry.`)
}

async function requireLocalPort() {
  try {
    await Bun.serve({ hostname: "127.0.0.1", port: 4444, fetch: () => new Response() }).stop(true)
  } catch {
    throw new Error("Port 4444 is already in use. Stop the process using it and retry.")
  }
}

function startVite(server: URL) {
  return Bun.spawn([process.execPath, "dev", "--", "--host", "127.0.0.1", "--port", "4444", "--strictPort"], {
    cwd: join(root, "packages/app"),
    env: {
      ...process.env,
      OPENCODE_DEV_SERVER_URL: server.origin,
      VITE_OPENCODE_PROXY: "true",
      VITE_OPENCODE_SERVER_HOST: "localhost",
      VITE_OPENCODE_SERVER_PORT: "4444",
    },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })
}

async function waitForVite(vite: Bun.Subprocess) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (vite.exitCode !== null) throw new Error("Local Vite failed to start on port 4444.")
    const ready = await fetch(localUrl).then(
      async (response) => {
        await response.body?.cancel()
        return true
      },
      () => false,
    )
    if (ready) return
    await Bun.sleep(100)
  }
  throw new Error("Local Vite failed to start on port 4444.")
}

async function openBrowser() {
  if ((await Bun.spawn(browserCommand(localUrl), { stdout: "ignore", stderr: "ignore" }).exited) !== 0) {
    throw new Error("Could not open the local web app in a browser.")
  }
}

function browserCommand(url: string) {
  if (process.env.BROWSER) return [process.env.BROWSER, url]
  if (process.platform === "darwin") return ["open", url]
  if (process.platform === "win32") return ["explorer.exe", url]
  return ["xdg-open", url]
}
