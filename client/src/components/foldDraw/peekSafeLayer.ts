import {
  FOLD_LAYER_HEIGHT_PX,
  FOLD_LAYER_WIDTH_PX,
} from '@rfgames/shared';

/**
 * Builds a section-sized PNG where only the bottom `peekRatio` strip has ink.
 * Safe to send to the next artist: full previous art above the peek is blank.
 * Uses the same layer pixel size as FoldCanvas so reveal stitches without stretch.
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
      canvas.width = FOLD_LAYER_WIDTH_PX;
      canvas.height = FOLD_LAYER_HEIGHT_PX;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas'));
        return;
      }
      const srcH = img.height || FOLD_LAYER_HEIGHT_PX;
      const srcY0 = srcH * (1 - ratio);
      const dstY0 = FOLD_LAYER_HEIGHT_PX * (1 - ratio);
      ctx.clearRect(0, 0, FOLD_LAYER_WIDTH_PX, FOLD_LAYER_HEIGHT_PX);
      ctx.drawImage(
        img,
        0,
        srcY0,
        img.width || FOLD_LAYER_WIDTH_PX,
        srcH - srcY0,
        0,
        dstY0,
        FOLD_LAYER_WIDTH_PX,
        FOLD_LAYER_HEIGHT_PX - dstY0,
      );
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('image'));
    img.src = sectionDataUrl;
  });
}
