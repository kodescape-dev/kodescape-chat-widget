# Architecture

## What this repo builds

One artifact: `dist/widget.js`, an IIFE bundle (Vite lib mode, `formats:
['iife']`) that a host page loads with:

```html
<script
  src="https://chat.kodescape.com/widget.js"
  data-site-id="{siteId}"
></script>
```

That exact snippet is what `kodescape-admin`'s Website Chat Installation tab
displays to the org — the _only_ public embed contract is the `data-site-id`
attribute. The customer's site never configures, or even knows, which
Kodescape API the widget talks to.

The API base URL is baked in at build time instead, via Vite's per-mode
env files: `.env.development` (`http://localhost:5001`) and
`.env.production` (`https://api.kodescape.com`), read in `mount.ts` as
`import.meta.env.VITE_API_BASE_URL`. `pnpm build` (production mode) is
what a real release ships; `pnpm build:dev` produces a build wired to a
local `cms-api` instead, for embedding in a site under local test (see
`kodescape-web`'s `WebsiteChatWidget.tsx`). `MountOptions.apiBaseUrl`
still exists as an optional override, but only for tests and the dev
harness calling `mount()` programmatically — the script-tag auto-init
path never reads it from `data-*`, matching the "customer needs siteId
only" contract above.

## Mount lifecycle (`src/mount.ts`)

1. On script load, `mount.ts`'s bottom-of-file side effect reads
   `document.currentScript`'s `data-site-id` and calls `mount({ siteId })`.
   It also exposes `window.KodescapeChatWidget = { mount }` so the same
   entry point works from a manual `import` (used by the dev harness and
   by tests) without relying on `document.currentScript`.
2. `mount()` creates one initially hidden `<div>` host element, attaches an open Shadow
   DOM to it, injects a single `<style>` tag (the CSS is imported via
   Vite's `?inline` query so it ships as a bundled string, not a separate
   network request), and appends the host to `document.body` (or
   `options.target`).
3. The launcher is revealed only after API settings have been applied, so
   built-in defaults never flash before organization branding. The panel itself is a
   three-view shell (`src/ui/window.ts`: home / lead-capture / chat,
   toggled via `hidden` on nodes that all exist in the DOM up front, not
   created per switch) — see "UI views" below. The authenticated socket
   connects in the background so presence and launcher unread updates remain
   realtime. After session/socket startup, the latest conversation page is
   scheduled as non-critical background work; it does not compete with the
   launcher bootstrap. Entering chat before that preload starts reuses the same
   one-time loader rather than issuing a second request. Chat entry happens by submitting the
   lead-capture form or clicking "Continue previous conversation"; a new
   visitor who opens the panel and reads the home screen without acting
   costs nothing, mirroring the backend's own "nothing written to Mongo
   until a message is sent" rule. A _returning_ visitor (a `resumeToken`
   already in `localStorage`, checked synchronously via
   `SessionManager.hasResumedSession()`, no network call) skips home
   entirely and lands straight in chat on open.
4. Widget configuration (`GET /public/chat/widget-settings` — support
   identity, color, launcher, content, visitor capture, device/path visibility)
   is fetched independently,
   in parallel, right away. The host stays hidden until the response is applied,
   then appears with the org's
   `primaryColor` action styling, `backgroundColor` widget surfaces, and
   `textColor` readable foreground even before the visitor opens anything. If that call
   fails (widget disabled, misconfigured, network down), `applyBranding` runs
   with `DEFAULT_WIDGET_SETTINGS` instead so the host still reveals — this call
   is cosmetic only, never a gate on the widget's availability. Session and
   socket startup remain independent of this visual gate.
   `deviceSettings.desktop` and `.mobile` independently control display,
   left/right position, icon-vs-label launcher style, bottom/side offsets, and
   small/medium/large launcher size. The mobile breakpoint is `480px`; tablets
   use the desktop profile. Legacy responses without `deviceSettings` are
   normalized from `showOnDesktop`, `showOnMobile`, `launcherPosition`, and
   `launcherStyle`. Page exclusions still apply after the active device
   profile is resolved.

## UI views (`src/ui/window.ts`)

`createChatWindow()` owns three view containers, all built once and kept
in the DOM for the panel's lifetime, switched with a `hidden` toggle
(never destroyed/recreated — this is also why `.kw-welcome` is always
queryable by tests regardless of which view is active):

- **Home** (`src/ui/home.ts`) — configurable heading, a `.kw-welcome`
  paragraph carrying the org's `welcomeMessage`, up to five conversation
  starters that enter Chat through the ordinary durable REST send path, and
  the resume action. The
  `setWelcomeMessage()` API predates this refactor and still targets this
  one node), a primary "Start a conversation" CTA, and a "Continue
  previous conversation" link shown only when `hasResumedSession()` is
  true.
- **Lead capture** (`src/ui/lead-capture.ts`) — Name/Email (required,
  validated with the form's native `reportValidity()`, no JS validation
  library) plus an optional "How can we help?" message, a back button
  to Home, and a "Start chat" submit.
- **Chat** — the pre-existing message list + typing indicator + composer,
  now wrapped in a `.kw-chat-view` container so it can be hidden as one
  unit alongside the other two views.

`mount.ts` wires the transitions but doesn't own the switching itself:
`window.ts` moves Home → Lead-capture → Chat internally on click/submit
for immediate UI feedback, and only calls out to `mount.ts`'s handlers
(`onContinue`, `onLeadSubmit`) for the side effects that need the network
(`enterChat()` → `loadInitialHistory()`). Once
`enterChat()` has run once for a given `mount()` instance, the panel
never shows Home again for the rest of that page load, even if closed
and reopened.

One second after session/socket initialization, the widget preloads the latest
20 messages into `ChatStore`. If the visitor enters chat first, that same load
starts immediately; an in-flight or completed preload is reused. Scrolling
within 80px of the top requests the next cursor page in batches of 20 and
restores the visual scroll offset after prepending. Loaded history stays in
`ChatStore`, so closing and reopening the panel during the same mount does not
refetch it.

On the first transition into Chat, the message list is positioned at its
maximum scroll height so the newest message is visible. Initial history images
temporarily retain that bottom anchor through their `load`/`error` event, which
prevents late attachment sizing from leaving the visitor above the latest
message. This initial positioning runs once and does not replace the preserved
offset behavior used when older cursor pages are prepended.

Context updates are conversation-gated. If initial history identifies an
existing conversation, its current page context posts immediately. Empty
history does not post context, and the context watcher remains a no-op until a
successful first message returns a conversation ID; that success posts context
once. The first-send path does not reset the context dedupe key, so an existing
conversation does not receive a duplicate unchanged context update.

While `loadInitialHistory()` is in flight,
`src/ui/message-list.ts`'s `renderLoadingSkeleton()` fills the list with
four pulsing placeholder rows (`clearLoadingSkeleton()` — or a real
`renderMessages()` call from the store, whichever happens first — clears
them). This exists because `ChatStore.mergeServerMessages([])` is a
no-op that never notifies subscribers, so an empty conversation history
would otherwise leave nothing to clear the loading state visually;
`setLoading(false)` clears the skeleton unconditionally to cover exactly
that case.

## Session (`src/core/session.ts`)

Mirrors `VisitorSessionService` on the API side exactly:

- `resumeToken` — 30-day token, the only thing persisted, written to
  `localStorage` under `kodescape_chat_resume_token:{siteId}` (scoped by
  site in case a host page ever embeds widgets for more than one
  `siteId`, however unlikely).
- `accessToken` — 15-minute token, kept in memory only. `ensureAccessToken()`
  reissues it via `POST /public/chat/session` (sending the stored
  `resumeToken`, if any) whenever it's missing or within 30 seconds of
  expiry. Concurrent callers (e.g. the initial history fetch racing the
  socket connect) share one in-flight refresh instead of each minting a
  new session — see the `inflight` promise field.
- The backend resolves `organizationId` from `siteId` server-side and
  never trusts a client-asserted org — this repo never has an
  `organizationId` anywhere in its code, by design.

## API client (`src/core/api.ts`)

### Internal-note privacy boundary

- Internal notes belong exclusively to the Admin/API Inbox. The widget must never render, backfill, receive over sockets, react to, or expose messages whose API kind is `internal_note`.
- The API enforces this boundary by filtering widget history/backfill and emitting internal-note realtime events only to organization Inbox rooms. No widget UI or public message contract is extended for notes or teammate mentions.

### Realtime composer presence

- Once an open conversation exists, visitor composer input emits the first full-text `visitor:draft:update` immediately, then throttles continuing updates to 250ms; empty input, send, and widget destruction emit `visitor:draft:clear`. Blur does not clear a draft, so switching to the Admin window preserves the preview. The widget does not assert a conversation or organization ID for this channel; the authenticated API socket resolves the visitor's open conversation. Drafts are ephemeral and never enter message history or storage.
- Remote agent typing is tracked per actor ID, supports multiple simultaneous agents, and renders up to three small stacked agent avatars followed by an animated three-dot pill above the composer.
- Each actor has an independent six-second stale timeout; explicit stop, socket disconnect, and widget destruction clear typing state and timers.

Thin `fetch` wrappers over `kodescape-cms-api`'s
`/api/v1/public/chat/*` controller
(`src/communications/widget/public-chat.controller.ts` on that side).
Every response is unwrapped from the API's global
`{success, statusCode, message, data}` envelope
(`TransformInterceptor`); a non-2xx or `success:false` response throws
`ApiError`. `siteId` goes on the query string for the two calls that
happen before a session exists (`widget-settings`, `session`); every call
after that authenticates with `Authorization: Bearer {accessToken}` and
the middleware resolves `siteId`/`organizationId` from the token's own
claims instead.

## Socket (`src/core/socket.ts`)

Connects to the `/chat` Socket.IO namespace with
`auth: { accessToken }`. Sends `message:send` via `sendMessage()` — a
socket.io ack callback + 10s timeout, resolving/rejecting with the same
contract `ChatApi.sendMessage()` (REST, kept as an unused fallback) used to.
Otherwise stays receive-only, matching `chat.gateway.ts` on the API side. On
every reconnect (not the first connect), it calls
`onReconnectBackfillNeeded()` so `mount.ts` can run a REST
`GET .../messages?after={lastKnownId}` backfill for anything missed while
offline. Before each reconnect attempt it also re-fetches a fresh
`accessToken`, since the 15-minute token can expire while the socket was
disconnected — though `message:send` itself doesn't need a fresh token,
since `ChatGateway` only checks the token once at connect time, not per
event.

## Store (`src/core/store.ts`)

Plain TypeScript state, no framework. Only the visitor's own outgoing
messages need optimistic local state (`sending` → `sent`/`failed`) —
`chat.gateway.ts` never echoes a visitor's own inbound message back over
the socket (only `direction: outbound`, i.e. admin replies, get emitted to
`buildVisitorRoom`), so the `message:send` ack (or, on the REST fallback
path, the `POST /public/chat/messages` response) is the only confirmation a
sent message gets. Everything funnels
through `mergeServerMessages()`: deduped first by server `id`, then by
`clientMessageId` for anything still locally pending, so a reconnect
backfill page can never double-add a message the UI already shows.

## Shadow DOM / styling

- `host.style.all = 'initial'` isolates the widget's root element from
  the host page's cascade (its own inherited font/line-height/etc. reset
  to browser defaults) without wiping the CSS custom property the widget
  sets on the same element — `all` explicitly excludes custom properties
  per spec, so `--kw-primary-color` still pierces the Shadow DOM boundary
  and reaches `styles.css` inside it.
- `.kw-root` inside the shadow tree is `position: fixed`, which behaves
  normally against the viewport regardless of where the host element sits
  in the light DOM, since nothing on the host establishes a new
  containing block (no `transform`/`filter`/`contain`).
- Below 480px width, `.kw-panel` becomes a full-screen overlay instead of
  a floating card.

## Accessibility

- Launcher is a real `<button aria-label>`, toggling between "Open chat"
  / "Close chat" and an aria-expanded state.
- The panel is `role="dialog"`; `Escape` closes it; a manual `Tab`/`Shift+Tab`
  focus trap (`trapFocus` in `src/ui/window.ts`) keeps focus inside the
  panel while it's open, since Shadow DOM content is otherwise reachable
  by regular document tab order.
- Focus returns to the launcher button on close.

## Deliberately not implemented

- Omnichannel adapters, AI, teams/routing, tickets, voice/video, SLAs, CSAT,
  and a general CRM.
- An offline outgoing-message queue. A failed send (see `ChatStore`'s
  `failed` status) is shown with a manual "retry" action; nothing is
  queued or auto-retried.
- A production CDN/hosting pipeline for `dist/widget.js`.

## Identity, composer, and attachments

Lead capture is progressive (`before_chat`, `after_first_message`, or
`disabled`) and persists name/email through the public identify REST endpoint.
The composer supports emoji, paste/drop/file selection, text-only,
attachment-only, and mixed messages. Files are uploaded over REST, remain
removable/retryable before send, and are bound to the durable message write;
Socket.IO only delivers the already-persisted safe message payload.
Replies add `replyToMessageId` to the send request and persist a compact target
snapshot. Reactions toggle through REST and synchronize as complete
`message:reactions` snapshots; `ChatStore.applyReactions` replaces the array so
REST responses, socket delivery, reconnect history, and Admin changes converge.

## Isolated Admin preview

`preview.html` is the only document Admin embeds. `src/preview-entry.ts`
mounts the same `mount()` renderer with `{ preview: true }`; `src/dev-entry.ts`
keeps the ordinary root route's developer harness separate. Preview mode
accepts source-scoped `kodescape-widget-preview:configure` messages for Home,
Chat, Pre-chat, Minimized and Desktop/Mobile. It uses deterministic messages
and returns before API, session, storage, or Socket.IO initialization, so it
cannot create visitors, contacts, conversations, or messages. Styles remain in
the same Shadow DOM stylesheet as production.

## Known gap fixed during this checkpoint

The original plan's Checkpoint 1 public-endpoint list didn't include a way
for an anonymous visitor to fetch widget branding
(`name`/appearance colors/`deviceSettings`/`welcomeMessage`/visibility rules)
before a session exists — the admin embed snippet only ever carried
`data-site-id`. Added `GET /public/chat/widget-settings` to
`kodescape-cms-api`'s `PublicChatController`/`PublicChatService`
(reusing the existing `WidgetSettingsRepository.findByOrganizationIdUnscoped`,
already resolved into `req.chatContext` by `ChatOriginMiddleware`) so this
repo has something real to call. Covered by a new case in
`kodescape-cms-api/tests/e2e/communications-public-chat.spec.ts`.
