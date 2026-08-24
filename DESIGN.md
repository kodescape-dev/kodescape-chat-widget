---
name: Kodescape Chat Widget
description: A calm, restrained support panel where blue marks only launch, act, and your own words
colors:
  brand-blue: '#2563eb'
  ink-900: '#101828'
  ink-700: '#344054'
  ink-500: '#667085'
  ink-400: '#98a2b3'
  border: '#e5e7eb'
  surface: '#ffffff'
  surface-sunk: '#f7f8fa'
  status-online: '#22c55e'
  status-offline: '#f59e0b'
  status-danger: '#ef4444'
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '20px'
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: '-0.01em'
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '14.5px'
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: 'normal'
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '13.5px'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '12.5px'
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 'normal'
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '11.5px'
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 'normal'
rounded:
  xs: '9px'
  sm: '10px'
  md: '12px'
  lg: '14px'
  xl: '20px'
  pill: '22px'
  full: '50%'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '20px'
  2xl: '24px'
components:
  button-primary:
    backgroundColor: '{colors.brand-blue}'
    textColor: '#ffffff'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '13px 16px'
  field-input:
    backgroundColor: '{colors.surface-sunk}'
    textColor: '{colors.ink-900}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '11px 13px'
  bubble-outbound:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink-900}'
    typography: '{typography.body}'
    rounded: '{rounded.lg}'
    padding: '10px 13px'
  bubble-inbound:
    backgroundColor: '{colors.brand-blue}'
    textColor: '#ffffff'
    typography: '{typography.body}'
    rounded: '{rounded.lg}'
    padding: '10px 13px'
  launcher:
    backgroundColor: '{colors.brand-blue}'
    textColor: '#ffffff'
    rounded: '{rounded.full}'
    height: '60px'
    width: '60px'
  composer-send:
    backgroundColor: '{colors.brand-blue}'
    textColor: '#ffffff'
    rounded: '{rounded.full}'
    height: '42px'
    width: '42px'
---

# Design System: Kodescape Chat Widget

## Overview

**Creative North Star: "The Quiet Concierge"**

This is a support panel that behaves the way a good concierge does: present, competent, and almost entirely out of the way until you need it. The system is deliberately restrained — one accent color, a fixed neutral scale, no gradients, no decorative iconography, no invented metrics or urgency devices. It reads as a real SaaS product (the register named in the brief was Intercom/Crisp/Tidio-tier), not a generic AI-generated dashboard: soft layered shadows instead of hard edges, a single system font stack at a small number of disciplined sizes, and generous but tight spacing rather than airy marketing whitespace.

The brand accent (`--kw-primary-color`) is rationed on purpose: it appears at the launcher, the one primary call-to-action per screen, focus rings, and a light tint on the visitor's own messages. Widget surfaces and foregrounds come from `--kw-background-color` and `--kw-text-color`, with related muted, border, and sunk colors derived from those two inputs. This keeps Admin preview and the embedded renderer on one three-color system.

Confirmed visual rejections from the brief: no gradients as decoration, no bento-grid card walls, no fabricated metrics or reply-time claims, no numbered unread badge (no real count data exists to back one). Attachments and an emoji picker were added after this brief was written (2026-08-24) — both are real, fully wired capabilities, not decoration; see Components → Emoji Picker below and the Composer's attach button.

**Key Characteristics:**

- One accent color, rationed to launcher / primary CTA / focus rings / online accent / visitor-message tint
- A background/text pair with derived neutral tones, themed per org
- Soft, ambient shadows — never a hard/flat neobrutalist edge, never a heavy card-stack
- A single system font stack, disciplined into five size/weight roles, no display type
- Every interactive control has a visible focus ring in the accent color

## Colors

The palette is one action accent against a customer-selected background/text pair — a **Restrained** three-color strategy, not a collection of unrelated component colors.

### Primary

- **Kodescape Blue** (`#2563eb` fallback; org-overridable via `--kw-primary-color`): the only brand color in the system. Used for the launcher, the primary CTA button, the header avatar, the focus ring on every interactive control, the connection-status accent styling on hover states, and a light tint on the visitor's own message bubbles.

### Neutral

- **Ink 900** (`#101828`): primary text — headings, body copy, message bubble text.
- **Ink 700** (`#344054`): form field labels only.
- **Ink 500** (`#667085`): all secondary/small text — status text, placeholders, timestamps, privacy line, footnotes. This is the darkest neutral that still reads as "secondary" while clearing 4.5:1 contrast on white.
- **Ink 400** (`#98a2b3`): icon strokes and hairline decoration only. Never used for text — at ~2.6:1 on white it fails the contrast floor; an earlier pass used it for placeholders/timestamps and that was a bug, not a style choice.
- **Border** (`#e5e7eb`): every hairline border, and the resting fill for skeleton loading bubbles.
- **Surface** (`#ffffff`): panel background, focused-input background, admin (outbound) message bubbles.
- **Surface Sunk** (`#f7f8fa`): resting-state input backgrounds, the message-list background.

### Semantic (not brand)

- **Online** (`#22c55e`) / **Offline** (`#f59e0b`): the connection-status dot. Fixed regardless of org branding — this is a system status, not a brand expression.
- **Danger** (`#ef4444`): the unread badge and the "Failed — retry" affordance. Also fixed.

### Named Rules

**The One Signal Rule.** The brand accent marks exactly one thing per screen: the single primary action. A screen never has two blue CTAs competing for attention — secondary actions are always an outline card or a ghost button, never a second fill.

**The Ink-400-Is-Not-Text Rule.** `#98a2b3` exists for icon strokes and borders only. If a designer reaches for it on a text node, that's the contrast bug reintroducing itself — use Ink 500 instead.

## Typography

**Body/UI Font:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` — the OS system stack, no webfont.

**Character:** Plain and workmanlike on purpose. This is an Operate-mode surface (the visitor is completing a task — start a conversation, send a message — not being persuaded or delighted by typography), so the system stack was chosen deliberately over a "point of view" display face; a widget that loads a custom font is also a widget that adds a network dependency this project's own architecture explicitly avoids.

### Hierarchy

- **Headline** (650, 20px, 1.25 line-height, -0.01em tracking): the one large text moment in the whole system — the home screen's "Hi there 👋" greeting. Nothing else in the widget uses this size.
- **Title** (650, 14.5px, 1.3 line-height): the header's org/agent name, always paired with the avatar and status row.
- **Body** (400, 13.5px, 1.5 line-height): message bubble text and form input text — the two places a visitor reads or writes real content.
- **Label** (600, 12.5px, 1.3 line-height): form field labels, button text, status text ("Online"/"Reconnecting…").
- **Caption** (500, 11.5px, 1.5 line-height): timestamps, the privacy line, the "(optional)" field suffix — the smallest, quietest text in the system.

### Named Rules

**The No-Display-Face Rule.** This system has no display/hero typography role. The widget is 368px wide and task-focused; introducing a large expressive headline would fight the "concierge, not billboard" premise.

## Layout

The panel is a floating card: `368px × 600px` on desktop, anchored to a bottom corner (`.kw-root--left` / `.kw-root--right`). Below 480px it keeps an 8px viewport gutter, rounds its corners, and reduces its height so the launcher and device safe area remain visible.

Internal density is tight and consistent: 16–18px outer padding on the header, 22–26px on the home/lead-capture views, 16px on the message list, with an 8–16px rhythm between elements inside any one view. Every view (home, lead-capture, chat) shares the same header and the same outer panel chrome; only the body content swaps.

## Elevation & Depth

Ambient, not structural. Shadows in this system signal "this element floats above the page" — they never encode a hierarchy of stacked surfaces within the panel itself, which stays flat throughout (no cards-on-cards, no nested elevation). Three things get a shadow: the panel itself (floating above the host page), the launcher (floating above the page), and the primary CTA / send button (a soft brand-tinted glow that reads as "this is the one interactive thing here").

### Shadow Vocabulary

- **Panel float** (`0 2px 4px rgba(16,24,40,.04), 0 20px 40px -12px rgba(16,24,40,.22)`): the whole panel against the host page.
- **Launcher float** (`0 10px 24px -4px color-mix(in srgb, var(--kw-primary-color) 45%, transparent), 0 4px 10px rgba(16,24,40,.12)`): brand-tinted, so the launcher always reads as "the brand-colored thing floating on this page" regardless of org color.
- **CTA/send glow** (`0 1px 2px rgba(16,24,40,.06), 0 4px 12px -2px color-mix(in srgb, var(--kw-primary-color, #2563eb) 40%, transparent)`): a soft brand-tinted glow under the one primary action per screen.
- **Emoji picker float** (`0 12px 28px -10px rgba(16,24,40,.28)`, added 2026-08-24): the emoji picker panel, floating above the composer. A scoped exception to The Flat-Interior Rule below — it's a popover overlaying panel content, not a stacked card, so it gets a shadow the way the outer panel itself does.

### Named Rules

**The Flat-Interior Rule.** Nothing inside the panel casts a shadow on anything else inside the panel. Elevation exists only at the panel/launcher's boundary with the host page, on the one primary action per screen, and on the emoji picker (a popover, floating above the composer — see Shadow Vocabulary).

## Shapes

A three-tier radius language, largest to smallest: `20px` for the panel itself (the largest surface), `12–14px` for buttons, cards, and message bubbles (the "control" tier), `9–10px` for form inputs and small icon buttons (the "field" tier), and `50%`/`22px`-pill for anything circular or pill-shaped (avatars, launcher, send button, composer input). Message bubbles carry an asymmetric detail — the corner nearest the sender's avatar tightens to `4px` (a "tail"), the standard chat-bubble convention.

Borders are hairline (`1px solid var(--kw-border)`) and used sparingly: outbound message bubbles, form inputs at rest, outline secondary controls. Filled surfaces (primary button, launcher, avatar, inbound bubble) never carry a border — color alone is enough to read as "filled."

## Components

### Buttons

- **Shape:** `12px` radius, no border.
- **Primary:** `var(--kw-primary-color)` fill, white text, `13px 16px` padding, brand-tinted glow shadow. Exactly one per screen — see The One Signal Rule.
- **Hover:** `filter: brightness(0.94)` — a darkening filter rather than a second hardcoded color, so it stays correct under any org's `--kw-primary-color`.
- **Secondary (outline card):** white fill, `1px` border, `12px` radius — used for a substantial secondary choice ("Continue previous conversation"), not a minor action.
- **Ghost (icon/text, no fill or border):** used for low-emphasis navigation only — back, close. Hover state is a `var(--kw-surface-sunk)` background wash, nothing more.

### Cards / Containers

- **Corner style:** `20px` (panel) or `12px` (the resume-conversation outline card).
- **Background:** white, or `var(--kw-surface-sunk)` for a resting/sunk feel (form inputs, message list background).
- **Shadow strategy:** see Elevation & Depth — only the panel itself carries a shadow; interior cards are flat with a hairline border instead.
- **Internal padding:** `16–18px` for the header, `13–14px` for the resume-conversation card.

### Inputs / Fields

- **Style:** `var(--kw-surface-sunk)` background, `1px` border, `10px` radius — a "sunk" resting state.
- **Focus:** background lifts to white, border becomes `var(--kw-primary-color)`, plus a `3px` soft brand-tinted focus ring (`color-mix(... 14%, transparent)`). This same lift-on-focus pattern is shared by the composer's pill input.
- **Validation:** native browser `reportValidity()` on required fields (Name, Email) — no custom validation-message styling; the browser's own inline UI is trusted as-is.

### Navigation / Header

- Identical across all three views (home, lead-capture, chat): 36–38px circular avatar (initial letter, brand-fill, white text), org/agent name (Title role), a status row (7px dot + Label-role status text), and a close button, right-aligned. Never a view-specific header variant.

### Message Bubbles (signature component)

- **Admin (outbound, left-aligned):** white fill, hairline border, Ink 900 text.
- **Visitor's own (inbound, right-aligned):** a light tint of the brand color (`color-mix(in srgb, var(--kw-primary-color) 14%, white)`) with Ink 900 text — not a solid brand fill — so the accent stays present without turning the visitor's whole message thread blue. Browsers without `color-mix` fall back to the older solid-brand-fill/white-text treatment under an `@supports` guard.
- **Loading state:** skeleton placeholder rows reuse the same left/right alignment classes with a flat `var(--kw-border)` fill and a slow opacity pulse — never the bubble's real background color, so a skeleton is never mistaken for a very short real message.

### Emoji Picker (signature component, added 2026-08-24)

- **Panel:** anchored above the composer, `12px` radius, `1px` hairline border, `var(--kw-surface)` background, Emoji picker float shadow (see Elevation & Depth) — the same elevated-popover recipe as the outer panel, at a smaller scale.
- **Search field:** `var(--kw-surface)` background, `1px` border, `8px` radius (a one-off, not part of the shared Shapes scale — this field doesn't need to match the 9–10px "field" tier elsewhere); focus treatment matches Inputs/Fields (border → `var(--kw-primary-color)`, soft color-mix ring).
- **Grid:** emoji buttons are `36px` square, `7px` radius, transparent at rest, `var(--kw-surface-sunk)` on hover/focus — same sunk-on-interaction language as Ghost buttons.
- **Trigger:** reuses the Ghost button style (no new button variant) next to the existing attach button.

### Message Reactions and Replies

- **Actions:** every confirmed bubble exposes four quick emoji reactions, the existing full Emoji Picker, and a reply icon in one compact floating toolbar. The same actions work on visitor and support messages, including the actor's own messages.
- **Reaction state:** persisted reactions render as compact counted pills below the bubble; selecting the same emoji again toggles the current actor's reaction. Realtime updates replace the complete snapshot so neither side invents counts.
- **Replies:** selecting Reply adds a dismissible inset preview above the composer. Sent replies carry a compact target preview inside the bubble. Both treatments use the existing sunk surface and primary hairline accent, never a new card style.
- **Touch:** because hover does not exist, the action row remains visible in touch-only environments. The Admin preview uses the same functional renderer and local reaction state.

## Do's and Don'ts

### Do:

- **Do** ration the brand accent to one primary action, the launcher, focus rings, the online-status accent, and the visitor's-own-message tint — never more.
- **Do** use Ink 500 (`#667085`) for any secondary or small text; it's the darkest neutral that still clears 4.5:1 contrast on white.
- **Do** keep the panel interior flat — borders and background-tone shifts carry hierarchy, not shadows, inside the panel.
- **Do** keep the header identical across every view; a view-specific header is a system violation, not a variant.
- **Do** use the system font stack (`-apple-system, ...`) — no webfont, matching this repo's zero-runtime-dependency rule for the shipped widget.

### Don't:

- **Don't** use Ink 400 (`#98a2b3`) for text of any kind — icon strokes and borders only.
- **Don't** add a second filled/brand-colored button on the same screen as the primary CTA.
- **Don't** invent an unread-count number on the launcher badge — it's a boolean presence dot because no real count data exists in the store or API today. Wire real data first.
- **Don't** add a functional-looking control unless it is wired end to end. Attachments, emoji insertion, replies, and reactions are persisted capabilities; their preview equivalents use the same renderer with isolated local state.
- **Don't** give the visitor's own message bubbles a solid, fully-saturated brand fill by default — the light tint is the chosen treatment; solid fill is the legacy/fallback path only.
