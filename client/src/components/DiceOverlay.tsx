import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Animasyon bitince netleşecek sonuç (1–6); null iken dönüyor */
  value: number | null;
  label: string;
  playerName?: string;
  playerColor?: string;
  onFinished: () => void;
}

const PIP_LAYOUTS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 24],
    [72, 24],
    [28, 50],
    [72, 50],
    [28, 76],
    [72, 76],
  ],
};

function DieFace({ value, spinning }: { value: number; spinning?: boolean }) {
  const pips = PIP_LAYOUTS[value] ?? PIP_LAYOUTS[1];
  return (
    <div className={`dice-face ${spinning ? 'dice-face-spin' : 'dice-face-land'}`}>
      {pips.map(([x, y], i) => (
        <span
          key={i}
          className="dice-pip"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      ))}
    </div>
  );
}

export function DiceOverlay({ value, label, playerName, playerColor, onFinished }: Props) {
  const [display, setDisplay] = useState(() => Math.floor(Math.random() * 6) + 1);
  const [phase, setPhase] = useState<'spin' | 'land' | 'hold'>('spin');
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const settledRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const landOn = (finalValue: number) => {
    if (settledRef.current) return;
    settledRef.current = true;
    setDisplay(finalValue);
    setPhase('land');
  };

  useEffect(() => {
    if (phase !== 'spin') return;
    const id = window.setInterval(() => {
      setDisplay((prev) => {
        let next = prev;
        while (next === prev) next = Math.floor(Math.random() * 6) + 1;
        return next;
      });
    }, 70);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (value == null || phase !== 'spin') return;
    const settle = window.setTimeout(() => landOn(value), 750);
    return () => window.clearTimeout(settle);
  }, [value, phase]);

  // Sonuç gelmezse takılı kalmasın
  useEffect(() => {
    if (phase !== 'spin') return;
    const failsafe = window.setTimeout(() => {
      landOn(valueRef.current ?? Math.floor(Math.random() * 6) + 1);
    }, 2200);
    return () => window.clearTimeout(failsafe);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'land') return;
    const hold = window.setTimeout(() => setPhase('hold'), 450);
    return () => window.clearTimeout(hold);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'hold') return;
    const done = window.setTimeout(() => onFinishedRef.current(), 650);
    return () => window.clearTimeout(done);
  }, [phase]);

  return (
    <div className="dice-overlay" role="dialog" aria-label={label}>
      <div className="dice-overlay-card -rotate-1">
        <p className="hand-title text-2xl mb-1">{label}</p>
        {playerName && (
          <p className="hand-note text-lg mb-4" style={{ color: playerColor ?? '#6e1c1c' }}>
            {playerName}
          </p>
        )}
        <DieFace value={display} spinning={phase === 'spin'} />
        <p className="mt-5 hand-note text-lg h-7">
          {phase === 'spin' ? (
            'zar yuvarlanıyor…'
          ) : (
            <span className="hand-title text-3xl">{display}</span>
          )}
        </p>
      </div>
    </div>
  );
}
