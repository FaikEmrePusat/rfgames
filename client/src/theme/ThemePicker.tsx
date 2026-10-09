import { THEME_IDS, THEME_META, type ThemeId } from './themes';

interface Props {
  theme: ThemeId;
  onChange: (theme: ThemeId) => void;
  /** Compact strip for hub / lobby */
  className?: string;
}

export function ThemePicker({ theme, onChange, className = '' }: Props) {
  return (
    <div className={`theme-picker ${className}`.trim()} role="group" aria-label="Ortam">
      <span className="theme-picker__label">Ortam</span>
      <div className="theme-picker__rail">
        {THEME_IDS.map((id) => {
          const meta = THEME_META[id];
          const active = theme === id;
          return (
            <button
              key={id}
              type="button"
              className={`theme-picker__opt${active ? ' is-active' : ''}`}
              aria-pressed={active}
              title={`${meta.label} — ${meta.hint}`}
              onClick={() => onChange(id)}
            >
              <span className={`theme-picker__swatch theme-picker__swatch--${id}`} aria-hidden />
              <span className="theme-picker__name">{meta.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
