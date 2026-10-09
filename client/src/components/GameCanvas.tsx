import { useEffect, useRef, useCallback, useState } from 'react';
import type { Bridge, GameState } from '@rfgames/shared';
import { getValidMoves } from '@rfgames/shared';

interface Props {
  game: GameState;
  onClaim: (r: number, c: number) => void;
  highlightValid?: boolean;
}

function cellCenter(c: number, r: number, cs: number) {
  return { x: c * cs + cs / 2, y: r * cs + cs / 2 };
}

function drawBridgeLines(ctx: CanvasRenderingContext2D, bridges: Bridge[], cs: number) {
  ctx.save();
  ctx.setLineDash([7, 5]);
  ctx.lineCap = 'round';

  for (const bridge of bridges) {
    const a = cellCenter(bridge.cellA.c, bridge.cellA.r, cs);
    const b = cellCenter(bridge.cellB.c, bridge.cellB.r, cs);

    ctx.strokeStyle = 'rgba(14, 80, 70, 0.4)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(40, 120, 100, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBridgeEndpoints(
  ctx: CanvasRenderingContext2D,
  bridges: Bridge[],
  game: GameState,
  cs: number,
) {
  const seen = new Set<string>();

  for (const bridge of bridges) {
    for (const [pos, targetIsland] of [
      [bridge.cellA, bridge.toIsland] as const,
      [bridge.cellB, bridge.fromIsland] as const,
    ]) {
      const key = `${pos.r},${pos.c}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const cell = game.grid[pos.r]?.[pos.c];
      if (!cell?.isLand) continue;

      const x = pos.c * cs;
      const y = pos.r * cs;
      const blocked = cell.owner !== null;

      ctx.fillStyle = blocked ? 'rgba(100, 90, 70, 0.35)' : 'rgba(45, 110, 90, 0.28)';
      ctx.fillRect(x + 2, y + 2, cs - 4, cs - 4);

      ctx.strokeStyle = blocked ? 'rgba(100, 90, 70, 0.9)' : 'rgba(30, 90, 70, 0.95)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x + 1.5, y + 1.5, cs - 3, cs - 3);
      ctx.setLineDash([]);

      ctx.fillStyle = blocked ? '#6b5a40' : '#1a4a3a';
      ctx.beginPath();
      ctx.arc(x + cs / 2, y + cs / 2, cs * 0.18, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = `bold ${Math.max(10, cs * 0.32)}px Fraunces, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = blocked ? '#5a4a30' : '#1a3d30';
      ctx.fillText(`→${targetIsland}`, x + cs / 2, y + cs - cs * 0.18);
    }
  }
}

function drawBridgeLabels(ctx: CanvasRenderingContext2D, bridges: Bridge[], cs: number) {
  for (const bridge of bridges) {
    const a = cellCenter(bridge.cellA.c, bridge.cellA.r, cs);
    const b = cellCenter(bridge.cellB.c, bridge.cellB.r, cs);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;

    ctx.font = `600 ${Math.max(10, cs * 0.28)}px Fraunces, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const label = `${bridge.fromIsland} ↔ ${bridge.toIsland}`;
    const metrics = ctx.measureText(label);
    const pad = 4;
    const w = metrics.width + pad * 2;
    const h = cs * 0.36;
    const lx = mx - w / 2;
    const ly = my - h / 2;

    ctx.fillStyle = 'rgba(232, 217, 184, 0.92)';
    ctx.strokeStyle = 'rgba(90, 60, 30, 0.45)';
    ctx.lineWidth = 1;
    ctx.fillRect(lx, ly, w, h);
    ctx.strokeRect(lx, ly, w, h);

    ctx.fillStyle = '#2a1c10';
    ctx.fillText(label, mx, my);
  }
}

function ownershipSignature(game: GameState): string {
  const parts: string[] = [];
  for (let r = 0; r < game.gridRows; r++) {
    for (let c = 0; c < game.gridCols; c++) {
      const cell = game.grid[r][c];
      if (!cell?.isLand) continue;
      parts.push(`${r},${c}:${cell.owner ?? 'n'}`);
    }
  }
  return `${game.gridCols}x${game.gridRows}|${game.bridges.length}|${parts.join(';')}`;
}

const MIN_ZOOM = 0.08;
const MAX_ZOOM = 2.5;

function pointerDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function pointerMidpoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function GameCanvas({ game, onClaim, highlightValid = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({
    x: 40,
    y: 40,
    zoom: 1,
    dragging: false,
    lastX: 0,
    lastY: 0,
    moved: false,
    pinching: false,
  });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{
    startDist: number;
    startZoom: number;
    originMapX: number;
    originMapY: number;
  } | null>(null);
  const parchmentRef = useRef<HTMLImageElement | null>(null);
  const mapCacheRef = useRef<HTMLCanvasElement | null>(null);
  const mapCacheKeyRef = useRef('');
  const rafPanRef = useRef<number | null>(null);
  const [parchmentReady, setParchmentReady] = useState(0);
  const gameRef = useRef(game);
  gameRef.current = game;

  useEffect(() => {
    const img = new Image();
    img.src = '/parchment-texture.png';
    img.onload = () => {
      parchmentRef.current = img;
      setParchmentReady((n) => n + 1);
    };
  }, []);

  const rebuildMapCache = useCallback((g: GameState) => {
    const cs = g.cellSize;
    const mapW = g.gridCols * cs;
    const mapH = g.gridRows * cs;
    const key = ownershipSignature(g);

    let cache = mapCacheRef.current;
    if (!cache || cache.width !== mapW || cache.height !== mapH) {
      cache = document.createElement('canvas');
      cache.width = mapW;
      cache.height = mapH;
      mapCacheRef.current = cache;
    } else if (mapCacheKeyRef.current === key) {
      return cache;
    }

    const ctx = cache.getContext('2d');
    if (!ctx) return cache;

    mapCacheKeyRef.current = key;

    const parchment = parchmentRef.current;
    if (parchment?.complete) {
      const pattern = ctx.createPattern(parchment, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, mapW, mapH);
        ctx.fillStyle = 'rgba(230, 213, 181, 0.28)';
        ctx.fillRect(0, 0, mapW, mapH);
      } else {
        ctx.fillStyle = '#e6d5b5';
        ctx.fillRect(0, 0, mapW, mapH);
      }
    } else {
      ctx.fillStyle = '#e6d5b5';
      ctx.fillRect(0, 0, mapW, mapH);
    }

    ctx.strokeStyle = 'rgba(55, 35, 15, 0.7)';
    ctx.lineWidth = 1.4;
    for (let x = 0; x <= mapW; x += cs) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, mapH);
      ctx.stroke();
    }
    for (let y = 0; y <= mapH; y += cs) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(mapW, y);
      ctx.stroke();
    }

    drawBridgeLines(ctx, g.bridges, cs);

    for (let r = 0; r < g.gridRows; r++) {
      for (let c = 0; c < g.gridCols; c++) {
        const cell = g.grid[r][c];
        if (!cell?.isLand) continue;

        const x = c * cs;
        const y = r * cs;

        ctx.fillStyle =
          cell.owner !== null
            ? `${g.players.find((p) => p.id === cell.owner)?.color ?? '#999'}66`
            : 'rgba(120, 140, 90, 0.45)';
        ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);

        ctx.strokeStyle = 'rgba(60, 45, 25, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, cs, cs);
      }
    }

    drawBridgeEndpoints(ctx, g.bridges, g, cs);
    drawBridgeLabels(ctx, g.bridges, cs);

    return cache;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const g = gameRef.current;
    const cs = g.cellSize;
    const offsetX = panRef.current.x;
    const offsetY = panRef.current.y;
    const zoom = panRef.current.zoom;

    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.floor(w * dpr);
    const cssH = Math.floor(h * dpr);
    if (canvas.width !== cssW || canvas.height !== cssH) {
      canvas.width = cssW;
      canvas.height = cssH;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#4a5648';
    ctx.fillRect(0, 0, w, h);

    const cache = rebuildMapCache(g);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);
    ctx.drawImage(cache, 0, 0);

    if (highlightValid && g.phase === 'claim' && g.remainingSteps > 0) {
      const player = g.players[g.currentPlayerIdx];
      const valid = getValidMoves(g.grid, g.bridges, g.gridRows, g.gridCols, player.id);
      for (const m of valid) {
        const x = m.c * cs;
        const y = m.r * cs;
        ctx.fillStyle = m.isBridgeTarget ? 'rgba(45, 110, 90, 0.4)' : `${player.color}40`;
        ctx.fillRect(x + 2, y + 2, cs - 4, cs - 4);
        ctx.strokeStyle = m.isBridgeTarget ? '#1a4a3a' : player.color;
        ctx.lineWidth = m.isBridgeTarget ? 3 : 2;
        ctx.strokeRect(x + 2, y + 2, cs - 4, cs - 4);
      }
    }

    ctx.restore();
  }, [highlightValid, rebuildMapCache]);

  const scheduleDraw = useCallback(() => {
    if (rafPanRef.current != null) return;
    rafPanRef.current = requestAnimationFrame(() => {
      rafPanRef.current = null;
      draw();
    });
  }, [draw]);

  const fitMapToView = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;

    const g = gameRef.current;
    const padding = 16;
    const mapW = g.gridCols * g.cellSize;
    const mapH = g.gridRows * g.cellSize;

    const scaleX = (w - padding * 2) / mapW;
    const scaleY = (h - padding * 2) / mapH;
    panRef.current.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)));

    const scaledW = mapW * panRef.current.zoom;
    const scaledH = mapH * panRef.current.zoom;
    panRef.current.x = (w - scaledW) / 2;
    panRef.current.y = (h - scaledH) / 2;
    draw();
  }, [draw]);

  const zoomAt = useCallback(
    (clientX: number, clientY: number, newZoom: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      const oldZoom = panRef.current.zoom;
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
      const mapX = (cx - panRef.current.x) / oldZoom;
      const mapY = (cy - panRef.current.y) / oldZoom;
      panRef.current.zoom = clamped;
      panRef.current.x = cx - mapX * clamped;
      panRef.current.y = cy - mapY * clamped;
      scheduleDraw();
    },
    [scheduleDraw],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        draw();
      }
    });
    observer.observe(container);

    requestAnimationFrame(() => {
      fitMapToView();
    });

    return () => observer.disconnect();
  }, [draw, fitMapToView, game.gridCols, game.gridRows]);

  useEffect(() => {
    mapCacheKeyRef.current = '';
    draw();
  }, [game, draw, parchmentReady]);

  useEffect(() => {
    return () => {
      if (rafPanRef.current != null) cancelAnimationFrame(rafPanRef.current);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      zoomAt(e.clientX, e.clientY, panRef.current.zoom * factor);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const screenToCell = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    const mapX = (clickX - panRef.current.x) / panRef.current.zoom;
    const mapY = (clickY - panRef.current.y) / panRef.current.zoom;

    const c = Math.floor(mapX / game.cellSize);
    const r = Math.floor(mapY / game.cellSize);

    if (r < 0 || r >= game.gridRows || c < 0 || c >= game.gridCols) return null;
    return { r, c };
  };

  const beginPinch = () => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const dist = pointerDistance(a, b);
    if (dist < 8) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mid = pointerMidpoint(a, b);
    const cx = mid.x - rect.left;
    const cy = mid.y - rect.top;

    pinchRef.current = {
      startDist: dist,
      startZoom: panRef.current.zoom,
      originMapX: (cx - panRef.current.x) / panRef.current.zoom,
      originMapY: (cy - panRef.current.y) / panRef.current.zoom,
    };
    panRef.current.pinching = true;
    panRef.current.dragging = false;
    panRef.current.moved = true;
  };

  const updatePinch = () => {
    const pinch = pinchRef.current;
    const pts = [...pointersRef.current.values()];
    if (!pinch || pts.length < 2) return;

    const [a, b] = pts;
    const dist = pointerDistance(a, b);
    if (dist < 8) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mid = pointerMidpoint(a, b);
    const cx = mid.x - rect.left;
    const cy = mid.y - rect.top;

    const newZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, pinch.startZoom * (dist / pinch.startDist)),
    );
    panRef.current.zoom = newZoom;
    panRef.current.x = cx - pinch.originMapX * newZoom;
    panRef.current.y = cy - pinch.originMapY * newZoom;
    scheduleDraw();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }

    panRef.current.dragging = true;
    panRef.current.lastX = e.clientX;
    panRef.current.lastY = e.clientY;
    panRef.current.moved = false;
    panRef.current.pinching = false;
    pinchRef.current = null;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2 || panRef.current.pinching) {
      if (!pinchRef.current) beginPinch();
      updatePinch();
      return;
    }

    if (!panRef.current.dragging) return;
    const dx = e.clientX - panRef.current.lastX;
    const dy = e.clientY - panRef.current.lastY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panRef.current.moved = true;
    panRef.current.x += dx;
    panRef.current.y += dy;
    panRef.current.lastX = e.clientX;
    panRef.current.lastY = e.clientY;
    scheduleDraw();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const wasPinching = panRef.current.pinching;
    const wasMoved = panRef.current.moved;
    pointersRef.current.delete(e.pointerId);

    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
      panRef.current.pinching = false;
    }

    if (pointersRef.current.size === 1) {
      const remaining = [...pointersRef.current.values()][0]!;
      panRef.current.dragging = true;
      panRef.current.lastX = remaining.x;
      panRef.current.lastY = remaining.y;
      panRef.current.moved = true;
      return;
    }

    if (pointersRef.current.size === 0) {
      if (!wasPinching && !wasMoved) {
        const cell = screenToCell(e.clientX, e.clientY);
        if (cell) onClaim(cell.r, cell.c);
      }
      panRef.current.dragging = false;
    }
  };

  const zoomBy = (delta: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cx = rect.left + container.clientWidth / 2;
    const cy = rect.top + container.clientHeight / 2;
    zoomAt(cx, cy, panRef.current.zoom + delta);
  };

  return (
    <div
      ref={containerRef}
      className="game-map"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <div className="absolute top-3 left-3 flex items-center gap-2 parchment-panel !p-2 text-[var(--ink)] text-sm max-w-[90%] pointer-events-none z-10 hand-note">
        <span className="w-3 border-t border-dashed border-[var(--ink-soft)] shrink-0" />
        <span className="truncate">köprü: kesikli hat · →N hedef ada</span>
      </div>
      <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
        <button
          type="button"
          onClick={() => zoomBy(0.12)}
          className="w-11 h-11 flex items-center justify-center text-3xl leading-none hand-title bg-[#e8d9b8] border-2 border-[#5a4020] text-[#5c1818] shadow-lg hover:bg-[#f0e4c8] active:scale-95 transition"
          aria-label="Yakınlaştır"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(-0.12)}
          className="w-11 h-11 flex items-center justify-center text-3xl leading-none hand-title bg-[#e8d9b8] border-2 border-[#5a4020] text-[#5c1818] shadow-lg hover:bg-[#f0e4c8] active:scale-95 transition"
          aria-label="Uzaklaştır"
        >
          −
        </button>
        <button
          type="button"
          onClick={fitMapToView}
          className="w-11 h-11 flex items-center justify-center text-xl leading-none hand-title bg-[#e8d9b8] border-2 border-[#5a4020] text-[#5c1818] shadow-lg hover:bg-[#f0e4c8] active:scale-95 transition"
          title="Haritayı sığdır"
          aria-label="Sığdır"
        >
          ◎
        </button>
      </div>
    </div>
  );
}
