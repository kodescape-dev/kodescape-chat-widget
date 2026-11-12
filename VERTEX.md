# Vertex

This repo keeps only its code. Its agent guide, context, engineering docs, product and design briefs, Claude config, skills and decision records live in [kodescape-vertex](https://github.com/kodescape-dev/kodescape-vertex), in the `chat-widget/` folder.

- Guide: [chat-widget/GUIDE.md](https://github.com/kodescape-dev/kodescape-vertex/blob/main/chat-widget/GUIDE.md)
- Decisions: [decisions/chat-widget index.md](https://github.com/kodescape-dev/kodescape-vertex/blob/main/decisions/chat-widget%20index.md)
- Rules for every repo: [GitHub naming](https://github.com/kodescape-dev/kodescape-vertex/blob/main/systems/GitHub%20naming.md), [Pull requests](https://github.com/kodescape-dev/kodescape-vertex/blob/main/systems/Pull%20requests.md), [Commits and pushes](https://github.com/kodescape-dev/kodescape-vertex/blob/main/systems/Commits%20and%20pushes.md), [Secrets](https://github.com/kodescape-dev/kodescape-vertex/blob/main/systems/Secrets.md)

## Set up

Clone kodescape-vertex next to this repo and run its setup script once:

```bash
git clone https://github.com/kodescape-dev/kodescape-vertex.git ../kodescape-vertex
../kodescape-vertex/scripts/setup.sh
```

The script installs the `kodescape` Claude Code plugin and links this repo's `.claude/launch.json` from the vault. Each Claude Code session in this repo then loads `chat-widget/GUIDE.md` and keeps that link in place, worktrees included. See [Set up Vertex](https://github.com/kodescape-dev/kodescape-vertex/blob/main/systems/Set%20up%20Vertex.md).

Do not commit `CLAUDE.md`, `AGENTS.md`, `context/`, `PRODUCT.md`, `DESIGN.md`, `memory.md`, `.agents/`, `.claude/`, `.codex/` or `.mcp.json` to this repo. Change them in kodescape-vertex.
