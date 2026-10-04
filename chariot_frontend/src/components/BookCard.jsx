import { Link } from "react-router-dom";
import "./BookCard.css";

export default function BookCard({ livre, categoryView = false }) {
  const verrouille = !livre.deja_achete;

  return (
    <Link to={`/livre/${livre.slug}`} className="book-card">
      <div className="book-card-cover">
        <img src={livre.couverture} alt={livre.titre} />
        {verrouille ? (
          <span className="book-card-badge">🔒 À acheter</span>
        ) : (
          <span className="book-card-badge book-card-badge-owned">✓ Acheté</span>
        )}
        <span className="book-card-price-ribbon">
          {Number(livre.prix).toLocaleString("fr-FR")} F
        </span>
      </div>
      <div className="book-card-info">
        <h3>{livre.titre}</h3>
        <p className="book-card-category">{livre.sous_categorie}</p>
        {categoryView && livre.description && (
          <p className="book-card-description">{livre.description}</p>
        )}
        {categoryView && (
          <span className="book-card-cta">
            {livre.deja_achete ? "Voir le livre" : "Acheter"}
          </span>
        )}
      </div>
    </Link>
  );
}
