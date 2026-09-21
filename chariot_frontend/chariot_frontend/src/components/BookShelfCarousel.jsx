import "./BookShelfCarousel.css";

/**
 * Carrousel "coverflow" en perspective 3D : les couvertures défilent en
 * continu, inclinées comme sur une étagère vue de biais, avec un ruban
 * rouge déchiré au-dessus — signature reprise des vraies couvertures DAS.
 */
export default function BookShelfCarousel({ livres }) {
  if (!livres || livres.length === 0) return null;
  const suite = [...livres, ...livres];

  return (
    <div className="coverflow">
      <div className="coverflow-stage">
        <div className="coverflow-track">
          {suite.map((livre, i) => (
            <div className="coverflow-book" key={`${livre.id}-${i}`}>
              <img src={livre.couverture} alt={livre.titre} />
              <div className="coverflow-sheen" />
            </div>
          ))}
        </div>
      </div>
      <div className="coverflow-floor" />
    </div>
  );
}
