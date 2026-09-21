import { useEffect, useState } from "react";
import { catalogService } from "../services/api";
import BookCard from "../components/BookCard";
import BookShelfCarousel from "../components/BookShelfCarousel";
import "./Home.css";

export default function Home() {
  const [livres, setLivres] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    catalogService
      .getVitrine()
      .then(({ data }) => setLivres(data))
      .finally(() => setChargement(false));
  }, []);

  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero-text fade-in-up">
          <span className="eyebrow">Dans la même collection</span>
          <h1>
            Tous vos ouvrages <span className="highlight">Maçonnerie &amp; Bâtiment</span> à portée de main
          </h1>
          <p>De la 1ère année jusqu'à la Terminale F4 — achetez, consultez, même sans connexion.</p>
        </div>
        <BookShelfCarousel livres={livres} />
      </section>

      <section className="home-showcase">
        <span className="eyebrow eyebrow-light">Vitrine</span>
        <h2>Ouvrages disponibles</h2>
        {chargement && <p>Chargement…</p>}
        {!chargement && livres.length === 0 && <p>Aucun livre disponible pour le moment.</p>}
        <div className="home-grid">
          {livres.map((livre, i) => (
            <div className="fade-in-up" style={{ animationDelay: `${(i % 8) * 0.05}s` }} key={livre.id}>
              <BookCard livre={livre} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
