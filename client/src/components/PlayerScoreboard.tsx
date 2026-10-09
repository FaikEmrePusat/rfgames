import type { Player } from '@rfgames/shared';

interface Props {
  players: Player[];
  totalLand: number;
  currentPlayerId: number;
}

export function PlayerScoreboard({ players, totalLand, currentPlayerId }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <ul className="space-y-1.5">
      {sorted.map((p, i) => {
        const pct = totalLand > 0 ? Math.round((p.score / totalLand) * 100) : 0;
        const isActive = p.id === currentPlayerId;

        return (
          <li
            key={p.id}
            className={`px-2 py-1.5 border transition-all ${
              isActive
                ? 'border-solid border-[var(--oxblood)]/50 bg-[var(--oxblood)]/8'
                : 'border-dashed border-[rgba(90,60,30,0.3)] bg-white/15'
            }`}
          >
            <div className="flex items-center justify-between mb-0.5 gap-2">
              <span className="flex items-center gap-1.5 min-w-0 hand-note text-sm">
                <span className="hand-title text-base shrink-0 w-4">{i + 1}.</span>
                <span
                  className="w-2.5 h-2.5 shrink-0 border border-[rgba(90,60,30,0.4)]"
                  style={{ backgroundColor: p.color }}
                />
                <span className="truncate hand-title text-lg" style={{ color: p.color }}>
                  {p.name}
                </span>
                {p.isBot && (
                  <span className="hand-note text-xs opacity-70 shrink-0">
                    bot
                    {p.botDifficulty ? ` · ${p.botDifficulty === 'easy' ? 'kolay' : p.botDifficulty === 'hard' ? 'zor' : 'orta'}` : ''}
                  </span>
                )}
                {isActive && (
                  <span className="hand-note text-xs text-[var(--oxblood)] shrink-0">sırada</span>
                )}
              </span>
              <span className="hand-title text-base shrink-0">
                {p.score}
                <span className="hand-note text-xs opacity-70 ml-1">({pct}%)</span>
              </span>
            </div>
            <div className="h-1.5 bg-white/30 border border-[rgba(90,60,30,0.25)] overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: p.color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
