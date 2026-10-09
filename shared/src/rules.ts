import type { Bridge, Cell, GameState, GridPos, Player, BotDifficulty } from './types.js';
import { PLAYER_COLORS } from './types.js';

export interface ValidMove extends GridPos {
  isBridgeTarget: boolean;
}

export function getPlayerCells(grid: (Cell | null)[][], playerId: number): GridPos[] {
  const cells: GridPos[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell && cell.owner === playerId) cells.push({ r, c });
    }
  }
  return cells;
}

export function getValidMoves(
  grid: (Cell | null)[][],
  bridges: Bridge[],
  rows: number,
  cols: number,
  playerId: number,
): ValidMove[] {
  const valid: ValidMove[] = [];
  const playerCells = getPlayerCells(grid, playerId);

  if (playerCells.length === 0) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (cell?.isLand && cell.owner === null) {
          valid.push({ r, c, isBridgeTarget: false });
        }
      }
    }
    return valid;
  }

  const visited = new Set<string>();

  const tryAdd = (r: number, c: number, isBridgeTarget: boolean) => {
    const key = `${r},${c}`;
    if (visited.has(key)) return;
    visited.add(key);
    valid.push({ r, c, isBridgeTarget });
  };

  for (const pc of playerCells) {
    for (const n of [
      { r: pc.r - 1, c: pc.c },
      { r: pc.r + 1, c: pc.c },
      { r: pc.r, c: pc.c - 1 },
      { r: pc.r, c: pc.c + 1 },
    ]) {
      if (n.r < 0 || n.r >= rows || n.c < 0 || n.c >= cols) continue;
      const cell = grid[n.r][n.c];
      if (cell?.isLand && cell.owner === null) tryAdd(n.r, n.c, false);
    }
  }

  for (const bridge of bridges) {
    const cellA = grid[bridge.cellA.r][bridge.cellA.c]!;
    const cellB = grid[bridge.cellB.r][bridge.cellB.c]!;

    if (cellA.owner === playerId && cellB.owner === null) {
      tryAdd(bridge.cellB.r, bridge.cellB.c, true);
    }
    if (cellB.owner === playerId && cellA.owner === null) {
      tryAdd(bridge.cellA.r, bridge.cellA.c, true);
    }
  }

  return valid;
}

export function claimCell(state: GameState, r: number, c: number, playerId: number): boolean {
  const valid = getValidMoves(state.grid, state.bridges, state.gridRows, state.gridCols, playerId);
  if (!valid.some((m) => m.r === r && m.c === c)) return false;

  const cell = state.grid[r][c];
  if (!cell || cell.owner !== null) return false;

  cell.owner = playerId;
  const player = state.players.find((p) => p.id === playerId);
  if (player) player.score += 1;
  state.unclaimedLandTiles -= 1;
  state.remainingSteps -= 1;
  return true;
}

function floodReachableEmpty(
  grid: (Cell | null)[][],
  bridges: Bridge[],
  rows: number,
  cols: number,
  startMoves: ValidMove[],
): Set<string> {
  const reachable = new Set<string>();
  const queue = [...startMoves];
  queue.forEach((m) => reachable.add(`${m.r},${m.c}`));

  while (queue.length > 0) {
    const curr = queue.shift()!;

    for (const n of [
      { r: curr.r - 1, c: curr.c },
      { r: curr.r + 1, c: curr.c },
      { r: curr.r, c: curr.c - 1 },
      { r: curr.r, c: curr.c + 1 },
    ]) {
      if (n.r < 0 || n.r >= rows || n.c < 0 || n.c >= cols) continue;
      const cell = grid[n.r][n.c];
      if (cell?.isLand && cell.owner === null) {
        const nKey = `${n.r},${n.c}`;
        if (!reachable.has(nKey)) {
          reachable.add(nKey);
          queue.push({ r: n.r, c: n.c, isBridgeTarget: false });
        }
      }
    }

    for (const bridge of bridges) {
      if (bridge.cellA.r === curr.r && bridge.cellA.c === curr.c) {
        const bCell = grid[bridge.cellB.r][bridge.cellB.c];
        if (bCell?.owner === null) {
          const bKey = `${bridge.cellB.r},${bridge.cellB.c}`;
          if (!reachable.has(bKey)) {
            reachable.add(bKey);
            queue.push({ r: bridge.cellB.r, c: bridge.cellB.c, isBridgeTarget: true });
          }
        }
      }
      if (bridge.cellB.r === curr.r && bridge.cellB.c === curr.c) {
        const aCell = grid[bridge.cellA.r][bridge.cellA.c];
        if (aCell?.owner === null) {
          const aKey = `${bridge.cellA.r},${bridge.cellA.c}`;
          if (!reachable.has(aKey)) {
            reachable.add(aKey);
            queue.push({ r: bridge.cellA.r, c: bridge.cellA.c, isBridgeTarget: true });
          }
        }
      }
    }
  }

  return reachable;
}

export function autoFillIsolatedTerritories(state: GameState): number {
  let totalFilled = 0;
  let filledInLoop = 0;

  do {
    filledInLoop = 0;
    const reachabilityMap = new Map<string, Set<number>>();

    for (let r = 0; r < state.gridRows; r++) {
      for (let c = 0; c < state.gridCols; c++) {
        const cell = state.grid[r][c];
        if (cell?.isLand && cell.owner === null) {
          reachabilityMap.set(`${r},${c}`, new Set());
        }
      }
    }

    if (reachabilityMap.size === 0) break;

    for (const player of state.players) {
      const validMoves = getValidMoves(
        state.grid,
        state.bridges,
        state.gridRows,
        state.gridCols,
        player.id,
      );
      const reachable = floodReachableEmpty(
        state.grid,
        state.bridges,
        state.gridRows,
        state.gridCols,
        validMoves,
      );

      reachable.forEach((key) => {
        if (reachabilityMap.has(key)) {
          reachabilityMap.get(key)!.add(player.id);
        }
      });
    }

    reachabilityMap.forEach((players, key) => {
      if (players.size !== 1) return;
      const soleId = [...players][0];
      const [rStr, cStr] = key.split(',');
      const r = parseInt(rStr, 10);
      const c = parseInt(cStr, 10);
      const cell = state.grid[r][c];
      if (cell && cell.owner === null) {
        cell.owner = soleId;
        const owner = state.players.find((p) => p.id === soleId);
        if (owner) owner.score += 1;
        state.unclaimedLandTiles -= 1;
        filledInLoop++;
      }
    });

    totalFilled += filledInLoop;
  } while (filledInLoop > 0);

  return totalFilled;
}

export function anyPlayerCanMove(state: GameState): boolean {
  for (const player of state.players) {
    const moves = getValidMoves(
      state.grid,
      state.bridges,
      state.gridRows,
      state.gridCols,
      player.id,
    );
    if (moves.length > 0) return true;
  }
  return false;
}

export function checkVictory(state: GameState): number[] | null {
  if (state.unclaimedLandTiles > 0 && anyPlayerCanMove(state)) return null;

  if (state.unclaimedLandTiles > 0) {
    autoFillIsolatedTerritories(state);
  }

  if (state.unclaimedLandTiles > 0 && anyPlayerCanMove(state)) return null;

  const maxScore = Math.max(...state.players.map((p) => p.score));
  return state.players.filter((p) => p.score === maxScore).map((p) => p.id);
}

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function advanceToNextPlayer(state: GameState): void {
  state.currentPlayerIdx = (state.currentPlayerIdx + 1) % state.players.length;
  state.phase = 'roll';
  state.remainingSteps = 0;
  state.lastDiceRoll = null;
}

export function applyDiceRoll(state: GameState, roll: number): void {
  state.lastDiceRoll = roll;
  state.remainingSteps = roll;
  state.phase = 'claim';
}

export function createPlayers(
  names: string[],
  memberIds?: string[],
  bots?: { isBot?: boolean; botDifficulty?: BotDifficulty }[],
): Player[] {
  return names.map((name, i) => {
    const bot = bots?.[i];
    const isBot = !!bot?.isBot;
    return {
      id: i,
      name: name.trim() || (isBot ? `Bot ${i + 1}` : `${i + 1}. Oyuncu`),
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      score: 0,
      orderRoll: null,
      memberId: memberIds?.[i],
      isBot,
      botDifficulty: isBot ? bot?.botDifficulty ?? 'medium' : undefined,
    };
  });
}

export function allOrderRollsDone(players: Player[]): boolean {
  return players.every((p) => p.orderRoll !== null);
}

export function resolveTurnOrder(players: Player[]): Player[] {
  const sorted = [...players].sort((a, b) => (b.orderRoll ?? 0) - (a.orderRoll ?? 0));
  return sorted.map((p, i) => ({ ...p, id: i }));
}

export function playerIdForMember(game: GameState, memberId: string): number | null {
  const p = game.players.find((pl) => pl.memberId === memberId);
  return p ? p.id : null;
}

export function needsOrderReroll(players: Player[]): boolean {
  const rolls = players.map((p) => p.orderRoll ?? 0);
  return new Set(rolls).size !== rolls.length;
}
