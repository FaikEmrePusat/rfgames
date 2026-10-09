import { getStroke, type StrokeOptions } from 'perfect-freehand';

export type PenKind = 'ink' | 'pencil' | 'marker' | 'brush' | 'charcoal';

export const PEN_KIND_LABELS: Record<PenKind, string> = {
  ink: 'Mürekkep',
  pencil: 'Kurşun',
  marker: 'Fosforlu',
  brush: 'Fırça',
  charcoal: 'Kömür',
};

export const PEN_KINDS: PenKind[] = ['ink', 'pencil', 'marker', 'brush', 'charcoal'];

export type StrokePoint = { x: number; y: number; p?: number };

/** Per-kind perfect-freehand options + once-per-stroke opacity. */
type PenStyle = {
  alpha: number;
  sizeMul: number;
  options: Omit<StrokeOptions, 'size' | 'last'>;
};

const PEN_STYLES: Record<PenKind, PenStyle> = {
  ink: {
    alpha: 1,
    sizeMul: 1,
    options: {
      thinning: 0.45,
      smoothing: 0.55,
      streamline: 0.45,
      simulatePressure: true,
      start: { taper: 12, cap: true },
      end: { taper: 12, cap: true },
    },
  },
  pencil: {
    alpha: 0.55,
    sizeMul: 0.72,
    options: {
      thinning: 0.25,
      smoothing: 0.35,
      streamline: 0.65,
      simulatePressure: true,
      start: { taper: 4, cap: true },
      end: { taper: 6, cap: true },
    },
  },
  marker: {
    alpha: 0.3,
    sizeMul: 2.4,
    options: {
      thinning: 0.05,
      smoothing: 0.65,
      streamline: 0.55,
      simulatePressure: false,
      start: { taper: 0, cap: true },
      end: { taper: 0, cap: true },
    },
  },
  brush: {
    alpha: 0.78,
    sizeMul: 1.35,
    options: {
      thinning: 0.75,
      smoothing: 0.6,
      streamline: 0.35,
      simulatePressure: true,
      start: { taper: 28, cap: true },
      end: { taper: 40, cap: true },
    },
  },
  charcoal: {
    alpha: 0.62,
    sizeMul: 1.55,
    options: {
      thinning: 0.55,
      smoothing: 0.2,
      streamline: 0.25,
      simulatePressure: true,
      start: { taper: 8, cap: true },
      end: { taper: 18, cap: true },
    },
  },
};

/** Average midpoint → SVG path for a closed stroke outline (perfect-freehand README). */
function getSvgPathFromStroke(points: number[][], closed = true): string {
  const len = points.length;
  if (len < 4) return '';

  let a = points[0];
  let b = points[1];
  const c = points[2];
  const avg = (p: number[], q: number[]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(
    2,
  )} ${avg(b, c)[0].toFixed(2)},${avg(b, c)[1].toFixed(2)} T`;

  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    result += `${avg(a, b)[0].toFixed(2)},${avg(a, b)[1].toFixed(2)} `;
  }

  if (closed) result += 'Z';
  return result;
}

function toInputPoints(points: StrokePoint[]): number[][] {
  return points.map((pt) => [pt.x, pt.y, Math.min(1, Math.max(0.05, pt.p ?? 0.5))]);
}

/**
 * Draw a complete stroke as opaque ink onto `ctx` via perfect-freehand outline fill.
 * Callers composite once with alpha so overlaps never double-darken.
 */
export function paintStrokeOpaque(
  ctx: CanvasRenderingContext2D,
  kind: PenKind,
  points: StrokePoint[],
  color: string,
  baseWidthPx: number,
  complete = true,
) {
  if (points.length === 0) return;

  const style = PEN_STYLES[kind];
  const outline = getStroke(toInputPoints(points), {
    ...style.options,
    size: Math.max(1.5, baseWidthPx * style.sizeMul),
    last: complete,
  });

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;

  if (outline.length < 4) {
    // Dot / very short stroke — fill a disc so taps still register
    const p = points[0];
    const r = Math.max(1, (baseWidthPx * style.sizeMul) / 2);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const path = new Path2D(getSvgPathFromStroke(outline));
  ctx.fill(path);
  ctx.restore();
}

/**
 * Paint a finished/live stroke onto the destination layer without in-stroke
 * alpha stacking: opaque ink on a scratch canvas, then one alpha composite.
 */
export function compositeStrokeOnto(
  dest: CanvasRenderingContext2D,
  scratch: HTMLCanvasElement,
  kind: PenKind,
  points: StrokePoint[],
  color: string,
  baseWidthPx: number,
  complete = true,
) {
  const sctx = scratch.getContext('2d');
  if (!sctx || points.length === 0) return;

  sctx.clearRect(0, 0, scratch.width, scratch.height);
  paintStrokeOpaque(sctx, kind, points, color, baseWidthPx, complete);

  dest.save();
  dest.globalCompositeOperation = 'source-over';
  dest.globalAlpha = PEN_STYLES[kind].alpha;
  dest.drawImage(scratch, 0, 0);
  dest.restore();
}
