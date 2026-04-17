# Prompt Input Mobile Improvements

## Goal

Make the prompt input substantially easier to use on mobile, where frequent use currently exposes several touch and readability issues.

Preferred direction: cleaner mobile composer.

This means:

- keep the editor larger and easier to tap
- reduce dense always-visible controls on mobile
- avoid hover-dependent interactions
- optimize for thumb use first, desktop second

## Current Problems

### 1. Main editor text is too small on mobile

The prompt editor uses `text-14-regular`, which is too small for frequent mobile input and can trigger iOS zoom behavior on focus.

Relevant code:

- `packages/app/src/components/prompt-input.tsx:1371`

### 2. Secondary controls are below recommended touch target size

The top tray controls are driven by a `28px` tall shared control style. That is too small for frequent mobile tapping.

Relevant code:

- `packages/app/src/components/prompt-input.tsx:283-284`
- `packages/app/src/components/prompt-input.tsx:1528-1541`
- `packages/app/src/components/prompt-input.tsx:1555-1579`
- `packages/app/src/components/prompt-input.tsx:1623-1637`

### 3. Context chips are too dense

Context items are compact, with a small remove affordance that is easy to miss on touch.

Relevant code:

- `packages/app/src/components/prompt-input/context-items.tsx:44`
- `packages/app/src/components/prompt-input/context-items.tsx:65-75`

### 4. Image attachment removal is hover-centric

The remove affordance is tiny and hidden until hover, which is a poor mobile interaction model.

Relevant code:

- `packages/app/src/components/prompt-input/image-attachments.tsx:16-18`
- `packages/app/src/components/prompt-input/image-attachments.tsx:43-50`

### 5. Mention and slash popover rows are too compact

The suggestion rows use very tight vertical padding, which makes quick tapping harder on phones.

Relevant code:

- `packages/app/src/components/prompt-input/slash-popover.tsx:61`
- `packages/app/src/components/prompt-input/slash-popover.tsx:78`
- `packages/app/src/components/prompt-input/slash-popover.tsx:106`

## Design Principles

This work should follow Emil-style design engineering rules:

- no critical interaction should depend on hover
- all mobile tap targets should be at least `44px`
- text inputs should use at least `16px` font size on mobile
- product UI should prioritize speed and clarity over decorative motion
- keyboard behavior should remain consistent for desktop users

## Recommended Direction

Adopt a cleaner mobile composer instead of just scaling up the current dense layout.

On mobile:

- keep the editor visually prominent
- keep primary actions immediately reachable
- move lower-frequency controls behind a single options entry point
- preserve the current desktop layout unless a change clearly improves both

## Proposed Changes

### 1. Increase editor size and tap comfort

For `viewportMode === "stacked"`:

- use `text-16-regular` for the editor and placeholder
- increase the minimum editor height so empty-space taps are easier
- preserve current desktop density

Expected result:

- easier tapping into the field
- better readability
- no iOS zoom-on-focus behavior

### 2. Simplify mobile controls

Replace the dense always-visible mobile tray with a lighter structure:

- keep attach
- keep send / stop
- keep session vs changes toggle when needed
- move agent, model, and variant controls into a single mobile options button or sheet

Why:

- these controls matter, but they are not the highest-frequency taps while composing
- consolidating them reduces accidental taps and visual crowding

### 3. Fix chip and attachment touch targets

For mobile:

- context chips should be at least `44px` tall
- image remove controls should always be reachable without hover
- remove buttons should get a much larger hit area, even if the visible icon remains small

Implementation preference:

- enlarge hit areas with padding or positioned hit zones
- avoid oversized visual icons that add noise

### 4. Make suggestion rows easier to tap

For mobile popovers:

- increase row padding
- keep one-tap selection comfortable with thumb input
- preserve keyboard navigation behavior

### 5. Restrict hover-only polish to hover-capable devices

Any hover styling that affects discoverability or removal actions should either:

- be always available on touch, or
- be wrapped in hover-capable media queries

## Suggested Implementation Order

1. Update editor typography and mobile min-height.
2. Introduce a mobile options entry point for agent/model/variant.
3. Increase chip and attachment hit targets.
4. Increase slash and mention row padding.
5. Audit hover-only affordances in the prompt input surface.

## Success Criteria

- mobile users can reliably tap into the editor without precision aiming
- no important action depends on hover
- all frequent touch targets are at least `44px`
- agent/model configuration remains accessible, but no longer crowds the composer
- desktop keyboard workflows remain unchanged

## Notes

This should be implemented as a stacked/mobile-specific pass first.

That keeps risk low, targets the real pain point, and avoids unnecessary churn in the desktop composer.
