import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '@rfgames/shared';
import { BOT_DIFFICULTY_LABELS, chooseBotClaim } from '@rfgames/shared';
import { GameCanvas } from './GameCanvas';
import { PhaseBar } from './PhaseBar';
import { PlayerScoreboard } from './PlayerScoreboard';
import { BridgeList } from './BridgeList';
import { DiceOverlay } from './DiceOverlay';

interface Props {
  game: GameState;
  orderRollIdx: number;
  toast: string | null;
  canInteract: boolean;
  myLabel?: string;
  canUndo?: boolean;
  /** Yeniden oyna — yerel veya online host */
  onPlayAgain?: () => void;
  /** Online: host değilse yeniden oyna bekleniyor */
  rematchWaiting?: boolean;
  onRollOrder: () => number | null | void;
  onRollDice: () => number | null | void;
  onClaim: (r: number, c: number) => void;
  onUndo?: () => void;
  onEndTurn: () => void;
  onLeave: () => void;
}

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

type DiceAnim = {
  label: string;
  playerName: string;
  playerColor: string;
  value: number | null;
};

export function GameScreen({
  game,
  orderRollIdx,
  toast,
  canInteract,
  myLabel,
  canUndo = false,
  onPlayAgain,
  rematchWaiting = false,
  onRollOrder,
  onRollDice,
  onClaim,
  onUndo,
  onEndTurn,
  onLeave,
}: Props) {
  const current = game.players[game.currentPlayerIdx];
  const orderPhase = game.phase === 'roll_order';
  const actingPlayer = orderPhase ? game.players[orderRollIdx] : current;
  const isBotTurn = !!actingPlayer?.isBot;
  const humanCanAct = canInteract && !isBotTurn;
  const isMyTurn = humanCanAct;
  const unclaimedPct =
    game.totalLandTiles > 0
      ? Math.round((game.unclaimedLandTiles / game.totalLandTiles) * 100)
      : 0;

  const [diceAnim, setDiceAnim] = useState<DiceAnim | null>(null);
  const [asideOpen, setAsideOpen] = useState(false);
  const prevLastRoll = useRef(game.lastDiceRoll);
  const prevOrderRolls = useRef(game.players.map((p) => p.orderRoll));
  const pendingKind = useRef<'order' | 'turn' | null>(null);

  const finishDiceAnim = useCallback(() => {
    setDiceAnim(null);
    pendingKind.current = null;
    prevLastRoll.current = game.lastDiceRoll;
    prevOrderRolls.current = game.players.map((p) => p.orderRoll);
  }, [game.lastDiceRoll, game.players]);

  useEffect(() => {
    if (!diceAnim || diceAnim.value != null) return;

    if (pendingKind.current === 'turn' && game.lastDiceRoll != null && game.lastDiceRoll !== prevLastRoll.current) {
      setDiceAnim((d) => (d ? { ...d, value: game.lastDiceRoll! } : null));
      return;
    }

    if (pendingKind.current === 'order') {
      const prev = prevOrderRolls.current;
      for (let i = 0; i < game.players.length; i++) {
        const roll = game.players[i]!.orderRoll;
        if (roll != null && prev[i] !== roll) {
          setDiceAnim((d) => (d ? { ...d, value: roll } : null));
          return;
        }
      }
    }
  }, [game, diceAnim]);

  useEffect(() => {
    if (diceAnim) return;
    if (game.phase === 'game_over') return;

    prevLastRoll.current = game.lastDiceRoll;
    prevOrderRolls.current = game.players.map((p) => p.orderRoll);
  }, [game, diceAnim]);

  const handleRollOrder = useCallback(() => {
    if (diceAnim) return;
    const player = game.players[orderRollIdx];
    if (!player) return;
    pendingKind.current = 'order';
    prevOrderRolls.current = game.players.map((p) => p.orderRoll);
    setDiceAnim({
      label: 'Sıra Zarı',
      playerName: player.name,
      playerColor: player.color,
      value: null,
    });
    const result = onRollOrder();
    if (typeof result === 'number') {
      setDiceAnim((d) => (d ? { ...d, value: result } : null));
    }
  }, [diceAnim, game.players, onRollOrder, orderRollIdx]);

  const handleRollDice = useCallback(() => {
    if (diceAnim) return;
    pendingKind.current = 'turn';
    prevLastRoll.current = game.lastDiceRoll;
    setDiceAnim({
      label: 'Hamle Zarı',
      playerName: current.name,
      playerColor: current.color,
      value: null,
    });
    const result = onRollDice();
    if (typeof result === 'number') {
      setDiceAnim((d) => (d ? { ...d, value: result } : null));
    }
  }, [current.color, current.name, diceAnim, game.lastDiceRoll, onRollDice]);

  useEffect(() => {
    if (!isBotTurn || diceAnim || game.phase === 'game_over') return;

    const difficulty = actingPlayer?.botDifficulty ?? 'medium';
    const thinkMs =
      difficulty === 'easy' ? 450 : difficulty === 'medium' ? 650 : 850;

    const timer = window.setTimeout(() => {
      if (game.phase === 'roll_order') {
        handleRollOrder();
        return;
      }
      if (game.phase === 'roll') {
        handleRollDice();
        return;
      }
      if (game.phase === 'claim' && current) {
        const move = chooseBotClaim(game, current.id, difficulty);
        if (move) onClaim(move.r, move.c);
        else onEndTurn();
        return;
      }
      if (game.phase === 'turn_complete') {
        onEndTurn();
      }
    }, thinkMs);

    return () => window.clearTimeout(timer);
  }, [
    actingPlayer?.botDifficulty,
    current,
    diceAnim,
    game,
    handleRollDice,
    handleRollOrder,
    isBotTurn,
    onClaim,
    onEndTurn,
  ]);

  return (
    <div className="game-layout">
      {toast && (
        <div className="toast-enter fixed top-16 left-1/2 -translate-x-1/2 z-50 parchment-panel px-4 py-2 text-base max-w-sm text-center hand-note -rotate-1">
          {toast}
        </div>
      )}

      {diceAnim && (
        <DiceOverlay
          value={diceAnim.value}
          label={diceAnim.label}
          playerName={diceAnim.playerName}
          playerColor={diceAnim.playerColor}
          onFinished={finishDiceAnim}
        />
      )}

      <div className="game-topbar oak-panel">
        <PhaseBar phase={game.phase} orderPhase={orderPhase} />

        <div className="game-topbar__row">
          <div className="game-topbar__player">
            <div
              className="game-dice-badge"
              style={{
                backgroundColor: `${actingPlayer?.color ?? current.color}28`,
                color: actingPlayer?.color ?? current.color,
              }}
            >
              {orderPhase
                ? game.players[orderRollIdx]?.orderRoll ?? '?'
                : game.lastDiceRoll ?? '·'}
            </div>
            <div className="game-topbar__meta">
              <p className="game-topbar__label">
                {orderPhase ? 'Sıra belirleniyor' : 'Sıradaki'}
              </p>
              <p
                className="game-topbar__name"
                style={{ color: actingPlayer?.color ?? current.color }}
              >
                {actingPlayer?.name ?? current.name}
              </p>
              {isBotTurn && actingPlayer && (
                <p className="game-topbar__note">
                  bot
                  {actingPlayer.botDifficulty
                    ? ` · ${BOT_DIFFICULTY_LABELS[actingPlayer.botDifficulty]}`
                    : ''}
                </p>
              )}
              {myLabel && !orderPhase && !isBotTurn && (
                <p className={`game-topbar__note ${isMyTurn ? 'text-[var(--oxblood)]' : ''}`}>
                  {isMyTurn ? 'sizin sıranız' : 'rakibi bekleyin'}
                </p>
              )}
            </div>
          </div>

          <div className="game-topbar__actions">
            <button
              type="button"
              className={`game-aside-toggle ${asideOpen ? 'is-on' : ''}`}
              onClick={() => setAsideOpen((o) => !o)}
              aria-expanded={asideOpen}
            >
              Durum
            </button>
            {orderPhase && (
              <button
                type="button"
                disabled={
                  !humanCanAct || !!diceAnim || game.players[orderRollIdx]?.orderRoll !== null
                }
                onClick={handleRollOrder}
                className="btn-primary"
              >
                Sıra zarı
              </button>
            )}
            {game.phase === 'roll' && (
              <button
                type="button"
                disabled={!isMyTurn || !!diceAnim}
                onClick={handleRollDice}
                className="btn-primary"
              >
                Zar at
              </button>
            )}
            {game.phase === 'claim' && (
              <div className="game-claim-chip">
                <span className="text-2xl leading-none">
                  {game.lastDiceRoll ? DICE_FACES[game.lastDiceRoll - 1] : '·'}
                </span>
                <div>
                  <p className="game-topbar__label">Kalan</p>
                  <div className="flex gap-0.5 mt-0.5">
                    {Array.from({ length: game.lastDiceRoll ?? 0 }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-2 h-2 border border-[rgba(90,60,30,0.5)] ${
                          i < (game.lastDiceRoll ?? 0) - game.remainingSteps
                            ? 'bg-[var(--forest)]'
                            : 'bg-[var(--oxblood)]'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            {canUndo && onUndo && (game.phase === 'claim' || game.phase === 'turn_complete') && (
              <button
                type="button"
                disabled={!isMyTurn}
                onClick={onUndo}
                className="btn-ghost"
              >
                Geri al
              </button>
            )}
            {game.phase === 'turn_complete' && (
              <button
                type="button"
                disabled={!isMyTurn}
                onClick={onEndTurn}
                className="btn-success"
              >
                Turu bitir
              </button>
            )}
          </div>
        </div>

        <div className="game-progress">
          <div className="game-progress__bar">
            <div
              className="game-progress__fill"
              style={{ width: `${100 - unclaimedPct}%` }}
            />
          </div>
          <span className="game-progress__pct">{100 - unclaimedPct}%</span>
        </div>
      </div>

      <div className="game-body">
        <div className="game-canvas-wrap">
          <GameCanvas
            game={game}
            onClaim={onClaim}
            highlightValid={isMyTurn && game.phase === 'claim' && !diceAnim}
          />
        </div>

        <aside className={`game-aside ${asideOpen ? 'is-open' : ''}`}>
          {asideOpen && (
            <button
              type="button"
              className="game-aside-toggle is-on self-end mb-1 md:hidden"
              onClick={() => setAsideOpen(false)}
            >
              Kapat
            </button>
          )}
          <div className="oak-panel game-aside__panel">
            <h3 className="hand-title">Fetih</h3>
            <PlayerScoreboard
              players={game.players}
              totalLand={game.totalLandTiles}
              currentPlayerId={current.id}
            />
          </div>

          <div className="oak-panel game-aside__panel">
            <BridgeList bridges={game.bridges} />
          </div>

          <div className="oak-panel game-aside__panel flex-1 min-h-0 flex flex-col">
            <h3 className="hand-title">Günlük</h3>
            <div className="game-aside__log">
              {[...game.log].reverse().map((line, i) => (
                <div key={i} className="game-aside__log-line">
                  {line}
                </div>
              ))}
            </div>
          </div>

          <button type="button" onClick={onLeave} className="btn-ghost w-full text-base py-1.5">
            ← menü
          </button>
        </aside>
      </div>

      {game.phase === 'game_over' && game.winnerIds && (
        <div className="game-end-overlay">
          <div className="parchment-panel game-end-panel">
            <h3 className="hand-title text-4xl mb-1">Sefer bitti</h3>
            <div className="ornament-line my-2 max-w-[7rem] mx-auto" />
            <p className="hand-note text-lg mb-4">
              {game.winnerIds.length > 1
                ? 'Beraberlik — topraklar paylaşıldı!'
                : `${game.players.find((p) => p.id === game.winnerIds![0])?.name} zafer kazandı!`}
            </p>
            <div className="text-left mb-2">
              <PlayerScoreboard
                players={game.players}
                totalLand={game.totalLandTiles}
                currentPlayerId={-1}
              />
            </div>
            <div className="game-end-actions">
              {onPlayAgain && (
                <button type="button" onClick={onPlayAgain} className="btn-primary">
                  Yeniden oyna
                </button>
              )}
              {rematchWaiting && !onPlayAgain && (
                <p className="hand-note text-base mb-0">Host yeniden başlatacak…</p>
              )}
              <button type="button" onClick={onLeave} className="btn-ghost">
                Ana menüye dön
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
