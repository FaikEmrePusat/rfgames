import type { GameState } from './types.js';
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
  const ok = claimCell(game, r, c, player.id);
  if (!ok) {
    return {
      ok: false,
      toast: 'Burayı fethedemezsiniz! Komşu karelerden veya boş köprülerden ilerleyin.',
    };
  }

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
