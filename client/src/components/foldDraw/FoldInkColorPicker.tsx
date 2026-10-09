import { useState } from 'react';
import {
  FOLD_INK_PRESETS,
  loadRecentFoldColors,
  pushRecentFoldColor,
} from './foldRecentColors';

interface Props {
  ink: string;
  onInkChange: (color: string) => void;
  /** Compact single-row for mobile dock */
  compact?: boolean;
}

export function FoldInkColorPicker({ ink, onInkChange, compact = false }: Props) {
  const [recent, setRecent] = useState(loadRecentFoldColors);

  const pick = (color: string) => {
    onInkChange(color);
    setRecent((prev) => pushRecentFoldColor(color, prev));
  };

  const presets = FOLD_INK_PRESETS as readonly string[];
  const chips = [
    ...presets.slice(0, compact ? 3 : 5),
    ...recent.filter((c) => !presets.includes(c.toLowerCase()) && !presets.includes(c)).slice(0, compact ? 3 : 4),
  ].slice(0, compact ? 6 : 8);

  return (
    <div className={`fold-ink-picker ${compact ? 'fold-ink-picker--compact' : ''}`}>
      <label className="fold-color-input-wrap" title="Renk seç">
        <input
          type="color"
          value={ink}
          aria-label="Renk"
          onChange={(e) => pick(e.target.value)}
          className="fold-color-input"
        />
        <span className="fold-color-swatch" style={{ backgroundColor: ink }} aria-hidden />
      </label>
      <div className="fold-ink-chips">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`Renk ${c}`}
            aria-pressed={ink.toLowerCase() === c.toLowerCase()}
            onClick={() => pick(c)}
            className={`fold-ink-chip ${
              ink.toLowerCase() === c.toLowerCase() ? 'fold-ink-chip--on' : ''
            }`}
          >
            <span className="fold-ink-chip__swatch" style={{ backgroundColor: c }} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
