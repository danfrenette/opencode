import { createEffect, For, Match, onMount, Show, Switch } from "solid-js"
import { createStore } from "solid-js/store"
import type { PermissionRequest } from "@opencode-ai/client/promise"
import { Button } from "@opencode-ai/ui/button"
import { TextareaV2 } from "@opencode-ai/ui/v2/textarea-v2"
import { DockPrompt } from "@opencode-ai/session-ui/dock-prompt"
import { File } from "@opencode-ai/session-ui/file"
import { resolveFileDiff } from "@opencode-ai/session-ui/session-diff"
import { Icon } from "@opencode-ai/ui/icon"
import { Select } from "@opencode-ai/ui/select"
import { useLanguage } from "@/context/language"
import { canonicalDiffs } from "@/utils/diffs"
import type { PermissionDecision } from "./session-permission-decision"

type PermissionStage = "permission" | "always" | "reject"
type PermissionFocusTarget = "once" | "always" | "reject" | "confirm" | "feedback"
type PermissionDockState = {
  requestID: string
  stage: PermissionStage
  message: string
  file?: string
}

const requestFiles = (request: PermissionRequest) => {
  if (request.action !== "edit") return undefined
  return canonicalDiffs(request.metadata?.files)
}

const initialState = (request: PermissionRequest) =>
  ({
    requestID: request.id,
    stage: "permission",
    message: "",
    file: requestFiles(request)?.[0]?.file,
  }) satisfies PermissionDockState

export function SessionPermissionDock(props: {
  request: PermissionRequest
  source?: string
  responding: boolean
  onDecide: (decision: PermissionDecision) => void
}) {
  const language = useLanguage()
  const actions: Partial<Record<PermissionFocusTarget, HTMLElement>> = {}
  const [store, setStore] = createStore<PermissionDockState>(initialState(props.request))
  const files = () => requestFiles(props.request)
  const preview = () => files()?.find((diff) => diff.file === store.file) ?? files()?.[0]
  const fileLabel = (diff: NonNullable<ReturnType<typeof files>>[number]) =>
    language.t(`session.permission.preview.file.${diff.status}`, {
      file: diff.file,
      additions: diff.additions,
      deletions: diff.deletions,
    })

  createEffect(() => {
    if (store.requestID === props.request.id) return
    setStore(initialState(props.request))
  })

  const focus = (target: PermissionFocusTarget) => queueMicrotask(() => actions[target]?.focus())
  onMount(() => focus("once"))
  const enter = (stage: Exclude<PermissionStage, "permission">, target: PermissionFocusTarget) => {
    setStore("stage", stage)
    focus(target)
  }
  const cancel = (stage: Exclude<PermissionStage, "permission">) => {
    setStore("stage", "permission")
    focus(stage)
  }

  const toolDescription = () => {
    const key = `settings.permissions.tool.${props.request.action}.description`
    const value = language.t(key as Parameters<typeof language.t>[0])
    if (value === key) return ""
    return value
  }

  return (
    <DockPrompt
      kind="permission"
      header={
        <div data-slot="permission-row" data-variant="header">
          <span data-slot="permission-icon">
            <Icon name="warning" size="normal" />
          </span>
          <div data-slot="permission-header-title">
            {store.stage === "always"
              ? language.t("session.permission.always.title")
              : store.stage === "reject"
                ? language.t("session.permission.reject.title")
                : language.t("notification.permission.title")}
          </div>
        </div>
      }
      footer={
        <>
          <div />
          <div data-slot="permission-footer-actions">
            <Switch>
              <Match when={store.stage === "permission"}>
                <Button
                  ref={(element: HTMLButtonElement) => {
                    actions.reject = element
                  }}
                  variant="ghost"
                  size="normal"
                  onClick={() => enter("reject", "feedback")}
                  disabled={props.responding}
                >
                  {language.t("ui.permission.deny")}
                </Button>
                <Show when={props.request.save?.length}>
                  <Button
                    ref={(element: HTMLButtonElement) => {
                      actions.always = element
                    }}
                    variant="secondary"
                    size="normal"
                    onClick={() => enter("always", "confirm")}
                    disabled={props.responding}
                  >
                    {language.t("ui.permission.allowAlways")}
                  </Button>
                </Show>
                <Button
                  ref={(element: HTMLButtonElement) => {
                    actions.once = element
                  }}
                  variant="primary"
                  size="normal"
                  onClick={() => props.onDecide({ reply: "once" })}
                  disabled={props.responding}
                >
                  {language.t("ui.permission.allowOnce")}
                </Button>
              </Match>
              <Match when={store.stage === "always"}>
                <Button
                  variant="ghost"
                  size="normal"
                  onClick={() => cancel("always")}
                  disabled={props.responding}
                >
                  {language.t("ui.common.cancel")}
                </Button>
                <Button
                  ref={(element: HTMLButtonElement) => {
                    actions.confirm = element
                  }}
                  variant="primary"
                  size="normal"
                  onClick={() => props.onDecide({ reply: "always" })}
                  disabled={props.responding}
                >
                  {language.t("ui.common.confirm")}
                </Button>
              </Match>
              <Match when={store.stage === "reject"}>
                <Button
                  variant="ghost"
                  size="normal"
                  onClick={() => cancel("reject")}
                  disabled={props.responding}
                >
                  {language.t("ui.common.cancel")}
                </Button>
                <Button
                  variant="primary"
                  size="normal"
                  onClick={() => props.onDecide({ reply: "reject", message: store.message || undefined })}
                  disabled={props.responding}
                >
                  {language.t("session.permission.reject.submit")}
                </Button>
              </Match>
            </Switch>
          </div>
        </>
      }
    >
      <Show when={props.source}>
        {(source) => (
          <div data-slot="permission-row">
            <span data-slot="permission-spacer" aria-hidden="true" />
            <div data-slot="permission-hint">{language.t("session.permission.source", { name: source() })}</div>
          </div>
        )}
      </Show>
      <Show when={props.request.action === "edit"}>
        <Show
          when={preview()}
          fallback={
            <div data-slot="permission-row">
              <span data-slot="permission-spacer" aria-hidden="true" />
              <div data-slot="permission-preview-warning">{language.t("session.permission.preview.unavailable")}</div>
            </div>
          }
        >
          {(diff) => (
            <div data-slot="permission-preview">
              <Show when={(files()?.length ?? 0) > 1}>
                <div data-slot="permission-preview-selector">
                  <Select
                    options={files() ?? []}
                    current={diff()}
                    value={(item) => item.file}
                    label={fileLabel}
                    onSelect={(item) => item && setStore("file", item.file)}
                    size="small"
                    variant="secondary"
                    triggerProps={{ "aria-label": language.t("session.permission.preview.fileSelector") }}
                  />
                </div>
              </Show>
              <div
                data-slot="permission-preview-scroll"
                role="region"
                aria-label={language.t("session.permission.preview.region")}
                tabIndex={0}
              >
                <File mode="diff" fileDiff={resolveFileDiff(diff())} diffStyle="unified" />
              </div>
            </div>
          )}
        </Show>
      </Show>
      <Switch>
        <Match when={store.stage === "always"}>
          <div data-slot="permission-row">
            <span data-slot="permission-spacer" aria-hidden="true" />
            <div data-slot="permission-content">
              <div data-slot="permission-hint">
                {props.request.save?.length === 1 && props.request.save[0] === "*"
                  ? language.t("session.permission.always.description.all", { action: props.request.action })
                  : language.t("session.permission.always.description.patterns")}
              </div>
              <div data-slot="permission-patterns">
                <For each={props.request.save}>{(pattern) => <code>{pattern}</code>}</For>
              </div>
            </div>
          </div>
        </Match>
        <Match when={store.stage === "reject"}>
          <div data-slot="permission-row">
            <span data-slot="permission-spacer" aria-hidden="true" />
            <div data-slot="permission-content">
              <label class="text-13-medium text-text-base" for={`permission-feedback-${props.request.id}`}>
                {language.t("session.permission.reject.feedback")}
              </label>
              <TextareaV2
                ref={(element: HTMLTextAreaElement) => {
                  actions.feedback = element
                }}
                id={`permission-feedback-${props.request.id}`}
                rows={3}
                value={store.message}
                disabled={props.responding}
                placeholder={language.t("session.permission.reject.placeholder")}
                onInput={(event) => setStore("message", event.currentTarget.value)}
              />
            </div>
          </div>
        </Match>
        <Match when={store.stage === "permission"}>
          <Show when={toolDescription()}>
            <div data-slot="permission-row">
              <span data-slot="permission-spacer" aria-hidden="true" />
              <div data-slot="permission-hint">{toolDescription()}</div>
            </div>
          </Show>

          <Show when={props.request.resources.length > 0}>
            <div data-slot="permission-row">
              <span data-slot="permission-spacer" aria-hidden="true" />
              <div data-slot="permission-patterns">
                <For each={props.request.resources}>
                  {(pattern) => <code class="text-12-regular text-text-base break-all">{pattern}</code>}
                </For>
              </div>
            </div>
          </Show>
        </Match>
      </Switch>
    </DockPrompt>
  )
}
