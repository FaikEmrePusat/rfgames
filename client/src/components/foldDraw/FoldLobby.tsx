import { useState } from 'react';
import type { FoldGameConfig } from '@rfgames/shared';
import { clampFoldPlayerCount } from '@rfgames/shared';
import type { FoldOnlineCreateOpts } from '../../hooks/useOnlineFoldDraw';

type Screen = 'lobby' | 'online';

interface Props {
  onStart: (config: FoldGameConfig) => void;
  onCreateOnline: (opts: FoldOnlineCreateOpts) => void;
  onJoinOnline: (code: string, name: string) => void;
  onBack: () => void;
  onlineError?: string | null;
}

const DEFAULT_NAMES = ['Oyuncu 1', 'Oyuncu 2', 'Oyuncu 3', 'Oyuncu 4'];

export function FoldLobby({
  onStart,
  onCreateOnline,
  onJoinOnline,
  onBack,
  onlineError,
}: Props) {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [onlineName, setOnlineName] = useState('Oyuncu');
  const [joinCode, setJoinCode] = useState('');
  const [onlineMax, setOnlineMax] = useState<2 | 3 | 4>(2);

  const updateName = (i: number, v: string) => {
    setNames((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  };

  const startLocal = () => {
    const n = clampFoldPlayerCount(playerCount);
    onStart({ playerNames: names.slice(0, n) });
  };

  const footerCta =
    screen === 'lobby' ? (
      <button type="button" onClick={startLocal} className="btn-primary w-full">
        Kağıdı ser
      </button>
    ) : (
      <div className="lobby-footer-stack">
        <button
          type="button"
          onClick={() =>
            onCreateOnline({
              playerName: onlineName,
              maxPlayers: onlineMax,
            })
          }
          className="btn-primary"
        >
          Oda oluştur
        </button>
        <div className="lobby-join-row">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="oda kodu"
            className="ink-input text-center uppercase tracking-[0.2em] !text-[var(--oxblood)]"
            aria-label="Oda kodu"
          />
          <button
            type="button"
            onClick={() => onJoinOnline(joinCode.trim(), onlineName)}
            className="btn-success"
          >
            Katıl
          </button>
        </div>
      </div>
    );

  return (
    <div className="lobby-shell">
      <div className="lobby-panel">
        <div className="lobby-panel__scroll">
          <button type="button" onClick={onBack} className="lobby-back">
            ← seçim
          </button>
          <h2 className="lobby-heading">Katla-Çiz</h2>
          <p className="lobby-sub">4 kat · kimse tam figürü görmez</p>

          <div className="tab-rail">
            <button
              type="button"
              onClick={() => setScreen('lobby')}
              className={screen === 'lobby' ? 'active' : ''}
            >
              Yerel
            </button>
            <button
              type="button"
              onClick={() => setScreen('online')}
              className={screen === 'online' ? 'active' : ''}
            >
              Çevrimiçi
            </button>
          </div>

          {screen === 'lobby' ? (
            <>
              <label className="section-label">Oyuncu (2–4)</label>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPlayerCount(n)}
                    className={`option-btn ${playerCount === n ? 'option-btn-active' : 'option-btn-idle'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <label className="section-label">İsimler</label>
              <div className="lobby-slots">
                {Array.from({ length: playerCount }).map((_, i) => (
                  <input
                    key={i}
                    type="text"
                    value={names[i]}
                    onChange={(e) => updateName(i, e.target.value)}
                    className="ink-input slot-name-input"
                    placeholder={`${i + 1}. oyuncu`}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <label className="section-label">Adınız</label>
              <input
                type="text"
                value={onlineName}
                onChange={(e) => setOnlineName(e.target.value)}
                className="ink-input mb-3"
              />

              <label className="section-label">Oda kapasitesi (2–4)</label>
              <div className="grid grid-cols-3 gap-1.5">
                {([2, 3, 4] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setOnlineMax(n)}
                    className={`option-btn ${onlineMax === n ? 'option-btn-active' : 'option-btn-idle'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="lobby-hint">Mühür kodunu paylaş; host oyunu başlatır.</p>
              {onlineError && <p className="lobby-error">{onlineError}</p>}
            </>
          )}
        </div>
        <div className="lobby-panel__footer">{footerCta}</div>
      </div>
    </div>
  );
}
