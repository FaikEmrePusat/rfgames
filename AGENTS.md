# RF Games — Agent Brief

You own **design and engineering** for this multi-game web platform. The human sets product intent; you decide aesthetics, architecture, UX details, and implementation quality. Prefer distinctive, playful craft over generic AI UI.

## Product

- **Platform:** RF Games (Turkish UI)
- **Game 1:** `Kare Kapmaca` — procedural island conquest (dice, bridges, bots, local + online)
- **Game 2 (in progress):** fold-and-draw character paper — working title **Katla-Çiz** (final name TBD)
  - Vertical paper, 4 folds: head → torso → legs → feet
  - 2–4 players; if fewer than 4, one person may draw multiple sections in turn order
  - After a section, fold; next player sees only a **peek strip** of the previous section’s bottom strokes for continuity
  - Input: mouse / touch / stylus freehand
  - Modes: local + online
  - Reveal: unfold full figure when last section is done

## Stack

- Monorepo: `shared/` (TS logic), `client/` (React + Vite + Tailwind), `server/` (Express + Socket.io)
- Install: `npm run install:all` then `npm run build:shared` (symlink-hostile envs)
- Dev: `npm run dev:server` + `npm run dev` → http://localhost:5173
- Tests: `npm test` (shared Vitest), `npm run test:e2e` (Playwright), `npm run verify`

## Non-negotiables

1. **Ship quality:** readable contrast, intentional motion, no card spam in heroes, brand-first hub.
2. **Game loop:** implement small → run → observe (browser/Playwright) → fix.
3. **Shared rules** for deterministic game logic; UI does not invent win/claim rules.
4. **Online security baseline:** CORS whitelist, validation, rate limit; no secrets in client.
5. **Turkish copy** in UI; keep code identifiers English.
6. Do not commit unless asked. Do not invent fake game rules that contradict briefs.

## Skills to apply

Project skills under `.cursor/skills/` plus user skills: `frontend-design`, `develop-web-game`, `react-best-practices`, `webapp-testing`, `playwright`, `security-best-practices`, `nodejs-best-practices`, `composition-patterns`, `web-design-guidelines`.

## MCP / tooling

- **cursor-ide-browser:** visual QA of lobby, canvas, fold/reveal, mobile widths
- Playwright in `client/` for smoke + game flows
- Prefer `http://localhost:5173` (IPv6-safe on this machine)

## When adding Game 2

Read `.cursor/skills/fold-draw-exquisite/SKILL.md` and `docs/GAME2-BRIEF.md`. Scaffold under clear module boundaries so Kare Kapmaca stays untouched. Hub screen chooses the game first.
