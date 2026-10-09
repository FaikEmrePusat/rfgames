import { useEffect, useId, useRef, useState } from 'react';
import { THEME_IDS, THEME_META, type ThemeId } from './themes';

interface Props {
  theme: ThemeId;
  onChange: (theme: ThemeId) => void;
  /** Compact strip for hub / lobby; menu for in-game chrome */
  variant?: 'rail' | 'menu';
  className?: string;
}

export function ThemePicker({
  theme,
  onChange,
  variant = 'rail',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const meta = THEME_META[theme];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const rail = (
    <div className="theme-picker__rail">
      {THEME_IDS.map((id) => {
        const opt = THEME_META[id];
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            className={`theme-picker__opt${active ? ' is-active' : ''}`}
            aria-pressed={active}
            title={`${opt.label} — ${opt.hint}`}
            onClick={() => {
              onChange(id);
              if (variant === 'menu') setOpen(false);
            }}
          >
            <span className={`theme-picker__swatch theme-picker__swatch--${id}`} aria-hidden />
            <span className="theme-picker__name">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );

  if (variant === 'menu') {
    return (
      <div
        ref={rootRef}
        className={`theme-picker theme-picker--menu ${className}`.trim()}
      >
        <button
          type="button"
          className={`theme-picker__trigger${open ? ' is-open' : ''}`}
          aria-expanded={open}
          aria-controls={panelId}
          aria-haspopup="true"
          title={`Ortam: ${meta.label}`}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`theme-picker__swatch theme-picker__swatch--${theme}`} aria-hidden />
          <span className="theme-picker__trigger-label">Ortam</span>
        </button>
        {open && (
          <div
            id={panelId}
            className="theme-picker__popover"
            role="group"
            aria-label="Ortam seç"
          >
            {rail}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`theme-picker ${className}`.trim()} role="group" aria-label="Ortam">
      <span className="theme-picker__label">Ortam</span>
      {rail}
    </div>
  );
}
