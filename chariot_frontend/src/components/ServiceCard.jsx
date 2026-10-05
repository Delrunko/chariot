import { Link } from "react-router-dom";
import "./ServiceCard.css";

export default function ServiceCard({ livre, achete, categoryView = false }) {
  const verrouille = !achete;

  return (
    <Link to={`/service/${livre.slug}`} className="service-card">
      <div className="service-card-cover">
        <img src={livre.couverture} alt={livre.titre} />
        {verrouille ? (
          <span className="service-card-badge">🔒 À acheter</span>
        ) : (
          <span className="service-card-badge service-card-badge-owned">✓ Acheté</span>
        )}
        <span className="service-card-price-ribbon">
          {Number(livre.prix).toLocaleString("fr-FR")} F
        </span>
      </div>
      <div className="service-card-info">
        <h3>{livre.titre}</h3>
        <p className="service-card-category">{livre.sous_categorie}</p>
        {livre.description && (
          <p className="service-card-description">{livre.description}</p>
        )}
        <span className="service-card-cta">
          <i className="fa-solid fa-cart-shopping" aria-hidden="true" />
          {achete ? "Voir" : categoryView ? "Réserver" : "Acheter"}
        </span>
      </div>
    </Link>
  );
}