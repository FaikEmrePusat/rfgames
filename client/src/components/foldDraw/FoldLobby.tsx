import { useState } from 'react';
import type { FoldGameConfig } from '@rfgames/shared';
import { clampFoldPlayerCount } from '@rfgames/shared';

interface Props {
  onStart: (config: FoldGameConfig) => void;
  onBack: () => void;
}

const DEFAULT_NAMES = ['Oyuncu 1', 'Oyuncu 2', 'Oyuncu 3', 'Oyuncu 4'];

export function FoldLobby({ onStart, onBack }: Props) {
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState(DEFAULT_NAMES);

  const updateName = (i: number, v: string) => {
    setNames((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  };

  const start = () => {
    const n = clampFoldPlayerCount(playerCount);
    onStart({ playerNames: names.slice(0, n) });
  };

  return (
    <div className="lobby-shell">
      <div className="lobby-panel">
        <div className="lobby-panel__scroll">
          <button type="button" onClick={onBack} className="lobby-back">
            ← seçim
          </button>
          <h2 className="lobby-heading">Katla-Çiz</h2>
          <p className="lobby-sub">
            4 kat · kimse tam figürü görmez
          </p>

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
        </div>
        <div className="lobby-panel__footer">
          <button type="button" onClick={start} className="btn-primary w-full">
            Kağıdı ser
          </button>
        </div>
      </div>
    </div>
  );
}
