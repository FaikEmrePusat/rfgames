import { useCallback, useRef, useState } from 'react';
import type { FoldGameConfig, FoldGameState } from '@rfgames/shared';
import { completeSection, createFoldGame, setSectionLayer } from '@rfgames/shared';

export function useLocalFoldDraw() {
  const [game, setGame] = useState<FoldGameState | null>(null);
  /** Per-section undo stacks of previous layer data URLs ('' = empty). */
  const historyRef = useRef<Record<number, string[]>>({});
  const lastConfigRef = useRef<FoldGameConfig | null>(null);
  const [undoTick, setUndoTick] = useState(0);

  const startGame = useCallback((config: FoldGameConfig) => {
    lastConfigRef.current = config;
    historyRef.current = {};
    setUndoTick((n) => n + 1);
    setGame(createFoldGame(config));
  }, []);

  const playAgain = useCallback(() => {
    const config = lastConfigRef.current;
    if (!config) return;
    startGame(config);
  }, [startGame]);

  const commitLayer = useCallback((dataUrl: string) => {
    setGame((g) => {
      if (!g || g.phase !== 'drawing') return g;
      const sec = g.currentSection;
      const prev = g.sectionLayers[sec] ?? '';
      const stack = historyRef.current[sec] ?? [];
      historyRef.current[sec] = [...stack, prev];
      return setSectionLayer(g, sec, dataUrl);
    });
    setUndoTick((n) => n + 1);
  }, []);

  const undo = useCallback(() => {
    setGame((g) => {
      if (!g || g.phase !== 'drawing') return g;
      const sec = g.currentSection;
      const stack = historyRef.current[sec] ?? [];
      if (stack.length === 0) return g;
      const prev = stack[stack.length - 1]!;
      historyRef.current[sec] = stack.slice(0, -1);
      return setSectionLayer(g, sec, prev === '' ? null : prev);
    });
    setUndoTick((n) => n + 1);
  }, []);

  const foldAndPass = useCallback(() => {
    setGame((g) => (g ? completeSection(g) : g));
  }, []);

  const leave = useCallback(() => {
    historyRef.current = {};
    setUndoTick((n) => n + 1);
    setGame(null);
  }, []);

  const canUndo =
    !!game &&
    game.phase === 'drawing' &&
    (historyRef.current[game.currentSection]?.length ?? 0) > 0 &&
    undoTick >= 0;

  return { game, startGame, playAgain, commitLayer, undo, foldAndPass, leave, canUndo };
}
