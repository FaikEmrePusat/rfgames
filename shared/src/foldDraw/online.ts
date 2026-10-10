import { assignSectionOwners, currentArtist } from './logic.js';
import type { FoldGameState, FoldPlayer, FoldSectionIndex } from './types.js';
import { FOLD_PLAYER_COLORS } from './types.js';

export interface FoldMemberSeed {
  memberId: string;
  name: string;
}

/** Max PNG data-URL length accepted for a section/peek payload (~1.2 MB). */
export const FOLD_LAYER_DATA_URL_MAX = 1_200_000;

export function createFoldGameOnline(members: FoldMemberSeed[]): FoldGameState {
  const n = Math.max(2, Math.min(4, members.length));
  const sliced = members.slice(0, n);
  const players: FoldPlayer[] = sliced.map((m, i) => ({
    id: i,
    name: m.name.trim() || `Oyuncu ${i + 1}`,
    color: FOLD_PLAYER_COLORS[i % FOLD_PLAYER_COLORS.length]!,
    memberId: m.memberId,
  }));

  return {
    players,
    sectionOwners: assignSectionOwners(players.length),
    currentSection: 0,
    phase: 'drawing',
    sectionLayers: [null, null, null, null],
    peekRatio: 0.1,
  };
}

export function foldPlayerIdForMember(
  state: FoldGameState,
  memberId: string,
): number | null {
  const p = state.players.find((pl) => pl.memberId === memberId);
  return p ? p.id : null;
}

export function isCurrentFoldArtist(state: FoldGameState, memberId: string): boolean {
  if (state.phase !== 'drawing') return false;
  const artist = currentArtist(state);
  return artist.memberId === memberId;
}

/**
 * Privacy filter: waiting players get metadata only (no ink).
 * Current artist gets peek-safe previous section + empty current (local draws).
 * Reveal sends full layers.
 *
 * `peekSafeLayers[i]` must be a section-sized PNG where only the bottom peek
 * strip has ink (rest transparent). FoldCanvas shows that strip above the crease
 * in paper space (not as an underlay inside the current section top) without
 * leaking the rest of the previous art.
 */
export function filterFoldStateForMember(
  state: FoldGameState,
  memberId: string,
  peekSafeLayers: (string | null)[],
): FoldGameState {
  if (state.phase === 'reveal') {
    return {
      ...state,
      sectionLayers: [...state.sectionLayers] as (string | null)[],
    };
  }

  const layers: (string | null)[] = [null, null, null, null];
  if (isCurrentFoldArtist(state, memberId) && state.currentSection > 0) {
    const prev = (state.currentSection - 1) as FoldSectionIndex;
    layers[prev] = peekSafeLayers[prev] ?? null;
  }

  return {
    ...state,
    sectionLayers: layers,
  };
}

export function isValidFoldLayerDataUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  if (raw.length < 32 || raw.length > FOLD_LAYER_DATA_URL_MAX) return false;
  return raw.startsWith('data:image/png;base64,') || raw.startsWith('data:image/jpeg;base64,');
}
