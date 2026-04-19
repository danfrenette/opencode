import { type Component, Show } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { List } from "@opencode-ai/ui/list"
import { useLocal } from "@/context/local"
import { useLanguage } from "@/context/language"
import { agentColor } from "@/utils/agent"

type AgentItem = ReturnType<ReturnType<typeof useLocal>["agent"]["list"]>[number]

export const DialogSelectAgent: Component<{ onBack?: () => void }> = (props) => {
  const dialog = useDialog()
  const local = useLocal()
  const language = useLanguage()

  const back = () => {
    if (!props.onBack) return
    props.onBack()
  }

  return (
    <Dialog
      title={
        <div class="flex min-w-0 items-center gap-2">
          <Show when={props.onBack}>
            <IconButton
              icon="arrow-left"
              variant="ghost"
              size="small"
              class="size-8 rounded-lg"
              aria-label={language.t("common.back")}
              onClick={back}
            />
          </Show>
          <span class="truncate">{language.t("dialog.agent.select.title")}</span>
        </div>
      }
      fit
    >
      <List<AgentItem>
        class="[&_[data-slot=list-scroll]]:max-h-[min(52vh,320px)] [&_[data-slot=list-item]]:min-h-12 [&_[data-slot=list-item]]:rounded-[14px] [&_[data-slot=list-item]]:px-3 [&_[data-slot=list-item]]:py-3"
        search={{ placeholder: language.t("common.search.placeholder"), autofocus: true }}
        emptyMessage={language.t("dialog.model.empty")}
        key={(x) => x.name}
        items={local.agent.list}
        current={local.agent.current()}
        filterKeys={[("name" satisfies keyof AgentItem) as string]}
        sortBy={(a, b) => a.name.localeCompare(b.name)}
        onSelect={(item) => {
          if (!item) return
          local.agent.set(item.name)
          dialog.close()
        }}
      >
        {(item) => (
          <div class="flex w-full items-center gap-3">
            <div
              class="size-2.5 shrink-0 rounded-full"
              style={{ "background-color": agentColor(item.name, item.color) }}
            />
            <span class="truncate text-14-medium capitalize">{item.name}</span>
          </div>
        )}
      </List>
    </Dialog>
  )
}
