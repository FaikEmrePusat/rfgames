export type MapSize = 'small' | 'medium' | 'large';
export type GameMode = 'local' | 'online';
export type TurnPhase = 'roll_order' | 'roll' | 'claim' | 'turn_complete' | 'game_over';
export type BotDifficulty = 'easy' | 'medium' | 'hard';

export const BOT_DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  easy: 'Kolay',
  medium: 'Orta',
  hard: 'Zor',
};

export interface GridPos {
  r: number;
  c: number;
}

export interface Cell {
  isLand: boolean;
  islandId: number;
  owner: number | null;
  r: number;
  c: number;
}

export interface Island {
  id: number;
  name: string;
  cells: GridPos[];
}

export interface Bridge {
  fromIsland: number;
  toIsland: number;
  cellA: GridPos;
  cellB: GridPos;
  dist: number;
}

export interface Player {
  id: number;
  name: string;
  color: string;
  score: number;
  orderRoll: number | null;
  /** Online odada stabil oyuncu kimliği */
  memberId?: string;
  isBot?: boolean;
  botDifficulty?: BotDifficulty;
}

export interface PlayerBotConfig {
  isBot: boolean;
  botDifficulty?: BotDifficulty;
}

export interface GameConfig {
  mapSize: MapSize;
  playerCount: number;
  playerNames: string[];
  memberIds?: string[];
  /** Yerel botlar — playerNames ile aynı sırada */
  bots?: PlayerBotConfig[];
}

/** Bir fetih hamlesinden önce kaydedilen tur içi geri-al anlığı. */
export interface TurnUndoSnapshot {
  owners: Array<{ r: number; c: number; owner: number | null }>;
  scores: number[];
  unclaimedLandTiles: number;
  remainingSteps: number;
  phase: TurnPhase;
  winnerIds: number[] | null;
  logLength: number;
}

export interface GameState {
  gridCols: number;
  gridRows: number;
  cellSize: number;
  grid: (Cell | null)[][];
  islands: Island[];
  bridges: Bridge[];
  players: Player[];
  currentPlayerIdx: number;
  phase: TurnPhase;
  remainingSteps: number;
  lastDiceRoll: number | null;
  totalLandTiles: number;
  unclaimedLandTiles: number;
  orderRollsPending: boolean;
  winnerIds: number[] | null;
  log: string[];
  /** Bu turda yapılan fetihler; tur bitince temizlenir. */
  turnUndoStack: TurnUndoSnapshot[];
}

export const PLAYER_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#eab308',
  '#a855f7',
  '#f97316',
];

export const MAP_SIZE_LABELS: Record<MapSize, string> = {
  small: 'Küçük',
  medium: 'Orta',
  large: 'Büyük',
};
