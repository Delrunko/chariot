import "./BookShelfCarousel.css";

/**
 * Carrousel "coverflow" en boucle infinie parfaite : la liste est
 * triplée pour garantir qu'on ne voit jamais la fin, quel que soit le
 * nombre de livres, et la vitesse s'adapte au nombre d'ouvrages pour
 * garder un rythme régulier.
 */
export default function BookShelfCarousel({ livres }) {
  if (!livres || livres.length === 0) return null;

  // Triple la liste : garantit une boucle invisible même avec peu de livres.
  const suite = [...livres, ...livres, ...livres];
  // Vitesse proportionnelle au nombre d'ouvrages (évite un défilement
  // trop rapide quand il y a peu de livres).
  const duree = Math.max(18, livres.length * 4.5);

  return (
    <div className="coverflow">
      <div className="coverflow-stage">
        <div className="coverflow-track" style={{ animationDuration: `${duree}s` }}>
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