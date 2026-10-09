import { useCallback, useEffect, useRef } from 'react';
import type { FoldGameState, FoldPoint, FoldSectionIndex } from '@rfgames/shared';
import {
  FOLD_SECTION_COUNT,
  FOLD_SECTION_LABELS,
  activeSectionBounds,
  clampPointToSection,
  peekBounds,
} from '@rfgames/shared';
import { compositeStrokeOnto, type PenKind, type StrokePoint } from './penStyles';

export type FoldTool = 'pen' | 'eraser';

/** Total unfold duration before settle pause (ms). */
const REVEAL_UNFOLD_MS = 1680;
/** Quiet beat after last section lands (ms). */
const REVEAL_SETTLE_PAUSE_MS = 520;

interface Props {
  game: FoldGameState;
  inkColor: string;
  inkWidth: number;
  tool: FoldTool;
  penKind: PenKind;
  canDraw: boolean;
  /** Commit raster layer for the current section (PNG data URL). */
  onCommitLayer: (dataUrl: string) => void;
  /** Fires once after unfold animation + brief pause (reveal phase only). */
  onRevealSettled?: () => void;
}

type ViewBand = { y0: number; y1: number };

const LAYER_W = 900;
const LAYER_H = Math.round(LAYER_W / FOLD_SECTION_COUNT); // square-ish band of full paper height share

function drawingViewBand(game: FoldGameState): ViewBand {
  const section = game.currentSection;
  const active = activeSectionBounds(section);
  const peek = peekBounds(section, game.peekRatio);
  return { y0: peek ? peek.y0 : active.y0, y1: active.y1 };
}

function brushPx(inkWidth: number) {
  return Math.max(2, inkWidth * (LAYER_W / 280));
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function makeOffscreen() {
  const c = document.createElement('canvas');
  c.width = LAYER_W;
  c.height = LAYER_H;
  return c;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function FoldCanvas({
  game,
  inkColor,
  inkWidth,
  tool,
  penKind,
  canDraw,
  onCommitLayer,
  onRevealSettled,
}: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLCanvasElement | null>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const strokeBaseRef = useRef<HTMLCanvasElement | null>(null);
  const strokePoints = useRef<StrokePoint[]>([]);
  const layerImgs = useRef<(HTMLImageElement | null)[]>([null, null, null, null]);
  const drawing = useRef(false);
  const lastLocal = useRef<{ x: number; y: number } | null>(null);
  const cursorView = useRef<FoldPoint | null>(null);
  const onCommitRef = useRef(onCommitLayer);
  const onRevealSettledRef = useRef(onRevealSettled);
  const viewRef = useRef<ViewBand>({ y0: 0, y1: 1 });
  const toolRef = useRef(tool);
  const penKindRef = useRef(penKind);
  const inkRef = useRef({ color: inkColor, width: inkWidth });
  /** 0→1 unfold progress across all sections (reveal phase). */
  const revealProgress = useRef(1);
  const paintRef = useRef<() => void>(() => {});
  onCommitRef.current = onCommitLayer;
  onRevealSettledRef.current = onRevealSettled;
  toolRef.current = tool;
  penKindRef.current = penKind;
  inkRef.current = { color: inkColor, width: inkWidth };

  const ensureLayer = useCallback(() => {
    if (!layerRef.current) layerRef.current = makeOffscreen();
    return layerRef.current;
  }, []);

  const ensureScratch = useCallback(() => {
    if (!scratchRef.current) scratchRef.current = makeOffscreen();
    return scratchRef.current;
  }, []);

  const ensureStrokeBase = useCallback(() => {
    if (!strokeBaseRef.current) strokeBaseRef.current = makeOffscreen();
    return strokeBaseRef.current;
  }, []);

  const loadLayerFromUrl = useCallback(
    async (url: string | null) => {
      const layer = ensureLayer();
      const ctx = layer.getContext('2d')!;
      ctx.clearRect(0, 0, LAYER_W, LAYER_H);
      if (!url) return;
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, LAYER_W, LAYER_H);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      });
    },
    [ensureLayer],
  );

  // Reload working layer when section / stored URL changes
  useEffect(() => {
    if (game.phase !== 'drawing') return;
    let cancelled = false;
    (async () => {
      await loadLayerFromUrl(game.sectionLayers[game.currentSection] ?? null);
      if (!cancelled) paint();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.currentSection, game.phase, game.sectionLayers[game.currentSection]]);

  // Prefetch all section images for peek / reveal
  useEffect(() => {
    game.sectionLayers.forEach((url, i) => {
      if (!url) {
        layerImgs.current[i] = null;
        return;
      }
      const img = new Image();
      img.onload = () => {
        layerImgs.current[i] = img;
        paint();
      };
      img.src = url;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.sectionLayers, game.phase]);

  const paperToLayer = (p: FoldPoint, section: FoldSectionIndex) => {
    const { y0, y1 } = activeSectionBounds(section);
    const span = y1 - y0 || 1;
    return {
      x: p.x * LAYER_W,
      y: ((p.y - y0) / span) * LAYER_H,
    };
  };

  const paint = useCallback(() => {
    const canvas = displayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const fillPaper = () => {
      ctx.fillStyle = '#f3e6c9';
      ctx.fillRect(0, 0, w, h);
      const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.15, w * 0.5, h * 0.5, w * 0.9);
      vig.addColorStop(0, 'rgba(255,250,235,0.4)');
      vig.addColorStop(1, 'rgba(160,130,80,0.2)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    };

    if (game.phase === 'reveal') {
      viewRef.current = { y0: 0, y1: 1 };
      fillPaper();
      const progress = revealProgress.current;
      const sectionH = h / FOLD_SECTION_COUNT;
      for (let s = 0; s < FOLD_SECTION_COUNT; s++) {
        const local = Math.min(1, Math.max(0, progress * FOLD_SECTION_COUNT - s));
        if (local <= 0) continue;
        const open = easeOutCubic(local);
        const img = layerImgs.current[s];
        const y0 = s * sectionH;
        const drawH = sectionH * open;
        if (img && drawH > 0.5) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, y0, w, drawH);
          ctx.clip();
          ctx.drawImage(img, 0, y0, w, sectionH);
          ctx.restore();
        }
        // Soft crease shadow at the unfolding edge
        if (open < 0.98) {
          const edgeY = y0 + drawH;
          const shade = ctx.createLinearGradient(0, edgeY - 10, 0, edgeY + 14);
          shade.addColorStop(0, 'rgba(42,28,16,0)');
          shade.addColorStop(0.45, 'rgba(42,28,16,0.18)');
          shade.addColorStop(1, 'rgba(42,28,16,0)');
          ctx.fillStyle = shade;
          ctx.fillRect(0, edgeY - 10, w, 24);
        }
      }
      if (progress >= 0.999) {
        ctx.strokeStyle = 'rgba(90,60,30,0.25)';
        ctx.setLineDash([6, 6]);
        for (let i = 1; i < FOLD_SECTION_COUNT; i++) {
          const y = (i / FOLD_SECTION_COUNT) * h;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      return;
    }

    const section = game.currentSection;
    const active = activeSectionBounds(section);
    const peek = peekBounds(section, game.peekRatio);
    const band = drawingViewBand(game);
    viewRef.current = band;
    const span = band.y1 - band.y0 || 1;
    fillPaper();

    ctx.strokeStyle = 'rgba(90,60,30,0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);

    const drawLayerBand = (
      img: HTMLCanvasElement | HTMLImageElement | null,
      paperY0: number,
      paperY1: number,
      srcY0 = 0,
      srcY1 = 1,
    ) => {
      if (!img) return;
      const dy0 = ((paperY0 - band.y0) / span) * h;
      const dy1 = ((paperY1 - band.y0) / span) * h;
      const sy0 = srcY0 * (img.height || LAYER_H);
      const sy1 = srcY1 * (img.height || LAYER_H);
      ctx.drawImage(img, 0, sy0, LAYER_W, sy1 - sy0, 0, dy0, w, dy1 - dy0);
    };

    // Peek: bottom of previous layer + physical crease at fold boundary
    if (peek && section > 0) {
      const prevImg = layerImgs.current[section - 1];
      const peekTop = ((peek.y0 - band.y0) / span) * h;
      const peekBot = ((peek.y1 - band.y0) / span) * h;
      ctx.fillStyle = 'rgba(110,28,28,0.06)';
      ctx.fillRect(0, peekTop, w, peekBot - peekTop);
      if (prevImg) {
        const prev = activeSectionBounds((section - 1) as FoldSectionIndex);
        const srcY0 = (peek.y0 - prev.y0) / (prev.y1 - prev.y0);
        drawLayerBand(prevImg, peek.y0, peek.y1, srcY0, 1);
      }

      // Fold shadow above the crease (folded paper sitting on the peek)
      const creaseShade = ctx.createLinearGradient(0, peekBot - 22, 0, peekBot + 16);
      creaseShade.addColorStop(0, 'rgba(42,28,16,0)');
      creaseShade.addColorStop(0.55, 'rgba(42,28,16,0.14)');
      creaseShade.addColorStop(0.72, 'rgba(42,28,16,0.22)');
      creaseShade.addColorStop(0.82, 'rgba(90,60,30,0.08)');
      creaseShade.addColorStop(1, 'rgba(42,28,16,0)');
      ctx.fillStyle = creaseShade;
      ctx.fillRect(0, peekBot - 22, w, 38);

      ctx.strokeStyle = 'rgba(90,60,30,0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, peekBot);
      ctx.lineTo(w, peekBot);
      ctx.stroke();
      // Hairline highlight just below crease
      ctx.strokeStyle = 'rgba(255,248,230,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, peekBot + 1.5);
      ctx.lineTo(w, peekBot + 1.5);
      ctx.stroke();

      ctx.fillStyle = 'rgba(42,28,16,0.45)';
      ctx.font = `600 ${Math.round(13 * (w / 400))}px "Source Sans 3", sans-serif`;
      ctx.fillText('← önceki katın ucu', 12, peekTop + 18);
    }

    // Live working layer (includes in-progress pen/eraser)
    const live = layerRef.current;
    drawLayerBand(live, active.y0, active.y1, 0, 1);

    // Eraser cursor tip only
    if (tool === 'eraser' && cursorView.current) {
      const p = cursorView.current;
      const x = p.x * w;
      const y = ((p.y - band.y0) / span) * h;
      const r = brushPx(inkWidth) * (w / LAYER_W);
      ctx.save();
      ctx.strokeStyle = 'rgba(42,28,16,0.35)';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(42,28,16,0.6)';
    ctx.font = `700 ${Math.round(18 * (w / 400))}px Fraunces, serif`;
    ctx.fillText(FOLD_SECTION_LABELS[section], 12, h - 14);
  }, [game, inkWidth, tool]);

  paintRef.current = paint;

  useEffect(() => {
    const canvas = displayRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const resize = () => {
      const rect = parent?.getBoundingClientRect();
      const availW = Math.max(160, rect?.width ?? 360);
      const availH = Math.max(160, rect?.height ?? 320);
      const ratio = game.phase === 'reveal' ? 1.55 : 0.88;
      // Fit inside stage without forcing page scroll
      let cssW = availW;
      let cssH = cssW * ratio;
      if (cssH > availH) {
        cssH = availH;
        cssW = cssH / ratio;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = `${Math.floor(cssW)}px`;
      canvas.style.height = `${Math.floor(cssH)}px`;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      paint();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [paint, game.phase, game.currentSection]);

  useEffect(() => {
    paint();
  }, [paint]);

  // Deliberate top→bottom unfold when entering reveal (respect reduced motion)
  useEffect(() => {
    if (game.phase !== 'reveal') {
      revealProgress.current = 1;
      return;
    }

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      revealProgress.current = 1;
      paintRef.current();
      const t = window.setTimeout(() => onRevealSettledRef.current?.(), 120);
      return () => window.clearTimeout(t);
    }

    revealProgress.current = 0;
    paintRef.current();
    let raf = 0;
    let settleTimer = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / REVEAL_UNFOLD_MS);
      revealProgress.current = t;
      paintRef.current();
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        settleTimer = window.setTimeout(() => {
          onRevealSettledRef.current?.();
        }, REVEAL_SETTLE_PAUSE_MS);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settleTimer);
    };
  }, [game.phase]);

  const toPaper = (e: React.PointerEvent<HTMLCanvasElement>): FoldPoint | null => {
    const canvas = displayRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const band = viewRef.current;
    const span = band.y1 - band.y0 || 1;
    const x = (e.clientX - rect.left) / rect.width;
    const y = band.y0 + ((e.clientY - rect.top) / rect.height) * span;
    const active = activeSectionBounds(game.currentSection);
    if (y < active.y0 || y > active.y1) return null;
    return clampPointToSection({ x, y, p: e.pressure || undefined }, game.currentSection);
  };

  const eraseSegment = (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    const layer = ensureLayer();
    const ctx = layer.getContext('2d')!;
    const r = brushPx(inkRef.current.width);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = r * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(to.x, to.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  /** Restore layer to pre-stroke snapshot, then composite the full live stroke once. */
  const redrawLiveStroke = (complete = false) => {
    const layer = ensureLayer();
    const base = ensureStrokeBase();
    const scratch = ensureScratch();
    const ctx = layer.getContext('2d')!;
    ctx.clearRect(0, 0, LAYER_W, LAYER_H);
    ctx.drawImage(base, 0, 0);
    const { color, width } = inkRef.current;
    compositeStrokeOnto(
      ctx,
      scratch,
      penKindRef.current,
      strokePoints.current,
      color,
      brushPx(width),
      complete,
    );
  };

  const beginPenStroke = (pt: StrokePoint) => {
    const layer = ensureLayer();
    const base = ensureStrokeBase();
    const bctx = base.getContext('2d')!;
    bctx.clearRect(0, 0, LAYER_W, LAYER_H);
    bctx.drawImage(layer, 0, 0);
    strokePoints.current = [pt];
    redrawLiveStroke();
  };

  const extendPenStroke = (pt: StrokePoint) => {
    const pts = strokePoints.current;
    const last = pts[pts.length - 1];
    if (last && dist2(last, pt) < 0.25) {
      last.x = pt.x;
      last.y = pt.y;
      if (pt.p != null) last.p = pt.p;
    } else {
      pts.push(pt);
    }
    redrawLiveStroke();
  };

  const commit = () => {
    const layer = layerRef.current;
    if (!layer) return;
    onCommitRef.current(layer.toDataURL('image/png'));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || game.phase !== 'drawing') return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Programmatic / inactive pointers may throw; drawing still works without capture.
    }
    const p = toPaper(e);
    if (!p) return;
    drawing.current = true;
    cursorView.current = p;
    const local = paperToLayer(p, game.currentSection);
    lastLocal.current = local;
    if (toolRef.current === 'eraser') {
      eraseSegment(local, local);
    } else {
      beginPenStroke({ x: local.x, y: local.y, p: e.pressure || 0.5 });
    }
    paint();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toPaper(e);
    if (toolRef.current === 'eraser') {
      cursorView.current = p;
      if (!drawing.current) paint();
    }
    if (!drawing.current || !p) return;
    cursorView.current = p;
    const local = paperToLayer(p, game.currentSection);
    const prev = lastLocal.current ?? local;
    if (toolRef.current === 'eraser') {
      eraseSegment(prev, local);
    } else {
      extendPenStroke({ x: local.x, y: local.y, p: e.pressure || 0.5 });
    }
    lastLocal.current = local;
    paint();
  };

  const endStroke = () => {
    if (!drawing.current) return;
    drawing.current = false;
    lastLocal.current = null;
    cursorView.current = null;
    if (toolRef.current !== 'eraser' && strokePoints.current.length > 0) {
      redrawLiveStroke(true);
    }
    strokePoints.current = [];
    commit();
    paint();
  };

  return (
    <canvas
      ref={displayRef}
      className="fold-canvas touch-none mx-auto block rounded-sm shadow-lg"
      style={{
        cursor: !canDraw ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair',
        maxWidth: '100%',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      onPointerLeave={() => {
        if (!drawing.current) {
          cursorView.current = null;
          paint();
        }
      }}
    />
  );
}
