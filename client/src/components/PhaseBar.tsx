import type { TurnPhase } from '@rfgames/shared';

const PHASES: { id: TurnPhase | 'roll_order'; label: string }[] = [
  { id: 'roll_order', label: 'Sıra zarı' },
  { id: 'roll', label: 'Zar at' },
  { id: 'claim', label: 'Fethet' },
  { id: 'turn_complete', label: 'Tur bitir' },
];

interface Props {
  phase: TurnPhase;
  orderPhase?: boolean;
}

export function PhaseBar({ phase, orderPhase }: Props) {
  const activeId = orderPhase ? 'roll_order' : phase;

  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      {PHASES.map((p, i) => {
        const isActive = p.id === activeId;
        const isPast = !orderPhase && PHASES.findIndex((x) => x.id === phase) > i;

        return (
          <div key={p.id} className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0">
            <div className={`phase-step ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}>
              <span className="w-4 h-4 shrink-0 flex items-center justify-center text-sm">
                {isPast ? '✓' : i + 1}
              </span>
              <span className="hidden sm:inline truncate text-lg">{p.label}</span>
            </div>
            {i < PHASES.length - 1 && (
              <div
                className={`h-px w-2 sm:w-3 shrink-0 ${isPast ? 'bg-[var(--forest)]' : 'bg-[rgba(90,60,30,0.3)]'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
