import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { catalogService } from "../services/api";
import BookCard from "../components/BookCard";
import "./Home.css";

export default function Catalog() {
  const [searchParams] = useSearchParams();
  const [livres, setLivres] = useState([]);
  const [chargement, setChargement] = useState(true);

  const sousCategorie = searchParams.get("sous_categorie");
  const categorie = searchParams.get("categorie");

  useEffect(() => {
    setChargement(true);
    catalogService
      .getBooks({ sous_categorie: sousCategorie || undefined, categorie: categorie || undefined })
      .then(({ data }) => setLivres(data))
      .finally(() => setChargement(false));
  }, [sousCategorie, categorie]);

  return (
    <div className="home-showcase">
      <h2>Catalogue</h2>
      {chargement && <p>Chargement…</p>}
      {!chargement && livres.length === 0 && <p>Aucun livre dans cette catégorie pour le moment.</p>}
      <div className="home-grid">
        {livres.map((livre) => (
          <BookCard key={livre.id} livre={livre} />
        ))}
      </div>
    </div>
  );
}
