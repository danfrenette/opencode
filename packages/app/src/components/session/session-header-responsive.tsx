import { createMediaQuery } from "@solid-primitives/media"
import { Show } from "solid-js"
import { SessionHeader } from "./session-header"
import { SessionHeaderMobile } from "./session-header-mobile"

interface SessionHeaderResponsiveProps {
  mobileTab: "session" | "changes"
  onMobileTabChange: (tab: "session" | "changes") => void
  hasReview: () => boolean
  reviewCount: () => number
}

export function SessionHeaderResponsive(props: SessionHeaderResponsiveProps) {
  const isDesktop = createMediaQuery("(min-width: 768px)")

  return (
    <Show
      when={isDesktop()}
      fallback={
        <SessionHeaderMobile
          mobileTab={props.mobileTab}
          onMobileTabChange={props.onMobileTabChange}
          hasReview={props.hasReview}
          reviewCount={props.reviewCount}
        />
      }
    >
      <SessionHeader />
    </Show>
  )
}
