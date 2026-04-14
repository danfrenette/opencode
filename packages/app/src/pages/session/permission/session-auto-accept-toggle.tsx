import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { createMemo } from "solid-js"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { usePermission } from "@/context/permission"
import { useSDK } from "@/context/sdk"

export function SessionAutoAcceptToggle(props: { sessionID?: string }) {
  const command = useCommand()
  const language = useLanguage()
  const permission = usePermission()
  const sdk = useSDK()

  const enabled = createMemo(() => {
    if (props.sessionID) return permission.isAutoAccepting(props.sessionID, sdk.directory)
    return permission.isAutoAcceptingDirectory(sdk.directory)
  })

  const label = createMemo(() =>
    enabled()
      ? language.t("command.permissions.autoaccept.disable")
      : language.t("command.permissions.autoaccept.enable"),
  )

  const toggle = () => {
    if (props.sessionID) {
      permission.toggleAutoAccept(props.sessionID, sdk.directory)
      return
    }

    permission.toggleAutoAcceptDirectory(sdk.directory)
  }

  return (
    <TooltipKeybind title={label()} keybind={command.keybind("permissions.autoaccept")}>
      <Button
        variant="ghost"
        class="group/shield-toggle titlebar-icon w-8 h-6 p-0 box-border shrink-0"
        classList={{
          "text-icon-strong": enabled(),
          "text-icon-weak": !enabled(),
        }}
        onClick={toggle}
        aria-label={label()}
        aria-pressed={enabled()}
      >
        <Icon size="small" name={enabled() ? "shield-active" : "shield"} />
      </Button>
    </TooltipKeybind>
  )
}
