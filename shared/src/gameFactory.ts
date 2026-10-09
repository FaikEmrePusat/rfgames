import type { GameConfig, GameState } from './types.js';
import { createMapForConfig } from './mapGenerator.js';
import { createPlayers } from './rules.js';

export function createInitialGame(config: GameConfig): GameState {
  const { grid, islands, bridges, totalLand, cols, rows } = createMapForConfig(
    config.mapSize,
    config.playerCount,
  );

  const players = createPlayers(
    config.playerNames.slice(0, config.playerCount),
    config.memberIds?.slice(0, config.playerCount),
    config.bots?.slice(0, config.playerCount),
  );

  return {
    gridCols: cols,
    gridRows: rows,
    cellSize: 36,
    grid,
    islands,
    bridges,
    players,
    currentPlayerIdx: 0,
    phase: 'roll_order',
    remainingSteps: 0,
    lastDiceRoll: null,
    totalLandTiles: totalLand,
    unclaimedLandTiles: totalLand,
    orderRollsPending: true,
    winnerIds: null,
    log: [`Harita oluşturuldu: ${islands.length} ada, ${totalLand} kara karesi.`],
  };
}

export function startMainGame(state: GameState): void {
  state.phase = 'roll';
  state.orderRollsPending = false;
  state.log.push('Sıra zar ile belirlendi. Oyun başlıyor!');
}
