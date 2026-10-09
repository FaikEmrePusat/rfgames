interface Props {
  onPickKapmaca: () => void;
  onPickFoldDraw: () => void;
}

export function HubScreen({ onPickKapmaca, onPickFoldDraw }: Props) {
  return (
    <div className="hub-screen">
      <div className="hub-screen__intro">
        <h2 className="hub-title">RF Games</h2>
        <p className="hub-kicker hub-kicker--lead">Oyun seç</p>
      </div>

      <div className="hub-screen__list">
        <button type="button" onClick={onPickKapmaca} className="hub-card hub-card--map">
          <h3 className="hub-card__title">Kare Kapmaca</h3>
          <p className="hub-card__blurb">Ada fetih · zar · bot · online</p>
        </button>

        <button type="button" onClick={onPickFoldDraw} className="hub-card hub-card--sketch">
          <h3 className="hub-card__title">Katla-Çiz</h3>
          <p className="hub-card__blurb">Katla · çiz · aç · sürpriz</p>
        </button>
      </div>
    </div>
  );
}
