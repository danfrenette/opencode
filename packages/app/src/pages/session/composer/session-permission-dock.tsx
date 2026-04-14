import { createMediaQuery } from "@solid-primitives/media"
import { For, Show, createMemo, createSignal } from "solid-js"
import type { PermissionRequest } from "@opencode-ai/sdk/v2"
import { Button } from "@opencode-ai/ui/button"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { DockPrompt } from "@opencode-ai/ui/dock-prompt"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { useLanguage } from "@/context/language"
import { SessionPermissionDiffPreview } from "../permission/session-permission-diff-preview"

export function SessionPermissionDock(props: {
  request: PermissionRequest
  responding: boolean
  onDecide: (response: "once" | "always" | "reject") => void
}) {
  const language = useLanguage()
  const isDesktop = createMediaQuery("(min-width: 640px)")
  const [detailsOpen, setDetailsOpen] = createSignal(false)

  const toolDescription = () => {
    const key = `settings.permissions.tool.${props.request.permission}.description`
    const value = language.t(key as Parameters<typeof language.t>[0])
    if (value === key) return ""
    return value
  }

  const summary = createMemo(() => {
    const count = props.request.patterns.length
    if (count > 0) {
      const label = language.t(count === 1 ? "session.review.change.one" : "session.review.change.other")
      return `${label} (${count})`
    }
    return toolDescription() || language.t("notification.permission.title")
  })

  const details = () => (
    <>
      <Show when={toolDescription()}>
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-hint">{toolDescription()}</div>
        </div>
      </Show>

      <Show when={props.request.patterns.length > 0}>
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-patterns">
            <For each={props.request.patterns}>
              {(pattern) => <code class="text-12-regular text-text-base break-all">{pattern}</code>}
            </For>
          </div>
        </div>
      </Show>

      <SessionPermissionDiffPreview request={props.request} />
    </>
  )

  return (
    <DockPrompt
      kind="permission"
      header={
        <div data-slot="permission-row" data-variant="header">
          <span data-slot="permission-icon">
            <Icon name="warning" size="normal" />
          </span>
          <div data-slot="permission-header-title">{language.t("notification.permission.title")}</div>
        </div>
      }
      footer={
        <div data-slot="permission-footer-actions">
          <Show
            when={isDesktop()}
            fallback={
              <>
                <IconButton
                  variant="secondary"
                  size="large"
                  icon="circle-ban-sign"
                  iconSize="normal"
                  aria-label={language.t("ui.permission.deny")}
                  title={language.t("ui.permission.deny")}
                  data-slot="permission-mobile-action"
                  data-action="reject"
                  onClick={() => props.onDecide("reject")}
                  disabled={props.responding}
                />
                <IconButton
                  variant="secondary"
                  size="large"
                  icon="warning"
                  iconSize="normal"
                  aria-label={language.t("ui.permission.allowAlways")}
                  title={language.t("ui.permission.allowAlways")}
                  data-slot="permission-mobile-action"
                  data-action="always"
                  onClick={() => props.onDecide("always")}
                  disabled={props.responding}
                />
                <IconButton
                  variant="primary"
                  size="large"
                  icon="circle-check"
                  iconSize="normal"
                  aria-label={language.t("ui.permission.allowOnce")}
                  title={language.t("ui.permission.allowOnce")}
                  data-slot="permission-mobile-action"
                  data-action="once"
                  onClick={() => props.onDecide("once")}
                  disabled={props.responding}
                />
              </>
            }
          >
            <Button variant="ghost" size="normal" onClick={() => props.onDecide("reject")} disabled={props.responding}>
              {language.t("ui.permission.deny")}
            </Button>
            <Button
              variant="secondary"
              size="normal"
              onClick={() => props.onDecide("always")}
              disabled={props.responding}
            >
              {language.t("ui.permission.allowAlways")}
            </Button>
            <Button variant="primary" size="normal" onClick={() => props.onDecide("once")} disabled={props.responding}>
              {language.t("ui.permission.allowOnce")}
            </Button>
          </Show>
        </div>
      }
    >
      <Show
        when={isDesktop()}
        fallback={
          <Collapsible variant="ghost" open={detailsOpen()} onOpenChange={setDetailsOpen}>
            <Collapsible.Trigger
              data-hide-details="true"
              class="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border-weak-base px-3 py-2 text-left"
            >
              <span class="min-w-0 flex-1">
                <span class="block text-12-medium text-text-strong">{summary()}</span>
                <Show when={toolDescription() && toolDescription() !== summary()}>
                  <span class="mt-0.5 block truncate text-12-regular text-text-weak">{toolDescription()}</span>
                </Show>
              </span>
              <Collapsible.Arrow />
            </Collapsible.Trigger>
            <Collapsible.Content>
              <div data-slot="permission-mobile-details">{details()}</div>
            </Collapsible.Content>
          </Collapsible>
        }
      >
        {details()}
      </Show>
    </DockPrompt>
  )
}
