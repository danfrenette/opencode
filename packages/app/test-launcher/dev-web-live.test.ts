import { afterEach, describe, expect, test } from "bun:test"
import { chmodSync, mkdtempSync, rmSync } from "fs"
import { request } from "http"
import { tmpdir } from "os"
import { join } from "path"

const launcher = join(import.meta.dir, "../script/dev-web-live.ts")
const localUrl = "http://127.0.0.1:4444"
const fixtures: string[] = []

afterEach(() => {
  fixtures.splice(0).forEach((fixture) => rmSync(fixture, { recursive: true, force: true }))
})

describe("dev:web:live", () => {
  test("fails clearly when the backend is unavailable", async () => {
    const result = await runLauncher("http://127.0.0.1:1")

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain("error: The OpenCode server at http://127.0.0.1:1 is unavailable")
    expect(result.stdout).toBe("")
  })

  test("rejects a malformed backend URL", async () => {
    const result = await runLauncher("not a URL")

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain("error: OPENCODE_DEV_SERVER_URL must be a valid HTTP origin URL")
  })

  test("fails clearly when port 4444 is occupied", async () => {
    await using backend = await createBackend()
    using _local = Bun.serve({ hostname: "127.0.0.1", port: 4444, fetch: () => new Response() })
    const result = await runLauncher(backend.url.origin)

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain("error: Port 4444 is already in use")
  })

  test("proxies browser authentication to the existing backend and cleans up on exit", async () => {
    await using backend = await createBackend()
    const fixture = await createFixture()
    const marker = join(fixture.directory, "browser.txt")
    const child = spawnLauncher(backend.url.origin, {
      BROWSER: fixture.browser,
      OPENCODE_BROWSER_MARKER: marker,
    })
    const completed = output(child)
    let failure: unknown

    try {
      await waitFor(() => Bun.file(marker).exists())
      expect(await Bun.file(marker).text()).toBe("http://localhost:4444")

      const challenge = await requestUrl(`${localUrl}/api/health`)
      expect(challenge).toMatchObject({
        status: 401,
        headers: { "www-authenticate": 'Basic realm="Secure Area"' },
      })

      const authorization = `Basic ${btoa("opencode:live-web-secret")}`
      const authenticated = await requestUrl(`${localUrl}/api/health`, { authorization })
      expect(authenticated.status).toBe(200)
      expect(JSON.parse(authenticated.body)).toEqual({ healthy: true })

      const event = await readFirstChunk(`${localUrl}/api/event`, { authorization })
      expect(event.headers["content-type"]).toBe("text/event-stream")
      expect(event.body).toBe('data: {"type":"server.connected"}\n\n')

      expect(await readWebSocket("ws://127.0.0.1:4444/api/socket")).toBe("connected")
    } catch (error) {
      failure = error
    } finally {
      child.kill("SIGTERM")
    }

    const result = await completed
    if (failure) {
      console.error(result.stdout, result.stderr)
      throw failure
    }
    expect(result.stdout + result.stderr).not.toContain("live-web-secret")
    expect(result.stdout + result.stderr).not.toContain("auth_token")
    using port = Bun.serve({ hostname: "127.0.0.1", port: 4444, fetch: () => new Response() })
    expect(port.url.origin).toBe(localUrl)
  }, 15_000)
})

async function runLauncher(serverUrl: string) {
  return output(spawnLauncher(serverUrl))
}

function spawnLauncher(serverUrl: string, env?: Record<string, string>) {
  return Bun.spawn([process.execPath, launcher], {
    env: {
      ...process.env,
      OPENCODE_DEV_SERVER_URL: serverUrl,
      ...env,
    },
    stdout: "pipe",
    stderr: "pipe",
  })
}

async function output(child: ReturnType<typeof spawnLauncher>) {
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { stdout, stderr, exitCode }
}

async function createBackend() {
  const directory = mkdtempSync(join(tmpdir(), "opencode-live-web-backend-"))
  fixtures.push(directory)
  const executable = await writeExecutable(
    directory,
    "backend",
    `
const authorization = "Basic " + btoa("opencode:live-web-secret")
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.OPENCODE_BACKEND_PORT),
  fetch(request, server) {
    const url = new URL(request.url)
    if (request.headers.get("authorization") !== authorization) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "www-authenticate": 'Basic realm="Secure Area"' },
      })
    }
    if (url.pathname === "/api/socket") {
      if (server.upgrade(request)) return
      return new Response("WebSocket upgrade required", { status: 426 })
    }
    if (url.pathname === "/api/event") {
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"server.connected"}\\n\\n'))
        },
      }), { headers: { "content-type": "text/event-stream" } })
    }
    return Response.json({ healthy: true })
  },
  websocket: {
    open(socket) {
      socket.send("connected")
    },
    message() {},
  },
})
const stop = () => {
  server.stop(true)
  process.exit()
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
await new Promise(() => {})
`,
  )
  using reservation = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
  const port = reservation.port
  reservation.stop(true)
  const child = Bun.spawn([executable], {
    env: { ...process.env, OPENCODE_BACKEND_PORT: String(port) },
    stdout: "ignore",
    stderr: "inherit",
  })
  const url = new URL(`http://127.0.0.1:${port}`)
  await waitFor(() =>
    requestUrl(new URL("/api/health", url).href).then(
      (response) => response.status === 401,
      () => false,
    ),
  )
  return {
    url,
    async [Symbol.asyncDispose]() {
      child.kill("SIGTERM")
      await child.exited
    },
  }
}

async function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), "opencode-live-web-"))
  fixtures.push(directory)
  const browser = await writeExecutable(
    directory,
    "browser",
    `await Bun.write(process.env.OPENCODE_BROWSER_MARKER, Bun.argv[2])`,
  )
  return { directory, browser }
}

async function writeExecutable(directory: string, name: string, source: string) {
  const script = join(directory, `${name}.ts`)
  await Bun.write(script, source)
  if (process.platform === "win32") {
    const executable = join(directory, `${name}.cmd`)
    await Bun.write(executable, `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`)
    return executable
  }

  const executable = join(directory, name)
  await Bun.write(executable, `#!/usr/bin/env bun\n${source}`)
  chmodSync(executable, 0o755)
  return executable
}

async function waitFor(check: () => boolean | Promise<boolean>) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return
    await Bun.sleep(100)
  }
  throw new Error("Timed out waiting for live web launcher")
}

function requestUrl(url: string, headers?: Record<string, string>) {
  return new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }>(
    (resolve, reject) => {
      const outgoing = request(url, { headers }, (response) => {
        const chunks: Buffer[] = []
        response.on("data", (chunk) => chunks.push(chunk))
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString(),
          }),
        )
      })
      outgoing.on("error", reject)
      outgoing.end()
    },
  )
}

function readFirstChunk(url: string, headers: Record<string, string>) {
  return new Promise<{ headers: Record<string, string | string[] | undefined>; body: string }>((resolve, reject) => {
    const outgoing = request(url, { headers }, (response) => {
      response.once("data", (chunk) => {
        resolve({ headers: response.headers, body: Buffer.from(chunk).toString() })
        response.destroy()
      })
      response.on("error", reject)
    })
    outgoing.on("error", reject)
    outgoing.end()
  })
}

async function readWebSocket(url: string) {
  const source = `
const { randomBytes } = require("node:crypto")
const { request } = require("node:http")
const target = new URL(process.argv[1])
target.protocol = "http:"
const outgoing = request(target, {
  headers: {
    Authorization: "Basic " + Buffer.from("opencode:live-web-secret").toString("base64"),
    Connection: "Upgrade",
    Upgrade: "websocket",
    "Sec-WebSocket-Key": randomBytes(16).toString("base64"),
    "Sec-WebSocket-Version": "13",
  },
})
const timeout = setTimeout(() => outgoing.destroy(new Error("WebSocket proxy connection timed out")), 5000)
outgoing.on("upgrade", (response, socket, head) => {
  if (response.statusCode !== 101) throw new Error("WebSocket proxy returned " + response.statusCode)
  let received = head
  const complete = () => {
    if (!received.toString().includes("connected")) return
    clearTimeout(timeout)
    process.stdout.write("connected")
    socket.destroy()
  }
  complete()
  socket.on("data", (chunk) => {
    received = Buffer.concat([received, chunk])
    complete()
  })
})
outgoing.on("response", (response) => {
  clearTimeout(timeout)
  console.error("WebSocket proxy returned " + response.statusCode)
  process.exitCode = 1
})
outgoing.on("error", (error) => {
  clearTimeout(timeout)
  console.error(error.message)
  process.exitCode = 1
})
outgoing.end()
`
  const child = Bun.spawn(["node", "-e", source, url], { stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (exitCode !== 0) throw new Error(stderr.trim() || "WebSocket proxy connection failed")
  return stdout
}
