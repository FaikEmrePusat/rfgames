---
name: fold-draw-exquisite
description: >-
  Use when designing or implementing RF Games Game 2 (Katla-Çiz): fold-and-draw paper character,
  canvas freehand, peek strips, 2–4 players local/online, reveal unfold animation.
---

# Katla-Çiz — Fold & Draw Skill

## Experience goal
Feel like passing a real folded paper around a table: anticipation, secrecy, funny reveal. Drawing tools should feel immediate on phone and desktop.

## Design direction
- Same RF Games parchment family, but emphasize **sketchbook / ink** (heavier paper grain on the canvas, soft fold shadows, paper crease)
- Avoid purple neon, glassmorphism, dashboard chrome
- Reveal moment: one deliberate unfold animation + quiet pause — not confetti spam
- Title TBD; until then UI may say **Katla-Çiz**

## Rules (do not invent conflicting ones)
| Item | Spec |
|------|------|
| Sections | 4 fixed bands: head, torso, legs, feet |
| Players | 2–4 |
| Assignment | Round-robin over 4 sections |
| Peek | Visible bottom strip of previous section strokes only |
| Input | Freehand pointer (mouse/touch/pen) |
| End | Unfold all sections into one figure |
| Online | Yes |

## Implementation outline
1. **Hub** entry card → Game 2 lobby (count, names, local/online)
2. `shared/foldDraw/` — types, section bounds, turn assignment, stroke types, pure helpers
3. `client` — `FoldDrawCanvas` (active band clip + peek overlay), tool palette (ink color, thickness, undo stroke)
4. Local hook drives turn; online mirrors strokes + `section:done` / `paper:reveal`
5. Export PNG of reveal optional later

## Stroke schema (suggested)
```ts
type Point = { x: number; y: number; t?: number; p?: number };
type Stroke = { id: string; color: string; width: number; points: Point[]; sectionIndex: 0|1|2|3 };
```
Normalize coordinates to paper space 0–1 so resize stays crisp.

## Peek
- Show previous section’s strokes clipped to bottom ~8–12% of that section height
- Do not show full previous art

## Harness hooks
Expose on `window` during playable builds:
- `render_game_to_text()` → phase, sectionIndex, currentPlayer, strokeCounts
- Prefer deterministic IDs for strokes in tests

## QA checklist
- [ ] Draw only clips to active section
- [ ] Fold hides prior art except peek
- [ ] 2-player completes all 4 sections
- [ ] Touch drawing works without page scroll steal
- [ ] Reveal shows all strokes aligned
- [ ] Online second client cannot draw out of turn
