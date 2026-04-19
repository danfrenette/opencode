import { Popover as Kobalte } from "@kobalte/core/popover"
import { Component, ComponentProps, createMemo, JSX, Show, ValidComponent } from "solid-js"
import { createStore } from "solid-js/store"
import { useLocal } from "@/context/local"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { popularProviders } from "@/hooks/use-providers"
import { Button } from "@opencode-ai/ui/button"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tag } from "@opencode-ai/ui/tag"
import { Dialog } from "@opencode-ai/ui/dialog"
import { List } from "@opencode-ai/ui/list"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { ModelTooltip } from "./model-tooltip"
import { useLanguage } from "@/context/language"

const isFree = (provider: string, cost: { input: number } | undefined) =>
  provider === "opencode" && (!cost || cost.input === 0)

type ModelState = ReturnType<typeof useLocal>["model"]

const ModelList: Component<{
  provider?: string
  class?: string
  onSelect: () => void
  action?: JSX.Element
  model?: ModelState
}> = (props) => {
  const model = props.model ?? useLocal().model
  const language = useLanguage()
  const [store, setStore] = createStore({
    filter: "",
  })

  const showFavorites = createMemo(() => !props.provider && store.filter.trim().length === 0)
  const favoritesLabel = createMemo(() => language.t("dialog.model.group.favorites"))

  const models = createMemo(() =>
    model
      .list()
      .filter((m) => model.visible({ modelID: m.id, providerID: m.provider.id }))
      .filter((m) => (props.provider ? m.provider.id === props.provider : true)),
  )

  const items = createMemo(() => {
    if (!showFavorites()) return models()
    const favorite = models().filter((item) => model.hasFavorite({ providerID: item.provider.id, modelID: item.id }))
    const rest = models().filter((item) => !model.hasFavorite({ providerID: item.provider.id, modelID: item.id }))
    return [...favorite, ...rest]
  })

  return (
    <List
      class={`flex-1 min-h-0 [&_[data-slot=list-scroll]]:flex-1 [&_[data-slot=list-scroll]]:min-h-0 [&_[data-slot=list-item]]:min-h-14 [&_[data-slot=list-item]]:rounded-[14px] [&_[data-slot=list-item]]:px-3 [&_[data-slot=list-item]]:py-2 ${props.class ?? ""}`}
      search={{ placeholder: language.t("dialog.model.search.placeholder"), autofocus: true, action: props.action }}
      emptyMessage={language.t("dialog.model.empty")}
      key={(x) => `${x.provider.id}:${x.id}`}
      items={items}
      current={model.current()}
      filterKeys={["provider.name", "name", "id"]}
      onFilter={(value) => setStore("filter", value)}
      sortBy={(a, b) => a.name.localeCompare(b.name)}
      groupBy={(x) =>
        showFavorites() && model.hasFavorite({ providerID: x.provider.id, modelID: x.id }) ? favoritesLabel() : x.provider.name
      }
      sortGroupsBy={(a, b) => {
        if (a.category === favoritesLabel()) return -1
        if (b.category === favoritesLabel()) return 1
        const aProvider = a.items[0].provider.id
        const bProvider = b.items[0].provider.id
        if (popularProviders.includes(aProvider) && !popularProviders.includes(bProvider)) return -1
        if (!popularProviders.includes(aProvider) && popularProviders.includes(bProvider)) return 1
        return popularProviders.indexOf(aProvider) - popularProviders.indexOf(bProvider)
      }}
      itemWrapper={(item, node) => (
        <Tooltip
          class="w-full"
          placement="right-start"
          gutter={12}
          value={<ModelTooltip model={item} latest={item.latest} free={isFree(item.provider.id, item.cost)} />}
        >
          {node}
        </Tooltip>
      )}
      onSelect={(x) => {
        model.set(x ? { modelID: x.id, providerID: x.provider.id } : undefined, {
          recent: true,
        })
        props.onSelect()
      }}
      >
        {(i) => (
          <div class="flex w-full min-w-0 items-center gap-2 text-13-regular">
            <div class="flex min-w-0 flex-1 items-center gap-x-2">
              <span class="truncate">{i.name}</span>
              <Show when={isFree(i.provider.id, i.cost)}>
                <Tag>{language.t("model.tag.free")}</Tag>
              </Show>
              <Show when={i.latest}>
                <Tag>{language.t("model.tag.latest")}</Tag>
              </Show>
            </div>
            <IconButton
              icon={model.hasFavorite({ providerID: i.provider.id, modelID: i.id }) ? "star-filled" : "star"}
              variant="ghost"
              size="small"
              class="size-11 rounded-xl"
              aria-label={
                model.hasFavorite({ providerID: i.provider.id, modelID: i.id })
                  ? language.t("dialog.model.unfavorite")
                  : language.t("dialog.model.favorite")
              }
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                model.toggleFavorite({ providerID: i.provider.id, modelID: i.id })
              }}
            />
          </div>
        )}
    </List>
  )
}

type ModelSelectorTriggerProps = Omit<ComponentProps<typeof Kobalte.Trigger>, "as" | "ref">
type Dismiss = "escape" | "outside" | "select" | "manage" | "provider"

export function ModelSelectorPopover(props: {
  provider?: string
  model?: ModelState
  children?: JSX.Element
  triggerAs?: ValidComponent
  triggerProps?: ModelSelectorTriggerProps
  onClose?: (cause: "escape" | "select") => void
}) {
  const [store, setStore] = createStore<{
    open: boolean
    dismiss: Dismiss | null
  }>({
    open: false,
    dismiss: null,
  })
  const dialog = useDialog()

  const close = (dismiss: Dismiss) => {
    setStore("dismiss", dismiss)
    setStore("open", false)
  }

  const handleManage = () => {
    close("manage")
    void import("./dialog-manage-models").then((x) => {
      dialog.show(() => <x.DialogManageModels />)
    })
  }

  const handleConnectProvider = () => {
    close("provider")
    void import("./dialog-select-provider").then((x) => {
      dialog.show(() => <x.DialogSelectProvider />)
    })
  }
  const language = useLanguage()

  return (
    <Kobalte
      open={store.open}
      onOpenChange={(next) => {
        if (next) setStore("dismiss", null)
        setStore("open", next)
      }}
      modal={false}
      placement="top-start"
      gutter={4}
    >
      <Kobalte.Trigger as={props.triggerAs ?? "div"} {...props.triggerProps}>
        {props.children}
      </Kobalte.Trigger>
      <Kobalte.Portal>
        <Kobalte.Content
          class="w-72 h-80 flex flex-col p-2 rounded-md border border-border-base bg-surface-raised-stronger-non-alpha shadow-md z-50 outline-none overflow-hidden"
          onEscapeKeyDown={(event) => {
            close("escape")
            event.preventDefault()
            event.stopPropagation()
          }}
          onPointerDownOutside={() => close("outside")}
          onFocusOutside={() => close("outside")}
          onCloseAutoFocus={(event) => {
            const dismiss = store.dismiss
            if (dismiss === "outside") event.preventDefault()
            if (dismiss === "escape" || dismiss === "select") {
              event.preventDefault()
              props.onClose?.(dismiss)
            }
            setStore("dismiss", null)
          }}
        >
          <Kobalte.Title class="sr-only">{language.t("dialog.model.select.title")}</Kobalte.Title>
          <ModelList
            provider={props.provider}
            model={props.model}
            onSelect={() => close("select")}
            class="p-1"
            action={
              <div class="flex items-center gap-1">
                <Tooltip placement="top" value={language.t("command.provider.connect")}>
                  <IconButton
                    icon="plus-small"
                    variant="ghost"
                    iconSize="normal"
                    class="size-6"
                    aria-label={language.t("command.provider.connect")}
                    onClick={handleConnectProvider}
                  />
                </Tooltip>
                <Tooltip placement="top" value={language.t("dialog.model.manage")}>
                  <IconButton
                    icon="sliders"
                    variant="ghost"
                    iconSize="normal"
                    class="size-6"
                    aria-label={language.t("dialog.model.manage")}
                    onClick={handleManage}
                  />
                </Tooltip>
              </div>
            }
          />
        </Kobalte.Content>
      </Kobalte.Portal>
    </Kobalte>
  )
}

export const DialogSelectModel: Component<{ provider?: string; model?: ModelState; onBack?: () => void }> = (props) => {
  const dialog = useDialog()
  const language = useLanguage()

  const provider = () => {
    void import("./dialog-select-provider").then((x) => {
      dialog.show(() => <x.DialogSelectProvider />)
    })
  }

  const manage = () => {
    void import("./dialog-manage-models").then((x) => {
      dialog.show(() => <x.DialogManageModels />)
    })
  }

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
          <span class="truncate">{language.t("dialog.model.select.title")}</span>
        </div>
      }
      action={
        <div class="flex items-center gap-1">
          <IconButton
            icon="plus-small"
            variant="ghost"
            size="small"
            class="size-8 rounded-lg"
            aria-label={language.t("command.provider.connect")}
            onClick={provider}
          />
          <IconButton
            icon="settings-gear"
            variant="ghost"
            size="small"
            class="size-8 rounded-lg"
            aria-label={language.t("dialog.model.manage")}
            onClick={manage}
          />
        </div>
      }
    >
      <ModelList provider={props.provider} model={props.model} onSelect={() => dialog.close()} />
    </Dialog>
  )
}
