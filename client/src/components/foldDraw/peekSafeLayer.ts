import {
  FOLD_LAYER_HEIGHT_PX,
  FOLD_LAYER_WIDTH_PX,
  peekStripHeightPx,
} from '@rfgames/shared';

/**
 * Builds a section-sized PNG where only the bottom `peekRatio` strip has ink.
 * Safe to send to the next artist: full previous art above the peek is blank.
 * FoldCanvas blits that strip into paper-space peek ABOVE the crease (not remapped
 * into the current section top). Exact integer row count via peekStripHeightPx.
 */
export function buildPeekSafeLayer(
  sectionDataUrl: string,
  peekRatio: number,
): Promise<string> {
  const peekH = peekStripHeightPx(peekRatio);
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
      const srcY0 = srcH - peekH;
      const dstY0 = FOLD_LAYER_HEIGHT_PX - peekH;
      ctx.clearRect(0, 0, FOLD_LAYER_WIDTH_PX, FOLD_LAYER_HEIGHT_PX);
      ctx.drawImage(
        img,
        0,
        srcY0,
        img.width || FOLD_LAYER_WIDTH_PX,
        peekH,
        0,
        dstY0,
        FOLD_LAYER_WIDTH_PX,
        peekH,
      );
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('image'));
    img.src = sectionDataUrl;
  });
}
