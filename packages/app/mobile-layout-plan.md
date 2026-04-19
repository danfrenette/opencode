# Mobile Layout Optimization Plan

## Goals

- Optimize the mobile session experience for phones and small tablets.
- Hit roughly `44px` touch targets for major interactions, especially the composer input and primary header actions.
- Reduce visual density so chat and diff review retain as much vertical space as possible.
- Keep the fork easy to maintain by adding new mobile-focused components from scratch and integrating them through thin wrappers.

## Product Decisions

- Use `768px` as the phone/tablet split.
- Remove mobile search from the header.
- Keep file tree as a first-class action and always visible.
- Use a single button to toggle between chat and reviewable changes.
- Change the chat/review toggle icon based on current mode.
- Open the file tree as an overlay on phones.
- Open the file tree as a side panel on tablets.
- Keep agent/model/variant controls in the composer, but collapse them into a single visible control.
- Keep shell mode supported on mobile.
- Use the existing app dialog system for overflow settings that do not fit in the composer.
- Do not use a modal for the review flow.

## Implementation Strategy

- Leave the existing desktop session UI intact.
- Add dedicated mobile components from scratch.
- Switch between mobile and existing desktop components at the caller level.
- Reuse existing session, review, file tree, and dialog state wherever possible.

## Planned Files

- Add `packages/app/src/components/session/session-header-mobile.tsx`
- Add `packages/app/src/components/session/session-header-responsive.tsx`
- Add `packages/app/src/components/prompt-input-mobile.tsx`
- Add `packages/app/src/components/prompt-input-responsive.tsx`
- Add `packages/app/src/components/dialog-mobile-composer-settings.tsx`
- Update `packages/app/src/pages/session.tsx`
- Update `packages/app/src/pages/session/composer/session-composer-region.tsx`
- Update session component exports if needed

## Phase 1: Mobile Header

- Build a new `session-header-mobile.tsx` with only the primary controls:
  - menu toggle
  - file tree button
  - chat/review toggle
- Keep the header single-row and low-height.
- Size major targets to roughly `44px`.
- Do not include search, status, terminal, or desktop utility actions.
- Add a responsive wrapper so the existing `SessionHeader` remains the desktop implementation.

### State Reuse

- Use `layout.mobileSidebar.toggle()` for the menu.
- Use `layout.fileTree.open()`, `close()`, or `toggle()` for the file tree.
- Reuse mobile review mode state from `pages/session.tsx` via `store.mobileTab`.

## Phase 2: Chat/Review Toggle

- Remove the current mobile `Tabs` strip in `packages/app/src/pages/session.tsx`.
- Make the new header toggle the only primary switch between chat and reviewable changes.
- Reuse existing mobile review state rather than adding a parallel state model.
- Swap the toggle icon based on current mode.

## Phase 3: File Tree Presentation

- Reuse the existing `FileTree` component and `layout.fileTree` state.
- Implement a mobile/tablet-specific file tree presentation rather than forcing the desktop-only side panel onto phones.

### Phone

- Below `768px`, open the file tree as an overlay.
- Keep it easy to dismiss so it does not permanently consume vertical space.

### Tablet

- At and above `768px`, open the file tree as a side panel.
- Keep it first-class and directly accessible from the header.

## Phase 4: Mobile Composer

- Build `prompt-input-mobile.tsx` from scratch as a mobile-first composer surface.
- Keep only essential controls visible by default:
  - attach
  - prompt input
  - send/stop
  - one collapsed config control
- Keep shell mode supported.
- Keep the component visually lighter than the current desktop tray-heavy implementation.

### Composer Config Control

- Collapse agent/model/variant into one visible control.
- Show enough current state to make the active selection understandable without expanding it.
- Keep the control visible in the composer rather than moving it into the header.

## Phase 5: Overflow Settings Dialog

- Reuse the same dialog infrastructure used by settings/options.
- Add `dialog-mobile-composer-settings.tsx` for overflow settings that do not fit inline.
- This dialog is not part of review or file-tree navigation.
- Likely contents:
  - expanded agent selection
  - expanded model selection
  - expanded variant selection
  - any future mobile overflow settings

## Phase 6: Density and Touch Target Pass

- Tune the new mobile header and composer around the agreed touch-target and density goals.
- Prioritize readability and vertical efficiency over desktop parity.

### Specific Checks

- Input focus area feels large enough to tap reliably.
- Attach and send/stop targets are easy to hit.
- Collapsed config control remains legible.
- Resting composer height stays compact.
- Visual chrome is reduced relative to the current mobile experience.

## Phase 7: Integration Rules

- Keep the responsive switch near the call sites.
- Avoid deep edits to `session-header.tsx` and `prompt-input.tsx` unless needed for shared behavior.
- Prefer reuse of existing app state:
  - `useSessionLayout().view().reviewPanel`
  - `layout.fileTree`
  - `store.mobileTab` in `pages/session.tsx`
  - `useDialog()`

## Phase 8: Validation

- Verify behavior on:
  - phone width
  - tablet portrait
  - tablet landscape

### Validation Checklist

- Header controls meet target hit area expectations.
- Chat/review toggle works cleanly.
- Phone file tree overlay opens and closes correctly.
- Tablet file tree side panel behaves correctly.
- Composer height remains compact in empty and filled states.
- Long prompts remain usable.
- Attachments and context chips still work.
- Collapsed config control and shell mode are still accessible.

## Execution Order

1. Add responsive header wrapper and mobile header.
2. Replace the mobile tab strip with the header-driven chat/review toggle.
3. Implement responsive file tree presentation for phone and tablet.
4. Add responsive prompt wrapper and mobile composer.
5. Add the overflow settings dialog.
6. Run density and responsive QA.
