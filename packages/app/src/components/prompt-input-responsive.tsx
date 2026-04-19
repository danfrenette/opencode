import { createMediaQuery } from "@solid-primitives/media"
import { Show } from "solid-js"
import { PromptInput } from "./prompt-input"
import { PromptInputMobile } from "./prompt-input-mobile"
import type { FollowupDraft } from "./prompt-input/submit"

interface PromptInputResponsiveProps {
  class?: string
  ref?: (el: HTMLDivElement) => void
  newSessionWorktree?: string
  onNewSessionWorktreeReset?: () => void
  edit?: { id: string; prompt: unknown; context: FollowupDraft["context"] }
  onEditLoaded?: () => void
  shouldQueue?: () => boolean
  onQueue?: (draft: FollowupDraft) => void
  onAbort?: () => void
  onSubmit?: () => void
}

export function PromptInputResponsive(props: PromptInputResponsiveProps) {
  const isDesktop = createMediaQuery("(min-width: 768px)")

  return (
    <Show
      when={isDesktop()}
      fallback={
        <PromptInputMobile
          class={props.class}
          ref={props.ref}
          newSessionWorktree={props.newSessionWorktree}
          onNewSessionWorktreeReset={props.onNewSessionWorktreeReset}
          edit={props.edit}
          onEditLoaded={props.onEditLoaded}
          shouldQueue={props.shouldQueue}
          onQueue={props.onQueue}
          onAbort={props.onAbort}
          onSubmit={props.onSubmit}
        />
      }
    >
      <PromptInput
        class={props.class}
        ref={props.ref}
        newSessionWorktree={props.newSessionWorktree}
        onNewSessionWorktreeReset={props.onNewSessionWorktreeReset}
        edit={props.edit}
        onEditLoaded={props.onEditLoaded}
        shouldQueue={props.shouldQueue}
        onQueue={props.onQueue}
        onAbort={props.onAbort}
        onSubmit={props.onSubmit}
      />
    </Show>
  )
}
