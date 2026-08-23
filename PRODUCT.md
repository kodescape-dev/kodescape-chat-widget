# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: a visitor on a Kodescape customer's own website, seeking support
or sales help, who opens the embedded chat launcher to ask a question and
reach a human. Secondary (out of scope for this repo): the org's staff,
who reply through `kodescape-admin`'s realtime inbox — not built here.

## Product Purpose

An embeddable website chat widget: a customer drops one `<script>` tag on
their site and visitors get a launcher + chat panel wired to that org's
Kodescape inbox. Success = a visitor can send a message and see admin
replies arrive in near-real-time, with zero setup burden on the customer
beyond the script tag.

## Positioning

Zero-config, single script tag: `<script src=".../widget.js"
data-site-id="{siteId}">` is the entire public contract. No SDK
configuration, no client-side API-base wiring, no `organizationId`
anywhere in this codebase — the backend resolves org identity from
`siteId` server-side. Competing widgets (Intercom/Crisp/Tawk-style)
typically require heavier install/config surfaces.

## Operating Context

- Ships as `dist/widget.js`, an IIFE built by Vite lib mode, loaded as a
  plain `<script>` tag with zero runtime dependencies beyond what's
  bundled in.
- Talks to `kodescape-cms-api`'s `/api/v1/public/chat/*` REST endpoints
  (all writes) and its `/chat` Socket.IO namespace (receive-only —
  admin replies and reconnect-triggered backfill).
- Renders entirely inside a Shadow DOM root (`src/mount.ts`) so it never
  collides with the host page's styles/scripts.
- Widget branding (name, primary color, launcher position, welcome/
  offline message) is fetched per-org from `GET
  /public/chat/widget-settings` and applied live; falls back to built-in
  defaults if that call fails, since it's cosmetic-only and never gates
  the send path.
- Part of a 3-repo Website Chat + Realtime Inbox Phase 1 feature; the
  admin-side inbox and API contract live in sibling repos
  (`kodescape-admin`, `kodescape-cms-api`), not here.

## Capabilities and Constraints

- REST is the only write path; the socket is receive-only
  (`message:new`).
- `accessToken` (15 min) lives only in memory; only `resumeToken` (30
  day) is persisted, to `localStorage`, scoped per `siteId`.
- No framework; vanilla TypeScript, Shadow DOM, no bundler dependency in
  the shipped artifact.
- Not yet implemented (by design, Phase 1 scope): typing indicators
  (presentational stub exists, unwired), an offline outgoing-message
  queue (failed sends show a manual retry instead), a production
  CDN/hosting pipeline for `dist/widget.js`.
- Small bundle size is a goal, not a release gate.

## Brand Commitments

None binding yet — open. No confirmed Kodescape logo, voice, or palette
commitments for this widget; widget appearance is currently driven by
per-org `primaryColor` from widget-settings, not a fixed Kodescape brand
skin.

## Evidence on Hand

None. No real screenshots, testimonials, or case studies on hand for
this surface; future work must not fabricate any.

## Product Principles

1. The customer's integration burden is exactly one script tag with a
   `siteId` — never grow the public configuration surface.
2. Never attach widget UI outside the Shadow DOM root; isolation from the
   host page's styles/scripts is non-negotiable.
3. Sends always go through REST; the socket is strictly receive-only.
4. Cosmetic personalization (branding fetch) must never gate or block the
   core send/receive path.
5. Keep the shipped artifact dependency-light without contorting the
   design to shave bytes.

## Accessibility & Inclusion

No formal standard confirmed yet (open). Existing implementation already
has real accessibility groundwork worth preserving: launcher is a real
`<button aria-label>` with aria-expanded state, panel is `role="dialog"`
with Escape-to-close and a manual focus trap, and focus returns to the
launcher on close.
