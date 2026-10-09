import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { THEME_IDS, THEME_META, type ThemeId } from './themes';

interface Props {
  theme: ThemeId;
  onChange: (theme: ThemeId) => void;
  /** Full always-open rail, or compact Ortam trigger + popover */
  variant?: 'rail' | 'menu';
  className?: string;
}

interface PopoverPos {
  top: number;
  right: number;
}

export function ThemePicker({
  theme,
  onChange,
  variant = 'rail',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const meta = THEME_META[theme];

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }

    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
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
    const popover =
      open &&
      pos &&
      createPortal(
        <div
          ref={popoverRef}
          id={panelId}
          className="theme-picker__popover theme-picker__popover--portal"
          role="group"
          aria-label="Ortam seç"
          style={{ top: pos.top, right: pos.right }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {rail}
        </div>,
        document.body,
      );

    return (
      <div
        ref={rootRef}
        className={`theme-picker theme-picker--menu ${className}`.trim()}
      >
        <button
          ref={triggerRef}
          type="button"
          className={`theme-picker__trigger${open ? ' is-open' : ''}`}
          aria-expanded={open}
          aria-controls={panelId}
          aria-haspopup="true"
          title={`Ortam: ${meta.label}`}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`theme-picker__swatch theme-picker__swatch--${theme}`} aria-hidden />
          <span className="theme-picker__trigger-label">
            Ortam
            <span className="theme-picker__trigger-current">{meta.label}</span>
          </span>
        </button>
        {popover}
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
