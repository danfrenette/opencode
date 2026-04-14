import { For, Match, Show, Switch, createMemo } from "solid-js"
import type { PermissionRequest } from "@opencode-ai/sdk/v2"
import { Button } from "@opencode-ai/ui/button"
import { DiffChanges } from "@opencode-ai/ui/diff-changes"
import { DockPrompt } from "@opencode-ai/ui/dock-prompt"
import { Icon } from "@opencode-ai/ui/icon"
import { useLanguage } from "@/context/language"

interface FileDiff {
  file?: string
  filePath?: string
  relativePath?: string
  patch?: string
  diff?: string
  additions?: number
  deletions?: number
  type?: "add" | "delete" | "move" | "update" | "modified"
}

interface PermissionMetadata {
  filepath?: string
  diff?: string
  filediff?: FileDiff
  files?: FileDiff[]
}

function extractFileDiffs(metadata: PermissionMetadata | undefined): FileDiff[] {
  if (!metadata) return []

  if (metadata.files && Array.isArray(metadata.files)) {
    return metadata.files.map((f) => ({
      ...f,
      file: f.file || f.filePath || f.relativePath,
    }))
  }

  if (metadata.filediff) {
    return [metadata.filediff]
  }

  if (metadata.diff && metadata.filepath) {
    return [
      {
        file: metadata.filepath,
        diff: metadata.diff,
        patch: metadata.diff,
        additions: 0,
        deletions: 0,
      },
    ]
  }

  return []
}

export function SessionPermissionDock(props: {
  request: PermissionRequest
  responding: boolean
  onDecide: (response: "once" | "always" | "reject") => void
}) {
  const language = useLanguage()

  const toolDescription = () => {
    const key = `settings.permissions.tool.${props.request.permission}.description`
    const value = language.t(key as Parameters<typeof language.t>[0])
    if (value === key) return ""
    return value
  }

  const fileDiffs = createMemo(() => extractFileDiffs(props.request.metadata as PermissionMetadata))
  const hasDiffs = createMemo(() => fileDiffs().length > 0)

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
        <>
          <div />
          <div data-slot="permission-footer-actions">
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
          </div>
        </>
      }
    >
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

      <Show when={hasDiffs()}>
        <div data-slot="permission-diff-preview">
          <div data-slot="permission-diff-header" class="text-12-medium text-text-strong mb-2">
            {language.t("session.review.change.other")}
          </div>
          <For each={fileDiffs()}>
            {(file) => (
              <div data-slot="permission-diff-file" class="mb-2">
                <div class="flex items-center justify-between text-12-regular">
                  <span class="truncate">{file.file || file.filePath || file.relativePath}</span>
                  <Switch>
                    <Match when={file.type === "add"}>
                      <span data-slot="permission-diff-type" data-type="added" class="text-syntax-success">
                        {language.t("ui.patch.action.created")}
                      </span>
                    </Match>
                    <Match when={file.type === "delete"}>
                      <span data-slot="permission-diff-type" data-type="removed" class="text-syntax-error">
                        {language.t("ui.patch.action.deleted")}
                      </span>
                    </Match>
                    <Match when={file.type === "move"}>
                      <span data-slot="permission-diff-type" data-type="modified" class="text-syntax-property">
                        {language.t("ui.patch.action.moved")}
                      </span>
                    </Match>
                    <Match when={true}>
                      <DiffChanges changes={{ additions: file.additions ?? 0, deletions: file.deletions ?? 0 }} />
                    </Match>
                  </Switch>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </DockPrompt>
  )
}
