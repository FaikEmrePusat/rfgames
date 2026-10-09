export const FOLD_SECTION_COUNT = 4 as const;

export type FoldSectionIndex = 0 | 1 | 2 | 3;

export const FOLD_SECTION_LABELS: Record<FoldSectionIndex, string> = {
  0: 'Kafa',
  1: 'Beden',
  2: 'Bacaklar',
  3: 'Ayak',
};

/** Normalized paper coords 0–1 (top-left origin). */
export interface FoldPoint {
  x: number;
  y: number;
  p?: number;
}

export interface FoldPlayer {
  id: number;
  name: string;
  color: string;
}

export type FoldPhase = 'drawing' | 'reveal';

export interface FoldGameState {
  players: FoldPlayer[];
  /** Who draws each of the 4 sections */
  sectionOwners: number[];
  currentSection: FoldSectionIndex;
  phase: FoldPhase;
  /**
   * Raster ink per section (PNG data URL). Eraser uses pixel-perfect destination-out.
   */
  sectionLayers: (string | null)[];
  /** Bottom fraction of previous section shown as peek (0–1 of section height) */
  peekRatio: number;
}

export interface FoldGameConfig {
  playerNames: string[];
  peekRatio?: number;
}

export const FOLD_PLAYER_COLORS = [
  '#6e1c1c',
  '#1e3a5f',
  '#3d5a40',
  '#8a6a28',
];
