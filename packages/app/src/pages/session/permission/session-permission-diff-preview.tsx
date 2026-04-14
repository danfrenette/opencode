import type { PermissionRequest } from "@opencode-ai/sdk/v2"
import { DiffChanges } from "@opencode-ai/ui/diff-changes"
import { For, Match, Show, Switch, createMemo } from "solid-js"
import { useLanguage } from "@/context/language"
import { permissionDiffPreview } from "./session-permission-diffs"

export function SessionPermissionDiffPreview(props: { request: PermissionRequest }) {
  const language = useLanguage()
  const fileDiffs = createMemo(() => permissionDiffPreview(props.request))

  return (
    <Show when={fileDiffs().length > 0}>
      <div data-slot="permission-diff-preview">
        <div data-slot="permission-diff-header" class="text-12-medium text-text-strong mb-2">
          {language.t("session.review.change.other")}
        </div>
        <For each={fileDiffs()}>
          {(file) => (
            <div data-slot="permission-diff-file" class="mb-2">
              <div class="flex items-center justify-between text-12-regular">
                <span class="truncate">{file.file}</span>
                <Switch>
                  <Match when={file.action === "add"}>
                    <span data-slot="permission-diff-type" data-type="added" class="text-syntax-success">
                      {language.t("ui.patch.action.created")}
                    </span>
                  </Match>
                  <Match when={file.action === "delete"}>
                    <span data-slot="permission-diff-type" data-type="removed" class="text-syntax-error">
                      {language.t("ui.patch.action.deleted")}
                    </span>
                  </Match>
                  <Match when={file.action === "move"}>
                    <span data-slot="permission-diff-type" data-type="modified" class="text-syntax-property">
                      {language.t("ui.patch.action.moved")}
                    </span>
                  </Match>
                  <Match when={true}>
                    <DiffChanges changes={{ additions: file.additions, deletions: file.deletions }} />
                  </Match>
                </Switch>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  )
}
