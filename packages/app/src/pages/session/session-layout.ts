import { useParams } from "@solidjs/router"
import { createMemo } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { useLayout } from "@/context/layout"

export type SessionViewportMode = "desktop-landscape" | "stacked"

/**
 * Determines the session viewport mode for responsive layout.
 *
 * - desktop-landscape: Side-by-side layout with review/file panels (width >= 1024px and landscape)
 * - stacked: Top-tab layout similar to mobile, used for phones and tablets in portrait (width < 1024px or portrait)
 *
 * This allows iPad portrait to use the mobile-style top tabs while preserving
 * desktop behavior on larger screens and iPad landscape.
 */
export const useSessionViewportMode = (): (() => SessionViewportMode) => {
  // Desktop landscape: >=1024px wide AND landscape orientation
  // Using 1024px (lg breakpoint) gives comfortable room for side panels
  const isDesktopLandscape = createMediaQuery("(min-width: 1024px) and (orientation: landscape)")

  return createMemo(() => {
    if (isDesktopLandscape()) return "desktop-landscape"
    return "stacked"
  })
}

export const useSessionKey = () => {
  const params = useParams()
  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  return { params, sessionKey }
}

export const useSessionLayout = () => {
  const layout = useLayout()
  const { params, sessionKey } = useSessionKey()
  return {
    params,
    sessionKey,
    tabs: createMemo(() => layout.tabs(sessionKey)),
    view: createMemo(() => layout.view(sessionKey)),
  }
}
