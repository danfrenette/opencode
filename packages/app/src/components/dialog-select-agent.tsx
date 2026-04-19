import { type Component } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { List } from "@opencode-ai/ui/list"
import { useLocal } from "@/context/local"
import { useLanguage } from "@/context/language"
import { agentColor } from "@/utils/agent"

type AgentItem = ReturnType<ReturnType<typeof useLocal>["agent"]["list"]>[number]

export const DialogSelectAgent: Component = () => {
  const dialog = useDialog()
  const local = useLocal()
  const language = useLanguage()

  return (
    <Dialog title={language.t("prompt.agent.label")} fit>
      <List<AgentItem>
        class="pb-2 [&_[data-slot=list-scroll]]:max-h-[min(52vh,320px)] [&_[data-slot=list-item]]:min-h-12 [&_[data-slot=list-item]]:rounded-[14px] [&_[data-slot=list-item]]:px-3 [&_[data-slot=list-item]]:py-3"
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
