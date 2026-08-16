import { createEffect, For, Match, Show, Switch } from "solid-js"
import { createStore } from "solid-js/store"
import type { PermissionRequest } from "@opencode-ai/client/promise"
import { Button } from "@opencode-ai/ui/button"
import { TextareaV2 } from "@opencode-ai/ui/v2/textarea-v2"
import { DockPrompt } from "@opencode-ai/session-ui/dock-prompt"
import { Icon } from "@opencode-ai/ui/icon"
import { useLanguage } from "@/context/language"

export function SessionPermissionDock(props: {
  request: PermissionRequest
  source?: string
  responding: boolean
  onDecide: (response: "once" | "always" | "reject", message?: string) => void
}) {
  const language = useLanguage()
  const [store, setStore] = createStore({
    requestID: props.request.id,
    stage: "permission" as "permission" | "always" | "reject",
    message: "",
  })

  createEffect(() => {
    if (store.requestID === props.request.id) return
    setStore({ requestID: props.request.id, stage: "permission", message: "" })
  })

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
                  variant="ghost"
                  size="normal"
                  onClick={() => setStore("stage", "reject")}
                  disabled={props.responding}
                >
                  {language.t("ui.permission.deny")}
                </Button>
                <Show when={props.request.save?.length}>
                  <Button
                    variant="secondary"
                    size="normal"
                    onClick={() => setStore("stage", "always")}
                    disabled={props.responding}
                  >
                    {language.t("ui.permission.allowAlways")}
                  </Button>
                </Show>
                <Button
                  variant="primary"
                  size="normal"
                  onClick={() => props.onDecide("once")}
                  disabled={props.responding}
                >
                  {language.t("ui.permission.allowOnce")}
                </Button>
              </Match>
              <Match when={store.stage === "always"}>
                <Button
                  variant="ghost"
                  size="normal"
                  onClick={() => setStore("stage", "permission")}
                  disabled={props.responding}
                >
                  {language.t("ui.common.cancel")}
                </Button>
                <Button
                  variant="primary"
                  size="normal"
                  autofocus
                  onClick={() => props.onDecide("always")}
                  disabled={props.responding}
                >
                  {language.t("ui.common.confirm")}
                </Button>
              </Match>
              <Match when={store.stage === "reject"}>
                <Button
                  variant="ghost"
                  size="normal"
                  onClick={() => setStore("stage", "permission")}
                  disabled={props.responding}
                >
                  {language.t("ui.common.cancel")}
                </Button>
                <Button
                  variant="primary"
                  size="normal"
                  onClick={() => props.onDecide("reject", store.message || undefined)}
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
                id={`permission-feedback-${props.request.id}`}
                autofocus
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
