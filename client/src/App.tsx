import { useEffect, useState } from 'react';
import { HubScreen } from './components/HubScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { GameScreen } from './components/GameScreen';
import { RematchSettingsPanel } from './components/RematchSettingsPanel';
import { FoldLobby } from './components/foldDraw/FoldLobby';
import { FoldGameScreen } from './components/foldDraw/FoldGameScreen';
import { useLocalGame } from './hooks/useLocalGame';
import { useOnlineGame } from './hooks/useOnlineGame';
import { useLocalFoldDraw } from './hooks/useLocalFoldDraw';
import { useOnlineFoldDraw } from './hooks/useOnlineFoldDraw';
import { ThemePicker } from './theme/ThemePicker';
import { useTheme } from './theme/useTheme';

type AppMode = 'hub' | 'kapmaca' | 'fold';

export default function App() {
  const [mode, setMode] = useState<AppMode>('hub');
  const [localRematchOpen, setLocalRematchOpen] = useState(false);
  const [onlineRematchOpen, setOnlineRematchOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const local = useLocalGame();
  const online = useOnlineGame();
  const fold = useLocalFoldDraw();
  const foldOnline = useOnlineFoldDraw();

  useEffect(() => {
    if (!local.game || local.game.phase !== 'game_over') setLocalRematchOpen(false);
  }, [local.game]);

  useEffect(() => {
    if (!online.game || online.game.phase !== 'game_over') setOnlineRematchOpen(false);
  }, [online.game]);

  const inLocalGame = local.game !== null;
  const inOnlineGame = online.game !== null;
  const inOnlineLobby = online.session !== null && !inOnlineGame;
  const inFoldLocalGame = fold.game !== null;
  const inFoldOnlineGame = foldOnline.game !== null;
  const inFoldOnlineLobby = foldOnline.session !== null && !inFoldOnlineGame;
  const inFoldGame = inFoldLocalGame || inFoldOnlineGame;
  const inKapmaca = mode === 'kapmaca' && (inLocalGame || inOnlineGame || inOnlineLobby);
  const inFoldLobby =
    mode === 'fold' && !inFoldGame && !inFoldOnlineLobby;

  const canReturnHome =
    mode !== 'hub' ||
    inLocalGame ||
    inOnlineGame ||
    inOnlineLobby ||
    inFoldGame ||
    inFoldOnlineLobby;

  const goHub = () => {
    if (inLocalGame) local.leaveGame();
    if (inOnlineGame || inOnlineLobby) online.leave();
    if (inFoldLocalGame) fold.leave();
    if (inFoldOnlineGame || inFoldOnlineLobby) foldOnline.leave();
    setLocalRematchOpen(false);
    setOnlineRematchOpen(false);
    setMode('hub');
  };

  const goKapmacaLobby = () => {
    fold.leave();
    foldOnline.leave();
    setMode('kapmaca');
  };

  const headerTitle =
    mode === 'fold' || inFoldGame || inFoldOnlineLobby
      ? 'Katla-Çiz'
      : mode === 'kapmaca' || inKapmaca
        ? 'Kare Kapmaca'
        : 'RF Games';

  const foldSeal =
    mode === 'fold' && foldOnline.session ? foldOnline.session.roomCode : null;

  return (
    <div className="app-shell">
      <header className="site-header sticky top-0 z-40">
        <div className="site-header__inner">
          <div className="min-w-0">
            {canReturnHome ? (
              <button
                type="button"
                onClick={goHub}
                className="site-header__brand text-left"
                title="Oyun seçimine dön"
              >
                <h1 className="hand-title truncate">{headerTitle}</h1>
                <p className="hand-note">← masa</p>
              </button>
            ) : (
              <h1 className="hand-title truncate">{headerTitle}</h1>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemePicker theme={theme} onChange={setTheme} variant="menu" />
            {canReturnHome && (
              <button type="button" onClick={goHub} className="btn-ghost">
                Çık
              </button>
            )}
            {online.session && mode === 'kapmaca' && (
              <div className="header-seal">
                <span className="header-seal__label">kod</span>
                <span className="header-seal__code">{online.session.roomCode}</span>
              </div>
            )}
            {foldSeal && (
              <div className="header-seal">
                <span className="header-seal__label">kod</span>
                <span className="header-seal__code">{foldSeal}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {mode === 'hub' && (
          <HubScreen
            onPickKapmaca={goKapmacaLobby}
            onPickFoldDraw={() => {
              local.leaveGame();
              online.leave();
              foldOnline.leave();
              setMode('fold');
            }}
          />
        )}

        {mode === 'fold' && inFoldLocalGame && fold.game && (
          <FoldGameScreen
            game={fold.game}
            onCommitLayer={fold.commitLayer}
            onUndo={fold.undo}
            onFold={fold.foldAndPass}
            onLeave={goHub}
            onNewDrawing={fold.playAgain}
            canUndo={fold.canUndo}
          />
        )}

        {mode === 'fold' && inFoldOnlineGame && foldOnline.game && foldOnline.session && (
          <FoldGameScreen
            game={foldOnline.game}
            onCommitLayer={foldOnline.commitLayer}
            onUndo={foldOnline.undo}
            onFold={foldOnline.foldAndPass}
            onLeave={goHub}
            onNewDrawing={
              foldOnline.session.isHost ? foldOnline.rematch : undefined
            }
            rematchWaiting={!foldOnline.session.isHost}
            canUndo={foldOnline.canUndo}
            canDraw={foldOnline.isMyTurn}
            foldBusy={foldOnline.submitting}
          />
        )}

        {mode === 'fold' && inFoldOnlineLobby && foldOnline.session && (
          <div className="lobby-shell">
            <div className="lobby-panel">
              <div className="lobby-panel__scroll">
                <button type="button" onClick={foldOnline.leave} className="lobby-back">
                  ← vazgeç
                </button>
                <h2 className="lobby-heading">
                  {foldOnline.session.isHost ? 'Oyuncular bekleniyor' : 'Lobide bekleniyor'}
                </h2>
                <p className="lobby-sub">Bu mührü arkadaşlarınla paylaş</p>
                <div className="lobby-online-code">{foldOnline.session.roomCode}</div>
                <ul className="lobby-members">
                  {foldOnline.session.members.map((m) => (
                    <li key={m.id}>
                      — {m.name}
                      {m.connected === false ? ' (bağlantı yok)' : ''}
                    </li>
                  ))}
                </ul>
                {foldOnline.error && <p className="lobby-error">{foldOnline.error}</p>}
                {!foldOnline.session.isHost && (
                  <p className="lobby-hint">Host oyunu başlatacak…</p>
                )}
              </div>
              <div className="lobby-panel__footer">
                {foldOnline.session.isHost ? (
                  <button
                    type="button"
                    onClick={foldOnline.startOnlineGame}
                    disabled={foldOnline.session.members.length < 2}
                    className="btn-primary"
                  >
                    Oyunu başlat · {foldOnline.session.members.length}
                  </button>
                ) : (
                  <p className="lobby-meta mb-0">Bekleniyor…</p>
                )}
              </div>
            </div>
          </div>
        )}

        {inFoldLobby && (
          <FoldLobby
            onStart={fold.startGame}
            onCreateOnline={foldOnline.createRoom}
            onJoinOnline={foldOnline.joinRoom}
            onBack={goHub}
            onlineError={foldOnline.error}
          />
        )}

        {mode === 'kapmaca' && inLocalGame && local.game && (
          <GameScreen
            game={local.game}
            orderRollIdx={local.orderRollIdx}
            toast={local.toast}
            canInteract
            canUndo={local.canUndo}
            onRollOrder={local.rollOrderDice}
            onRollDice={local.rollTurnDice}
            onClaim={local.claimTile}
            onUndo={local.undoClaim}
            onEndTurn={local.endTurn}
            onPlayAgain={
              local.lastConfig ? () => setLocalRematchOpen(true) : undefined
            }
            rematchSettings={
              localRematchOpen && local.lastConfig ? (
                <RematchSettingsPanel
                  mode="local"
                  initial={local.lastConfig}
                  onConfirm={(config) => {
                    local.startGame(config);
                    setLocalRematchOpen(false);
                  }}
                  onCancel={() => setLocalRematchOpen(false)}
                />
              ) : undefined
            }
            onLeave={() => {
              setLocalRematchOpen(false);
              local.leaveGame();
            }}
          />
        )}

        {mode === 'kapmaca' && inOnlineGame && online.game && online.session && (
          <GameScreen
            game={online.game}
            orderRollIdx={Math.max(0, online.game.players.findIndex((p) => p.orderRoll === null))}
            toast={online.toast}
            canInteract={online.canInteract}
            myLabel="online"
            canUndo={online.canUndo}
            onRollOrder={online.rollOrderDice}
            onRollDice={online.rollTurnDice}
            onClaim={online.claimTile}
            onUndo={online.undoClaim}
            onEndTurn={online.endTurn}
            onPlayAgain={
              online.session.isHost
                ? () => {
                    setOnlineRematchOpen(true);
                    online.beginRematchConfig();
                  }
                : undefined
            }
            rematchWaiting={!online.session.isHost}
            rematchHostConfiguring={!!online.session.rematchConfiguring}
            rematchSettings={
              onlineRematchOpen && online.session.isHost ? (
                <RematchSettingsPanel
                  mode="online"
                  initial={{
                    mapSize: online.session.mapSize,
                    maxPlayers: online.session.maxPlayers,
                  }}
                  memberCount={online.session.members.length}
                  onConfirm={(opts) => {
                    online.rematch(opts);
                    setOnlineRematchOpen(false);
                  }}
                  onCancel={() => {
                    setOnlineRematchOpen(false);
                    online.cancelRematchConfig();
                  }}
                />
              ) : undefined
            }
            onLeave={() => {
              setOnlineRematchOpen(false);
              online.leave();
            }}
          />
        )}

        {mode === 'kapmaca' && inOnlineLobby && online.session && (
          <div className="lobby-shell">
            <div className="lobby-panel">
              <div className="lobby-panel__scroll">
                <button type="button" onClick={online.leave} className="lobby-back">
                  ← vazgeç
                </button>
                <h2 className="lobby-heading">
                  {online.session.isHost ? 'Oyuncular bekleniyor' : 'Lobide bekleniyor'}
                </h2>
                <p className="lobby-sub">Bu mührü arkadaşlarınla paylaş</p>
                <div className="lobby-online-code">{online.session.roomCode}</div>
                <ul className="lobby-members">
                  {online.session.members.map((m) => (
                    <li key={m.id}>— {m.name}</li>
                  ))}
                </ul>
                {online.error && <p className="lobby-error">{online.error}</p>}
                {!online.session.isHost && (
                  <p className="lobby-hint">Host oyunu başlatacak…</p>
                )}
              </div>
              <div className="lobby-panel__footer">
                {online.session.isHost ? (
                  <button
                    type="button"
                    onClick={online.startOnlineGame}
                    disabled={online.session.members.length < 2}
                    className="btn-primary"
                  >
                    Oyunu başlat · {online.session.members.length}
                  </button>
                ) : (
                  <p className="lobby-meta mb-0">Bekleniyor…</p>
                )}
              </div>
            </div>
          </div>
        )}

        {mode === 'kapmaca' && !inLocalGame && !inOnlineGame && !inOnlineLobby && (
          <>
            {online.error && <p className="lobby-error shrink-0 px-3 pt-1">{online.error}</p>}
            <LobbyScreen
              onStartLocal={local.startGame}
              onCreateOnline={online.createRoom}
              onJoinOnline={online.joinRoom}
              onBack={goHub}
            />
          </>
        )}
      </main>
    </div>
  );
}
