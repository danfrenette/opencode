import { base64Encode } from "@opencode-ai/core/util/encode"
import type {
  FormCancelled,
  FormCreated,
  FormInfo,
  FileDiffInfo,
  PermissionAsked,
  PermissionReplied,
  PermissionRequest,
  SessionCreated,
  SessionInfo,
  SessionStatus,
} from "@opencode-ai/client/promise"
import { expect, test, type Page } from "@playwright/test"
import { mockOpenCodeServer } from "../utils/mock-server"
import { installSseTransport } from "../utils/sse-transport"
import { expectSessionTitle } from "../utils/waits"

const directory = "C:/OpenCode/RequestDocks"
const projectID = "proj_request_docks"
const sessionID = "ses_request_docks"
const title = "Request dock regression"

type RequestDockEvent = {
  directory: string
  payload:
    | { type: SessionCreated["type"]; properties: SessionCreated["data"] }
    | { type: PermissionAsked["type"]; properties: PermissionAsked["data"] }
    | { type: PermissionReplied["type"]; properties: PermissionReplied["data"] }
    | { type: FormCreated["type"]; properties: FormCreated["data"] }
    | { type: FormCancelled["type"]; properties: FormCancelled["data"] }
}

type SessionFixture = Pick<SessionInfo, "id" | "parentID" | "projectID" | "title" | "time"> & {
  slug: string
  directory: string
  version: string
}

type RequestDockFixtures = {
  permissions?: PermissionRequest[] | (() => PermissionRequest[])
  forms?: FormInfo[] | (() => FormInfo[])
  sessionStatus?: Record<string, SessionStatus>
  sessions?: SessionFixture[]
  vcsDiff?: FileDiffInfo[]
}

test("shows a pending question dock", async ({ page }) => {
  await mockServer(page, {
    forms: [
      {
        id: "frm_question_request",
        sessionID,
        title: "Questions",
        metadata: { kind: "question" },
        fields: [
          {
            key: "q0",
            type: "string",
            title: "Implementation",
            description: "Which implementation should be used?",
            options: [
              { value: "minimal", label: "Minimal", description: "Use the smallest correct change" },
              { value: "extended", label: "Extended", description: "Include additional behavior" },
            ],
            custom: true,
          },
        ],
      },
    ],
  })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await expectSessionTitle(page, title)

  const question = page.locator('[data-component="dock-prompt"][data-kind="question"]')
  await expect(question).toBeVisible()
  await expect(question.getByText("Which implementation should be used?")).toBeVisible()
  await expect(question.getByRole("radio", { name: /Minimal/ })).toBeVisible()
  await expect(question.getByRole("radio", { name: /Extended/ })).toBeVisible()
  await expect(page.locator('[data-component="session-composer"]')).toHaveCount(0)

  const rejectRequests: string[] = []
  page.on("request", (request) => {
    if (request.method() !== "POST") return
    if (new URL(request.url()).pathname === `/api/session/${sessionID}/form/frm_question_request/cancel`)
      rejectRequests.push(request.url())
  })

  await question.locator('[data-component="icon-button"][data-icon="chevron-down"]').click()
  await expect(question).toBeVisible()
  await expect(question.getByText("Which implementation should be used?")).toBeVisible()
  await expect(question.getByText("Select one answer")).toBeHidden()
  await expect(question.getByRole("radio", { name: /Minimal/ })).toBeHidden()
  await expect(question.getByRole("radio", { name: /Extended/ })).toBeHidden()
  await expect(question.getByRole("button", { name: "Dismiss" })).toBeVisible()
  await expect(question.getByRole("button", { name: "Submit" })).toBeVisible()
  await expect(page.locator('[data-component="question-minimized-dock"]')).toHaveCount(0)
  expect(rejectRequests).toEqual([])

  await question.locator('[data-component="icon-button"][data-icon="chevron-down"]').click()
  await expect(question).toBeVisible()
  await expect(question.getByText("Which implementation should be used?")).toBeVisible()
  await expect(question.getByRole("radio", { name: /Minimal/ })).toBeVisible()
  expect(rejectRequests).toEqual([])

  await question.getByRole("radio", { name: /Minimal/ }).click()
  const reply = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === `/api/session/${sessionID}/form/frm_question_request/reply`,
  )
  await question.getByRole("button", { name: "Submit" }).click()
  expect((await reply).postDataJSON()).toEqual({ answer: { q0: "minimal" } })
})

test("previews a pending edit without hiding permission choices", async ({ page }) => {
  await mockServer(page, {
    permissions: [
      {
        id: "permission-edit-small",
        sessionID,
        action: "edit",
        resources: ["src/config.ts"],
        save: ["*"],
        metadata: {
          files: [
            {
              file: "src/config.ts",
              patch: "@@ -1 +1 @@\n-export const mode = 'old'\n+export const mode = 'new'\n",
              additions: 1,
              deletions: 1,
              status: "modified",
            },
          ],
        },
      },
    ],
  })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await expectSessionTitle(page, title)

  const permission = page.locator('[data-component="dock-prompt"][data-kind="permission"]')
  await expect(permission.getByText("export const mode = 'old'", { exact: true })).toBeVisible()
  await expect(permission.getByText("export const mode = 'new'", { exact: true })).toBeVisible()
  await expect
    .poll(() =>
      permission
        .locator('[data-slot="permission-preview-scroll"]')
        .evaluate((element) => element.scrollHeight === element.clientHeight),
    )
    .toBe(true)
  await expect(permission.getByRole("button", { name: "Allow once" })).toBeEnabled()
  await expect(permission.getByRole("button", { name: "Allow always" })).toBeEnabled()
  await expect(permission.getByRole("button", { name: "Deny" })).toBeEnabled()
  await permission.getByRole("button", { name: "Allow always" }).click()
  await expect(permission.getByRole("button", { name: "Confirm" })).toBeFocused()
  await expect(permission.getByText("export const mode = 'new'", { exact: true })).toBeVisible()
})

test("selects preview files without losing decision state and resets for the next request", async ({ page }) => {
  const transport = await installSseTransport<RequestDockEvent>(page, {
    server: `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`,
    retry: 20,
  })
  await mockServer(page, {
    permissions: [
      {
        id: "permission-edit-multi",
        sessionID,
        action: "edit",
        resources: ["src/first.ts", "src/second.ts"],
        save: ["*"],
        metadata: {
          files: [
            {
              file: "src/first.ts",
              patch: "@@ -1 +1 @@\n-first old content\n+first new content\n",
              additions: 1,
              deletions: 1,
              status: "modified",
            },
            {
              file: "src/second.ts",
              patch: "@@ -1 +1 @@\n-second old content\n+second new content\n",
              additions: 1,
              deletions: 1,
              status: "modified",
            },
          ],
        },
      },
      {
        id: "permission-edit-next",
        sessionID,
        action: "edit",
        resources: ["src/next.ts"],
        save: [],
        metadata: {
          files: [
            {
              file: "src/next.ts",
              patch: "@@ -1 +1 @@\n-next old content\n+next new content\n",
              additions: 1,
              deletions: 1,
              status: "modified",
            },
          ],
        },
      },
    ],
  })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await transport.waitForConnection()
  await expectSessionTitle(page, title)

  const permission = page.locator('[data-component="dock-prompt"][data-kind="permission"]')
  await expect(permission.getByText("first new content", { exact: true })).toBeVisible()
  await permission.getByRole("button", { name: "Deny" }).click()
  const feedback = permission.getByRole("textbox", { name: "Corrective feedback" })
  await feedback.fill("Keep the public API")

  const selector = permission.getByRole("button", { name: /^Preview file/ })
  await selector.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("option", { name: "src/second.ts Modified +1 -1" })).toBeVisible()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
  await expect(permission.getByText("second new content", { exact: true })).toBeVisible()
  await expect(permission.getByRole("button", { name: "Deny permission" })).toBeVisible()
  await expect(feedback).toHaveValue("Keep the public API")

  await transport.send({
    directory,
    payload: {
      type: "permission.replied",
      properties: { sessionID, requestID: "permission-edit-multi", reply: "reject" },
    },
  })
  await expect(permission.getByText("next new content", { exact: true })).toBeVisible()
  await expect(permission.getByRole("button", { name: "Allow once" })).toBeFocused()
  await expect(permission.getByRole("textbox", { name: "Corrective feedback" })).toHaveCount(0)
  await expect(permission.getByRole("button", { name: /^Preview file/ })).toHaveCount(0)
})

test("expands pending edits into desktop review with shared selection and decision state", async ({ page }) => {
  await mockServer(page, {
    permissions: [
      {
        id: "permission-edit-review",
        sessionID,
        action: "edit",
        resources: ["src/first.ts", "src/second.ts"],
        save: ["*"],
        metadata: {
          files: [
            {
              file: "src/first.ts",
              patch: "@@ -1 +1 @@\n-first old review\n+first new review\n",
              additions: 1,
              deletions: 1,
              status: "modified",
            },
            {
              file: "src/second.ts",
              patch: "@@ -1 +1 @@\n-second old review\n+second new review\n",
              additions: 1,
              deletions: 1,
              status: "modified",
            },
          ],
        },
      },
    ],
  })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await expectSessionTitle(page, title)

  const compact = page.locator('[data-permission-surface="compact"]')
  const selector = compact.getByRole("button", { name: /^Preview file/ })
  await selector.click()
  await page.getByRole("option", { name: "src/second.ts Modified +1 -1" }).click()
  await compact.getByRole("button", { name: "Deny" }).click()
  await compact.getByRole("textbox", { name: "Corrective feedback" }).fill("Keep the shared review state")

  await compact.getByRole("button", { name: "Review changes" }).click()

  const panel = page.locator("#review-panel")
  const review = panel.locator('[data-component="session-review-v2"]')
  const reviewPermission = panel.locator('[data-permission-surface="review"]')
  await expect(review).toBeVisible()
  await expect(panel.getByText("second new review", { exact: true })).toBeVisible()
  await expect(reviewPermission.getByRole("textbox", { name: "Corrective feedback" })).toHaveValue(
    "Keep the shared review state",
  )
  await expect(panel.locator('[data-slot="line-comment-v2-overflow"]')).toHaveCount(0)

  await panel.getByRole("button", { name: "first.ts", exact: true }).click()
  await expect(panel.getByText("first new review", { exact: true })).toBeVisible()
  await expect(compact.getByRole("textbox", { name: "Corrective feedback" })).toHaveValue(
    "Keep the shared review state",
  )

  await reviewPermission.getByRole("button", { name: "Close review" }).click()
  await expect(reviewPermission).toHaveCount(0)
  await expect(compact.getByText("first new review", { exact: true })).toBeVisible()
  await expect(compact.getByRole("textbox", { name: "Corrective feedback" })).toHaveValue(
    "Keep the shared review state",
  )
})

test("keeps permission decisions reachable in expanded mobile review", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 })
  await mockServer(page, {
    permissions: [
      {
        id: "permission-edit-mobile-review",
        sessionID,
        action: "edit",
        resources: ["src/mobile-first.ts", "src/mobile-second.ts"],
        save: ["*"],
        metadata: {
          files: [
            {
              file: "src/mobile-first.ts",
              patch: "@@ -1 +1 @@\n-mobile first old\n+mobile first new\n",
              additions: 1,
              deletions: 1,
              status: "modified",
            },
            {
              file: "src/mobile-second.ts",
              patch: "@@ -1 +1 @@\n-mobile second old\n+mobile second new\n",
              additions: 1,
              deletions: 1,
              status: "modified",
            },
          ],
        },
      },
    ],
  })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await expectSessionTitle(page, title)

  const permission = page.locator('[data-permission-surface="compact"]')
  await permission.getByRole("button", { name: /^Preview file/ }).click()
  await page.getByRole("option", { name: "src/mobile-second.ts Modified +1 -1" }).click()
  await permission.getByRole("button", { name: "Allow always" }).click()
  await permission.getByRole("button", { name: "Review changes" }).click()

  const review = page.locator('[data-component="session-review"]')
  await expect(page.getByRole("tab", { name: /Files Changed/, selected: true })).toBeVisible()
  await expect(review.getByText("mobile second new", { exact: true })).toBeVisible()
  await expect(permission.getByRole("button", { name: "Confirm" })).toBeVisible()
  await expect(permission.getByRole("button", { name: "Close review" })).toBeInViewport()
  await expect(review.locator('[data-slot="line-comment-button"]')).toHaveCount(0)

  await page.setViewportSize({ width: 1024, height: 800 })
  await expect(page.locator('#review-panel [data-component="session-review-v2"]')).toBeVisible()
  await expect(page.locator('#review-panel [data-permission-surface="review"]')).toBeVisible()
  await page.setViewportSize({ width: 430, height: 800 })
  await expect(page.getByRole("tab", { name: /Files Changed/, selected: true })).toBeVisible()

  await review.locator('[data-file="src/mobile-first.ts"]').getByRole("button").click()
  await expect(review.getByText("mobile first new", { exact: true })).toBeVisible()
  await permission.getByRole("button", { name: "Close review" }).click()

  await expect(page.getByRole("tab", { name: "Session", selected: true })).toBeVisible()
  await expect(permission.getByText("mobile first new", { exact: true })).toBeVisible()
  await expect(permission.getByRole("button", { name: "Confirm" })).toBeVisible()
})

test("restores normal review only after authoritative permission replacement", async ({ page }) => {
  const transport = await installSseTransport<RequestDockEvent>(page, {
    server: `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`,
    retry: 20,
  })
  await mockServer(page, {
    vcsDiff: [
      {
        file: "src/normal-first.ts",
        patch: "@@ -1 +1 @@\n-normal first old\n+normal first new\n",
        additions: 1,
        deletions: 1,
        status: "modified",
      },
      {
        file: "src/normal-second.ts",
        patch: "@@ -1 +1 @@\n-normal second old\n+normal second new\n",
        additions: 1,
        deletions: 1,
        status: "modified",
      },
    ],
    permissions: [
      {
        id: "permission-edit-authoritative",
        sessionID,
        action: "edit",
        resources: ["src/pending.ts"],
        save: [],
        metadata: {
          files: [
            {
              file: "src/pending.ts",
              patch: "@@ -1 +1 @@\n-pending old\n+pending new\n",
              additions: 1,
              deletions: 1,
              status: "modified",
            },
          ],
        },
      },
      {
        id: "permission-edit-sequential",
        sessionID,
        action: "edit",
        resources: ["src/sequential.ts"],
        save: [],
        metadata: {
          files: [
            {
              file: "src/sequential.ts",
              patch: "@@ -1 +1 @@\n-sequential old\n+sequential new\n",
              additions: 1,
              deletions: 1,
              status: "modified",
            },
          ],
        },
      },
    ],
  })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await transport.waitForConnection()
  await expectSessionTitle(page, title)

  await page.getByRole("button", { name: "Toggle review" }).click()
  const panel = page.locator("#review-panel")
  await panel.getByRole("button", { name: "normal-second.ts", exact: true }).click()
  await expect(panel.locator('[data-slot="session-review-v2-file-name"]')).toHaveText("normal-second.ts")
  await panel.getByRole("searchbox", { name: "Filter files" }).fill("normal-second")
  await page.getByRole("button", { name: "Toggle review" }).click()
  await expect(panel).toHaveCount(0)

  const compact = page.locator('[data-permission-surface="compact"]')
  await compact.getByRole("button", { name: "Review changes" }).click()
  const reviewPermission = panel.locator('[data-permission-surface="review"]')
  await expect(panel.getByText("pending new", { exact: true })).toBeVisible()

  const reply = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === `/api/session/${sessionID}/permission/permission-edit-authoritative/reply`,
  )
  await reviewPermission.getByRole("button", { name: "Allow once" }).click()
  expect((await reply).postDataJSON()).toEqual({ reply: "once" })
  await expect(reviewPermission.getByRole("button", { name: "Allow once" })).toBeDisabled()
  await expect(panel.getByText("pending new", { exact: true })).toBeVisible()

  await transport.send({
    directory,
    payload: {
      type: "permission.replied",
      properties: { sessionID, requestID: "permission-edit-authoritative", reply: "once" },
    },
  })

  await expect(reviewPermission).toHaveCount(0)
  await expect(panel).toHaveCount(0)
  await expect(compact.getByText("sequential new", { exact: true })).toBeVisible()
  await expect(compact.getByRole("button", { name: "Allow once" })).toBeFocused()
  await expect(compact.getByRole("button", { name: "Review changes" })).toHaveAttribute("aria-expanded", "false")

  await page.getByRole("button", { name: "Toggle review" }).click()
  await expect(page.getByRole("button", { name: "Git changes" })).toBeVisible()
  await expect(panel.locator('[data-slot="session-review-v2-file-name"]')).toHaveText("normal-second.ts")
  await expect(panel.getByRole("searchbox", { name: "Filter files" })).toHaveValue("normal-second")
})

test("warns for malformed edit metadata without blocking a decision", async ({ page }) => {
  await mockServer(page, {
    permissions: [
      {
        id: "permission-edit-malformed",
        sessionID,
        action: "edit",
        resources: ["src/valid.ts", "src/invalid.ts"],
        save: [],
        metadata: {
          files: [
            {
              file: "src/valid.ts",
              patch: "@@ -1 +1 @@\n-valid old content\n+valid new content\n",
              additions: 1,
              deletions: 1,
              status: "modified",
            },
            {
              file: "src/invalid.ts",
              patch: "@@ -1 +1 @@\n-invalid old content\n+invalid new content\n",
              additions: -1,
              deletions: 1,
              status: "modified",
            },
          ],
        },
      },
    ],
  })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await expectSessionTitle(page, title)

  const permission = page.locator('[data-component="dock-prompt"][data-kind="permission"]')
  await expect(
    permission.getByText("A preview isn't available for this edit. You can still allow or deny it."),
  ).toBeVisible()
  await expect(permission.getByText("valid new content", { exact: true })).toHaveCount(0)
  await expect(permission.getByRole("button", { name: "Allow once" })).toBeEnabled()
  await expect(permission.getByRole("button", { name: "Deny" })).toBeEnabled()
  await expect(permission.getByRole("button", { name: "Review changes" })).toHaveCount(0)

  const reply = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === `/api/session/${sessionID}/permission/permission-edit-malformed/reply`,
  )
  await permission.getByRole("button", { name: "Allow once" }).click()
  expect((await reply).postDataJSON()).toEqual({ reply: "once" })
  await expect(permission.getByRole("button", { name: "Allow once" })).toBeDisabled()
  await expect(permission.getByRole("button", { name: "Deny" })).toBeDisabled()
})

test("keeps a large mobile edit preview bounded and its actions reachable", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 })
  const lines = Array.from({ length: 120 }, (_, index) => index + 1)
  const patch = [
    "@@ -1,120 +1,120 @@",
    ...lines.map((line) => `-old mobile line ${line}`),
    ...lines.map((line) => `+new mobile line ${line}`),
    "",
  ].join("\n")
  await mockServer(page, {
    permissions: [
      {
        id: "permission-edit-large",
        sessionID,
        action: "edit",
        resources: ["src/large.ts", "src/small.ts"],
        save: ["*"],
        metadata: {
          files: [
            {
              file: "src/large.ts",
              patch,
              additions: 120,
              deletions: 120,
              status: "modified",
            },
            {
              file: "src/small.ts",
              patch: "@@ -1 +1 @@\n-small old content\n+small new content\n",
              additions: 1,
              deletions: 1,
              status: "modified",
            },
          ],
        },
      },
    ],
  })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await expectSessionTitle(page, title)

  const permission = page.locator('[data-component="dock-prompt"][data-kind="permission"]')
  const preview = permission.locator('[data-slot="permission-preview-scroll"]')
  await expect(permission.getByText("new mobile line 120", { exact: true })).toBeVisible()
  await expect.poll(() => preview.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  await expect
    .poll(() =>
      permission
        .locator('[data-component="file"] [data-line-number-content]')
        .evaluateAll((elements) => elements.every((element) => element.getClientRects().length === 0)),
    )
    .toBe(true)

  const selector = permission.getByRole("button", { name: /^Preview file/ })
  const once = permission.getByRole("button", { name: "Allow once" })
  await expect(selector).toBeInViewport()
  await expect(once).toBeInViewport()
  await expect
    .poll(() =>
      once.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return (
          bounds.top >= 0 &&
          bounds.left >= 0 &&
          bounds.bottom <= window.innerHeight &&
          bounds.right <= window.innerWidth
        )
      }),
    )
    .toBe(true)
  await expect
    .poll(() => selector.evaluate((element) => element.getBoundingClientRect().height))
    .toBeGreaterThanOrEqual(44)
  await expect.poll(() => once.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
})

test("confirms persistent permission and waits for authoritative removal", async ({ page }) => {
  const transport = await installSseTransport<RequestDockEvent>(page, {
    server: `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`,
    retry: 20,
  })
  await mockServer(page, {
    permissions: [
      {
        id: "permission-always",
        sessionID,
        action: "shell",
        resources: ["git status", "git diff"],
        save: ["git *", "jj *"],
        metadata: {},
      },
      {
        id: "permission-next",
        sessionID,
        action: "shell",
        resources: ["pwd"],
        save: [],
        metadata: {},
      },
    ],
  })
  const replyGate = Promise.withResolvers<void>()
  const replyIntercepted = Promise.withResolvers<void>()
  let replyRequests = 0
  await page.route(`**/api/session/${sessionID}/permission/permission-always/reply`, async (route) => {
    replyRequests += 1
    replyIntercepted.resolve()
    await replyGate.promise
    await route.fulfill({ status: 204 })
  })

  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await transport.waitForConnection()
  await expectSessionTitle(page, title)

  const permission = page.locator('[data-component="dock-prompt"][data-kind="permission"]')
  await expect(permission).toBeVisible()
  await expect(permission.getByText("git status")).toBeVisible()
  await expect(permission.getByText("git diff")).toBeVisible()
  await expect(permission.locator('[data-slot="permission-preview"]')).toHaveCount(0)
  await expect(permission.getByRole("button", { name: "Review changes" })).toHaveCount(0)
  await expect(permission.locator('[data-slot="permission-footer-actions"] button')).toHaveCount(3)
  await expect(page.locator('[data-component="session-composer"]')).toHaveCount(0)

  await permission.getByRole("button", { name: "Allow always" }).click()
  await expect(permission.getByRole("button", { name: "Confirm" })).toBeFocused()
  await expect(permission.getByText("Always allow")).toBeVisible()
  await expect(permission.getByText("git *", { exact: true })).toBeVisible()
  await expect(permission.getByText("jj *", { exact: true })).toBeVisible()
  await expect(
    permission.getByText("This will allow the following patterns until OpenCode is restarted."),
  ).toBeVisible()
  await permission.getByRole("button", { name: "Cancel" }).click()
  await expect(permission.getByRole("button", { name: "Allow always" })).toBeFocused()
  await permission.getByRole("button", { name: "Allow always" }).click()

  const reply = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === `/api/session/${sessionID}/permission/permission-always/reply`,
  )
  const replyResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === `/api/session/${sessionID}/permission/permission-always/reply`,
  )
  await permission.getByRole("button", { name: "Confirm" }).click()
  const request = await reply
  await replyIntercepted.promise
  expect(new URL(request.url()).pathname).toBe(`/api/session/${sessionID}/permission/permission-always/reply`)
  expect(request.postDataJSON()).toEqual({ reply: "always" })
  expect(replyRequests).toBe(1)
  await expect(permission).toBeVisible()
  await expect(permission.getByRole("button", { name: "Confirm" })).toBeDisabled()
  replyGate.resolve()
  await replyResponse
  expect(replyRequests).toBe(1)
  await expect(permission.getByRole("button", { name: "Confirm" })).toBeDisabled()

  await transport.send({
    directory,
    payload: {
      type: "permission.replied",
      properties: { sessionID, requestID: "permission-always", reply: "always" },
    },
  })
  await expect(permission.getByText("pwd", { exact: true })).toBeVisible()
  await expect(permission.getByRole("button", { name: "Allow once" })).toBeEnabled()
  await expect(permission.getByRole("button", { name: "Deny" })).toBeEnabled()
  await expect(permission.getByRole("button", { name: "Allow always" })).toHaveCount(0)
  await expect(permission.getByText("Always allow")).toHaveCount(0)
  await expect(permission.getByRole("button", { name: "Allow once" })).toBeFocused()

  const onceReply = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === `/api/session/${sessionID}/permission/permission-next/reply`,
  )
  await permission.getByRole("button", { name: "Allow once" }).click()
  const onceRequest = await onceReply
  expect(new URL(onceRequest.url()).pathname).toBe(`/api/session/${sessionID}/permission/permission-next/reply`)
  expect(onceRequest.postDataJSON()).toEqual({ reply: "once" })
  await expect(permission.getByRole("button", { name: "Allow once" })).toBeDisabled()
  await expect(permission.getByRole("button", { name: "Deny" })).toBeDisabled()
})

test("denies a child permission with corrective feedback without leaving the parent", async ({ page }) => {
  const childID = "ses_permission_child"
  const transport = await installSseTransport<RequestDockEvent>(page, {
    server: `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`,
    retry: 20,
  })
  await mockServer(page, {
    sessions: [
      {
        id: childID,
        parentID: sessionID,
        slug: "permission-child",
        projectID,
        directory,
        title: "Research subagent",
        version: "dev",
        time: { created: 1700000001000, updated: 1700000001000 },
      },
    ],
    permissions: [],
    sessionStatus: { [childID]: { type: "busy" } },
  })

  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await transport.waitForConnection()
  await expectSessionTitle(page, title)
  await transport.send({
    directory,
    payload: {
      type: "session.created",
      properties: {
        sessionID: childID,
        parentID: sessionID,
        slug: "permission-child",
        projectID,
        location: { directory },
        title: "Research subagent",
        version: "dev",
        agent: "general",
      },
    },
  })
  await transport.send({
    directory,
    payload: {
      type: "permission.asked",
      properties: {
        id: "permission-child-reject",
        sessionID: childID,
        action: "edit",
        resources: ["src/child.ts"],
        metadata: {
          files: [
            {
              file: "src/child.ts",
              patch: "@@ -1 +1 @@\n-child old content\n+child new content\n",
              additions: 1,
              deletions: 1,
              status: "modified",
            },
          ],
        },
      },
    },
  })

  const permission = page.locator('[data-component="dock-prompt"][data-kind="permission"]')
  await expect(permission.getByText("Requested by Research subagent")).toBeVisible()
  await expect(permission.getByText("child new content", { exact: true })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/session/${sessionID}$`))

  await permission.getByRole("button", { name: "Deny" }).click()
  await expect(permission.getByText("Requested by Research subagent")).toBeVisible()
  await expect(permission.getByText("child new content", { exact: true })).toBeVisible()
  const feedback = permission.getByRole("textbox", { name: "Corrective feedback" })
  await expect(feedback).toBeFocused()
  await permission.getByRole("button", { name: "Cancel" }).click()
  await expect(permission.getByRole("button", { name: "Deny" })).toBeFocused()
  await permission.getByRole("button", { name: "Deny" }).click()
  await feedback.fill("Use the internal documentation instead")
  await permission.getByRole("button", { name: "Review changes" }).click()
  const reviewPermission = page.locator('#review-panel [data-permission-surface="review"]')
  await expect(reviewPermission.getByText("Requested by Research subagent")).toBeVisible()
  await expect(reviewPermission.getByRole("textbox", { name: "Corrective feedback" })).toHaveValue(
    "Use the internal documentation instead",
  )
  const reply = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === `/api/session/${childID}/permission/permission-child-reject/reply`,
  )
  await reviewPermission.getByRole("button", { name: "Deny permission" }).click()
  const request = await reply
  expect(new URL(request.url()).pathname).toBe(`/api/session/${childID}/permission/permission-child-reject/reply`)
  expect(request.postDataJSON()).toEqual({ reply: "reject", message: "Use the internal documentation instead" })
  await expect(page).toHaveURL(new RegExp(`/session/${sessionID}$`))
})

test("allows empty rejection feedback and preserves feedback after a failed reply", async ({ page }) => {
  await mockServer(page, {
    permissions: [
      {
        id: "permission-retry",
        sessionID,
        action: "shell",
        resources: ["rm generated.txt"],
        metadata: {},
      },
    ],
  })
  let attempts = 0
  await page.route(`**/api/session/${sessionID}/permission/permission-retry/reply`, async (route) => {
    attempts += 1
    if (attempts === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "No reply" }),
      })
      return
    }
    await route.fulfill({ status: 204 })
  })

  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await expectSessionTitle(page, title)

  const permission = page.locator('[data-component="dock-prompt"][data-kind="permission"]')
  await permission.getByRole("button", { name: "Deny" }).click()
  const feedback = permission.getByRole("textbox", { name: "Corrective feedback" })
  await feedback.fill("Keep generated files")
  await permission.getByRole("button", { name: "Deny permission" }).click()

  await expect(page.getByText("Request failed")).toBeVisible()
  await expect(feedback).toHaveValue("Keep generated files")
  await expect(permission.getByRole("button", { name: "Deny permission" })).toBeEnabled()

  await page.getByRole("button", { name: "Dismiss" }).click()
  await feedback.fill("")
  const reply = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === `/api/session/${sessionID}/permission/permission-retry/reply`,
  )
  await permission.getByRole("button", { name: "Deny permission" }).click()
  expect((await reply).postDataJSON()).toEqual({ reply: "reject" })
})

test("restores the draft caret before typing after a request dock closes", async ({ page }) => {
  const transport = await installSseTransport<RequestDockEvent>(page, {
    server: `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`,
    retry: 20,
  })
  await mockServer(page, { forms: [] })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await transport.waitForConnection()
  await expectSessionTitle(page, title)

  const editor = page.locator('[data-component="prompt-input"][contenteditable="true"]')
  const draft = "keep the caret at the end"
  await editor.fill(draft)
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  for (let index = 0; index < 4; index++) await page.keyboard.press("ArrowLeft")
  const cursor = draft.length - 4
  await expect
    .poll(() =>
      editor.evaluate((element) => {
        const selection = window.getSelection()
        if (!selection?.rangeCount || !element.contains(selection.anchorNode)) return -1
        const range = selection.getRangeAt(0).cloneRange()
        range.selectNodeContents(element)
        range.setEnd(selection.anchorNode!, selection.anchorOffset)
        return range.toString().length
      }),
    )
    .toBe(cursor)
  await transport.send({
    directory,
    payload: {
      type: "form.created",
      properties: {
        form: {
          id: "frm_question_caret",
          sessionID,
          title: "Questions",
          metadata: { kind: "question", tool: { messageID: "message-caret", id: "call-caret" } },
          fields: [
            {
              key: "q0",
              type: "string",
              title: "Continue",
              description: "Continue?",
              options: [{ value: "yes", label: "Yes", description: "Continue the session" }],
              custom: true,
            },
          ],
        },
      },
    },
  })
  const question = page.locator('[data-component="dock-prompt"][data-kind="question"]')
  await expect(question).toBeVisible()
  await expect(editor).toHaveCount(0)

  await transport.send({
    directory,
    payload: {
      type: "form.cancelled",
      properties: { sessionID, id: "frm_question_caret" },
    },
  })
  await expect(question).toHaveCount(0)
  await expect(editor).toBeVisible()
  await page.keyboard.press("x")

  await expect(editor).toHaveText(`${draft.slice(0, cursor)}x${draft.slice(cursor)}`)
})

async function mockServer(page: Page, fixtures: RequestDockFixtures) {
  await mockOpenCodeServer(page, {
    protocol: "v2",
    directory,
    project: {
      id: projectID,
      worktree: directory,
      vcs: "git",
      name: "request-docks",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "opencode",
          name: "OpenCode",
          models: {
            "claude-opus-4-6": {
              id: "claude-opus-4-6",
              name: "Claude Opus 4.6",
              limit: { context: 200_000 },
            },
          },
        },
      ],
      connected: ["opencode"],
      default: { providerID: "opencode", modelID: "claude-opus-4-6" },
    },
    sessions: [
      {
        id: sessionID,
        slug: "request-docks",
        projectID,
        directory,
        title,
        version: "dev",
        time: { created: 1700000000000, updated: 1700000000000 },
      },
      ...(fixtures.sessions ?? []),
    ],
    pageMessages: () => ({ items: [] }),
    permissions: fixtures.permissions,
    forms: fixtures.forms,
    sessionStatus: fixtures.sessionStatus,
    vcsDiff: fixtures.vcsDiff,
  })
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
  })
}
