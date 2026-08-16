import { expect, test } from "@playwright/test"
import { fixture, pageMessages } from "../smoke/session-timeline.fixture"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectAppVisible } from "../utils/waits"

test.skip(!process.env.OPENCODE_DEV_SERVER_URL, "requires Vite proxy mode")

test("proxy startup selects the supplied server over persisted state", async ({ page }) => {
  await mockOpenCodeServer(page, {
    additionalServerPorts: ["4097"],
    sessions: fixture.sessions,
    provider: fixture.provider,
    directory: fixture.directory,
    project: fixture.project,
    pageMessages,
  })
  await page.addInitScript(() => {
    const persistedServer = "http://127.0.0.1:4097"
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
    localStorage.setItem("opencode.global.dat:server", JSON.stringify({ list: [persistedServer] }))
    localStorage.setItem(
      "opencode.global.dat:layout",
      JSON.stringify({
        home: {
          selection: {
            server: persistedServer,
            directory: "/persisted/project",
          },
        },
      }),
    )
  })

  await page.goto("/")

  await expect(page).toHaveURL("/")
  const proxyHost = new URL(page.url()).host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const selected = page.getByRole("button", { name: new RegExp(proxyHost) })
  await expectAppVisible(selected)
  await expect(selected).toHaveAttribute("data-selected", "")
})
