---
name: rfgames-mobile-web
description: >-
  RF Games mobile-web (browser) layout: thumb zone CTAs, 8pt spacing, ≥44px touch
  targets, parchment/atelier identity. Use when editing hub, lobby, docks, game-end,
  responsive CSS, or mobile UX for Kapmaca / Katla-Çiz — not React Native/Flutter,
  not a game-directory SaaS look.
---

# RF Games — Mobile Web

Browser hub for **Kare Kapmaca** + **Katla-Çiz**. Not a native app, not a game catalog.

## Rules of thumb (~390px)

1. **Thumb zone:** Primary CTAs live in the **lower third** of the viewport (hub picks, lobby start/join, fold/Kapmaca docks, rematch / ana menü).
2. **8pt spacing:** Use existing `--space-*` (`--space-2` = 8px). Prefer multiples of 8; `--space-1_5` only for dense game chrome.
3. **Touch targets ≥44px:** Enforce `min-height` / `min-width: var(--touch-min)` (2.75rem) on tappable controls.
4. **100dvh shell:** Keep `.app-shell` no-page-scroll. Scroll only inside named regions (e.g. `.lobby-panel__scroll`). Respect `env(safe-area-inset-bottom)`.

## Layout patterns

| Surface | Mobile | Desktop (≥768) |
| --- | --- | --- |
| Hub | Intro top; game picks toward bottom (`space-between` / `margin-top: auto`) | Existing split grid OK |
| Lobby | Panel stretches; **footer** pinned to bottom with primary CTA | Centered panel OK |
| In-game docks | Bottom dock; primary action full-width or dominant in dock row | Same chrome, roomier padding OK |
| Game end / reveal | Overlay content anchored **bottom** so CTAs sit in thumb zone | Centered panel OK |

Prefer CSS in `client/src/index.css` over one-off Tailwind layout for shell/thumb behavior.

## Identity (do not abandon)

Preserve parchment / atelier: ink, oxblood, oak, brass, Fraunces + Source Sans 3, quiet borders, soft panel shadow.

**Forbidden looks**
- Slate–zinc–neon SaaS / shadcn default kit
- Purple dark “gaming catalog” storefront
- Scrapbook dashed PNG spam / sticker collage chrome
- Rewriting the visual system wholesale for “mobile polish”

## Checklist before shipping UI

- [ ] Primary action reachable in lower third at ~390×844
- [ ] Controls ≥ `--touch-min`; spacing on `--space-*`
- [ ] No new page scroll on `100dvh` shell
- [ ] Still reads as RF Games parchment on desktop
