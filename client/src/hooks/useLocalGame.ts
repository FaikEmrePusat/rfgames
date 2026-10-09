import { useCallback, useRef, useState } from 'react';
import type { GameConfig, GameState } from '@rfgames/shared';
import {
  canUndoTurn,
  createInitialGame,
  performClaim,
  performEndTurn,
  performOrderRoll,
  performTurnRoll,
  performUndo,
} from '@rfgames/shared';

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

export function useLocalGame() {
  const [game, setGame] = useState<GameState | null>(null);
  const [orderRollIdx, setOrderRollIdx] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastConfigRef = useRef<GameConfig | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 2800);
  }, []);

  const startGame = useCallback((config: GameConfig) => {
    lastConfigRef.current = config;
    const initial = createInitialGame(config);
    setGame(initial);
    setOrderRollIdx(0);
  }, []);

  const playAgain = useCallback(() => {
    const config = lastConfigRef.current;
    if (!config) return;
    startGame(config);
  }, [startGame]);

  const rollOrderDice = useCallback((): number | null => {
    if (!game || game.phase !== 'roll_order') return null;
    const next = cloneState(game);
    const result = performOrderRoll(next, orderRollIdx);
    if (!result.ok) return null;
    if (result.toast) showToast(result.toast);
    setOrderRollIdx(result.orderRollIndex);
    setGame(next);
    return result.roll ?? null;
  }, [game, orderRollIdx, showToast]);

  const rollTurnDice = useCallback((): number | null => {
    if (!game || game.phase !== 'roll') return null;
    const next = cloneState(game);
    const acting = next.currentPlayerIdx;
    const result = performTurnRoll(next, acting);
    if (!result.ok) return null;
    setGame(next);
    return result.roll ?? null;
  }, [game]);

  const claimTile = useCallback(
    (r: number, c: number) => {
      if (!game) return;
      const next = cloneState(game);
      const result = performClaim(next, next.currentPlayerIdx, r, c);
      if (!result.ok) {
        if (result.toast) showToast(result.toast);
        return;
      }
      if (result.toast) showToast(result.toast);
      setGame(next);
    },
    [game, showToast],
  );

  const undoClaim = useCallback(() => {
    if (!game || !canUndoTurn(game, game.currentPlayerIdx)) return;
    const next = cloneState(game);
    const result = performUndo(next, next.currentPlayerIdx);
    if (!result.ok) return;
    setGame(next);
  }, [game]);

  const endTurn = useCallback(() => {
    if (!game) return;
    const next = cloneState(game);
    const result = performEndTurn(next, next.currentPlayerIdx);
    if (!result.ok) return;
    setGame(next);
  }, [game]);

  const leaveGame = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setGame(null);
    setOrderRollIdx(0);
    setToast(null);
    lastConfigRef.current = null;
  }, []);

  const canUndo = !!game && canUndoTurn(game, game.currentPlayerIdx);

  return {
    game,
    orderRollIdx,
    toast,
    startGame,
    playAgain,
    rollOrderDice,
    rollTurnDice,
    claimTile,
    undoClaim,
    endTurn,
    leaveGame,
    canUndo,
    setGame,
  };
}
