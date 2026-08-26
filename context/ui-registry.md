# UI Registry

Visual consistency reference for `src/ui/`. This project has no Tailwind
and no component framework — plain CSS in `src/ui/styles.css`, scoped
inside the widget's Shadow DOM. "Class" below means the literal CSS
class name; values are the actual declarations, not utility tokens.

Read this before adding or restyling any widget UI. Match the existing
pattern for a given element type rather than inventing a new one.

## Admin live-preview contract

The Admin preview is not a visual reimplementation. It embeds `preview.html`,
which mounts the exact production components and this exact stylesheet inside
the widget Shadow DOM. Home, Chat, Pre-chat, Minimized, Desktop, and Mobile are
renderer states configured over `postMessage`; any visual change made here is
therefore reflected in Admin automatically. Keep the root `index.html`
developer harness out of the preview document.

## Design tokens (`.kw-root` in `src/ui/styles.css`)

The only externally-themeable value is `--kw-primary-color`, set on the
host element from `WidgetSettings.primaryColor` (`mount.ts`'s
`applyBranding()`). Every other token is fixed — orgs never override
neutrals, only the one brand accent.

| Token                | Value                         | Used for                                                                                                    |
| -------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `--kw-primary-color` | (org-set, fallback `#2563eb`) | launcher, avatar, primary CTA, focus rings, send button, close-to-active accents, inbound-bubble tint       |
| `--kw-ink-900`       | `#101828`                     | primary text (headings, body, bubble text)                                                                  |
| `--kw-ink-700`       | `#344054`                     | form labels                                                                                                 |
| `--kw-ink-500`       | `#667085`                     | secondary text — status text, placeholders, timestamps, privacy line, footnotes (validated ≥4.5:1 on white) |
| `--kw-ink-400`       | `#98a2b3`                     | icon stroke / decorative only — **never** text (fails contrast, ~2.6:1)                                     |
| `--kw-border`        | `#e5e7eb`                     | all hairline borders, skeleton bubble fill                                                                  |
| `--kw-surface`       | `#ffffff`                     | panel background, input focus background, outbound bubble                                                   |
| `--kw-surface-sunk`  | `#f7f8fa`                     | input resting background, message list background                                                           |

**Pattern notes:** `--kw-ink-400` is for icons and borders only — it was
originally (wrongly) used for placeholder/timestamp text and failed the
4.5:1 contrast floor; fixed once, don't reintroduce it as a text color.
Status-dot green (`#22c55e`) / amber (`#f59e0b`) and the danger red
(`#ef4444`) are connection/error semantics, not brand — they stay fixed
regardless of `--kw-primary-color`.

## Panel shell & header

File: `src/ui/window.ts`, `src/ui/styles.css`
Last updated: 2026-08-21

| Property       | Value                                                                         |
| -------------- | ----------------------------------------------------------------------------- |
| Background     | `var(--kw-surface)`                                                           |
| Border         | `1px solid rgba(16, 24, 40, 0.04)`                                            |
| Border radius  | `20px` (panel), `9px` (small icon buttons like close)                         |
| Shadow         | `0 2px 4px rgba(16,24,40,.04), 0 20px 40px -12px rgba(16,24,40,.22)`          |
| Header padding | `16px 18px`, `border-bottom: 1px solid var(--kw-border)`                      |
| Avatar         | `36px` circle, `var(--kw-primary-color)` bg, white initials, `650` weight     |
| Title text     | `14.5px / 650 / var(--kw-ink-900)`                                            |
| Status text    | `12.5px / var(--kw-ink-500)`, 7px dot with a 3px soft glow ring               |
| Focus ring     | `2px solid var(--kw-primary-color)`, `2px` offset — every interactive element |

**Pattern notes:** the header is identical across all three views (home /
lead-capture / chat) — never make a view-specific header variant. Panel
radius (20px) is the "large surface" radius; smaller controls (buttons,
inputs, icon buttons) use 9–12px — see below. Below 480px the panel goes
full-screen (`inset: 0`, `border-radius: 0`) — not itself in this
registry since it's a responsive override, not a base pattern.

## Primary button (`.kw-btn-primary`)

File: `src/ui/home.ts`, `src/ui/lead-capture.ts`, `src/ui/styles.css`
Last updated: 2026-08-21

| Property      | Value                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Background    | `var(--kw-primary-color)`                                                                                                                                          |
| Text          | `#fff`, `14.5px / 600`                                                                                                                                             |
| Border radius | `12px`                                                                                                                                                             |
| Padding       | `13px 16px`                                                                                                                                                        |
| Shadow        | `0 1px 2px rgba(16,24,40,.06), 0 4px 12px -2px color-mix(in srgb, var(--kw-primary-color) 40%, transparent)`                                                       |
| Hover         | `filter: brightness(0.94)`                                                                                                                                         |
| Layout        | `justify-content: space-between` by default (label + trailing icon); `.kw-btn-primary--center` modifier centers when there's no icon (lead-capture's "Start chat") |

**Pattern notes:** this is the _only_ filled/high-emphasis button in the
widget. Secondary actions (`.kw-resume-link`, `.kw-lead-back`) are always
outline or ghost — never a second solid-fill button competing with this
one on the same screen.

## Secondary controls — outline card & ghost button

File: `src/ui/home.ts` (`.kw-resume-link`), `src/ui/lead-capture.ts`
(`.kw-lead-back`), `src/ui/styles.css`
Last updated: 2026-08-21

| Property      | Outline card (`.kw-resume-link`)                                                     | Ghost button (`.kw-lead-back`, `.kw-close`)                   |
| ------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Background    | `var(--kw-surface)`, hover → `var(--kw-surface-sunk)`                                | transparent, hover → `var(--kw-surface-sunk)`                 |
| Border        | `1px solid var(--kw-border)`                                                         | none                                                          |
| Border radius | `12px`                                                                               | `8–9px`                                                       |
| Text          | `13.5px / 600 / var(--kw-ink-900)` (title) + `12.5px / var(--kw-ink-500)` (subtitle) | `13px / 600 / var(--kw-ink-500)`, hover → `var(--kw-ink-700)` |

**Pattern notes:** ghost buttons (icon-only or icon+label, no border, no
fill) are for low-emphasis navigation — back, close. Outline cards (bordered,
white fill) are for a secondary _choice_ that's still substantial —
"Continue previous conversation" is a real alternative path, not a minor
action, hence the card treatment instead of a plain link.

## Form field (`.kw-field-input`)

File: `src/ui/lead-capture.ts`, `src/ui/styles.css`
Last updated: 2026-08-21

| Property      | Value                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Background    | `var(--kw-surface-sunk)`, focus → `var(--kw-surface)`                                           |
| Border        | `1px solid var(--kw-border)`, focus → `var(--kw-primary-color)`                                 |
| Border radius | `10px`                                                                                          |
| Padding       | `11px 13px`                                                                                     |
| Text          | `13.5px / var(--kw-ink-900)`, placeholder → `var(--kw-ink-500)` (not `--kw-ink-400` — contrast) |
| Focus ring    | `0 0 0 3px color-mix(in srgb, var(--kw-primary-color) 14%, transparent)`                        |
| Label         | `12.5px / 600 / var(--kw-ink-700)`, optional-suffix → `var(--kw-ink-500)`                       |

**Pattern notes:** sunk-background-that-lifts-on-focus is the field
pattern everywhere (also used by the composer input) — don't switch to a
plain white-bordered-always field style for a new form.

## Message bubble (`.kw-bubble`)

File: `src/ui/message-list.ts`, `src/ui/styles.css`
Last updated: 2026-08-21

| Property      | Outbound (admin, left)       | Inbound (visitor, right)                                                                                                                                      |
| ------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Background    | `var(--kw-surface)`          | `color-mix(in srgb, var(--kw-primary-color) 14%, white)` (fallback: solid `var(--kw-primary-color)` under `@supports` guard for browsers without `color-mix`) |
| Text          | `var(--kw-ink-900)`          | `var(--kw-ink-900)` (fallback path: `#fff` on solid brand)                                                                                                    |
| Border        | `1px solid var(--kw-border)` | none                                                                                                                                                          |
| Border radius | `14px`, tail corner `4px`    | `14px`, tail corner `4px`                                                                                                                                     |
| Max width     | `82%` of `.kw-list`          | `82%` of `.kw-list`                                                                                                                                           |

**Pattern notes:** `direction: 'inbound'` in this codebase means _the
visitor's own message_ (right-aligned) and `'outbound'` means the admin
reply (left-aligned) — matches the backend's naming (inbound to the org,
outbound from the org), not the visual side. Don't rename or "fix" this
without checking `core/types.ts`'s `MessageDirection` first. Skeleton
loading rows (`.kw-skeleton-bubble`) reuse these same row classes for
alignment but use fixed px widths, not `%` — percentage width on a
shrink-to-fit flex row resolves to 0 (see architecture.md).

Every confirmed bubble exposes the same compact reaction/reply action bar.
Quick reactions are `👍 ❤️ 😂 😮`; More reactions reuses `createEmojiPicker()`
and Reply stages a dismissible composer preview. Persisted reactions group into
count chips beneath the bubble. Reply snapshots render as a small inset block
inside the new message. Touch devices keep actions visible because hover is not
available. Preview mode uses these exact controls and updates its local store;
production posts through REST and replaces reactions from `message:reactions`.

The message list scrollbar stays transparent until the list is hovered. Its
WebKit track is `5px` wide; the thumb uses `var(--kw-ink-400)` at 24% opacity,
increasing only to 34% when the thumb itself is hovered. Firefox retains its
native `thin` width with the same lighter 24% thumb color.

## Composer

File: `src/ui/composer.ts`, `src/ui/styles.css`
Last updated: 2026-08-21

| Property    | Value                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input wrap  | `var(--kw-surface-sunk)`, `1px solid var(--kw-border)`, radius `22px` (pill), focus-within → border + bg become `var(--kw-primary-color)` / `var(--kw-surface)` |
| Input text  | `13.5px / var(--kw-ink-900)`, placeholder `var(--kw-ink-500)`                                                                                                   |
| Send button | `42px` circle, `var(--kw-primary-color)` bg, white icon, shadow `0 2px 8px -1px color-mix(in srgb, var(--kw-primary-color) 45%, transparent)`                   |
| Disabled    | `opacity: 0.6; cursor: not-allowed`                                                                                                                             |

**Pattern notes:** the pill-input-plus-circular-icon-button pattern is
unique to the composer — form fields (above) are rectangular with a
separate submit button below, never inline. Don't merge the two patterns.

## Launcher

File: `src/ui/launcher.ts`, `src/ui/styles.css`
Last updated: 2026-08-21

| Property   | Value                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| Size       | `60px` circle                                                                                                  |
| Background | `var(--kw-primary-color)`                                                                                      |
| Shadow     | `0 10px 24px -4px color-mix(in srgb, var(--kw-primary-color) 45%, transparent), 0 4px 10px rgba(16,24,40,.12)` |
| Icon       | inline SVG, `1.8px` stroke, `26px`                                                                             |
| Badge      | `14px` circle, `#ef4444`, `2.5px solid #fff` ring — boolean presence only, no unread count today               |

**Pattern notes:** the badge is a plain unread _dot_, not a numbered
pill — there's no unread-count data anywhere in `ChatStore`/the API
today. Don't add a number without first plumbing real count data;
a fabricated number is worse than the dot.

## Emoji picker (`.kw-emoji-picker`)

File: `src/ui/emoji-picker.ts`, `src/ui/styles.css`
Last updated: 2026-08-24

| Property         | Value                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel            | absolutely positioned above the composer (`bottom: 62px; left: 8px`), `min(300px, 100vw-32px)` wide, `360px` tall (`max-height: calc(100dvh - 120px)`)                                      |
| Background       | `var(--kw-surface)`, `1px solid var(--kw-border)`, radius `12px`, shadow `0 12px 28px -10px rgba(16,24,40,.28)` — same elevated-panel recipe as the widget's own panel shell, not a new one |
| Search input     | `36px` tall, `var(--kw-surface)` bg, `1px solid var(--kw-border)`, radius `8px`; focus → border `var(--kw-primary-color)` + `2px` color-mix ring (matches Form field's focus treatment)     |
| Category heading | sticky, `var(--kw-ink-500)`, `11px / 650` weight                                                                                                                                            |
| Emoji grid       | `36px` cells, `7` per row, radius `7px`, transparent until hover/focus → `var(--kw-surface-sunk)`                                                                                           |
| Trigger button   | reuses the existing `.kw-composer-action` icon-button class (same as the attach button) — no new trigger style                                                                              |

**Pattern notes:** the picker is a floating panel, not an inline
expansion — it overlays above the composer like a native emoji picker,
closes on outside pointerdown or `Escape`. Built entirely from tokens
already defined in "Design tokens" above (`--kw-surface`, `--kw-border`,
`--kw-ink-500/900`, `--kw-primary-color`) — no new color introduced for
this component, matching this repo's convention of every surface tracing
back to the same token set. Reuses the existing `.kw-composer-action`
class for its own trigger button rather than a bespoke emoji-button
style, keeping the attach/emoji/send row visually uniform.

---

## Session Imprint — Conversation Surface Refinement

Last updated: 2026-08-24 18:36 +06

### Flat Chat Composer

Files: `src/ui/composer.ts`, `src/ui/styles.css`

| Property         | Value                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| Background       | one continuous `var(--kw-surface)` surface                                                                         |
| Border           | one full-width `1px solid var(--kw-border)` top divider on `.kw-composer`; `.kw-composer-row` has no second border |
| Border radius    | none on the composer row and input wrapper; compact action buttons use `8px`                                       |
| Text — primary   | textarea `13.5px`, `22px` line-height; placeholder “Enter your message…”                                           |
| Text — secondary | powered-by mark uses the quiet caption role                                                                        |
| Spacing          | composer `padding: 0 14px 9px`; textarea `min-height: 44px`, `max-height: 120px`; toolbar `min-height: 34px`       |
| Hover state      | icon/send actions use `var(--kw-surface-sunk)` only on interaction                                                 |
| Shadow           | none                                                                                                               |
| Accent usage     | send icon uses `var(--kw-primary-color)` without a filled circle                                                   |

The send control is a compact `34px × 34px` square with an `18px` icon. Keep
it bottom-aligned with the input row; do not restore the older full-input-height
button.

**Pattern notes:** The previous rounded pill input is retired. Multiline input grows without exposing a scrollbar. Attachment and emoji controls sit in the lower toolbar beside “Powered by Kodescape.” Clearing a send clears text and staged attachments immediately. The Admin live preview renders this same production implementation rather than maintaining a visual copy.

### Message Disclosure, Receipts, and Date Labels

Files: `src/ui/message-list.ts`, `src/ui/styles.css`

| Property         | Value                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| Background       | message bubbles use existing direction surfaces; Today/Yesterday labels are transparent                  |
| Border           | date labels have no border; reaction chips retain their compact hairline                                 |
| Border radius    | no radius on date labels; message bubbles retain `14px` with direction-specific tail corners             |
| Text — primary   | bubble content `13.5px`; sender metadata `10px` with `font-weight: 600`                                  |
| Text — secondary | timestamps and delivery state use `var(--kw-ink-500)`                                                    |
| Spacing          | date labels use plain text with `padding: 0`; hidden metadata sits immediately below the selected bubble |
| Hover state      | reactions/reply toolbar stays attached to the actual bubble; touch keeps actions reachable               |
| Shadow           | none on bubbles, dates, or reaction chips                                                                |
| Accent usage     | read receipt may use primary; other states stay neutral                                                  |

**Pattern notes:** Sender, timestamp, and delivery/read check are hidden at rest. Clicking or keyboard-activating a message reveals them together below only that message; the check follows the time and never floats alone under every visitor message. Today and Yesterday are plain centered captions, not rounded pills. Reactions render below the actual message and replies use compact, less-rounded quoted previews with sender name plus content only.

### Attachments and Typing Indicator

Files: `src/ui/message-list.ts`, `src/ui/typing-indicator.ts`, `src/ui/styles.css`

| Property         | Value                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Background       | typing dots use a small neutral bubble; no outer typing-row background                     |
| Border           | attachment previews and typing bubble use the existing hairline token                      |
| Border radius    | attachment preview follows message geometry; typing bubble stays compact and rounded       |
| Text — primary   | attachment message copy renders below the attachment                                       |
| Text — secondary | attachment metadata and typing state use caption tokens                                    |
| Spacing          | typing section receives slight top spacing; support avatar matches normal support messages |
| Hover state      | image attachments reveal a small top-right download control                                |
| Shadow           | only floating download/emoji controls may use the established overlay shadow               |
| Accent usage     | typing identity uses the real support image; visitor initials use one first letter only    |

**Pattern notes:** Attachment media stays compact in both widget and preview. Typing indicators are realtime, animated, and placed immediately above the composer; never render static dots. The visitor side shows the support identity used by messages, while Admin receives visitor typing through the shared socket contract.

### Launcher and Unread State

Files: `src/ui/launcher.ts`, `src/ui/styles.css`

| Property         | Value                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| Background       | dynamic brand color for the icon segment; label surface remains restrained      |
| Border           | one subtle outer edge; no online-status dot                                     |
| Border radius    | compact label-plus-icon silhouette, fully rounded only at the launcher boundary |
| Text — primary   | launcher label uses medium weight                                               |
| Text — secondary | none                                                                            |
| Spacing          | label and icon align centrally with a single internal separator                 |
| Hover state      | brightness/tonal feedback without geometry change                               |
| Shadow           | launcher float shadow only                                                      |
| Accent usage     | unread count uses a small high-contrast badge backed by real store state        |

**Pattern notes:** Presence remains functional but is not visualized on the closed launcher. Unread is count-backed and updates when messages are read; do not substitute a decorative online dot or fabricated count.

---

## Starter Icons (Home View)

File: `src/ui/home.ts`, `src/ui/styles.css`
Last updated: 2026-08-27

| Icon         | Color       | Background  | Intent keywords                                      |
| ------------ | ----------- | ----------- | ---------------------------------------------------- |
| `rocket`     | `#f97316`   | `#fff7ed`   | getting-started, welcome, new, start, begin, intro   |
| `package`    | `#8b5cf6`   | `#f5f3ff`   | product, service, feature, solution                  |
| `creditCard` | `#10b981`   | `#ecfdf5`   | pricing, plan, cost, billing, subscription           |
| `lifeBuoy`   | `#06b6d4`   | `#ecfeff`   | support, help, issue, problem, bug, error, technical |
| `messages`   | `var(--kw-primary-color)` | `var(--kw-brand-soft)` | team, contact, talk, chat, human, agent, sales |

**Pattern notes:** Categories are intent-based (what the visitor wants), not
noun-based (what the icon depicts). The fallback chain is
`['rocket', 'package', 'creditCard', 'lifeBuoy', 'messages'][index]` — if
no regex matches, icons cycle by position. The `messages` icon uses the
brand-primary token (same as the composer send button), making it the
"talk to us" accent. Each icon is a 24×24 inline SVG with `1.8px` stroke,
wrapped in a `36px` circle with the color/bg pair above.

## Home & List Scrollbar

File: `src/ui/styles.css`
Last updated: 2026-08-27

| Property         | `.kw-home` (Firefox)                        | `.kw-home` (WebKit)                          | `.kw-list` (Firefox)                         | `.kw-list` (WebKit)                          |
| ---------------- | ------------------------------------------- | -------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| Default thumb    | `transparent`                               | `transparent`                                | `color-mix(in srgb, var(--kw-ink-400) 14%, transparent)` | `color-mix(in srgb, var(--kw-ink-400) 14%, transparent)` |
| Hover thumb      | `color-mix(in srgb, var(--kw-ink-400) 14%, transparent)` | same | `color-mix(in srgb, var(--kw-ink-400) 14%, transparent)` | same |
| Thumb hover      | `color-mix(in srgb, var(--kw-ink-400) 24%, transparent)` | same | `color-mix(in srgb, var(--kw-ink-400) 24%, transparent)` | same |
| Track            | `transparent`                               | `transparent`                                | `transparent`                                | `transparent`                                |
| Width            | native                                      | `5px`                                        | native                                       | `5px`                                        |

**Pattern notes:** `.kw-home` scrollbar is fully transparent at rest (scrollbar
invisible until the area is hovered), matching the `.kw-list` pattern but
starting from zero rather than 14% — a deliberate distinction: the message
list shows a faint hint of the scrollbar even at rest (it's a long, actively
scrolled surface), while the home view hides it completely (shorter content,
less scroll interaction). Both converge to the same 14%/24% opacity ramp on
interaction. `.kw-list` padding is `14px 8px 14px 20px` (asymmetric: tighter
right edge for the scrollbar gutter). `.kw-home` padding is
`16px 6px 16px 20px` (same right-edge pattern, slightly more vertical
breathing room for the greeting/CTA layout).
