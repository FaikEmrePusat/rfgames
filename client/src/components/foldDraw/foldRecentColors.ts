const STORAGE_KEY = 'rfgames-fold-recent-colors';
const MAX_RECENT = 6;

export const FOLD_INK_PRESETS = [
  '#1f140c',
  '#6e1c1c',
  '#1e3a5f',
  '#3d5a40',
  '#8a6a28',
] as const;

function normalizeHex(color: string): string | null {
  const raw = color.trim().toLowerCase();
  const short = /^#([0-9a-f]{3})$/i.exec(raw);
  if (short) {
    const [r, g, b] = short[1]!.split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const full = /^#([0-9a-f]{6})$/i.exec(raw);
  return full ? `#${full[1]}` : null;
}

export function loadRecentFoldColors(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    for (const item of parsed) {
      if (typeof item !== 'string') continue;
      const hex = normalizeHex(item);
      if (!hex || out.includes(hex)) continue;
      out.push(hex);
      if (out.length >= MAX_RECENT) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function pushRecentFoldColor(color: string, current: string[]): string[] {
  const hex = normalizeHex(color);
  if (!hex) return current;
  const next = [hex, ...current.filter((c) => c !== hex)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
  return next;
}
