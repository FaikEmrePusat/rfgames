---
name: rfgames-platform
description: >-
  Use when working on the RF Games monorepo (Kare Kapmaca, Katla-Çiz hub, shared/client/server),
  multi-game routing, parchment UI system, local/online Socket patterns, or deploy/verify harness.
---

# RF Games Platform Skill

## Goal
Build a cohesive multi-game site that feels handcrafted (parchment / play), not a generic dashboard.

## Hub pattern
1. Landing / game picker (brand **RF Games**, then game titles)
2. Each game owns lobby → play → end
3. Header “home / leave” returns to hub or game lobby consistently

## Shared UI tokens
Reuse CSS variables in `client/src/index.css` (`--ink`, `--oxblood`, parchment panels, `--space-*`, `--touch-min`). Improve contrast for idle controls. Prefer Source Sans 3 for UI chrome; Fraunces for brand/titles.

## Mobile web
Browser layouts (not native): primary CTAs in the lower third on ~390px. See `rfgames-mobile-web` skill.

## Online pattern (any game)
- Client: `VITE_SERVER_URL`
- Server: `CORS_ORIGIN`, payload validation, rate limits
- Session: room code, host, reconnect/grace where applicable
- Scope events per game to avoid cross-talk

## Verify loop
```powershell
cd D:\Projects\rfgames
npm run verify
```
Then open http://localhost:5173 and exercise the changed flow in browser MCP or Playwright.

## Do not
- Merge game logics into one mega-state
- Ship unreadable low-contrast parchment text
- Skip shared rebuild after logic edits
