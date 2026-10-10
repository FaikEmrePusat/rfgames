export const FOLD_SECTION_COUNT = 4 as const;

export type FoldSectionIndex = 0 | 1 | 2 | 3;

export const FOLD_SECTION_LABELS: Record<FoldSectionIndex, string> = {
  0: 'Kafa',
  1: 'Beden',
  2: 'Bacaklar',
  3: 'Ayak',
};

/**
 * Canonical vertical character paper (width:height = 2:5).
 * Four equal section bands stack on this sheet; draw zoom and reveal share these metrics
 * so strokes never squash/stretch between phases.
 */
export const FOLD_PAPER_ASPECT_W = 2;
export const FOLD_PAPER_ASPECT_H = 5;
/** Full unfolded paper height / width (= 2.5). */
export const FOLD_PAPER_HEIGHT_OVER_WIDTH = FOLD_PAPER_ASPECT_H / FOLD_PAPER_ASPECT_W;

/**
 * Raster size for one section layer PNG (full paper width x one band height).
 * Chosen so paper height is exact: 800x2000 -> four 800x500 bands.
 */
export const FOLD_LAYER_WIDTH_PX = 800;
export const FOLD_PAPER_HEIGHT_PX =
  (FOLD_LAYER_WIDTH_PX * FOLD_PAPER_ASPECT_H) / FOLD_PAPER_ASPECT_W;
export const FOLD_LAYER_HEIGHT_PX = FOLD_PAPER_HEIGHT_PX / FOLD_SECTION_COUNT;
/** Section band height / width on the paper (= 0.625 = 5/8). */
export const FOLD_SECTION_HEIGHT_OVER_WIDTH =
  FOLD_PAPER_HEIGHT_OVER_WIDTH / FOLD_SECTION_COUNT;

/** Normalized paper coords 0-1 (top-left origin). */
export interface FoldPoint {
  x: number;
  y: number;
  p?: number;
}

export interface FoldPlayer {
  id: number;
  name: string;
  color: string;
  /** Present in online rooms — ties seat to socket member. */
  memberId?: string;
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
  /** Bottom fraction of previous section shown as peek (0-1 of section height) */
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
