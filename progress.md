# RF Games — Agent Progress

Original prompt: Multi-game RF Games platform; Game 1 Kare Kapmaca; Game 2 fold-and-draw (Katla-Çiz) with peek strips, 2–4 players, local+online; user wants AI to own design+tech with skills/MCP/harness preconfigured.

## Done
- [x] Kare Kapmaca core + bots + parchment UI + leave-home
- [x] Agent harness: AGENTS.md, .cursor/rules, project skills, GAME2 brief, `npm run verify`
- [x] Game hub (pick Kare Kapmaca vs Katla-Çiz)
- [x] Katla-Çiz local prototype (draw / fold / peek / reveal)
- [ ] Katla-Çiz online
- [x] Free deploy wiring (Render + Express serves client/dist)

## Notes for next agent
Phase 1 deploy wiring done (`render.yaml`, Express serves `client/dist`, `docs/DEPLOY.md`). Katla-Çiz online Socket rooms next. Local path: Hub → Katla-Çiz → FoldLobby → FoldGameScreen.
