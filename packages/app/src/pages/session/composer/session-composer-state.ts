import { createEffect, createMemo, type Accessor } from "solid-js"
import { createStore } from "solid-js/store"
import type { FormInfo, PermissionRequest } from "@opencode-ai/client/promise"
import { useParams } from "@solidjs/router"
import { showToast } from "@/utils/toast"
import { useServerSDK } from "@/context/server-sdk"
import { useLanguage } from "@/context/language"
import { usePermission } from "@/context/permission"
import { useWorkspaceLocation } from "@/context/location"
import { sessionPermissionRequest, sessionQuestionForm } from "./session-request-tree"
import { useData } from "@/context/server"
import type { PermissionDecision } from "./session-permission-decision"
import { canonicalDiffs } from "@/utils/diffs"

export type PermissionStage = "permission" | "always" | "reject"

export const permissionRequestFiles = (request: PermissionRequest | undefined) => {
  if (request?.action !== "edit") return undefined
  return canonicalDiffs(request.metadata?.files)
}

function createSessionPermissionController(request: Accessor<PermissionRequest | undefined>) {
  const current = request()
  const initialFiles = permissionRequestFiles(current)
  const [store, setStore] = createStore({
    requestID: current?.id,
    sessionID: current?.sessionID,
    stage: "permission" as PermissionStage,
    message: "",
    file: initialFiles?.[0]?.file,
    open: initialFiles?.[0] ? [initialFiles[0].file] : ([] as string[]),
    expanded: false,
  })
  const files = createMemo(() => permissionRequestFiles(request()))

  createEffect(() => {
    const current = request()
    const nextFiles = files()
    if (store.requestID !== current?.id || store.sessionID !== current?.sessionID) {
      setStore({
        requestID: current?.id,
        sessionID: current?.sessionID,
        stage: "permission",
        message: "",
        file: nextFiles?.[0]?.file,
        open: nextFiles?.[0] ? [nextFiles[0].file] : [],
        expanded: false,
      })
      return
    }

    if (!nextFiles?.length) {
      setStore({ file: undefined, open: [], expanded: false })
      return
    }
    if (store.file && nextFiles.some((diff) => diff.file === store.file)) return
    setStore({ file: nextFiles[0].file, open: [nextFiles[0].file] })
  })

  const select = (file: string) => {
    if (!files()?.some((diff) => diff.file === file)) return
    setStore({ file, open: [file] })
  }

  return {
    files,
    stage: () => store.stage,
    message: () => store.message,
    setMessage: (message: string) => setStore("message", message),
    file: () => store.file,
    select,
    open: () => store.open,
    setOpen: (open: string[]) => {
      const allowed = new Set(files()?.map((diff) => diff.file))
      const next = Array.from(new Set(open.filter((file) => allowed.has(file))))
      const selected = next.find((file) => !store.open.includes(file))
      setStore("open", next)
      if (selected) setStore("file", selected)
    },
    expanded: () => store.expanded,
    expand: () => {
      if (!files()?.length) return
      setStore("expanded", true)
    },
    collapse: () => setStore("expanded", false),
    enter: (stage: Exclude<PermissionStage, "permission">) => setStore("stage", stage),
    cancel: () => setStore("stage", "permission"),
  }
}

export type SessionPermissionController = ReturnType<typeof createSessionPermissionController>

const idle = { type: "idle" as const }

export function createSessionComposerController() {
  const params = useParams()
  const sdk = useWorkspaceLocation()
  const serverSDK = useServerSDK()
  const data = useData()
  const language = useLanguage()
  const permissionContext = usePermission()
  createEffect(() => {
    const id = params.id
    if (!id || serverSDK.connection.status() !== "connected") return
    void Promise.all([
      data.shell.sync({ directory: sdk().directory }),
      data.session.permission.sync(id),
      data.session.form.sync(id),
    ]).catch(() => undefined)
  })

  const questionRequest = createMemo((): FormInfo | undefined => {
    return sessionQuestionForm(data.session.list(), data.session.form.list, params.id)
  })

  const permissionRequest = createMemo((): PermissionRequest | undefined => {
    return sessionPermissionRequest(data.session.list(), data.session.permission.list, params.id, (item) => {
      return !permissionContext.autoResponds(item, sdk().directory)
    })
  })
  const permissionState = createSessionPermissionController(permissionRequest)

  const blocked = createMemo(() => {
    const id = params.id
    if (!id) return false
    return !!permissionRequest() || !!questionRequest()
  })

  const primary = () => {
    const id = params.id
    return !!id && !data.session.get(id)?.parentID
  }
  const backgroundBlocking = createMemo(() => {
    if (!primary()) return []
    const id = params.id
    if (!id) return []
    const assistant = data.session.message
      .list(id)
      .findLast((message) => message.type === "assistant" && message.time.completed === undefined)
    if (assistant?.type !== "assistant") return []
    return assistant.content.flatMap((part) => {
      if (part.type !== "tool" || part.state.status !== "running") return []
      if (part.name !== "shell" && part.name !== "subagent") return []
      const value = part.name === "shell" ? part.state.metadata.shellID : part.state.metadata.sessionID
      const label = part.name === "shell" ? part.state.input.command : part.state.input.description
      return [
        {
          type: part.name as "shell" | "subagent",
          id: typeof value === "string" ? value : undefined,
          label: typeof label === "string" ? label : undefined,
        },
      ]
    })
  })
  const backgroundTasks = createMemo(() => {
    if (!primary()) return []
    const id = params.id
    if (!id) return []
    const blocking = backgroundBlocking()
    const messages = data.session.message.list(id)
    const completed = new Set(
      messages.flatMap((message) => {
        if (message.type !== "synthetic") return []
        if (message.metadata?.source === "subagent" && typeof message.metadata.childID === "string")
          return [message.metadata.childID]
        if (message.metadata?.source === "shell" && typeof message.metadata.jobID === "string")
          return [message.metadata.jobID]
        return []
      }),
    )
    const backgrounded = messages.flatMap((message) => {
      if (message.type !== "assistant") return []
      return message.content.flatMap((part) => {
        if (part.type !== "tool" || part.name !== "subagent") return []
        if (part.state.status !== "completed" || part.state.metadata?.status !== "running") return []
        const sessionID = part.state.metadata.sessionID
        if (typeof sessionID !== "string" || completed.has(sessionID)) return []
        const description = part.state.input.description
        return [
          {
            id: sessionID,
            type: "subagent" as const,
            label: typeof description === "string" ? description : sessionID,
          },
        ]
      })
    })
    const active = data.session.list().flatMap((info) => {
      if (info?.parentID !== id) return []
      if (data.session.status(info.id) === "idle") return []
      if (
        blocking.some(
          (item) => item.type === "subagent" && (item.id === info.id || (!!item.label && info.title === item.label)),
        )
      )
        return []
      return [{ id: info.id, type: "subagent" as const, label: info.title ?? info.id }]
    })
    const backgroundShells = messages.flatMap((message) => {
      if (message.type !== "assistant") return []
      return message.content.flatMap((part) => {
        if (part.type !== "tool" || part.name !== "shell" || completed.has(part.id)) return []
        if (part.state.status !== "completed" || part.state.metadata?.status !== "running") return []
        const shellID = part.state.metadata.shellID
        const command = part.state.input.command
        return [
          {
            id: typeof shellID === "string" ? shellID : part.id,
            type: "shell" as const,
            label: typeof command === "string" ? command : part.id,
          },
        ]
      })
    })
    const running = data.shell.list({ directory: sdk().directory }).flatMap((shell) => {
      if (shell.status !== "running" || shell.metadata.sessionID !== id) return []
      if (
        blocking.some(
          (item) => item.type === "shell" && (item.id === shell.id || (!!item.label && shell.command === item.label)),
        )
      )
        return []
      return [{ id: shell.id, type: "shell" as const, label: shell.command }]
    })
    return [
      ...new Map([...backgrounded, ...active, ...backgroundShells, ...running].map((task) => [task.id, task])).values(),
    ]
  })
  const moveToBackground = async () => {
    if (!primary()) return
    const sessionID = params.id
    if (!sessionID) return
    await serverSDK.api.session.background({ sessionID }).catch((error) => {
      showToast({
        title: language.t("common.requestFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    })
  }

  const [store, setStore] = createStore({
    responding: undefined as string | undefined,
  })

  const permissionResponding = createMemo(() => {
    const perm = permissionRequest()
    if (!perm) return false
    return store.responding === perm.id
  })

  const permissionSource = createMemo(() => {
    const perm = permissionRequest()
    if (!perm || perm.sessionID === params.id) return
    return data.session.list().find((item) => item.id === perm.sessionID)?.title ?? perm.sessionID
  })

  const decide = (decision: PermissionDecision) => {
    const perm = permissionRequest()
    if (!perm) return
    if (store.responding === perm.id) return

    setStore("responding", perm.id)
    serverSDK.api.permission
      .reply({
        sessionID: perm.sessionID,
        requestID: perm.id,
        reply: decision.reply,
        ...(decision.reply === "reject" && decision.message ? { message: decision.message } : {}),
      })
      .catch((err: unknown) => {
        setStore("responding", (id) => (id === perm.id ? undefined : id))
        const description = err instanceof Error ? err.message : String(err)
        showToast({ title: language.t("common.requestFailed"), description })
      })
  }

  return {
    blocked,
    questionRequest,
    permissionRequest,
    permissionResponding,
    permissionSource,
    permission: permissionState,
    background: {
      blocking: backgroundBlocking,
      tasks: backgroundTasks,
      move: moveToBackground,
    },
    decide,
  }
}

export type SessionComposerController = ReturnType<typeof createSessionComposerController>
