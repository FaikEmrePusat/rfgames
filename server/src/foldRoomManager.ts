import {
  completeSection,
  createFoldGameOnline,
  filterFoldStateForMember,
  isCurrentFoldArtist,
  setSectionLayer,
  type FoldGameState,
  type FoldSectionIndex,
} from '@rfgames/shared';
import type { RoomMember } from './roomManager.js';
import { generateRoomCode, transferHostIfNeeded } from './roomManager.js';

export type FoldMaxPlayers = 2 | 3 | 4;

export interface FoldRoom {
  code: string;
  hostId: string;
  members: RoomMember[];
  maxPlayers: FoldMaxPlayers;
  game: FoldGameState | null;
  /** Privacy-safe section layers (peek strip only) for next artist. */
  peekSafeLayers: (string | null)[];
}

export function createFoldRoomState(
  code: string,
  host: RoomMember,
  maxPlayers: FoldMaxPlayers,
): FoldRoom {
  return {
    code,
    hostId: host.id,
    members: [host],
    maxPlayers,
    game: null,
    peekSafeLayers: [null, null, null, null],
  };
}

export function foldRoomToSession(room: FoldRoom, memberId: string) {
  return {
    roomCode: room.code,
    memberId,
    isHost: memberId === room.hostId,
    waiting: room.game === null,
    members: room.members.map((m) => ({
      name: m.name,
      id: m.id,
      connected: m.connected,
    })),
    maxPlayers: room.maxPlayers,
    gameId: 'fold' as const,
  };
}

export function startFoldGame(room: FoldRoom): FoldGameState {
  const seeds = room.members.map((m) => ({
    memberId: m.id,
    name: m.name,
  }));
  const game = createFoldGameOnline(seeds);
  room.game = game;
  room.peekSafeLayers = [null, null, null, null];
  return game;
}

/** Host, reveal sonrası aynı odada yeni kağıt başlatır. */
export function rematchFoldGame(
  room: FoldRoom,
  memberId: string,
): { ok: boolean; error?: string } {
  if (room.hostId !== memberId) {
    return { ok: false, error: 'Yalnızca host yeniden başlatabilir' };
  }
  if (!room.game || room.game.phase !== 'reveal') {
    return { ok: false, error: 'Yeniden oyna yalnızca açılıştan sonra' };
  }
  if (room.members.filter((m) => m.connected).length < 2) {
    return { ok: false, error: 'En az 2 bağlı oyuncu gerekli' };
  }

  startFoldGame(room);
  return { ok: true };
}

export function submitFoldSection(
  room: FoldRoom,
  memberId: string,
  layerDataUrl: string,
  peekSafeDataUrl: string,
): { ok: boolean; error?: string } {
  const game = room.game;
  if (!game || game.phase !== 'drawing') {
    return { ok: false, error: 'Oyun çizim aşamasında değil' };
  }
  if (!isCurrentFoldArtist(game, memberId)) {
    return { ok: false, error: 'Sıra sizde değil' };
  }

  const section = game.currentSection as FoldSectionIndex;
  let next = setSectionLayer(game, section, layerDataUrl);
  const peekSafe = [...room.peekSafeLayers] as (string | null)[];
  peekSafe[section] = peekSafeDataUrl;
  room.peekSafeLayers = peekSafe;
  next = completeSection(next);
  room.game = next;
  return { ok: true };
}

export function filteredFoldState(room: FoldRoom, memberId: string): FoldGameState | null {
  if (!room.game) return null;
  return filterFoldStateForMember(room.game, memberId, room.peekSafeLayers);
}

export function onFoldMemberRemoved(room: FoldRoom, memberId: string): void {
  if (!room.game || room.game.phase === 'reveal') return;
  // If current artist leaves permanently, advance so the room isn't stuck.
  if (!isCurrentFoldArtist(room.game, memberId)) return;
  room.game = completeSection(room.game);
}

export { generateRoomCode, transferHostIfNeeded };
