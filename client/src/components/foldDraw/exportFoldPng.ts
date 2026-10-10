import type { FoldGameState } from '@rfgames/shared';
import {
  FOLD_LAYER_WIDTH_PX,
  FOLD_PAPER_HEIGHT_PX,
  FOLD_SECTION_COUNT,
  foldSectionBandPx,
} from '@rfgames/shared';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Renders the full unfolded paper from section layer PNGs and downloads it. */
export async function downloadFoldPaperPng(
  game: FoldGameState,
  filename = 'katla-ciz.png',
) {
  const w = FOLD_LAYER_WIDTH_PX;
  const h = FOLD_PAPER_HEIGHT_PX;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#f3e6c9';
  ctx.fillRect(0, 0, w, h);

  const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.2, w * 0.5, h * 0.5, w * 0.9);
  vig.addColorStop(0, 'rgba(255,250,235,0.35)');
  vig.addColorStop(1, 'rgba(160,130,80,0.16)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  for (let s = 0; s < FOLD_SECTION_COUNT; s++) {
    const url = game.sectionLayers[s];
    if (!url) continue;
    try {
      const img = await loadImage(url);
      const band = foldSectionBandPx(s);
      ctx.drawImage(img, band.x, band.y, band.w, band.h);
    } catch {
      /* skip broken layer */
    }
  }

  ctx.strokeStyle = 'rgba(90,60,30,0.18)';
  ctx.setLineDash([8, 8]);
  for (let i = 1; i < FOLD_SECTION_COUNT; i++) {
    const y = foldSectionBandPx(i).y;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(90,60,30,0.4)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);

  ctx.fillStyle = 'rgba(42,28,16,0.45)';
  ctx.font = '600 22px "Source Sans 3", sans-serif';
  ctx.fillText('Katla-\u00c7iz \u00b7 RF Games', 24, h - 20);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
