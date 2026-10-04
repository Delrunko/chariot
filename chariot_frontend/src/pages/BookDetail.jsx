import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getStoragePublicUrl } from "../lib/storageAssets";
import { loadWithOfflineSnapshot } from "../lib/offlineData";
import { createOrder } from "../services/orderService";
import { useAuth } from "../context/AuthContext";
import ReaderModal from "../components/ReaderModal";
import PaymentInstructions from "../components/PaymentInstructions";
import "./BookDetail.css"; // Assurez-vous que le nouveau CSS est ici
import "./AdminDashboard.css"; // Réutilisation des styles du modal

export default function BookDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [livre, setLivre] = useState(null);
  const [achatEnCours, setAchatEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [lectureOuverte, setLectureOuverte] = useState(false);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const paymentForm = { moyen_paiement: "orange_money" };
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadBook = async () => {
      setLivre(null);
      setLectureOuverte(false);
      try {
        const book = await loadWithOfflineSnapshot(`book-detail:${slug}`, async () => {
          const { data, error } = await supabase
            .from("books")
            .select("id, title, slug, description, price, cover_path, available, subcategories(name, categories(name))")
            .eq("slug", slug)
            .maybeSingle();
          if (error) throw error;
          return data;
        });
        if (!book) {
          const { data: service, error: serviceError } = await supabase
            .from("services")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();
          if (serviceError) throw serviceError;
          if (service) {
            if (!cancelled) navigate(`/service/${slug}`, { replace: true });
            return;
          }
          if (!cancelled) setLivre(false);
          return;
        }

        let alreadyPurchased = false;
        if (user?.id) {
          const { data: order, error: orderError } = await supabase
              .from("orders")
              .select("id")
              .eq("user_id", user.id)
              .eq("book_id", book.id)
              .eq("status", "paye")
              .maybeSingle();
          if (orderError) {
            console.error("Impossible de vérifier l'achat du livre.", orderError);
          } else {
            alreadyPurchased = Boolean(order);
          }
        }

        if (!cancelled) {
          const subcategory = Array.isArray(book.subcategories)
            ? book.subcategories[0]
            : book.subcategories;
          const categoryValue = subcategory?.categories;
          const category = Array.isArray(categoryValue) ? categoryValue[0] : categoryValue;
          setLivre({
            id: book.id,
            titre: book.title,
            slug: book.slug,
            description: book.description,
            prix: book.price,
            couverture: getStoragePublicUrl("covers", book.cover_path),
            sous_categorie: subcategory?.name || category?.name || "Livre",
            deja_achete: alreadyPurchased,
          });
        }
      } catch (error) {
        console.error("Impossible de charger le livre depuis Supabase.", error);
        if (!cancelled) setLivre(false);
      }
    };

    void loadBook();

    return () => {
      cancelled = true;
    };
  }, [slug, navigate, user?.id]);

  const acheter = () => {
    if (!user) {
      navigate("/connexion");
      return;
    }
    setErreur("");
    setConfirmation("");
    setShowPaymentModal(true);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setAchatEnCours(true);

    try {
      const order = await createOrder({
        bookId: livre.id,
        paymentMethod: paymentForm.moyen_paiement,
      });
      setErreur("");
      setConfirmation(
        `Paiement initié (commande ${order.orderId}). Effectuez le dépôt au numéro indiqué; votre accès sera activé après vérification.`,
      );
    } catch (err) {
      console.error("Impossible d'enregistrer la commande.", err);
      setErreur(err instanceof Error ? err.message : "Impossible d'initier l'achat. Réessayez.");
    } finally {
      setAchatEnCours(false);
    }
  };

  if (livre === null) return <p className="book-detail-loading">Chargement en cours…</p>;
  if (livre === false) return <p className="book-detail-loading">Livre ou service introuvable.</p>;

  return (
    <div className="book-detail">
      
      {/* ==========================================
          COLONNE GAUCHE : EXPÉRIENCE VISUELLE
          ========================================== */}
      <div className="detail-visuals">
        <div className="main-and-badge">
          <img 
            src={livre.couverture} 
            alt={livre.titre} 
            className="gallery-main-img" 
          />
          {/* Badge optionnel : à adapter si vous avez un tableau d'images dans votre API */}
          <span className="image-count">1 / 1</span>
        </div>
        
        {/* Section Miniatures (À adapter si livre.images existe) */}
        <div className="thumbnails">
          <button className="thumb-btn thumb-active">
            <img src={livre.couverture} alt="Couverture principale" className="thumb-img" />
          </button>
          {/* Exemple si vous avez d'autres images : 
              {livre.images?.map((img, index) => (
                <button key={index} className="thumb-btn">
                  <img src={img.url} alt={`Vue ${index + 1}`} className="thumb-img" />
                </button>
              ))} 
          */}
        </div>
      </div>

      {/* ==========================================
          COLONNE DROITE : INFOS & ACHAT (STICKY)
          ========================================== */}
      <div className="detail-info">
        <div className="purchase-card">
          <span className="detail-category">{livre.sous_categorie || "Livre"}</span>
          
          <h1 className="detail-title">{livre.titre}</h1>
          
          <div className="detail-price">
            {Number(livre.prix).toLocaleString("fr-FR")} FCFA
          </div>

          {erreur && <p className="book-detail-error">{erreur}</p>}

          <p className="detail-description">
            {livre.description || "Aucune description disponible pour ce livre."}
          </p>

          {/* Boutons d'action avec icônes Font Awesome */}
          {livre.deja_achete ? (
            <button className="btn-primary" onClick={() => setLectureOuverte(true)}>
              <i className="fas fa-book-open"></i> Lire ce livre
            </button>
          ) : (
            <button className="btn-primary" onClick={acheter} disabled={achatEnCours}>
              <i className="fas fa-mobile-alt"></i> 
              {achatEnCours ? "Paiement en cours…" : "Acheter via Orange Money"}
            </button>
          )}
        </div>
      </div>

      {/* ==========================================
          MODALS (Lecture & Paiement)
          ========================================== */}
      {livre.deja_achete && (
        <ReaderModal 
          livreId={livre.id} 
          open={lectureOuverte} 
          onClose={() => setLectureOuverte(false)} 
        />
      )}

      {showPaymentModal && (
        <div
          className="admin-modal-overlay animate__animated animate__fadeIn"
          onMouseDown={(e) => {
            if (e.target.classList && e.target.classList.contains("admin-modal-overlay")) {
              setShowPaymentModal(false);
              setConfirmation("");
              setErreur("");
            }
          }}
        >
          <div className="admin-modal animate__animated animate__fadeInUp" role="dialog" aria-modal="true" aria-labelledby="book-payment-title">
            <h3 id="book-payment-title">Paiement — {livre.titre}</h3>
            {confirmation && <div className="admin-alert admin-alert-success" role="status">{confirmation}</div>}
            {erreur && <div className="admin-alert admin-alert-error">{erreur}</div>}
            <form onSubmit={submitPayment}>
              <PaymentInstructions
                amount={livre.prix}
              />

              <div className="admin-form-actions">
                <button type="submit" className="btn-primary" disabled={achatEnCours || Boolean(confirmation)}>
                  {achatEnCours ? "Initialisation..." : confirmation ? "Paiement initié" : "Initier le paiement"}
                </button>
                <button
                  type="button" 
                  className="btn-outline" 
                  onClick={() => { setShowPaymentModal(false); setConfirmation(""); setErreur(""); }}
                >
                  Fermer
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}