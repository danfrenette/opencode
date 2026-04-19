import { Match, Show, Switch, createMemo } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { Tabs } from "@opencode-ai/ui/tabs"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useFile } from "@/context/file"
import { useSync } from "@/context/sync"
import FileTree from "@/components/file-tree"

interface SessionFileTreeMobileProps {
  diffs: () => { file: string; status?: string }[]
  diffsReady: () => boolean
  hasReview: () => boolean
  reviewCount: () => number
  activeDiff?: string
  onDiffClick: (path: string) => void
  onFileClick: (path: string) => void
}

export function SessionFileTreeMobile(props: SessionFileTreeMobileProps) {
  const language = useLanguage()
  const layout = useLayout()
  const file = useFile()
  const sync = useSync()

  const isDesktop = createMediaQuery("(min-width: 768px)")
  const isOpen = createMemo(() => layout.fileTree.opened())

  const diffFiles = createMemo(() => props.diffs().map((d) => d.file))
  const kinds = createMemo(() => {
    const merge = (a: "add" | "del" | "mix" | undefined, b: "add" | "del" | "mix") => {
      if (!a) return b
      if (a === b) return a
      return "mix" as const
    }

    const normalize = (p: string) => p.replaceAll("\\\\", "/").replace(/\/+$/, "")

    const out = new Map<string, "add" | "del" | "mix">()
    for (const diff of props.diffs()) {
      const file = normalize(diff.file)
      const kind = diff.status === "added" ? "add" : diff.status === "deleted" ? "del" : "mix"

      out.set(file, kind)

      const parts = file.split("/")
      for (const [idx] of parts.slice(0, -1).entries()) {
        const dir = parts.slice(0, idx + 1).join("/")
        if (!dir) continue
        out.set(dir, merge(out.get(dir), kind))
      }
    }
    return out
  })

  const nofiles = createMemo(() => {
    const state = file.tree.state("")
    if (!state?.loaded) return false
    return file.tree.children("").length === 0
  })

  const fileTreeTab = () => layout.fileTree.tab()

  const setFileTreeTabValue = (value: string) => {
    if (value !== "changes" && value !== "all") return
    layout.fileTree.setTab(value)
  }

  const empty = (msg: string) => (
    <div class="h-full flex flex-col">
      <div class="h-6 shrink-0" aria-hidden />
      <div class="flex-1 pb-64 flex items-center justify-center text-center">
        <div class="text-12-regular text-text-weak">{msg}</div>
      </div>
    </div>
  )

  // Phone overlay presentation
  const PhoneOverlay = () => (
    <Show when={isOpen() && !isDesktop()}>
      <div
        class="fixed inset-0 z-50 flex flex-col bg-background-base"
        style={{ top: "56px" }} // Account for mobile header height
      >
        {/* Header with close button */}
        <div class="flex items-center justify-between px-3 py-2 border-b border-border-weak-base">
          <div class="text-14-medium text-text-strong">
            {language.t("session.fileTree.title")}
          </div>
          <IconButton
            icon="close"
            variant="ghost"
            size="small"
            class="w-11 h-11 rounded-md"
            onClick={() => layout.fileTree.close()}
            aria-label={language.t("common.close")}
          />
        </div>

        {/* File tree content */}
        <div class="flex-1 overflow-hidden">
          <Tabs
            variant="pill"
            value={fileTreeTab()}
            onChange={setFileTreeTabValue}
            class="h-full"
            data-scope="filetree"
          >
            <Tabs.List class="px-3 py-2">
              <Tabs.Trigger value="changes" class="flex-1" classes={{ button: "w-full" }}>
                {props.reviewCount()}{" "}
                {language.t(
                  props.reviewCount() === 1 ? "session.review.change.one" : "session.review.change.other",
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="all" class="flex-1" classes={{ button: "w-full" }}>
                {language.t("session.files.all")}
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="changes" class="bg-background-stronger px-3 py-0 h-full overflow-auto">
              <Switch>
                <Match when={props.hasReview() || !props.diffsReady()}>
                  <Show
                    when={props.diffsReady()}
                    fallback={
                      <div class="px-2 py-2 text-12-regular text-text-weak">
                        {language.t("common.loading")}
                        {language.t("common.loading.ellipsis")}
                      </div>
                    }
                  >
                    <FileTree
                      path=""
                      class="pt-3"
                      allowed={diffFiles()}
                      kinds={kinds()}
                      draggable={false}
                      active={props.activeDiff}
                      onFileClick={(node) => props.onDiffClick(node.path)}
                    />
                  </Show>
                </Match>
              </Switch>
            </Tabs.Content>
            <Tabs.Content value="all" class="bg-background-stronger px-3 py-0 h-full overflow-auto">
              <Switch>
                <Match when={nofiles()}>{empty(language.t("session.files.empty"))}</Match>
                <Match when={true}>
                  <FileTree
                    path=""
                    class="pt-3"
                    modified={diffFiles()}
                    kinds={kinds()}
                    onFileClick={(node) => props.onFileClick(node.path)}
                  />
                </Match>
              </Switch>
            </Tabs.Content>
          </Tabs>
        </div>
      </div>
    </Show>
  )

  // Tablet side panel presentation
  const TabletPanel = () => (
    <Show when={isOpen() && isDesktop()}>
      <aside
        class="fixed left-0 top-[56px] bottom-0 w-[280px] bg-background-base border-r border-border-weaker-base z-40 flex flex-col"
        style={{ top: "56px" }} // Account for mobile header height
      >
        {/* Header with close button */}
        <div class="flex items-center justify-between px-3 py-2 border-b border-border-weak-base">
          <div class="text-14-medium text-text-strong">
            {language.t("session.fileTree.title")}
          </div>
          <IconButton
            icon="close"
            variant="ghost"
            size="small"
            class="w-11 h-11 rounded-md"
            onClick={() => layout.fileTree.close()}
            aria-label={language.t("common.close")}
          />
        </div>

        {/* File tree content */}
        <div class="flex-1 overflow-hidden">
          <Tabs
            variant="pill"
            value={fileTreeTab()}
            onChange={setFileTreeTabValue}
            class="h-full"
            data-scope="filetree"
          >
            <Tabs.List class="px-3 py-2">
              <Tabs.Trigger value="changes" class="flex-1" classes={{ button: "w-full" }}>
                {props.reviewCount()}{" "}
                {language.t(
                  props.reviewCount() === 1 ? "session.review.change.one" : "session.review.change.other",
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="all" class="flex-1" classes={{ button: "w-full" }}>
                {language.t("session.files.all")}
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="changes" class="bg-background-stronger px-3 py-0 h-full overflow-auto">
              <Switch>
                <Match when={props.hasReview() || !props.diffsReady()}>
                  <Show
                    when={props.diffsReady()}
                    fallback={
                      <div class="px-2 py-2 text-12-regular text-text-weak">
                        {language.t("common.loading")}
                        {language.t("common.loading.ellipsis")}
                      </div>
                    }
                  >
                    <FileTree
                      path=""
                      class="pt-3"
                      allowed={diffFiles()}
                      kinds={kinds()}
                      draggable={false}
                      active={props.activeDiff}
                      onFileClick={(node) => props.onDiffClick(node.path)}
                    />
                  </Show>
                </Match>
              </Switch>
            </Tabs.Content>
            <Tabs.Content value="all" class="bg-background-stronger px-3 py-0 h-full overflow-auto">
              <Switch>
                <Match when={nofiles()}>{empty(language.t("session.files.empty"))}</Match>
                <Match when={true}>
                  <FileTree
                    path=""
                    class="pt-3"
                    modified={diffFiles()}
                    kinds={kinds()}
                    onFileClick={(node) => props.onFileClick(node.path)}
                  />
                </Match>
              </Switch>
            </Tabs.Content>
          </Tabs>
        </div>
      </aside>
    </Show>
  )

  return (
    <>
      <PhoneOverlay />
      <TabletPanel />
    </>
  )
}
