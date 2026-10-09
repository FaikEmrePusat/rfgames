import { FOLD_SECTION_COUNT } from '@rfgames/shared';

const LAYER_W = 900;
const LAYER_H = Math.round(LAYER_W / FOLD_SECTION_COUNT);

/**
 * Builds a section-sized PNG where only the bottom `peekRatio` strip has ink.
 * Safe to send to the next artist: full previous art above the peek is blank.
 */
export function buildPeekSafeLayer(
  sectionDataUrl: string,
  peekRatio: number,
): Promise<string> {
  const ratio = Math.min(0.25, Math.max(0.04, peekRatio));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = LAYER_W;
      canvas.height = LAYER_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas'));
        return;
      }
      const srcH = img.height || LAYER_H;
      const srcY0 = srcH * (1 - ratio);
      const dstY0 = LAYER_H * (1 - ratio);
      ctx.clearRect(0, 0, LAYER_W, LAYER_H);
      ctx.drawImage(
        img,
        0,
        srcY0,
        img.width || LAYER_W,
        srcH - srcY0,
        0,
        dstY0,
        LAYER_W,
        LAYER_H - dstY0,
      );
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('image'));
    img.src = sectionDataUrl;
  });
}
