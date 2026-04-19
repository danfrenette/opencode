import { Component, Show, createMemo, For } from "solid-js"
import { createStore } from "solid-js/store"
import { useLocal } from "@/context/local"
import { usePrompt, type ImageAttachmentPart } from "@/context/prompt"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { useLanguage } from "@/context/language"
import { usePermission } from "@/context/permission"
import { useSessionLayout } from "@/pages/session/session-layout"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { getFilenameTruncated } from "@opencode-ai/shared/util/path"
import { createPromptSubmit, type FollowupDraft } from "./prompt-input/submit"
import { promptLength, prependHistoryEntry, type PromptHistoryStoredEntry } from "./prompt-input/history"
import { Persist, persisted } from "@/utils/persist"

interface PromptInputMobileProps {
  class?: string
  ref?: (el: HTMLDivElement) => void
  newSessionWorktree?: string
  onNewSessionWorktreeReset?: () => void
  edit?: { id: string; prompt: unknown; context: FollowupDraft["context"] }
  onEditLoaded?: () => void
  shouldQueue?: () => boolean
  onQueue?: (draft: FollowupDraft) => void
  onAbort?: () => void
  onSubmit?: () => void
}

const NON_EMPTY_TEXT = /[^\s\u200B]/

export const PromptInputMobile: Component<PromptInputMobileProps> = (props) => {
  const sdk = useSDK()
  const sync = useSync()
  const local = useLocal()
  const prompt = usePrompt()
  const dialog = useDialog()
  const language = useLanguage()
  const permission = usePermission()
  const { params } = useSessionLayout()

  let editorRef!: HTMLDivElement

  const [store, setStore] = createStore({
    mode: "normal" as "normal" | "shell",
  })

  const currentPrompt = createMemo(() => prompt.current())
  const contextItems = createMemo(() => prompt.context.items())
  const info = createMemo(() => (params.id ? sync.session.get(params.id) : undefined))

  // Extract text content from prompt
  const textContent = createMemo(() => {
    const parts = currentPrompt()
    return parts.filter((p): p is { type: "text"; content: string; start: number; end: number } => p.type === "text")
      .map((p) => p.content)
      .join("")
  })

  // Extract image attachments from prompt
  const imageAttachments = createMemo(() => {
    const parts = currentPrompt()
    return parts.filter((p): p is ImageAttachmentPart => p.type === "image")
  })

  const blank = createMemo(() => !NON_EMPTY_TEXT.test(textContent()) && imageAttachments().length === 0)

  const working = createMemo(() => {
    const id = params.id
    if (!id) return false
    const status = sync.data.session_status[id]
    return status && status.type !== "idle"
  })

  const stopping = createMemo(() => {
    const id = params.id
    if (!id) return false
    const status = sync.data.session_status[id]
    return !!status && status.type !== "idle" && blank()
  })

  const canSubmit = createMemo(() => working() || !blank())
  const accepting = createMemo(() => {
    const id = params.id
    if (!id) return permission.isAutoAcceptingDirectory(sdk.directory)
    return permission.isAutoAccepting(id, sdk.directory)
  })
  const [, setHistory] = persisted(
    Persist.global("prompt-history", ["prompt-history.v1"]),
    createStore<{ entries: PromptHistoryStoredEntry[] }>({
      entries: [],
    }),
  )
  const [, setShellHistory] = persisted(
    Persist.global("prompt-history-shell", ["prompt-history-shell.v1"]),
    createStore<{ entries: PromptHistoryStoredEntry[] }>({
      entries: [],
    }),
  )

  const { handleSubmit } = createPromptSubmit({
    info,
    imageAttachments,
    commentCount: () => 0,
    autoAccept: accepting,
    mode: () => store.mode,
    working,
    editor: () => editorRef,
    queueScroll: () => {},
    promptLength,
    addToHistory: (nextPrompt, mode) => {
      if (mode === "shell") {
        setShellHistory("entries", (entries) => prependHistoryEntry(entries, nextPrompt))
        return
      }
      setHistory("entries", (entries) => prependHistoryEntry(entries, nextPrompt))
    },
    resetHistoryNavigation: () => {},
    setMode: (mode) => setStore("mode", mode),
    setPopover: () => {},
    newSessionWorktree: () => props.newSessionWorktree,
    onNewSessionWorktreeReset: props.onNewSessionWorktreeReset,
    shouldQueue: props.shouldQueue,
    onQueue: props.onQueue,
    onAbort: props.onAbort,
    onSubmit: props.onSubmit,
  })

  const toggleMode = () => {
    setStore("mode", store.mode === "normal" ? "shell" : "normal")
  }

  const openSettings = () => {
    void import("./dialog-mobile-composer-settings").then((x) => {
      dialog.show(() => <x.DialogMobileComposerSettings mode={store.mode} onModeChange={(mode) => setStore("mode", mode)} />)
    })
  }

  const pick = () => {
    void import("./dialog-select-file").then((x) => {
      dialog.show(() => <x.DialogSelectFile mode="files" />)
    })
  }

  // Get current config summary for the collapsed control
  const configSummary = createMemo(() => {
    const agent = local.agent.current()?.name || "Default"
    const model = (local.model.current()?.name || language.t("dialog.model.select.title"))
      .split(/\s+/)
      .slice(0, 2)
      .join(" ")
    return `${agent} • ${model}`
  })

  const modeLabel = createMemo(() =>
    store.mode === "shell" ? language.t("prompt.mode.shell") : language.t("prompt.mode.normal"),
  )

  const providerLabel = createMemo(() => local.model.current()?.provider?.name || local.agent.current()?.name || "Default")

  const removeImage = (id: string) => {
    const current = prompt.current()
    const next = current.filter((part) => part.type !== "image" || part.id !== id)
    prompt.set(next, prompt.cursor())
  }

  return (
    <div
      class="flex flex-col border-t border-border-weak-base bg-background-base px-2 pt-2 pb-2"
      classList={{ [props.class || ""]: !!props.class }}
    >
      <Show when={contextItems().length > 0}>
        <div class="mb-2 flex flex-nowrap items-start gap-2 px-1 no-scrollbar overflow-x-auto">
          <For each={contextItems()}>
            {(item) => {
              const label = getFilenameTruncated(item.path, 16)
              return (
                <Tooltip value={item.path} placement="top" openDelay={1000}>
                  <div class="group flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] bg-background-stronger px-2.5 shadow-xs-border-base">
                    <FileIcon node={{ path: item.path, type: "file" }} class="size-3.5 shrink-0" />
                    <span class="max-w-[160px] truncate text-12-medium text-text-strong">{label}</span>
                    <button
                      type="button"
                      onClick={() => prompt.context.remove(item.key)}
                      class="ml-0.5 flex size-4.5 items-center justify-center rounded-full text-text-weak transition-colors hover:bg-surface-raised-base-hover hover:text-text-strong"
                      aria-label={language.t("common.remove")}
                    >
                      <Icon name="close-small" class="size-3" />
                    </button>
                  </div>
                </Tooltip>
              )
            }}
          </For>
        </div>
      </Show>

      <Show when={imageAttachments().length > 0}>
        <div class="mb-2 flex flex-wrap gap-2 px-1">
          <For each={imageAttachments()}>
            {(attachment) => (
              <Tooltip value={attachment.filename} placement="top">
                <div class="relative group">
                  <Show
                    when={attachment.mime.startsWith("image/")}
                    fallback={
                      <div class="flex size-14 items-center justify-center rounded-[12px] bg-background-stronger shadow-xs-border-base">
                        <Icon name="folder" class="size-5 text-text-weak" />
                      </div>
                    }
                  >
                    <img
                      src={attachment.dataUrl}
                      alt={attachment.filename}
                      class="size-14 rounded-[12px] object-cover shadow-xs-border-base"
                    />
                  </Show>
                  <button
                    type="button"
                    onClick={() => removeImage(attachment.id)}
                    class="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-background-base shadow-xs-border-base"
                    aria-label={language.t("common.remove")}
                  >
                    <Icon name="close-small" class="size-3 text-text-weak" />
                  </button>
                </div>
              </Tooltip>
            )}
          </For>
        </div>
      </Show>

      <div class="overflow-hidden rounded-[12px] bg-background-stronger shadow-xs-border-base">
        <div class="relative min-h-[92px] px-3 pt-3 pb-12">
          <Show when={blank()}>
            <div class="pointer-events-none absolute left-3 right-12 top-3 text-14-regular text-text-weak">
              {store.mode === "shell"
                ? language.t("prompt.mode.shell")
                : language.t("prompt.placeholder")}
            </div>
          </Show>
          <div
            ref={editorRef}
            contentEditable
            class="min-h-[44px] max-h-[120px] overflow-y-auto bg-transparent pr-10 text-14-regular text-text-strong focus:outline-none"
            classList={{
              "font-mono": store.mode === "shell",
            }}
            onInput={(e) => {
              const text = e.currentTarget.textContent || ""
              const parts = prompt.current()
              const textPart = parts.find((p) => p.type === "text")
              if (textPart) {
                prompt.set(
                  parts.map((p) =>
                    p.type === "text" ? { ...p, content: text, start: 0, end: text.length } : p,
                  ),
                  text.length,
                )
                return
              }
              prompt.set([...parts, { type: "text", content: text, start: 0, end: text.length }], text.length)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void handleSubmit(e)
              }
            }}
            role="textbox"
            aria-multiline="true"
            aria-label={store.mode === "shell" ? language.t("prompt.mode.shell") : language.t("prompt.placeholder")}
          />

          <div class="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-[linear-gradient(to_top,var(--background-stronger)_35%,transparent)]" />

          <div class="pointer-events-none absolute bottom-2 left-2">
            <Tooltip placement="top" value={language.t("prompt.action.attachFile")}>
              <Button
                data-action="prompt-attach"
                type="button"
                variant="ghost"
                size="small"
                class="pointer-events-auto flex size-8 items-center justify-center rounded-md p-0 text-icon-weak transition-colors hover:text-icon-strong"
                onClick={pick}
                aria-label={language.t("prompt.action.attachFile")}
              >
                <Icon name="plus" size="small" />
              </Button>
            </Tooltip>
          </div>

          <div class="pointer-events-none absolute bottom-2 right-2">
            <Tooltip placement="top" value={stopping() ? language.t("prompt.action.stop") : language.t("prompt.action.send")}>
              <IconButton
                data-action="prompt-submit"
                type="submit"
                disabled={!canSubmit()}
                icon={stopping() ? "stop" : "arrow-up"}
                variant="primary"
                size="small"
                class="pointer-events-auto size-8 rounded-md"
                onClick={(e) => void handleSubmit(e)}
                aria-label={stopping() ? language.t("prompt.action.stop") : language.t("prompt.action.send")}
              />
            </Tooltip>
          </div>
        </div>

        <div class="border-t border-border-weaker-base px-1 py-1.5">
          <Button
            variant="ghost"
            size="small"
            class="flex h-11 w-full items-center justify-between rounded-[14px] px-2.5 text-left transition-colors hover:bg-surface-raised-base-hover"
            onClick={openSettings}
          >
            <div class="flex min-w-0 items-center gap-2.5">
              <div class="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-surface-raised-base-active text-icon-strong">
                <Icon name={store.mode === "shell" ? "terminal-active" : "settings-gear"} size="small" />
              </div>
              <div class="min-w-0">
                <div class="flex min-w-0 items-center gap-1.5">
                  <span class="truncate text-13-medium text-text-strong">{configSummary()}</span>
                </div>
                <div class="flex min-w-0 items-center gap-1.5 text-11-medium text-text-weak">
                  <span>{modeLabel()}</span>
                  <span class="text-text-weaker">•</span>
                  <span class="truncate">{providerLabel()}</span>
                </div>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-1 text-text-weaker">
              <Show when={store.mode === "shell"}>
                <span class="rounded-md bg-surface-raised-base-active px-2 py-1 text-11-medium text-text-weak">
                  {language.t("prompt.mode.shell")}
                </span>
              </Show>
              <Icon name="chevron-down" size="small" class="shrink-0" />
            </div>
          </Button>
        </div>
      </div>
    </div>
  )
}
