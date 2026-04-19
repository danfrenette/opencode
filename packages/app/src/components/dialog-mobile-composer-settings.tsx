import { Show, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { useProviders } from "@/hooks/use-providers"
import { useSync } from "@/context/sync"
import { useLocal } from "@/context/local"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"
import { agentColor } from "@/utils/agent"

interface DialogMobileComposerSettingsProps {
  mode: "normal" | "shell"
  onModeChange: (mode: "normal" | "shell") => void
  onClose?: () => void
}

export function DialogMobileComposerSettings(props: DialogMobileComposerSettingsProps) {
  const language = useLanguage()
  const local = useLocal()
  const dialog = useDialog()
  const providers = useProviders()
  const sync = useSync()
  const [store, setStore] = createStore({
    advanced: false,
  })

  const agentsLoading = createMemo(() => sync.data.agent.length === 0)
  const providersLoading = createMemo(() => providers.all().length === 0)

  const currentAgent = createMemo(() => local.agent.current())

  const variants = createMemo(() => {
    const current = local.model.current()
    if (!current) return ["default"]
    const provider = providers.all().find((p) => p.id === current.provider?.id)
    // Check if provider has variants (dynamic property check)
    const providerVariants = (provider as { variants?: string[] })?.variants
    if (!providerVariants) return ["default"]
    return ["default", ...providerVariants]
  })

  const providerName = createMemo(() => local.model.current()?.provider?.name ?? language.t("settings.providers.title"))
  const modelName = createMemo(() => local.model.current()?.name ?? language.t("dialog.model.select.title"))

  const close = () => {
    if (props.onClose) {
      props.onClose()
      return
    }
    dialog.close()
  }

  const openModelSelection = () => {
    if (providers.paid().length > 0) {
      void import("./dialog-select-model").then((x) => {
        dialog.show(() => <x.DialogSelectModel model={local.model} />)
      })
      return
    }

    void import("./dialog-select-model-unpaid").then((x) => {
      dialog.show(() => <x.DialogSelectModelUnpaid model={local.model} />)
    })
  }

  const openProviderSelection = () => {
    void import("./dialog-select-provider").then((x) => {
      dialog.show(() => <x.DialogSelectProvider />)
    })
  }

  const openAgentSelection = () => {
    void import("./dialog-select-agent").then((x) => {
      dialog.show(() => <x.DialogSelectAgent />)
    })
  }

  const openVariantSelection = () => {
    void import("./dialog-select-variant").then((x) => {
      dialog.show(() => (
        <x.DialogSelectVariant
          variants={variants()}
          current={local.model.variant.current()}
          onSelect={(value) => {
            local.model.variant.set(value)
          }}
        />
      ))
    })
  }

  const setMode = (next: "normal" | "shell") => props.onModeChange(next)

  return (
    <div class="fixed inset-x-0 bottom-0 z-50 flex max-h-[78vh] flex-col rounded-t-[28px] border-t border-border-weak-base bg-surface-raised-stronger-non-alpha shadow-lg-border-base pointer-events-auto">
      <div class="flex justify-center pt-2 pb-1">
        <div class="h-1 w-10 rounded-full bg-border-strong-base/70" />
      </div>
      <div class="flex items-start justify-between px-4 pt-1 pb-3">
        <div class="min-w-0">
          <div class="text-11-medium uppercase tracking-[0.08em] text-text-weaker">Composer</div>
          <div class="text-18-medium text-text-strong">{language.t("session.composerSettings.title")}</div>
          <div class="mt-1 flex min-w-0 items-center gap-2 text-13-regular text-text-weak">
            <Show when={local.model.current()?.provider?.id}>
              <ProviderIcon id={local.model.current()?.provider?.id ?? ""} class="size-4 shrink-0" />
            </Show>
            <span class="truncate">{modelName()}</span>
          </div>
        </div>
        <Button variant="ghost" size="small" class="mt-1 h-9 rounded-xl px-3" onClick={close}>
          {language.t("common.done")}
        </Button>
      </div>

      <div class="overflow-y-auto px-4 pb-5">
        <div class="flex flex-col gap-5 rounded-[24px] bg-background-base/80 px-3 py-3 shadow-xs-border-base">
          <div class="space-y-2">
            <div class="text-12-medium text-text-weaker">Mode</div>
            <div class="grid grid-cols-2 gap-2">
              <Button
                variant="ghost"
                size="small"
                class="h-11 justify-start rounded-[16px] px-3 text-14-medium"
                classList={{
                  "bg-surface-raised-base-active text-text-strong shadow-xs-border-base": props.mode === "normal",
                  "text-text-weak": props.mode !== "normal",
                }}
                onClick={() => setMode("normal")}
              >
                <Icon name="prompt" size="small" class="shrink-0" />
                {language.t("prompt.mode.normal")}
              </Button>
              <Button
                variant="ghost"
                size="small"
                class="h-11 justify-start rounded-[16px] px-3 text-14-medium"
                classList={{
                  "bg-surface-raised-base-active text-text-strong shadow-xs-border-base": props.mode === "shell",
                  "text-text-weak": props.mode !== "shell",
                }}
                onClick={() => setMode("shell")}
              >
                <Icon name="terminal" size="small" class="shrink-0" />
                {language.t("prompt.mode.shell")}
              </Button>
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-12-medium text-text-weaker">Model</div>
            <Show when={!providersLoading()}>
              <Button
                variant="ghost"
                size="small"
                class="h-auto min-h-12 w-full justify-between rounded-[18px] px-3 py-3 text-left"
                onClick={openModelSelection}
              >
                <div class="flex min-w-0 items-center gap-3">
                  <div class="flex size-9 shrink-0 items-center justify-center rounded-[14px] bg-surface-raised-base-active">
                    <Show when={local.model.current()?.provider?.id}>
                      <ProviderIcon id={local.model.current()?.provider?.id ?? ""} class="size-4 shrink-0" />
                    </Show>
                  </div>
                  <div class="min-w-0">
                    <div class="truncate text-15-medium text-text-strong">{modelName()}</div>
                    <div class="truncate text-12-regular text-text-weak">{providerName()}</div>
                  </div>
                </div>
                <Icon name="chevron-right" size="small" class="shrink-0 text-icon-weaker" />
              </Button>
            </Show>
          </div>

          <div class="space-y-2">
            <div class="text-12-medium text-text-weaker">{language.t("prompt.agent.label")}</div>
            <Show when={!agentsLoading()}>
              <Button
                variant="ghost"
                size="small"
                class="h-auto min-h-12 w-full justify-between rounded-[18px] px-3 py-3 text-left"
                onClick={openAgentSelection}
              >
                <div class="flex min-w-0 items-center gap-3">
                  <div
                    class="size-9 shrink-0 rounded-[14px]"
                    style={{
                      background: `color-mix(in oklab, ${agentColor(currentAgent()?.name ?? "build", currentAgent()?.color)} 18%, var(--surface-raised-base-active))`,
                    }}
                  >
                    <div
                      class="mx-auto mt-[15px] size-2 rounded-full"
                      style={{ "background-color": agentColor(currentAgent()?.name ?? "build", currentAgent()?.color) }}
                    />
                  </div>
                  <div class="min-w-0">
                    <div class="truncate text-15-medium text-text-strong capitalize">{currentAgent()?.name ?? "Default"}</div>
                    <div class="truncate text-12-regular text-text-weak">Primary agent</div>
                  </div>
                </div>
                <Icon name="chevron-right" size="small" class="shrink-0 text-icon-weaker" />
              </Button>
            </Show>
          </div>

          <div class="space-y-2 border-t border-border-weaker-base pt-4">
            <Button
              variant="ghost"
              size="small"
              class="flex h-10 w-full items-center justify-between rounded-[14px] px-1 text-13-medium text-text-weak"
              onClick={() => setStore("advanced", (value) => !value)}
            >
              <span>Advanced</span>
              <Icon
                name="chevron-down"
                size="small"
                class="shrink-0 transition-transform"
                classList={{ "rotate-180": store.advanced }}
              />
            </Button>

            <Show when={store.advanced}>
              <div class="space-y-3 pt-1">
                <Button
                  variant="ghost"
                  size="small"
                  class="h-auto min-h-11 w-full justify-between rounded-[16px] px-3 py-3 text-left"
                  onClick={openProviderSelection}
                >
                  <div class="min-w-0">
                    <div class="text-12-medium text-text-weaker">{language.t("settings.providers.title")}</div>
                    <div class="mt-0.5 truncate text-14-medium text-text-strong">{providerName()}</div>
                  </div>
                  <Icon name="chevron-right" size="small" class="shrink-0 text-icon-weaker" />
                </Button>

                <Show when={variants().length > 1}>
                  <Button
                    variant="ghost"
                    size="small"
                    class="h-auto min-h-11 w-full justify-between rounded-[16px] px-3 py-3 text-left"
                    onClick={openVariantSelection}
                  >
                    <div class="min-w-0">
                      <div class="text-12-medium text-text-weaker">{language.t("prompt.variant.label")}</div>
                      <div class="mt-0.5 truncate text-14-medium text-text-strong">
                        {local.model.variant.current() ?? language.t("common.default")}
                      </div>
                    </div>
                    <Icon name="chevron-right" size="small" class="shrink-0 text-icon-weaker" />
                  </Button>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
}
