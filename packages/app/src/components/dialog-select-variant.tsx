import { type Component, Show } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { List } from "@opencode-ai/ui/list"
import { useLanguage } from "@/context/language"

export const DialogSelectVariant: Component<{
  variants: string[]
  current?: string
  onSelect: (value: string | undefined) => void
  onBack?: () => void
}> = (props) => {
  const dialog = useDialog()
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
          <span class="truncate">{language.t("prompt.variant.label")}</span>
        </div>
      }
      fit
    >
      <List
        class="[&_[data-slot=list-scroll]]:max-h-[min(44vh,280px)] [&_[data-slot=list-item]]:min-h-12 [&_[data-slot=list-item]]:rounded-[14px] [&_[data-slot=list-item]]:px-3 [&_[data-slot=list-item]]:py-3"
        key={(x) => x}
        items={() => ["default", ...props.variants]}
        current={props.current ?? "default"}
        onSelect={(item) => {
          if (!item) return
          props.onSelect(item === "default" ? undefined : item)
          dialog.close()
        }}
      >
        {(item) => <div class="w-full truncate text-14-medium">{item === "default" ? language.t("common.default") : item}</div>}
      </List>
    </Dialog>
  )
}
