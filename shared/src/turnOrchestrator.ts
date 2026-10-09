import type { GameState, TurnUndoSnapshot } from './types.js';
import {
  advanceToNextPlayer,
  applyDiceRoll,
  autoFillIsolatedTerritories,
  checkVictory,
  claimCell,
  needsOrderReroll,
  resolveTurnOrder,
  rollDice,
} from './rules.js';
import { startMainGame } from './gameFactory.js';

export type TurnActionResult = {
  ok: boolean;
  error?: string;
  toast?: string;
  roll?: number;
};

function ensureUndoStack(game: GameState): TurnUndoSnapshot[] {
  if (!game.turnUndoStack) game.turnUndoStack = [];
  return game.turnUndoStack;
}

function captureTurnUndoSnapshot(game: GameState): TurnUndoSnapshot {
  const owners: TurnUndoSnapshot['owners'] = [];
  for (let r = 0; r < game.gridRows; r++) {
    for (let c = 0; c < game.gridCols; c++) {
      const cell = game.grid[r][c];
      if (cell?.isLand) owners.push({ r, c, owner: cell.owner });
    }
  }
  return {
    owners,
    scores: game.players.map((p) => p.score),
    unclaimedLandTiles: game.unclaimedLandTiles,
    remainingSteps: game.remainingSteps,
    phase: game.phase,
    winnerIds: game.winnerIds ? [...game.winnerIds] : null,
    logLength: game.log.length,
  };
}

function applyTurnUndoSnapshot(game: GameState, snap: TurnUndoSnapshot): void {
  for (const { r, c, owner } of snap.owners) {
    const cell = game.grid[r]?.[c];
    if (cell) cell.owner = owner;
  }
  game.players.forEach((p, i) => {
    p.score = snap.scores[i] ?? p.score;
  });
  game.unclaimedLandTiles = snap.unclaimedLandTiles;
  game.remainingSteps = snap.remainingSteps;
  game.phase = snap.phase;
  game.winnerIds = snap.winnerIds ? [...snap.winnerIds] : null;
  if (game.log.length > snap.logLength) {
    game.log.length = snap.logLength;
  }
}

export function canUndoTurn(game: GameState, actingPlayerId?: number): boolean {
  const stack = ensureUndoStack(game);
  if (stack.length === 0) return false;
  if (
    game.phase !== 'claim' &&
    game.phase !== 'turn_complete' &&
    game.phase !== 'game_over'
  ) {
    return false;
  }
  if (actingPlayerId !== undefined && game.currentPlayerIdx !== actingPlayerId) return false;
  return true;
}

/** Sıra zarını atar; `orderRollIndex` güncellenmiş indeks döner. */
export function performOrderRoll(
  game: GameState,
  orderRollIndex: number,
): TurnActionResult & { orderRollIndex: number } {
  if (game.phase !== 'roll_order') {
    return { ok: false, error: 'Sıra zarı atılamaz', orderRollIndex };
  }

  const player = game.players[orderRollIndex];
  if (!player || player.orderRoll !== null) {
    return { ok: false, error: 'Zaten attınız', orderRollIndex };
  }

  const roll = rollDice();
  player.orderRoll = roll;
  game.log.push(`${player.name} sıra zarı: ${roll}`);

  if (orderRollIndex < game.players.length - 1) {
    return { ok: true, roll, orderRollIndex: orderRollIndex + 1 };
  }

  if (needsOrderReroll(game.players)) {
    game.players.forEach((p) => {
      p.orderRoll = null;
    });
    game.log.push('Beraberlik! Sıra zarı tekrar atılıyor.');
    return { ok: true, roll, orderRollIndex: 0, toast: 'Beraberlik — tekrar atılıyor' };
  }

  game.players = resolveTurnOrder(game.players);
  game.currentPlayerIdx = 0;
  startMainGame(game);
  return { ok: true, roll, orderRollIndex: 0 };
}

/** Ana oyun zarı — sıradaki oyuncu için. */
export function performTurnRoll(game: GameState, actingPlayerId: number): TurnActionResult {
  if (game.phase !== 'roll') return { ok: false, error: 'Zar atılamaz' };
  if (game.currentPlayerIdx !== actingPlayerId) return { ok: false, error: 'Sıra sizde değil' };

  const roll = rollDice();
  applyDiceRoll(game, roll);
  const player = game.players[actingPlayerId];
  game.log.push(`${player.name} zarda ${roll} attı.`);

  if (game.remainingSteps === 0) {
    advanceToNextPlayer(game);
  }

  return { ok: true, roll };
}

/** Kare fethi + otomatik doldurma + zafer kontrolü. */
export function performClaim(
  game: GameState,
  actingPlayerId: number,
  r: number,
  c: number,
): TurnActionResult {
  if (game.phase !== 'claim' || game.remainingSteps <= 0) {
    return { ok: false, error: 'Hamle yapılamaz' };
  }
  if (game.currentPlayerIdx !== actingPlayerId) return { ok: false, error: 'Sıra sizde değil' };

  const player = game.players[actingPlayerId];
  const stack = ensureUndoStack(game);
  const snapshot = captureTurnUndoSnapshot(game);

  const ok = claimCell(game, r, c, player.id);
  if (!ok) {
    return {
      ok: false,
      toast: 'Burayı fethedemezsiniz! Komşu karelerden veya boş köprülerden ilerleyin.',
    };
  }

  stack.push(snapshot);

  const filled = autoFillIsolatedTerritories(game);
  if (filled > 0) {
    game.log.push(`🔒 ${player.name} ${filled} kareyi otomatik fethetti.`);
  }

  const winners = checkVictory(game);
  if (winners) {
    game.winnerIds = winners;
    game.phase = 'game_over';
    game.log.push('Oyun bitti!');
  } else if (game.remainingSteps <= 0) {
    game.phase = 'turn_complete';
  }

  return {
    ok: true,
    toast: filled > 0 ? `🔒 ${player.name} ${filled} kareyi otomatik fethetti!` : undefined,
  };
}

/** Bu turdaki son fethi geri al (Turu bitir öncesi). */
export function performUndo(game: GameState, actingPlayerId: number): TurnActionResult {
  if (game.currentPlayerIdx !== actingPlayerId) return { ok: false, error: 'Sıra sizde değil' };
  if (!canUndoTurn(game, actingPlayerId)) {
    return { ok: false, error: 'Geri alınacak hamle yok' };
  }

  const stack = ensureUndoStack(game);
  const snap = stack.pop();
  if (!snap) return { ok: false, error: 'Geri alınacak hamle yok' };

  applyTurnUndoSnapshot(game, snap);
  return { ok: true };
}

/** Turu bitir ve gerekirse zafer kontrolü. */
export function performEndTurn(game: GameState, actingPlayerId: number): TurnActionResult {
  if (game.currentPlayerIdx !== actingPlayerId) return { ok: false, error: 'Sıra sizde değil' };

  advanceToNextPlayer(game);
  const winners = checkVictory(game);
  if (winners) {
    game.winnerIds = winners;
    game.phase = 'game_over';
  }

  return { ok: true };
}

/** Bağlantı kopunca sırayı kilitlememek için turu atla. */
export function forceSkipCurrentTurn(game: GameState): void {
  if (game.phase === 'game_over' || game.phase === 'roll_order') return;
  advanceToNextPlayer(game);
  const winners = checkVictory(game);
  if (winners) {
    game.winnerIds = winners;
    game.phase = 'game_over';
  }
}
