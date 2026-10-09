interface Props {
  onPickKapmaca: () => void;
  onPickFoldDraw: () => void;
}

export function HubScreen({ onPickKapmaca, onPickFoldDraw }: Props) {
  return (
    <div className="hub-screen">
      <div className="hub-screen__intro">
        <h2 className="hub-title">RF Games</h2>
        <p className="hub-kicker">iki oyun · aynı masa</p>
      </div>

      <div className="hub-screen__list">
        <button type="button" onClick={onPickKapmaca} className="hub-row">
          <h3 className="hub-row__title">Kare Kapmaca</h3>
          <p className="hub-row__blurb">zar at, ada kap, köprü kur</p>
        </button>

        <button type="button" onClick={onPickFoldDraw} className="hub-row">
          <h3 className="hub-row__title">Katla-Çiz</h3>
          <p className="hub-row__blurb">katla, çiz, aç — sürpriz figür</p>
        </button>
      </div>
    </div>
  );
}
