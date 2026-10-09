export const THEME_IDS = ['defter', 'liman', 'gece', 'tebesir'] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const THEME_STORAGE_KEY = 'rfgames.theme';

export const THEME_META: Record<
  ThemeId,
  { label: string; hint: string }
> = {
  defter: { label: 'Defter', hint: 'mürekkep · damga' },
  liman: { label: 'Liman', hint: 'harita masası' },
  gece: { label: 'Gece', hint: 'fener ışığı' },
  tebesir: { label: 'Tebeşir', hint: 'kara tahta' },
};

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEME_IDS.includes(value as ThemeId);
}

export function readStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(raw)) return raw;
  } catch {
    /* private mode */
  }
  return 'defter';
}

export function applyThemeAttribute(theme: ThemeId) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function persistTheme(theme: ThemeId) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode */
  }
}

/** Kapmaca canvas materials — one place per environment, not hue remaps. */
export interface MapMaterials {
  viewport: string;
  waterBase: string;
  waterTint: string;
  /** When texture image missing */
  waterFallback: string;
  grid: string;
  landUnclaimed: string;
  landStroke: string;
  bridgeSoft: string;
  bridgeStrong: string;
  bridgeEndpointOpen: string;
  bridgeEndpointOpenStroke: string;
  bridgeEndpointOpenDot: string;
  bridgeEndpointOpenLabel: string;
  bridgeEndpointBlocked: string;
  bridgeEndpointBlockedStroke: string;
  bridgeEndpointBlockedDot: string;
  bridgeEndpointBlockedLabel: string;
  labelBg: string;
  labelStroke: string;
  labelInk: string;
  validBridgeFill: string;
  validBridgeStroke: string;
  useParchmentTexture: boolean;
  displayFont: string;
  uiFont: string;
  gridDash?: number[];
  landStyle: 'fill' | 'chalk' | 'chart';
}

export const MAP_MATERIALS: Record<ThemeId, MapMaterials> = {
  defter: {
    viewport: '#4a5648',
    waterBase: '#e6d5b5',
    waterTint: 'rgba(230, 213, 181, 0.28)',
    waterFallback: '#e6d5b5',
    grid: 'rgba(55, 35, 15, 0.7)',
    landUnclaimed: 'rgba(120, 140, 90, 0.45)',
    landStroke: 'rgba(60, 45, 25, 0.75)',
    bridgeSoft: 'rgba(14, 80, 70, 0.4)',
    bridgeStrong: 'rgba(40, 120, 100, 0.7)',
    bridgeEndpointOpen: 'rgba(45, 110, 90, 0.28)',
    bridgeEndpointOpenStroke: 'rgba(30, 90, 70, 0.95)',
    bridgeEndpointOpenDot: '#1a4a3a',
    bridgeEndpointOpenLabel: '#1a3d30',
    bridgeEndpointBlocked: 'rgba(100, 90, 70, 0.35)',
    bridgeEndpointBlockedStroke: 'rgba(100, 90, 70, 0.9)',
    bridgeEndpointBlockedDot: '#6b5a40',
    bridgeEndpointBlockedLabel: '#5a4a30',
    labelBg: 'rgba(232, 217, 184, 0.92)',
    labelStroke: 'rgba(90, 60, 30, 0.45)',
    labelInk: '#2a1c10',
    validBridgeFill: 'rgba(45, 110, 90, 0.4)',
    validBridgeStroke: '#1a4a3a',
    useParchmentTexture: true,
    displayFont: '"Archivo Black", "Arial Black", Impact, sans-serif',
    uiFont: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
    landStyle: 'fill',
  },
  liman: {
    viewport: '#1a3344',
    waterBase: '#c5d4dc',
    waterTint: 'rgba(70, 120, 150, 0.22)',
    waterFallback: '#b8c9d4',
    grid: 'rgba(25, 55, 80, 0.45)',
    landUnclaimed: 'rgba(90, 130, 100, 0.5)',
    landStroke: 'rgba(30, 70, 90, 0.85)',
    bridgeSoft: 'rgba(40, 70, 110, 0.45)',
    bridgeStrong: 'rgba(180, 140, 60, 0.75)',
    bridgeEndpointOpen: 'rgba(50, 90, 130, 0.3)',
    bridgeEndpointOpenStroke: 'rgba(30, 70, 110, 0.95)',
    bridgeEndpointOpenDot: '#1a3a5c',
    bridgeEndpointOpenLabel: '#14304a',
    bridgeEndpointBlocked: 'rgba(90, 80, 50, 0.35)',
    bridgeEndpointBlockedStroke: 'rgba(120, 100, 50, 0.9)',
    bridgeEndpointBlockedDot: '#6a5a30',
    bridgeEndpointBlockedLabel: '#4a4020',
    labelBg: 'rgba(230, 236, 240, 0.94)',
    labelStroke: 'rgba(40, 80, 110, 0.5)',
    labelInk: '#0e2438',
    validBridgeFill: 'rgba(50, 100, 140, 0.4)',
    validBridgeStroke: '#1a3a5c',
    useParchmentTexture: true,
    displayFont: '"Libre Baskerville", Georgia, serif',
    uiFont: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
    landStyle: 'chart',
    gridDash: [3, 4],
  },
  gece: {
    viewport: '#0a0c10',
    waterBase: '#121820',
    waterTint: 'rgba(20, 40, 70, 0.35)',
    waterFallback: '#10161e',
    grid: 'rgba(180, 200, 220, 0.12)',
    landUnclaimed: 'rgba(55, 75, 90, 0.55)',
    landStroke: 'rgba(200, 170, 100, 0.35)',
    bridgeSoft: 'rgba(200, 160, 80, 0.35)',
    bridgeStrong: 'rgba(230, 180, 90, 0.7)',
    bridgeEndpointOpen: 'rgba(200, 160, 80, 0.22)',
    bridgeEndpointOpenStroke: 'rgba(230, 180, 90, 0.9)',
    bridgeEndpointOpenDot: '#e8c060',
    bridgeEndpointOpenLabel: '#d4b050',
    bridgeEndpointBlocked: 'rgba(80, 70, 60, 0.4)',
    bridgeEndpointBlockedStroke: 'rgba(120, 110, 90, 0.7)',
    bridgeEndpointBlockedDot: '#8a7a60',
    bridgeEndpointBlockedLabel: '#7a6a50',
    labelBg: 'rgba(18, 22, 30, 0.92)',
    labelStroke: 'rgba(200, 160, 80, 0.45)',
    labelInk: '#e8dcc0',
    validBridgeFill: 'rgba(200, 160, 80, 0.35)',
    validBridgeStroke: '#e8c060',
    useParchmentTexture: false,
    displayFont: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
    uiFont: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
    landStyle: 'fill',
  },
  tebesir: {
    viewport: '#1a2a1c',
    waterBase: '#243528',
    waterTint: 'rgba(40, 60, 45, 0.2)',
    waterFallback: '#243528',
    grid: 'rgba(220, 220, 200, 0.18)',
    landUnclaimed: 'rgba(200, 210, 180, 0.2)',
    landStroke: 'rgba(235, 235, 210, 0.55)',
    bridgeSoft: 'rgba(200, 200, 170, 0.35)',
    bridgeStrong: 'rgba(245, 230, 120, 0.65)',
    bridgeEndpointOpen: 'rgba(220, 220, 190, 0.18)',
    bridgeEndpointOpenStroke: 'rgba(245, 245, 220, 0.85)',
    bridgeEndpointOpenDot: '#f0f0d8',
    bridgeEndpointOpenLabel: '#e8e8c8',
    bridgeEndpointBlocked: 'rgba(140, 130, 90, 0.3)',
    bridgeEndpointBlockedStroke: 'rgba(180, 170, 100, 0.7)',
    bridgeEndpointBlockedDot: '#c0b070',
    bridgeEndpointBlockedLabel: '#b0a060',
    labelBg: 'rgba(30, 45, 32, 0.9)',
    labelStroke: 'rgba(230, 230, 200, 0.4)',
    labelInk: '#f2f2dc',
    validBridgeFill: 'rgba(245, 230, 120, 0.28)',
    validBridgeStroke: '#f5e678',
    useParchmentTexture: false,
    displayFont: '"IBM Plex Mono", "Consolas", monospace',
    uiFont: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
    landStyle: 'chalk',
    gridDash: [2, 5],
  },
};
