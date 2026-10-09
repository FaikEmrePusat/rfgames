# Agent tooling checklist

## Already available in Cursor (no install needed)
| Tool | Use for |
|------|---------|
| **cursor-ide-browser** MCP | Visual QA, lobby flows, canvas screenshots |
| User skills `~/.cursor/skills/` | frontend-design, develop-web-game, react-best-practices, playwright, webapp-testing, security-best-practices, nodejs-best-practices, … |
| Project skills `.cursor/skills/` | `rfgames-platform`, `fold-draw-exquisite` |
| Project rules `.cursor/rules/` | Always-on platform + game globs |
| `AGENTS.md` | Session brief |

## Local harness
```powershell
cd D:\Projects\rfgames
npm run verify
# skip Playwright: $env:RFGAMES_SKIP_E2E=1; npm run verify
```

Dev servers:
```powershell
npm run dev:server   # :3001
npm run dev          # :5173 — open http://localhost:5173
```

## Design / QA expectation
After UI or game-loop changes: browser snapshot or Playwright smoke; fix contrast and touch issues before declaring done.
