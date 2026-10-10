import { useState } from 'react';
import type { BotDifficulty, GameConfig, MapSize } from '@rfgames/shared';
import {
  BOT_DIFFICULTY_LABELS,
  MAP_SIZE_LABELS,
  clampPlayerCount,
  getGridDimensions,
  getIslandCount,
} from '@rfgames/shared';

type SlotKind = 'human' | 'bot';

interface LocalSlot {
  name: string;
  kind: SlotKind;
  difficulty: BotDifficulty;
}

export interface OnlineRematchOptions {
  mapSize: MapSize;
  maxPlayers: number | 'unlimited';
}

interface LocalProps {
  mode: 'local';
  initial: GameConfig;
  onConfirm: (config: GameConfig) => void;
  onCancel: () => void;
}

interface OnlineProps {
  mode: 'online';
  initial: OnlineRematchOptions;
  memberCount: number;
  onConfirm: (opts: OnlineRematchOptions) => void;
  onCancel: () => void;
}

type Props = LocalProps | OnlineProps;

function slotsFromConfig(config: GameConfig): LocalSlot[] {
  const count = clampPlayerCount(config.playerCount);
  return Array.from({ length: 6 }, (_, i) => {
    if (i < count) {
      const bot = config.bots?.[i];
      return {
        name: config.playerNames[i] ?? (bot?.isBot ? `Bot ${i + 1}` : `Oyuncu ${i + 1}`),
        kind: (bot?.isBot ? 'bot' : 'human') as SlotKind,
        difficulty: bot?.botDifficulty ?? 'medium',
      };
    }
    return { name: `Bot ${i + 1}`, kind: 'bot' as SlotKind, difficulty: 'medium' as BotDifficulty };
  });
}

export function RematchSettingsPanel(props: Props) {
  const [mapSize, setMapSize] = useState<MapSize>(
    props.mode === 'local' ? props.initial.mapSize : props.initial.mapSize,
  );
  const [playerCount, setPlayerCount] = useState(
    props.mode === 'local' ? clampPlayerCount(props.initial.playerCount) : 2,
  );
  const [slots, setSlots] = useState<LocalSlot[]>(
    props.mode === 'local' ? slotsFromConfig(props.initial) : [],
  );
  const [onlineMax, setOnlineMax] = useState<number | 'unlimited'>(
    props.mode === 'online' ? props.initial.maxPlayers : 2,
  );

  const memberCount = props.mode === 'online' ? props.memberCount : 0;
  const previewCount =
    props.mode === 'local'
      ? playerCount
      : onlineMax === 'unlimited'
        ? Math.max(4, memberCount)
        : onlineMax;
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

  const confirm = () => {
    if (props.mode === 'local') {
      const count = clampPlayerCount(playerCount);
      const active = slots.slice(0, count);
      props.onConfirm({
        mapSize,
        playerCount: count,
        playerNames: active.map((s) => s.name),
        bots: active.map((s) => ({
          isBot: s.kind === 'bot',
          botDifficulty: s.difficulty,
        })),
      });
      return;
    }
    props.onConfirm({ mapSize, maxPlayers: onlineMax });
  };

  const capacityTooLow =
    props.mode === 'online' && onlineMax !== 'unlimited' && onlineMax < memberCount;

  return (
    <div className="rematch-settings">
      <h3 id="game-end-title" className="hand-title text-3xl mb-1">
        Yeni sefer ayarları
      </h3>
      <div className="ornament-line my-2 max-w-[7rem] mx-auto" />
      <p className="hand-note text-base mb-3">
        {props.mode === 'local'
          ? 'Harita ve koltukları düzenle, sonra başlat.'
          : 'Harita ve oda kapasitesini düzenle. Odadaki oyuncular kalır.'}
      </p>

      <div className="lobby-field text-left">
        <div className="lobby-field__head">
          <label className="section-label">Harita</label>
          <p className="lobby-meta" aria-live="polite">
            ≈ {grid.cols}×{grid.rows} · ~{islands} ada
          </p>
        </div>
        <div className="lobby-option-grid lobby-option-grid--3">
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
      </div>

      {props.mode === 'local' ? (
        <>
          <div className="lobby-field text-left">
            <label className="section-label">Oyuncu</label>
            <div className="lobby-option-grid lobby-option-grid--5">
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
          </div>

          <div className="lobby-field lobby-field--seats text-left">
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
                    <div className="lobby-slot__controls" role="group" aria-label={`${i + 1}. koltuk türü`}>
                      <button
                        type="button"
                        onClick={() => updateSlot(i, { kind: 'human' })}
                        className={`option-btn lobby-slot__kind ${
                          slot.kind === 'human' ? 'option-btn-active' : 'option-btn-idle'
                        }`}
                      >
                        İnsan
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSlot(i, { kind: 'bot' })}
                        className={`option-btn lobby-slot__kind ${
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
          </div>
        </>
      ) : (
        <div className="lobby-field text-left">
          <label className="section-label">Oda kapasitesi</label>
          <div className="lobby-option-grid lobby-option-grid--6">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setOnlineMax(n)}
                disabled={n < memberCount}
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
          <p className="lobby-hint">
            Odada {memberCount} oyuncu · botlar yalnızca yerelde
          </p>
          {capacityTooLow && (
            <p className="lobby-error mb-0">Kapasite odadaki oyuncu sayısından az olamaz.</p>
          )}
        </div>
      )}

      <div className="game-end-actions">
        <button
          type="button"
          onClick={confirm}
          disabled={capacityTooLow}
          className="btn-primary"
        >
          Yeni oyunu başlat
        </button>
        <button type="button" onClick={props.onCancel} className="btn-ghost">
          Geri
        </button>
      </div>
    </div>
  );
}
