import { Show, createMemo } from "solid-js"
import { useLanguage } from "@/context/language"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Select } from "@opencode-ai/ui/select"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { useCommand } from "@/context/command"
import { useProviders } from "@/hooks/use-providers"
import { useSync } from "@/context/sync"
import { useLocal } from "@/context/local"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"

interface DialogMobileComposerSettingsProps {
  onClose?: () => void
}

export function DialogMobileComposerSettings(props: DialogMobileComposerSettingsProps) {
  const language = useLanguage()
  const local = useLocal()
  const command = useCommand()
  const providers = useProviders()
  const sync = useSync()

  const agentsLoading = createMemo(() => !sync.data.ready || sync.data.agent.length === 0)
  const providersLoading = createMemo(() => providers.loading?.() ?? false)

  const agentNames = createMemo(() => local.agent.list().map((agent) => agent.name))

  const variants = createMemo(() => {
    const current = local.model.current()
    if (!current) return ["default"]
    const provider = providers.all().find((p) => p.id === current.provider?.id)
    // Check if provider has variants (dynamic property check)
    const providerVariants = (provider as { variants?: string[] })?.variants
    if (!providerVariants) return ["default"]
    return ["default", ...providerVariants]
  })

  return (
    <div class="flex flex-col h-full bg-background-base">
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-border-weak-base">
        <div class="text-16-semibold text-text-strong">
          {language.t("session.composerSettings.title")}
        </div>
        <IconButton
          icon="close"
          variant="ghost"
          size="small"
          class="w-10 h-10 rounded-md"
          onClick={() => props.onClose?.()}
          aria-label={language.t("common.close")}
        />
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Agent Selection */}
        <div class="space-y-2">
          <label class="text-14-medium text-text-strong">
            {language.t("prompt.agent.label")}
          </label>
          <Show when={!agentsLoading()}>
            <TooltipKeybind
              placement="top"
              gutter={4}
              title={language.t("command.agent.cycle")}
              keybind={command.keybind("agent.cycle")}
            >
              <Select
                size="normal"
                options={agentNames()}
                current={local.agent.current()?.name ?? ""}
                onSelect={(value) => {
                  local.agent.set(value)
                }}
                class="w-full capitalize"
                valueClass="truncate text-14-regular"
                variant="ghost"
              />
            </TooltipKeybind>
          </Show>
        </div>

        {/* Model Selection */}
        <div class="space-y-2">
          <label class="text-14-medium text-text-strong">
            {language.t("prompt.model.label")}
          </label>
          <Show when={!providersLoading()}>
            <Show
              when={providers.paid().length > 0}
              fallback={
                <Button
                  as="div"
                  variant="ghost"
                  size="normal"
                  class="w-full text-14-regular justify-between"
                  onClick={() => {
                    // Would open model selection dialog
                  }}
                >
                  <span class="truncate">
                    {local.model.current()?.name ?? language.t("dialog.model.select.title")}
                  </span>
                  <Icon name="chevron-down" size="small" />
                </Button>
              }
            >
              <Button
                as="div"
                variant="ghost"
                size="normal"
                class="w-full text-14-regular justify-between group"
                onClick={() => {
                  // Would open model selection dialog
                }}
              >
                <div class="flex items-center gap-2 min-w-0">
                  <Show when={local.model.current()?.provider?.id}>
                    <ProviderIcon
                      id={local.model.current()?.provider?.id ?? ""}
                      class="size-4 shrink-0"
                    />
                  </Show>
                  <span class="truncate">
                    {local.model.current()?.name ?? language.t("dialog.model.select.title")}
                  </span>
                </div>
                <Icon name="chevron-down" size="small" />
              </Button>
            </Show>
          </Show>
        </div>

        {/* Variant Selection */}
        <Show when={variants().length > 1}>
          <div class="space-y-2">
            <label class="text-14-medium text-text-strong">
              {language.t("prompt.variant.label")}
            </label>
            <TooltipKeybind
              placement="top"
              gutter={4}
              title={language.t("command.model.variant.cycle")}
              keybind={command.keybind("model.variant.cycle")}
            >
              <Select
                size="normal"
                options={variants()}
                current={local.model.variant.current() ?? "default"}
                label={(x) => (x === "default" ? language.t("common.default") : x)}
                onSelect={(value) => {
                  local.model.variant.set(value === "default" ? undefined : value)
                }}
                class="w-full capitalize"
                valueClass="truncate text-14-regular"
                variant="ghost"
              />
            </TooltipKeybind>
          </div>
        </Show>
      </div>

      {/* Footer */}
      <div class="p-4 border-t border-border-weak-base">
        <Button
          variant="secondary"
          size="large"
          class="w-full"
          onClick={() => props.onClose?.()}
        >
          {language.t("common.done")}
        </Button>
      </div>
    </div>
  )
}
