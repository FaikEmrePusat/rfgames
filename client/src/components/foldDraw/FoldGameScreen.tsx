import { useEffect, useMemo, useState } from 'react';
import type { FoldGameState } from '@rfgames/shared';
import {
  FOLD_SECTION_COUNT,
  FOLD_SECTION_LABELS,
  currentArtist,
  foldGameSummary,
  sectionHasInk,
} from '@rfgames/shared';
import { FoldCanvas, type FoldTool } from './FoldCanvas';
import { FoldInkColorPicker } from './FoldInkColorPicker';
import { downloadFoldPaperPng } from './exportFoldPng';
import { FOLD_INK_PRESETS } from './foldRecentColors';
import { PEN_KIND_LABELS, type PenKind } from './penStyles';

const ADVANCED_PEN_KINDS: PenKind[] = ['pencil', 'marker', 'brush', 'charcoal'];

interface Props {
  game: FoldGameState;
  onCommitLayer: (dataUrl: string) => void;
  onUndo: () => void;
  onFold: () => void | Promise<void>;
  onLeave: () => void;
  onNewDrawing: () => void;
  canUndo: boolean;
  /** Online: false while waiting for another player's section. Default true (local). */
  canDraw?: boolean;
  foldBusy?: boolean;
}

export function FoldGameScreen({
  game,
  onCommitLayer,
  onUndo,
  onFold,
  onLeave,
  onNewDrawing,
  canUndo,
  canDraw: canDrawProp,
  foldBusy = false,
}: Props) {
  const [ink, setInk] = useState<string>(FOLD_INK_PRESETS[0]);
  const [width, setWidth] = useState(3.5);
  const [tool, setTool] = useState<FoldTool>('pen');
  const [penKind, setPenKind] = useState<PenKind>('ink');
  const [showMore, setShowMore] = useState(false);
  const [revealSettled, setRevealSettled] = useState(false);
  const artist = currentArtist(game);
  const sectionLabel = FOLD_SECTION_LABELS[game.currentSection];
  const hasInk = sectionHasInk(game);
  const canDraw = game.phase === 'drawing' && (canDrawProp ?? true);
  const isWaiting = game.phase === 'drawing' && !canDraw;
  const foldLabel = game.currentSection === 3 ? 'Aç' : 'Katla';

  const plan = useMemo(
    () =>
      Array.from({ length: FOLD_SECTION_COUNT }, (_, i) => ({
        i,
        done: game.phase === 'reveal' || i < game.currentSection,
        active: game.phase === 'drawing' && i === game.currentSection,
      })),
    [game],
  );

  useEffect(() => {
    const w = window as Window & { render_game_to_text?: () => string };
    w.render_game_to_text = () => foldGameSummary(game);
    return () => {
      delete w.render_game_to_text;
    };
  }, [game]);

  useEffect(() => {
    if (game.phase !== 'reveal') setRevealSettled(false);
  }, [game.phase]);

  return (
    <div className="fold-game-screen">
      {game.phase === 'drawing' && (
        <header className="fold-topbar">
          <div className="fold-progress" aria-label="Katlar">
            {plan.map((p) => (
              <span
                key={p.i}
                className={`fold-dot ${p.active ? 'is-active' : ''} ${p.done ? 'is-done' : ''}`}
                title={FOLD_SECTION_LABELS[p.i as 0 | 1 | 2 | 3]}
              />
            ))}
          </div>
          <p className="fold-topbar-title">
            <span className="fold-topbar-section">{sectionLabel}</span>
            <span className="fold-topbar-sep">·</span>
            <span style={{ color: artist.color }}>{artist.name}</span>
            {isWaiting && <span className="fold-topbar-sep"> · bekleniyor</span>}
          </p>
        </header>
      )}

      <div className="fold-stage">
        {isWaiting ? (
          <div className="fold-wait" role="status">
            <p className="fold-wait__title">Kağıt katlandı</p>
            <p className="fold-wait__body">
              <span style={{ color: artist.color }}>{artist.name}</span>
              {' · '}
              {sectionLabel} çiziyor…
            </p>
            <p className="fold-wait__hint">Sıra sana gelince yalnızca kat izini göreceksin.</p>
          </div>
        ) : (
          <FoldCanvas
            game={game}
            inkColor={ink}
            inkWidth={width}
            tool={tool}
            penKind={penKind}
            canDraw={canDraw}
            onCommitLayer={onCommitLayer}
            onRevealSettled={() => setRevealSettled(true)}
          />
        )}
      </div>

      {canDraw && (
        <footer className="fold-dock">
          {showMore && (
            <div className="fold-more-sheet" role="dialog" aria-label="Daha fazla">
              <div className="fold-more-row" role="group" aria-label="Kalem türü">
                <button
                  type="button"
                  onClick={() => setPenKind('ink')}
                  className={`fold-chip ${penKind === 'ink' ? 'is-on' : ''}`}
                >
                  {PEN_KIND_LABELS.ink}
                </button>
                {ADVANCED_PEN_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPenKind(k)}
                    className={`fold-chip ${penKind === k ? 'is-on' : ''}`}
                  >
                    {PEN_KIND_LABELS[k]}
                  </button>
                ))}
              </div>
              <label className="fold-more-range">
                <span>{tool === 'eraser' ? 'Boyut' : 'Kalınlık'}</span>
                <input
                  type="range"
                  className="fold-range"
                  min={1.5}
                  max={10}
                  step={0.5}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
              </label>
            </div>
          )}

          <div className="fold-dock-row">
            <div className="fold-tool-seg" role="group" aria-label="Araç">
              <button
                type="button"
                onClick={() => setTool('pen')}
                className={`fold-seg-btn ${tool === 'pen' ? 'is-on' : ''}`}
              >
                Kalem
              </button>
              <button
                type="button"
                onClick={() => setTool('eraser')}
                className={`fold-seg-btn ${tool === 'eraser' ? 'is-on' : ''}`}
              >
                Silgi
              </button>
            </div>

            {tool === 'pen' && <FoldInkColorPicker ink={ink} onInkChange={setInk} compact />}

            <button
              type="button"
              className={`fold-icon-btn ${showMore ? 'is-on' : ''}`}
              aria-expanded={showMore}
              aria-label="Daha fazla"
              onClick={() => setShowMore((v) => !v)}
            >
              ···
            </button>

            <button
              type="button"
              className="fold-icon-btn"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Geri al"
              title="Geri al"
            >
              ↶
            </button>

            <button
              type="button"
              className="btn-primary fold-dock-cta"
              onClick={() => void onFold()}
              disabled={!hasInk || foldBusy}
            >
              {foldBusy ? 'Gönderiliyor…' : foldLabel}
            </button>
          </div>
        </footer>
      )}

      {game.phase === 'reveal' && (
        <footer className={`fold-dock fold-dock--reveal ${revealSettled ? 'is-settled' : ''}`}>
          <button
            type="button"
            className="btn-success fold-dock-cta"
            disabled={!revealSettled}
            onClick={() =>
              void downloadFoldPaperPng(
                game,
                `katla-ciz-${new Date().toISOString().slice(0, 10)}.png`,
              )
            }
          >
            İndir
          </button>
          <button
            type="button"
            className="btn-primary fold-dock-cta"
            disabled={!revealSettled}
            onClick={onNewDrawing}
          >
            Yeni
          </button>
          <button
            type="button"
            className="btn-ghost fold-dock-cta"
            disabled={!revealSettled}
            onClick={onLeave}
          >
            Çık
          </button>
        </footer>
      )}
    </div>
  );
}
