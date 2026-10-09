import type { Bridge } from '@rfgames/shared';

interface Props {
  bridges: Bridge[];
}

export function BridgeList({ bridges }: Props) {
  if (bridges.length === 0) return null;

  return (
    <div>
      <h3 className="hand-title text-xl mb-1.5">
        Köprüler ({bridges.length})
      </h3>
      <ul className="hand-note text-sm space-y-1 max-h-24 overflow-y-auto">
        {bridges.map((b, i) => (
          <li key={i} className="flex justify-between gap-2 border-b border-dashed border-[rgba(90,60,30,0.25)] pb-1 last:border-0">
            <span>
              Ada {b.fromIsland} ↔ Ada {b.toIsland}
            </span>
            <span className="hand-note text-xs opacity-70 shrink-0">
              ({b.cellA.c},{b.cellA.r})–({b.cellB.c},{b.cellB.r})
            </span>
          </li>
        ))}
      </ul>
      <p className="hand-note text-xs mt-1.5 italic opacity-75">
        Kesikli hatlar deniz üzerinden geçer.
      </p>
    </div>
  );
}
