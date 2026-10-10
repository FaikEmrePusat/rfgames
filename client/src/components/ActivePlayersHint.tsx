import { useActivePlayers } from '../hooks/useActivePlayers';

/** Muted header chrome: "aktif · N" — hidden until first successful poll. */
export function ActivePlayersHint() {
  const count = useActivePlayers();
  if (count === null) return null;

  return (
    <span
      className="active-players-hint"
      title="Açık sekme / bağlı oyuncu sayısı"
      aria-live="polite"
    >
      aktif · {count}
    </span>
  );
}
