import { afterEach, describe, expect, test } from "bun:test"
import { chmodSync, mkdtempSync, rmSync } from "fs"
import { createServer, request } from "http"
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
      expect(backend.requests.at(-1)).toEqual({ path: "/api/health", authorization })
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
  const requests: Array<{ path: string; authorization: string | null }> = []
  const server = createServer((request, response) => {
    const authorization = request.headers.authorization ?? null
    requests.push({ path: request.url ?? "", authorization })
    if (!authorization) {
      response.writeHead(401, { "www-authenticate": 'Basic realm="Secure Area"' })
      response.end("Unauthorized")
      return
    }
    response.setHeader("content-type", "application/json")
    response.end(JSON.stringify({ healthy: true }))
  })
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Test backend did not bind to a TCP port")
  return Object.assign(server, { url: new URL(`http://127.0.0.1:${address.port}`), requests })
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
