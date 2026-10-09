import { useState } from 'react';
import type { BotDifficulty, GameConfig, MapSize } from '@rfgames/shared';
import {
  BOT_DIFFICULTY_LABELS,
  MAP_SIZE_LABELS,
  clampPlayerCount,
  getGridDimensions,
  getIslandCount,
} from '@rfgames/shared';

type Screen = 'lobby' | 'online';

interface Props {
  onStartLocal: (config: GameConfig) => void;
  onCreateOnline: (opts: OnlineLobbyOptions) => void;
  onJoinOnline: (code: string, name: string) => void;
  onBack?: () => void;
}

export interface OnlineLobbyOptions {
  playerName: string;
  mapSize: MapSize;
  maxPlayers: number | 'unlimited';
}

type SlotKind = 'human' | 'bot';

interface LocalSlot {
  name: string;
  kind: SlotKind;
  difficulty: BotDifficulty;
}

const DEFAULT_SLOTS: LocalSlot[] = [
  { name: 'Oyuncu 1', kind: 'human', difficulty: 'medium' },
  { name: 'Bot', kind: 'bot', difficulty: 'medium' },
  { name: 'Bot', kind: 'bot', difficulty: 'medium' },
  { name: 'Bot', kind: 'bot', difficulty: 'medium' },
  { name: 'Bot', kind: 'bot', difficulty: 'medium' },
  { name: 'Bot', kind: 'bot', difficulty: 'medium' },
];

export function LobbyScreen({ onStartLocal, onCreateOnline, onJoinOnline, onBack }: Props) {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [playerCount, setPlayerCount] = useState(2);
  const [mapSize, setMapSize] = useState<MapSize>('medium');
  const [slots, setSlots] = useState<LocalSlot[]>(DEFAULT_SLOTS);
  const [onlineName, setOnlineName] = useState('Oyuncu');
  const [joinCode, setJoinCode] = useState('');
  const [onlineMax, setOnlineMax] = useState<number | 'unlimited'>(2);

  const previewCount = screen === 'lobby' ? playerCount : onlineMax === 'unlimited' ? 4 : onlineMax;
  const grid = getGridDimensions(mapSize, clampPlayerCount(previewCount));
  const islands = getIslandCount(mapSize, clampPlayerCount(previewCount));

  const updateSlot = (idx: number, patch: Partial<LocalSlot>) => {
    setSlots((prev) => {
      const next = [...prev];
      const cur = { ...next[idx]!, ...patch };
      if (patch.kind === 'bot' && !prev[idx]!.name.toLowerCase().startsWith('bot')) {
        cur.name = `Bot ${idx + 1}`;
      }
      if (patch.kind === 'human' && prev[idx]!.kind === 'bot') {
        cur.name = `Oyuncu ${idx + 1}`;
      }
      next[idx] = cur;
      return next;
    });
  };

  const startLocal = () => {
    const count = clampPlayerCount(playerCount);
    const active = slots.slice(0, count);
    onStartLocal({
      mapSize,
      playerCount: count,
      playerNames: active.map((s) => s.name),
      bots: active.map((s) => ({
        isBot: s.kind === 'bot',
        botDifficulty: s.difficulty,
      })),
    });
  };

  const footerCta =
    screen === 'lobby' ? (
      <button type="button" onClick={startLocal} className="btn-primary">
        Oyuna başlat
      </button>
    ) : (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() =>
            onCreateOnline({
              playerName: onlineName,
              mapSize,
              maxPlayers: onlineMax,
            })
          }
          className="btn-primary"
        >
          Oda oluştur
        </button>
        <div className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="oda kodu"
            className="ink-input text-center uppercase tracking-[0.2em] !text-[var(--oxblood)] flex-1"
            aria-label="Oda kodu"
          />
          <button
            type="button"
            onClick={() => onJoinOnline(joinCode.trim(), onlineName)}
            className="btn-success shrink-0"
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
          {onBack && (
            <button type="button" onClick={onBack} className="lobby-back">
              ← seçim
            </button>
          )}
          <h2 className="lobby-heading">Kare Kapmaca</h2>
          <p className="lobby-sub">Zar · ada · köprü</p>

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

          <label className="section-label">Harita</label>
          <div className="grid grid-cols-3 gap-1.5 mb-1">
            {(['small', 'medium', 'large'] as MapSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setMapSize(size)}
                className={`option-btn ${mapSize === size ? 'option-btn-active' : 'option-btn-idle'}`}
              >
                {MAP_SIZE_LABELS[size]}
              </button>
            ))}
          </div>
          <p className="lobby-meta">
            ≈ {grid.cols}×{grid.rows} · ~{islands} ada
          </p>

          {screen === 'lobby' ? (
            <>
              <label className="section-label">Oyuncu</label>
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {[2, 3, 4, 5, 6].map((n) => (
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

              <label className="section-label">Koltuklar</label>
              <div className="lobby-slots">
                {Array.from({ length: playerCount }).map((_, i) => {
                  const slot = slots[i]!;
                  return (
                    <div key={i} className="lobby-slot">
                      <input
                        type="text"
                        value={slot.name}
                        onChange={(e) => updateSlot(i, { name: e.target.value })}
                        className="ink-input slot-name-input"
                        placeholder={`${i + 1}. oyuncu`}
                        aria-label={`${i + 1}. oyuncu adı`}
                      />
                      <div className="lobby-slot__row">
                        <button
                          type="button"
                          onClick={() => updateSlot(i, { kind: 'human' })}
                          className={`option-btn px-2.5 py-1 text-sm ${
                            slot.kind === 'human' ? 'option-btn-active' : 'option-btn-idle'
                          }`}
                        >
                          İnsan
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSlot(i, { kind: 'bot' })}
                          className={`option-btn px-2.5 py-1 text-sm ${
                            slot.kind === 'bot' ? 'option-btn-active' : 'option-btn-idle'
                          }`}
                        >
                          Bot
                        </button>
                        {slot.kind === 'bot' && (
                          <select
                            value={slot.difficulty}
                            onChange={(e) =>
                              updateSlot(i, { difficulty: e.target.value as BotDifficulty })
                            }
                            className="ink-input slot-diff-select"
                            aria-label="Bot zorluğu"
                          >
                            {(['easy', 'medium', 'hard'] as BotDifficulty[]).map((d) => (
                              <option key={d} value={d}>
                                {BOT_DIFFICULTY_LABELS[d]}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="lobby-hint">Tek kişi için diğer koltukları bot yap.</p>
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

              <label className="section-label">Oda kapasitesi</label>
              <div className="grid grid-cols-6 gap-1.5">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setOnlineMax(n)}
                    className={`option-btn ${onlineMax === n ? 'option-btn-active' : 'option-btn-idle'}`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setOnlineMax('unlimited')}
                  className={`option-btn ${onlineMax === 'unlimited' ? 'option-btn-active' : 'option-btn-idle'}`}
                  title="Sınırsız"
                >
                  ∞
                </button>
              </div>
            </>
          )}
        </div>
        <div className="lobby-panel__footer">{footerCta}</div>
      </div>
    </div>
  );
}
