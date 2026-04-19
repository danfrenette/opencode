import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"

interface SessionHeaderMobileProps {
  mobileTab: "session" | "changes"
  onMobileTabChange: (tab: "session" | "changes") => void
  hasReview: () => boolean
  reviewCount: () => number
}

export function SessionHeaderMobile(props: SessionHeaderMobileProps) {
  const language = useLanguage()
  const layout = useLayout()

  const isReviewMode = () => props.mobileTab === "changes"

  const toggleChatReview = () => {
    const next = isReviewMode() ? "session" : "changes"
    props.onMobileTabChange(next)
  }

  return (
    <div class="flex items-center justify-between px-3 py-2 border-b border-border-weak-base bg-background-base min-h-[44px]">
      {/* Left: Menu toggle */}
      <div class="flex items-center">
        <IconButton
          icon="menu"
          variant="ghost"
          size="small"
          class="w-11 h-11 rounded-md"
          onClick={layout.mobileSidebar.toggle}
          aria-label={language.t("sidebar.menu.toggle")}
          aria-expanded={layout.mobileSidebar.opened()}
        />
      </div>

      {/* Center: File tree + Chat/Review toggle */}
      <div class="flex items-center gap-1">
        {/* File tree button - always visible */}
        <Button
          variant="ghost"
          size="small"
          class="h-11 px-3 rounded-md flex items-center gap-2"
          onClick={() => layout.fileTree.toggle()}
          aria-label={language.t("command.fileTree.toggle")}
          aria-expanded={layout.fileTree.opened()}
        >
          <Icon
            size="small"
            name={layout.fileTree.opened() ? "file-tree-active" : "file-tree"}
            classList={{
              "text-icon-strong": layout.fileTree.opened(),
              "text-icon-weak": !layout.fileTree.opened(),
            }}
          />
          <span class="text-14-medium text-text-strong">
            {language.t("session.fileTree.label")}
          </span>
        </Button>

        {/* Chat/Review toggle */}
        <Button
          variant="ghost"
          size="small"
          class="h-11 px-3 rounded-md flex items-center gap-2"
          onClick={toggleChatReview}
          aria-label={isReviewMode() ? language.t("session.tab.session") : language.t("session.review.change.other")}
        >
          <Icon
            size="small"
            name={isReviewMode() ? "speech-bubble" : "review"}
            class="text-icon-base"
          />
          <span class="text-14-medium text-text-strong">
            {isReviewMode()
              ? language.t("session.tab.session")
              : props.hasReview()
                ? language.t("session.review.filesChanged", { count: props.reviewCount() })
                : language.t("session.review.change.other")}
          </span>
        </Button>
      </div>

      <div class="w-11" />
    </div>
  )
}
