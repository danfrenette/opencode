import { For, Match, onMount, Show, Switch } from "solid-js"
import type { PermissionRequest } from "@opencode-ai/client/promise"
import { Button } from "@opencode-ai/ui/button"
import { TextareaV2 } from "@opencode-ai/ui/v2/textarea-v2"
import { DockPrompt } from "@opencode-ai/session-ui/dock-prompt"
import { File } from "@opencode-ai/session-ui/file"
import { resolveFileDiff } from "@opencode-ai/session-ui/session-diff"
import { Icon } from "@opencode-ai/ui/icon"
import { Select } from "@opencode-ai/ui/select"
import { useLanguage } from "@/context/language"
import type { PermissionDecision } from "./session-permission-decision"
import type { PermissionStage, SessionPermissionController } from "./session-composer-state"

type PermissionFocusTarget = "once" | "always" | "reject" | "confirm" | "feedback" | "review"

export function SessionPermissionDock(props: {
  request: PermissionRequest
  source?: string
  responding: boolean
  state: SessionPermissionController
  surface?: "compact" | "review"
  onReview: () => void
  onDecide: (decision: PermissionDecision) => void
}) {
  const language = useLanguage()
  const actions: Partial<Record<PermissionFocusTarget, HTMLElement>> = {}
  const files = props.state.files
  const preview = () => files()?.find((diff) => diff.file === props.state.file()) ?? files()?.[0]
  const fileLabel = (diff: NonNullable<ReturnType<typeof files>>[number]) =>
    language.t(`session.permission.preview.file.${diff.status}`, {
      file: diff.file,
      additions: diff.additions,
      deletions: diff.deletions,
    })

  const focus = (target: PermissionFocusTarget) => queueMicrotask(() => actions[target]?.focus())
  onMount(() => {
    if (props.surface !== "review") focus("once")
  })
  const enter = (stage: Exclude<PermissionStage, "permission">, target: PermissionFocusTarget) => {
    props.state.enter(stage)
    focus(target)
  }
  const cancel = (stage: Exclude<PermissionStage, "permission">) => {
    props.state.cancel()
    focus(stage)
  }

  const toolDescription = () => {
    const key = `settings.permissions.tool.${props.request.action}.description`
    const value = language.t(key as Parameters<typeof language.t>[0])
    if (value === key) return ""
    return value
  }

  return (
    <div data-permission-surface={props.surface ?? "compact"} class="min-w-0">
      <DockPrompt
        kind="permission"
        header={
          <div data-slot="permission-row" data-variant="header">
            <span data-slot="permission-icon">
              <Icon name="warning" size="normal" />
            </span>
            <div data-slot="permission-header-title">
              {props.state.stage() === "always"
                ? language.t("session.permission.always.title")
                : props.state.stage() === "reject"
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
                <Match when={props.state.stage() === "permission"}>
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
                <Match when={props.state.stage() === "always"}>
                  <Button variant="ghost" size="normal" onClick={() => cancel("always")} disabled={props.responding}>
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
                <Match when={props.state.stage() === "reject"}>
                  <Button variant="ghost" size="normal" onClick={() => cancel("reject")} disabled={props.responding}>
                    {language.t("ui.common.cancel")}
                  </Button>
                  <Button
                    variant="primary"
                    size="normal"
                    onClick={() => props.onDecide({ reply: "reject", message: props.state.message() || undefined })}
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
        <Show when={files()?.length}>
          <div data-slot="permission-row">
            <span data-slot="permission-spacer" aria-hidden="true" />
            <Button
              ref={(element: HTMLButtonElement) => {
                actions.review = element
              }}
              variant="secondary"
              size="small"
              data-permission-review-trigger
              onClick={props.onReview}
              aria-expanded={props.state.expanded()}
            >
              {language.t(
                props.state.expanded()
                  ? "session.permission.preview.closeReview"
                  : "session.permission.preview.reviewChanges",
              )}
            </Button>
          </div>
        </Show>
        <Show when={props.surface !== "review" && !props.state.expanded() && props.request.action === "edit"}>
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
                      onSelect={(item) => item && props.state.select(item.file)}
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
          <Match when={props.state.stage() === "always"}>
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
          <Match when={props.state.stage() === "reject"}>
            <div data-slot="permission-row">
              <span data-slot="permission-spacer" aria-hidden="true" />
              <div data-slot="permission-content">
                <label
                  class="text-13-medium text-text-base"
                  for={`permission-feedback-${props.surface ?? "compact"}-${props.request.id}`}
                >
                  {language.t("session.permission.reject.feedback")}
                </label>
                <TextareaV2
                  ref={(element: HTMLTextAreaElement) => {
                    actions.feedback = element
                  }}
                  id={`permission-feedback-${props.surface ?? "compact"}-${props.request.id}`}
                  rows={3}
                  value={props.state.message()}
                  disabled={props.responding}
                  placeholder={language.t("session.permission.reject.placeholder")}
                  onInput={(event) => props.state.setMessage(event.currentTarget.value)}
                />
              </div>
            </div>
          </Match>
          <Match when={props.state.stage() === "permission"}>
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
    </div>
  )
}
