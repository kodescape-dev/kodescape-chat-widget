# CLAUDE.md

Guidance for Claude Code in this repository. This file stays short. It
points to `context/architecture.md` for the real detail.

# What this is

Embeddable website chat widget for Kodescape — a single `<script>` tag a
customer drops on their own site. Vite lib-mode build, vanilla TypeScript
(no framework), Shadow DOM. Talks to `kodescape-cms-api`'s
`/api/v1/public/chat/*` REST endpoints and its `/chat` Socket.IO namespace
(see `kodescape-cms-api/src/communications/`). Part of the 3-repo Website
Chat + Realtime Inbox feature — full cross-repo design lives at
`kodescape-cms-api/docs/WEBSITE-CHAT.md`.

## Read Before Anything Else

1. `context/architecture.md` — mount lifecycle, session/token handling,
   Shadow DOM structure, reconnect/backfill design.
2. `kodescape-cms-api/docs/WEBSITE-CHAT.md` — the full 3-repo feature doc
   this widget is one part of.
3. `kodescape-cms-api/src/communications/` — the actual API contract this
   widget talks to (routes, DTOs, socket payloads, token claims). Re-read
   the real source there before changing any request/response shape here;
   this repo has no shared types package, everything is hand-synced.

## Rules That Never Change

- **REST is the only write path.** The socket (`/chat` namespace) is
  receive-only — it never sends a message, only listens for
  `message:new`. Sending is always `POST /api/v1/public/chat/messages`.
- **`accessToken` lives only in memory; only `resumeToken` goes to
  localStorage.** See `src/core/session.ts`.
- No framework, no bundler dependency for the shipped artifact — the build
  output (`dist/widget.js`) must load as a plain `<script>` tag with zero
  runtime dependencies beyond what's bundled into it.
- Everything renders inside the Shadow DOM root created in `src/mount.ts`.
  Never attach widget UI to the light DOM — the whole point is not
  colliding with the host page's styles/scripts.
- Small bundle size is a goal, not a release gate — don't contort the
  design to shave bytes.
- Automated tests live under `tests/` (`tests/unit/`, `tests/smoke/`);
  never add `*.test.ts` beside production source.

## Commands

```bash
pnpm dev        # Vite dev harness (index.html) — mounts against a local cms-api
pnpm build      # tsc --noEmit && vite build -> dist/widget.js
pnpm test       # vitest run
pnpm lint
pnpm format
pnpm typecheck
```

## Code Style

- Do not add comments unless they provide critical context that is not
  obvious from the code.
- Prefer self-documenting code through clear naming and small functions.
- Never add boilerplate comments, section separators, or comments that
  restate what the code already does.
- Keep comments only for non-obvious architectural decisions, workarounds
  for external limitations, or important warnings/caveats.
