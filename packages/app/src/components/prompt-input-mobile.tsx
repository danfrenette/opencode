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
      dialog.show(() => <x.DialogMobileComposerSettings />)
    })
  }

  // Get current config summary for the collapsed control
  const configSummary = createMemo(() => {
    const agent = local.agent.current()?.name || "Default"
    const model = local.model.current()?.name || language.t("dialog.model.select.title")
    const variant = local.model.variant.current()
    if (variant && variant !== "default") {
      return `${agent} • ${model} (${variant})`
    }
    return `${agent} • ${model}`
  })

  const removeImage = (id: string) => {
    const current = prompt.current()
    const next = current.filter((part) => part.type !== "image" || part.id !== id)
    prompt.set(next, prompt.cursor())
  }

  return (
    <div
      class="flex flex-col bg-background-stronger border-t border-border-weak-base"
      classList={{ [props.class || ""]: !!props.class }}
    >
      {/* Context items */}
      <Show when={contextItems().length > 0}>
        <div class="flex flex-nowrap items-start gap-2 px-3 pt-2 overflow-x-auto no-scrollbar">
          <For each={contextItems()}>
            {(item) => {
              const label = getFilenameTruncated(item.path, 14)
              return (
                <Tooltip
                  value={item.path}
                  placement="top"
                  openDelay={1000}
                >
                  <div
                    class="group shrink-0 flex items-center gap-1.5 rounded-md pl-2 pr-1 py-1.5 max-w-[160px] cursor-default bg-background-base border border-border-weak-base"
                  >
                    <FileIcon node={{ path: item.path, type: "file" }} class="shrink-0 size-3.5" />
                    <span class="text-11-regular text-text-strong whitespace-nowrap">{label}</span>
                    <button
                      type="button"
                      onClick={() => prompt.context.remove(item.key)}
                      class="ml-1 size-4 rounded-full flex items-center justify-center hover:bg-surface-raised-base-hover"
                      aria-label={language.t("common.remove")}
                    >
                      <Icon name="close-small" class="size-3 text-text-weak" />
                    </button>
                  </div>
                </Tooltip>
              )
            }}
          </For>
        </div>
      </Show>

      {/* Image attachments */}
      <Show when={imageAttachments().length > 0}>
        <div class="flex flex-wrap gap-2 px-3 pt-2">
          <For each={imageAttachments()}>
            {(attachment) => (
              <Tooltip value={attachment.filename} placement="top">
                <div class="relative group">
                  <Show
                    when={attachment.mime.startsWith("image/")}
                    fallback={
                      <div class="size-14 rounded-md bg-surface-base flex items-center justify-center border border-border-base">
                        <Icon name="folder" class="size-5 text-text-weak" />
                      </div>
                    }
                  >
                    <img
                      src={attachment.dataUrl}
                      alt={attachment.filename}
                      class="size-14 rounded-md object-cover border border-border-base"
                    />
                  </Show>
                  <button
                    type="button"
                    onClick={() => removeImage(attachment.id)}
                    class="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-surface-raised-stronger border border-border-base flex items-center justify-center"
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

      {/* Main input area */}
      <div class="flex items-end gap-2 px-3 py-3">
        {/* Attach button */}
        <Tooltip placement="top" value={language.t("prompt.action.attachFile")}>
          <Button
            data-action="prompt-attach"
            type="button"
            variant="ghost"
            size="small"
            class="w-11 h-11 shrink-0 rounded-md flex items-center justify-center"
            onClick={() => {}}
            aria-label={language.t("prompt.action.attachFile")}
          >
            <Icon name="plus" size="small" />
          </Button>
        </Tooltip>

        {/* Text input */}
        <div class="flex-1 min-w-0">
          <div
            ref={editorRef}
            contentEditable
            class="min-h-[44px] max-h-[120px] px-3 py-2.5 text-14-regular text-text-strong bg-background-base rounded-lg border border-border-weak-base overflow-y-auto"
            classList={{
              "font-mono": store.mode === "shell",
            }}
            onInput={(e) => {
              const text = e.currentTarget.textContent || ""
              // Update prompt state
              const parts = prompt.current()
              const textPart = parts.find((p) => p.type === "text")
              if (textPart) {
                prompt.set(
                  parts.map((p) =>
                    p.type === "text" ? { ...p, content: text, start: 0, end: text.length } : p
                  ),
                  text.length
                )
              } else {
                prompt.set(
                  [...parts, { type: "text", content: text, start: 0, end: text.length }],
                  text.length
                )
              }
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
        </div>

        {/* Send/Stop button */}
        <Tooltip
          placement="top"
          value={stopping() ? language.t("prompt.action.stop") : language.t("prompt.action.send")}
        >
          <IconButton
            data-action="prompt-submit"
            type="submit"
            disabled={!canSubmit()}
            icon={stopping() ? "stop" : "arrow-up"}
            variant="primary"
            size="small"
            class="w-11 h-11 shrink-0 rounded-md"
            onClick={(e) => void handleSubmit(e)}
            aria-label={stopping() ? language.t("prompt.action.stop") : language.t("prompt.action.send")}
          />
        </Tooltip>
      </div>

      {/* Bottom controls: Mode toggle + Collapsed config */}
      <div class="flex items-center justify-between px-3 pb-3">
        {/* Shell mode toggle */}
        <Button
          variant="ghost"
          size="small"
          class="h-9 px-2 rounded-md flex items-center gap-2"
          onClick={toggleMode}
          classList={{
            "bg-surface-raised-base-active": store.mode === "shell",
          }}
        >
          <Icon
            size="small"
            name={store.mode === "shell" ? "terminal-active" : "terminal"}
            classList={{
              "text-icon-strong": store.mode === "shell",
              "text-icon-weak": store.mode === "normal",
            }}
          />
          <span
            class="text-13-medium"
            classList={{
              "text-text-strong": store.mode === "shell",
              "text-text-weak": store.mode === "normal",
            }}
          >
            {language.t("prompt.mode.shell")}
          </span>
        </Button>

        {/* Collapsed config control */}
        <Button
          variant="ghost"
          size="small"
          class="h-9 px-2 rounded-md flex items-center gap-2 max-w-[200px]"
          onClick={openSettings}
        >
          <Icon name="settings-gear" size="small" class="text-icon-weak" />
          <span class="text-13-regular text-text-weak truncate">{configSummary()}</span>
          <Icon name="chevron-down" size="small" class="text-icon-weaker shrink-0" />
        </Button>
      </div>
    </div>
  )
}
