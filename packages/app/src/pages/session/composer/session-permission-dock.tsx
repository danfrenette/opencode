import { For, Show, createMemo } from "solid-js"
import type { PermissionRequest } from "@opencode-ai/sdk/v2"
import { Button } from "@opencode-ai/ui/button"
import { DockPrompt } from "@opencode-ai/session-ui/dock-prompt"
import { Icon } from "@opencode-ai/ui/icon"
import { useLanguage } from "@/context/language"

export function SessionPermissionDock(props: {
  request: PermissionRequest
  responding: boolean
  onDecide: (response: "once" | "always" | "reject", message?: string) => void
  onReviewChanges?: () => void
  hasPendingDiffs?: boolean
}) {
  const language = useLanguage()
  const reviewMode = () => props.request.permission === "edit" && !!props.hasPendingDiffs && !!props.onReviewChanges

  const toolDescription = () => {
    const key = `settings.permissions.tool.${props.request.permission}.description`
    const value = language.t(key as Parameters<typeof language.t>[0])
    if (value === key) return ""
    return value
  }

  const fileSummary = createMemo(() => {
    if (props.request.permission !== "edit") return null
    const metadata = props.request.metadata as
      | {
          files?: Array<{ relativePath?: string; filePath: string }>
          filepath?: string
        }
      | undefined
    if (!metadata) return null

    if (metadata.files && metadata.files.length > 0) {
      if (metadata.files.length === 1) {
        return metadata.files[0]?.relativePath ?? metadata.files[0]?.filePath
      }
      return `${metadata.files.length} files`
    }

    if (metadata.filepath) {
      return props.request.patterns[0] ?? metadata.filepath
    }

    return null
  })

  const footer = () => {
    if (reviewMode()) {
      return (
        <>
          <div />
          <div data-slot="permission-footer-actions">
            <Button
              variant="primary"
              size="normal"
              onClick={props.onReviewChanges}
              disabled={props.responding}
              class="w-full min-h-11 px-4"
            >
              {language.t("ui.permission.reviewChanges")}
            </Button>
          </div>
        </>
      )
    }

    return (
      <>
        <div />
        <div data-slot="permission-footer-actions">
          <Button variant="ghost" size="normal" onClick={() => props.onDecide("reject")} disabled={props.responding}>
            {language.t("ui.permission.deny")}
          </Button>
          <Button variant="secondary" size="normal" onClick={() => props.onDecide("always")} disabled={props.responding}>
            {language.t("ui.permission.allowAlways")}
          </Button>
          <Button variant="primary" size="normal" onClick={() => props.onDecide("once")} disabled={props.responding}>
            {language.t("ui.permission.allowOnce")}
          </Button>
        </div>
      </>
    )
  }

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
      footer={footer()}
    >
      <Show when={toolDescription()}>
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-hint">{toolDescription()}</div>
        </div>
      </Show>

      <Show when={fileSummary()}>
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-file-summary" class="min-w-0 text-13-medium text-text-strong truncate">
            {fileSummary()}
          </div>
        </div>
      </Show>

      <Show when={reviewMode()}>
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div class="text-12-regular text-text-weak">{language.t("ui.permission.reviewSummary")}</div>
        </div>
      </Show>

      <Show when={props.request.patterns.length > 0 && !fileSummary()}>
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-patterns">
            <For each={props.request.patterns}>
              {(pattern) => <code class="text-12-regular text-text-base break-all">{pattern}</code>}
            </For>
          </div>
        </div>
      </Show>
    </DockPrompt>
  )
}
