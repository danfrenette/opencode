import { spawn, spawnSync, which } from "bun"
import { existsSync } from "node:fs"
import { join } from "node:path"

const root = new URL("..", import.meta.url).pathname

if (!which("tailscale")) {
  console.error("tailscale is not installed: https://tailscale.com/download")
  process.exit(1)
}

const ip = spawnSync(["tailscale", "ip", "-4"]).stdout.toString().split("\n")[0]?.trim()
if (!ip) {
  console.error("could not determine tailscale IP — is tailscale running?")
  process.exit(1)
}

if (!existsSync(join(root, "node_modules"))) {
  const install = spawnSync({ cmd: ["bun", "install"], cwd: root, stdout: "inherit", stderr: "inherit" })
  if (install.exitCode !== 0) process.exit(install.exitCode)
}

const backend = spawn({
  cmd: [
    "bun",
    "run",
    "--cwd",
    "packages/opencode",
    "--conditions=browser",
    "src/index.ts",
    "serve",
    "--port",
    "4096",
    "--hostname",
    "0.0.0.0",
  ],
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
})

const app = spawn({
  cmd: ["bun", "--cwd", "packages/app", "dev", "--", "--port", "4444"],
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env, VITE_OPENCODE_SERVER_HOST: ip },
})

console.log("")
console.log(`  local UI:    http://localhost:4444`)
console.log(`  tailnet UI:  http://${ip}:4444  <- open this on other tailnet devices`)
console.log("")

if (!process.env.OPENCODE_SERVER_PASSWORD) {
  console.warn("! OPENCODE_SERVER_PASSWORD is not set; the API is open to any tailnet device")
}

const shutdown = () => {
  backend.kill()
  app.kill()
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

await Promise.race([backend.exited, app.exited])
shutdown()
