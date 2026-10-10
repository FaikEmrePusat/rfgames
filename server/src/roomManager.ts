import type { GameState, MapSize } from '@rfgames/shared';
import {
  createInitialGame,
  forceSkipCurrentTurn,
  performClaim,
  performEndTurn,
  performOrderRoll,
  performTurnRoll,
  performUndo,
  playerIdForMember,
} from '@rfgames/shared';

export interface RoomMember {
  id: string;
  name: string;
  socketId: string;
  connected: boolean;
  disconnectedAt: number | null;
}

export interface Room {
  code: string;
  hostId: string;
  members: RoomMember[];
  maxPlayers: number | 'unlimited';
  mapSize: MapSize;
  game: GameState | null;
  orderRollIndex: number;
  /** Host, game_over sonrası yeniden-oyna ayarlarını düzenliyor */
  rematchConfiguring: boolean;
}

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

export function createRoomState(
  code: string,
  host: RoomMember,
  mapSize: MapSize,
  maxPlayers: number | 'unlimited',
): Room {
  return {
    code,
    hostId: host.id,
    members: [host],
    maxPlayers,
    mapSize,
    game: null,
    orderRollIndex: 0,
    rematchConfiguring: false,
  };
}

export function roomToSession(room: Room, memberId: string) {
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
    mapSize: room.mapSize,
    rematchConfiguring: !!room.rematchConfiguring,
  };
}

function memberToPlayerId(room: Room, memberId: string): number | null {
  if (!room.game) return null;
  return playerIdForMember(room.game, memberId);
}

export function startGame(room: Room): GameState {
  const names = room.members.map((m) => m.name);
  const memberIds = room.members.map((m) => m.id);
  const game = createInitialGame({
    mapSize: room.mapSize,
    playerCount: names.length,
    playerNames: names,
    memberIds,
  });
  room.game = game;
  room.orderRollIndex = 0;
  room.rematchConfiguring = false;
  return game;
}

export function rollOrder(room: Room, memberId: string): { ok: boolean; error?: string; toast?: string } {
  const game = room.game;
  if (!game || game.phase !== 'roll_order') return { ok: false, error: 'Sıra zarı atılamaz' };

  const seatIndex = room.members.findIndex((m) => m.id === memberId);
  if (seatIndex !== room.orderRollIndex) return { ok: false, error: 'Sıra sizde değil' };

  const result = performOrderRoll(game, room.orderRollIndex);
  if (!result.ok) return { ok: false, error: result.error };
  room.orderRollIndex = result.orderRollIndex;
  return { ok: true, toast: result.toast };
}

export function rollTurn(room: Room, memberId: string): { ok: boolean; error?: string } {
  const game = room.game;
  if (!game) return { ok: false, error: 'Oyun yok' };
  const playerId = memberToPlayerId(room, memberId);
  if (playerId === null) return { ok: false, error: 'Sıra sizde değil' };

  return performTurnRoll(game, playerId);
}

export function claimTile(
  room: Room,
  memberId: string,
  r: number,
  c: number,
): { ok: boolean; error?: string; toast?: string } {
  const game = room.game;
  if (!game) return { ok: false, error: 'Oyun yok' };
  const playerId = memberToPlayerId(room, memberId);
  if (playerId === null) return { ok: false, error: 'Sıra sizde değil' };

  const next = cloneState(game);
  const result = performClaim(next, playerId, r, c);
  if (!result.ok) return { ok: false, error: result.error, toast: result.toast };

  room.game = next;
  return { ok: true, toast: result.toast };
}

export function endTurn(room: Room, memberId: string): { ok: boolean; error?: string } {
  const game = room.game;
  if (!game) return { ok: false, error: 'Oyun yok' };
  const playerId = memberToPlayerId(room, memberId);
  if (playerId === null) return { ok: false, error: 'Sıra sizde değil' };

  return performEndTurn(game, playerId);
}

export function undoClaim(room: Room, memberId: string): { ok: boolean; error?: string } {
  const game = room.game;
  if (!game) return { ok: false, error: 'Oyun yok' };
  const playerId = memberToPlayerId(room, memberId);
  if (playerId === null) return { ok: false, error: 'Sıra sizde değil' };

  const next = cloneState(game);
  const result = performUndo(next, playerId);
  if (!result.ok) return { ok: false, error: result.error };

  room.game = next;
  return { ok: true };
}

/** Host, oyun bittikten sonra yeniden-oyna ayar panelini açar. */
export function beginRematchConfig(room: Room, memberId: string): { ok: boolean; error?: string } {
  if (room.hostId !== memberId) return { ok: false, error: 'Yalnızca host ayarlayabilir' };
  if (!room.game || room.game.phase !== 'game_over') {
    return { ok: false, error: 'Ayarlar yalnızca oyun bitince' };
  }
  room.rematchConfiguring = true;
  return { ok: true };
}

/** Host ayar panelinden geri döner (henüz yeni oyun başlamaz). */
export function cancelRematchConfig(room: Room, memberId: string): { ok: boolean; error?: string } {
  if (room.hostId !== memberId) return { ok: false, error: 'Yalnızca host iptal edebilir' };
  room.rematchConfiguring = false;
  return { ok: true };
}

export interface RematchOptions {
  mapSize?: MapSize;
  maxPlayers?: number | 'unlimited';
}

/** Host, oyun bittikten sonra aynı odada yeni harita başlatır (isteğe bağlı ayar güncellemesi). */
export function rematchGame(
  room: Room,
  memberId: string,
  opts?: RematchOptions,
): { ok: boolean; error?: string } {
  if (room.hostId !== memberId) return { ok: false, error: 'Yalnızca host yeniden başlatabilir' };
  if (!room.game || room.game.phase !== 'game_over') {
    return { ok: false, error: 'Yeniden oyna yalnızca oyun bitince' };
  }
  if (room.members.filter((m) => m.connected).length < 2) {
    return { ok: false, error: 'En az 2 bağlı oyuncu gerekli' };
  }

  if (opts?.mapSize) room.mapSize = opts.mapSize;
  if (opts?.maxPlayers !== undefined) {
    const seated = room.members.length;
    if (opts.maxPlayers !== 'unlimited' && opts.maxPlayers < seated) {
      return { ok: false, error: `Kapasite en az ${seated} olmalı` };
    }
    room.maxPlayers = opts.maxPlayers;
  }

  startGame(room);
  return { ok: true };
}

/** Host düşerse sıradaki bağlı üyeye aktar (Kapmaca + Katla-Çiz). */
export function transferHostIfNeeded(room: {
  hostId: string;
  members: RoomMember[];
  rematchConfiguring?: boolean;
}): boolean {
  const host = room.members.find((m) => m.id === room.hostId);
  if (host?.connected) return false;
  const nextHost = room.members.find((m) => m.connected);
  if (!nextHost) return false;
  room.hostId = nextHost.id;
  if ('rematchConfiguring' in room) room.rematchConfiguring = false;
  return true;
}

/** Üye kalıcı olarak çıkınca oyun sırasını kilitlememek. */
export function onMemberRemoved(room: Room, memberId: string): void {
  if (!room.game || room.game.phase === 'game_over') return;
  const pid = playerIdForMember(room.game, memberId);
  if (pid !== null && room.game.currentPlayerIdx === pid) {
    forceSkipCurrentTurn(room.game);
  }
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
