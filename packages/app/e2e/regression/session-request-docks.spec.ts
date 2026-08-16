import { base64Encode } from "@opencode-ai/core/util/encode"
import { expect, test, type Page } from "@playwright/test"
import { mockOpenCodeServer } from "../utils/mock-server"
import { installSseTransport } from "../utils/sse-transport"
import { expectSessionTitle } from "../utils/waits"

const directory = "C:/OpenCode/RequestDocks"
const projectID = "proj_request_docks"
const sessionID = "ses_request_docks"
const title = "Request dock regression"

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

test("confirms persistent permission and waits for authoritative removal", async ({ page }) => {
  const transport = await installSseTransport(page, {
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
  let replyRequests = 0
  await page.route(`**/api/session/${sessionID}/permission/permission-always/reply`, async (route) => {
    replyRequests += 1
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
  await expect(permission.locator('[data-slot="permission-footer-actions"] button')).toHaveCount(3)
  await expect(page.locator('[data-component="session-composer"]')).toHaveCount(0)

  await permission.getByRole("button", { name: "Allow always" }).click()
  await expect(permission.getByRole("button", { name: "Confirm" })).toBeFocused()
  await expect(permission.getByText("Always allow")).toBeVisible()
  await expect(permission.getByText("git *", { exact: true })).toBeVisible()
  await expect(permission.getByText("jj *", { exact: true })).toBeVisible()
  await expect(permission.getByText("This will allow the following patterns until OpenCode is restarted.")).toBeVisible()

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
  const transport = await installSseTransport(page, {
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
    permissions: [
      {
        id: "permission-child-reject",
        sessionID: childID,
        action: "webfetch",
        resources: ["https://example.com"],
        metadata: {},
      },
    ],
    sessionStatus: { [childID]: { type: "running" } },
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
        action: "webfetch",
        resources: ["https://example.com"],
        metadata: {},
      },
    },
  })

  const permission = page.locator('[data-component="dock-prompt"][data-kind="permission"]')
  await expect(permission.getByText("Requested by Research subagent")).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/session/${sessionID}$`))

  await permission.getByRole("button", { name: "Deny" }).click()
  await expect(permission.getByText("Requested by Research subagent")).toBeVisible()
  const feedback = permission.getByRole("textbox", { name: "Corrective feedback" })
  await expect(feedback).toBeFocused()
  await feedback.fill("Use the internal documentation instead")
  const reply = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === `/api/session/${childID}/permission/permission-child-reject/reply`,
  )
  await permission.getByRole("button", { name: "Deny permission" }).click()
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
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "No reply" }) })
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
  const transport = await installSseTransport(page, {
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

async function mockServer(
  page: Page,
  requests: {
    permissions?: unknown[] | (() => unknown[])
    questions?: unknown[] | (() => unknown[])
    forms?: unknown[] | (() => unknown[])
    sessionStatus?: Record<string, unknown>
    sessions?: ({ id: string } & Record<string, unknown>)[]
  },
) {
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
      ...(requests.sessions ?? []),
    ],
    pageMessages: () => ({ items: [] }),
    permissions: requests.permissions,
    questions: requests.questions,
    forms: requests.forms,
    sessionStatus: requests.sessionStatus,
  })
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
  })
}
