import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { catalogService, purchaseService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./BookDetail.css";

export default function BookDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [livre, setLivre] = useState(null);
  const [achatEnCours, setAchatEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    catalogService.getBook(slug).then(({ data }) => setLivre(data));
  }, [slug]);

  const acheter = async () => {
    if (!user) {
      navigate("/connexion");
      return;
    }
    setAchatEnCours(true);
    setErreur("");
    try {
      // NOTE : ici on suppose un paiement Orange Money validé côté backend
      // (voir purchases/views.py — à brancher sur le vrai agrégateur).
      await purchaseService.buy(livre.id);
      navigate("/ma-bibliotheque");
    } catch (e) {
      setErreur("Le paiement Orange Money n'a pas pu être confirmé. Réessayez.");
    } finally {
      setAchatEnCours(false);
    }
  };

  if (!livre) return <p className="book-detail-loading">Chargement…</p>;

  return (
    <div className="book-detail">
      <img src={livre.couverture} alt={livre.titre} className="book-detail-cover" />
      <div className="book-detail-info">
        <span className="book-detail-category">{livre.sous_categorie}</span>
        <h1>{livre.titre}</h1>
        <p>{livre.description}</p>
        <p className="book-detail-price">{Number(livre.prix).toLocaleString("fr-FR")} FCFA</p>

        {erreur && <p className="book-detail-error">{erreur}</p>}

        {livre.deja_achete ? (
          <button className="btn-primary" onClick={() => navigate("/ma-bibliotheque")}>
            Lire ce livre
          </button>
        ) : (
          <button className="btn-primary" onClick={acheter} disabled={achatEnCours}>
            {achatEnCours ? "Paiement en cours…" : "Acheter via Orange Money"}
          </button>
        )}
      </div>
    </div>
  );
}
