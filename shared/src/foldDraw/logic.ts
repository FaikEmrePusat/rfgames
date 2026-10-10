import {
  FOLD_PAPER_HEIGHT_OVER_WIDTH,
  FOLD_PLAYER_COLORS,
  FOLD_SECTION_COUNT,
  type FoldGameConfig,
  type FoldGameState,
  type FoldPlayer,
  type FoldPoint,
  type FoldSectionIndex,
} from './types.js';

export function clampFoldPlayerCount(n: number): number {
  return Math.max(2, Math.min(4, Math.floor(n)));
}

/** Round-robin: section i → player i % playerCount */
export function assignSectionOwners(playerCount: number): number[] {
  const n = clampFoldPlayerCount(playerCount);
  return Array.from({ length: FOLD_SECTION_COUNT }, (_, i) => i % n);
}

export function createFoldPlayers(names: string[]): FoldPlayer[] {
  const n = clampFoldPlayerCount(names.length);
  return names.slice(0, n).map((name, i) => ({
    id: i,
    name: name.trim() || `Oyuncu ${i + 1}`,
    color: FOLD_PLAYER_COLORS[i % FOLD_PLAYER_COLORS.length]!,
  }));
}

export function createFoldGame(config: FoldGameConfig): FoldGameState {
  const players = createFoldPlayers(config.playerNames);
  return {
    players,
    sectionOwners: assignSectionOwners(players.length),
    currentSection: 0,
    phase: 'drawing',
    sectionLayers: [null, null, null, null],
    peekRatio: config.peekRatio ?? 0.1,
  };
}

export function sectionYRange(section: FoldSectionIndex): { y0: number; y1: number } {
  const h = 1 / FOLD_SECTION_COUNT;
  return { y0: section * h, y1: (section + 1) * h };
}

export function activeSectionBounds(section: FoldSectionIndex) {
  return sectionYRange(section);
}

export function peekBounds(
  section: FoldSectionIndex,
  peekRatio: number,
): { y0: number; y1: number } | null {
  if (section === 0) return null;
  const prev = (section - 1) as FoldSectionIndex;
  const { y0, y1 } = sectionYRange(prev);
  const h = y1 - y0;
  const ratio = Math.min(0.25, Math.max(0.04, peekRatio));
  return { y0: y1 - h * ratio, y1 };
}

/**
 * Visible paper Y band while drawing: active section only.
 * Previous-section peek continuity is composited as a non-erasable underlay
 * inside the top of this band (see FoldCanvas), not as an extra strip above.
 */
export function drawingViewBand(
  section: FoldSectionIndex,
  _peekRatio: number,
): { y0: number; y1: number } {
  return activeSectionBounds(section);
}

/**
 * Canvas/CSS height÷width for a paper-space Y band on the canonical 2:5 sheet.
 * Draw zoom must use this so the viewport matches the band's true rectangle on reveal.
 */
export function foldBandHeightOverWidth(band: { y0: number; y1: number }): number {
  const span = band.y1 - band.y0 || 1;
  return FOLD_PAPER_HEIGHT_OVER_WIDTH * span;
}

export function currentArtist(state: FoldGameState): FoldPlayer {
  const ownerId = state.sectionOwners[state.currentSection]!;
  return state.players[ownerId]!;
}

export function sectionHasInk(state: FoldGameState, section?: FoldSectionIndex): boolean {
  const s = section ?? state.currentSection;
  return !!state.sectionLayers[s];
}

export function setSectionLayer(
  state: FoldGameState,
  section: FoldSectionIndex,
  dataUrl: string | null,
): FoldGameState {
  if (state.phase !== 'drawing') return state;
  const sectionLayers = [...state.sectionLayers] as (string | null)[];
  sectionLayers[section] = dataUrl;
  return { ...state, sectionLayers };
}

export function completeSection(state: FoldGameState): FoldGameState {
  if (state.phase !== 'drawing') return state;
  if (state.currentSection >= FOLD_SECTION_COUNT - 1) {
    return { ...state, phase: 'reveal' };
  }
  return {
    ...state,
    currentSection: (state.currentSection + 1) as FoldSectionIndex,
  };
}

export function clampPointToSection(point: FoldPoint, section: FoldSectionIndex): FoldPoint {
  const { y0, y1 } = sectionYRange(section);
  return {
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(y1, Math.max(y0, point.y)),
    p: point.p,
  };
}

export function foldGameSummary(state: FoldGameState): string {
  const artist = currentArtist(state);
  const ink = state.sectionLayers.filter(Boolean).length;
  return [
    `phase=${state.phase}`,
    `section=${state.currentSection}`,
    `artist=${artist.name}`,
    `layers=${ink}`,
    `players=${state.players.length}`,
  ].join(' | ');
}
